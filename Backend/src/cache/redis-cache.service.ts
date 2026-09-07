import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import log from "spectra-log";
import { PrismaService } from "src/prisma/prisma.service";
import { ChunkService } from "src/util/chunk.service";
import { EncodeService } from "src/util/encode.service";

/** RGB 픽셀 하나가 차지하는 바이트 수 (EncodeService와 같은 값) */
const BYTES_PER_RGB_PIXEL = 3;

interface CachePixel {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
}

/** getLatestCompletedSnapshotVersion()이 고르는 필드만 담은 형태 */
interface SnapshotVersion {
  version_idx: number;
  created_at: Date;
}

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  /** canvas_events 재생 시 한 번에 읽어오는 행 수 */
  private static readonly EVENT_REPLAY_PAGE_SIZE = 5_000;
  /** 스냅샷을 쓸 때 한 트랜잭션에 묶는 청크 수 */
  private static readonly SNAPSHOT_BATCH_SIZE = 50;

  isReady: boolean = false;
  /** 부팅 로드가 끝날 때까지 청크 요청을 대기시키기 위한 게이트 */
  private readyPromise: Promise<void>;
  private resolveReady!: () => void;
  /** 스냅샷 작업이 겹쳐 도는 것을 막는다 */
  private snapshotInProgress = false;
  private readonly redis: Redis;

  constructor(
    private readonly configService: ConfigService,
    private readonly chunkService: ChunkService,
    private readonly encodeService: EncodeService,
    private readonly prismaService: PrismaService,
  ) {
    this.redis = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      username: this.configService.get<string>('REDIS_USERNAME', 'default'),
      password: this.configService.get<string>('REDIS_PASSWORD', '1234'),
      db: this.configService.get<number>('REDIS_DB', 0),
    });

    this.readyPromise = new Promise<void>((resolve) => {
      this.resolveReady = resolve;
    });
  };

  async onModuleInit() {
    try {
      // 스냅샷 버전을 한 번만 조회해 재생 기준으로 그대로 넘긴다.
      const latestVersion = await this.loadSnapshot();
      await this.loadChanges(latestVersion);
    } finally {
      // 로드가 실패해도 게이트는 반드시 열어야 클라이언트가 무한 대기하지 않는다.
      this.isReady = true;
      this.resolveReady();
    }
  }

  /** 부팅 로드가 끝날 때까지 기다린다. 청크 전송 경로는 반드시 이걸 먼저 await 할 것. */
  public whenReady() {
    return this.readyPromise;
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  private getChunkKey(cx: number, cy: number) {
    return `${cx},${cy}`;
  }

  private normalizeChunkPayload(payload: Buffer | Uint8Array | null | undefined, cx: number, cy: number) {
    const expectedBytes = this.chunkService.getChunkPixelCount(cx, cy) * BYTES_PER_RGB_PIXEL;

    if (payload) {
      const buffer = Buffer.from(payload);

      // 저장된 청크의 크기가 지금 기대하는 크기와 다를 수 있다.
      // (캔버스 크기 설정을 바꾼 뒤 예전 스냅샷을 읽는 경우 — 특히 가장자리 청크)
      // 크기가 어긋난 버퍼를 그대로 쓰면 화면이 어긋나거나 쓰기에서 범위를 벗어난다.
      // 기대 크기에 맞춰 자르거나(넘칠 때) 흰색으로 채워 늘린다(모자랄 때).
      if (buffer.length === expectedBytes) return buffer;

      log(`Chunk (${cx},${cy}) size mismatch: ${buffer.length} != ${expectedBytes}. Resizing.`, 400, 'ERROR');

      const resized = this.encodeService.createRgbChunk(
        this.chunkService.getChunkPixelCount(cx, cy),
      );
      buffer.copy(resized, 0, 0, Math.min(buffer.length, expectedBytes));

      return resized;
    }

    return this.encodeService.createRgbChunk(
      this.chunkService.getChunkPixelCount(cx, cy),
    );
  }

  /**
   * 청크의 원본 RGB 버퍼(픽셀당 3바이트)를 그대로 반환한다.
   * 전송 계층은 이 버퍼를 그대로 실어 보내야 한다. 픽셀 객체로 풀어내지 말 것.
   */
  public async getChunkBuffer(cx: number, cy: number) {
    const cachedChunk = await this.redis.getBuffer(this.getChunkKey(cx, cy));

    return this.normalizeChunkPayload(cachedChunk, cx, cy);
  }

  /**
   * 여러 청크를 한 번의 MGET으로 읽는다.
   * 청크를 잘게 쪼갤수록 개별 조회의 왕복 비용이 지배적이 되므로, 전송 경로는 반드시 이쪽을 쓸 것.
   */
  public async getChunkBuffers(coordinates: Array<{ cx: number; cy: number }>) {
    if (coordinates.length === 0) return [];

    const keys = coordinates.map(({ cx, cy }) => this.getChunkKey(cx, cy));
    const cachedChunks = await this.redis.mgetBuffer(...keys);

    return coordinates.map(({ cx, cy }, index) =>
      this.normalizeChunkPayload(cachedChunks[index], cx, cy),
    );
  }

  private async getLatestCompletedSnapshotVersion() {
    return this.prismaService.snapshot_versions.findFirst({
      select: {
        version_idx: true,
        created_at: true,
      },
      where: {
        completed: true,
      },
      orderBy: {
        version_idx: 'desc'
      }
    });
  }

  // 서버가 처음 로드되면 DB에서 스냅샷을 불러온 후 스냅샷이 찍힌 이후의 데이터를 모두 가져오기
  /**
   * 최신 완료 스냅샷을 Redis로 복원한다.
   * 스냅샷이 없으면 전 청크를 빈 캔버스로 초기화하며, 이 경우 이후 loadChanges()가
   * canvas_events 전체를 재생해 캔버스를 복원한다.
   */
  public async loadSnapshot() {
    const latestVersion = await this.getLatestCompletedSnapshotVersion();

    // 청크마다 쿼리를 날리면 청크 수에 비례해 부팅이 느려진다. 한 번에 읽고 메모리에서 짝을 맞춘다.
    const snapshots = latestVersion
      ? await this.prismaService.canvas_snapshot.findMany({
        select: {
          snapshot_cx: true,
          snapshot_cy: true,
          snapshot_payload: true,
        },
        where: {
          snapshot_version: latestVersion.version_idx,
        },
        // 오름차순으로 읽어 같은 좌표는 뒤에 오는(=더 최신) 행이 덮어쓰게 한다
        orderBy: [
          { created_at: 'asc' },
          { snapshot_idx: 'asc' },
        ],
      })
      : [];

    const payloadByChunk = new Map<string, Buffer | Uint8Array>();
    for (const snapshot of snapshots) {
      if (!snapshot.snapshot_payload) continue;
      payloadByChunk.set(
        this.getChunkKey(snapshot.snapshot_cx, snapshot.snapshot_cy),
        snapshot.snapshot_payload,
      );
    }

    // Redis 쓰기도 파이프라인으로 묶어 왕복을 한 번으로 줄인다
    const pipeline = this.redis.pipeline();
    for (let cx = 0; cx < this.chunkService.chunkCountX; cx++) {
      for (let cy = 0; cy < this.chunkService.chunkCountY; cy++) {
        const key = this.getChunkKey(cx, cy);
        pipeline.set(key, this.normalizeChunkPayload(payloadByChunk.get(key), cx, cy));
      }
    }
    await pipeline.exec();

    log(latestVersion
      ? `Loaded snapshot version ${latestVersion.version_idx} (${payloadByChunk.size} chunks)`
      : 'No completed snapshot found. Starting from a blank canvas.');

    return latestVersion;
  }

  /**
   * 스냅샷 이후에 쌓인 canvas_events를 재생해 Redis 캔버스를 최신 상태로 만든다.
   * 스냅샷이 아직 한 번도 찍히지 않았다면 이벤트 전체가 재생 대상이다.
   * (예전에는 여기서 곧바로 return 해버려 재시작마다 캔버스가 백지가 됐다.)
   */
  public async loadChanges(latestVersion?: SnapshotVersion | null) {
    const version = latestVersion === undefined
      ? await this.getLatestCompletedSnapshotVersion()
      : latestVersion;

    // 스냅샷이 없으면 이벤트 전체가, 있으면 그 시점 이후의 이벤트만 재생 대상이다.
    const where = version
      ? { created_at: { gte: version.created_at } }
      : {};

    // 좌표별 최신 1건만 남기면 되므로, 전체 이벤트를 메모리에 올리지 않도록
    // event_idx 오름차순으로 페이지네이션하며 Map에 덮어쓴다. 뒤에 오는 행이 항상 더 최신이다.
    const latestByCoordinate = new Map<string, CachePixel>();
    let cursor: number | undefined;
    let scanned = 0;
    let outOfBounds = 0;

    for (;;) {
      const page = await this.prismaService.canvas_events.findMany({
        select: {
          event_idx: true,
          event_payload: true,
          event_x: true,
          event_y: true,
        },
        where,
        orderBy: { event_idx: 'asc' },
        take: CacheService.EVENT_REPLAY_PAGE_SIZE,
        ...(cursor === undefined ? {} : { cursor: { event_idx: cursor }, skip: 1 }),
      });

      if (page.length === 0) break;

      for (const change of page) {
        const payload = Buffer.from(change.event_payload);
        // 손상된 페이로드가 섞여 있어도 부팅 전체를 실패시키지 않는다.
        if (payload.length < 3) {
          log(`Skipping malformed event at (${change.event_x}, ${change.event_y})`, 400, 'ERROR');
          continue;
        }

        // 캔버스보다 큰 좌표의 이력이 남아 있을 수 있다(캔버스를 줄여서 재배포한 경우).
        // 그대로 쓰면 0바이트 청크 버퍼에 써서 부팅이 죽으므로 세어만 두고 건너뛴다.
        if (!this.chunkService.isInBounds(change.event_x, change.event_y)) {
          outOfBounds++;
          continue;
        }

        latestByCoordinate.set(`${change.event_x},${change.event_y}`, {
          x: change.event_x,
          y: change.event_y,
          r: payload.readUInt8(0),
          g: payload.readUInt8(1),
          b: payload.readUInt8(2),
        });
      }

      scanned += page.length;
      cursor = page[page.length - 1].event_idx;

      if (page.length < CacheService.EVENT_REPLAY_PAGE_SIZE) break;
    }

    // 조용히 버리면 캔버스가 잘려 보이는 이유를 알 수 없다. 한 줄로 분명히 남긴다.
    if (outOfBounds > 0) {
      log(`Skipped ${outOfBounds} events outside the current canvas `
        + `(${this.chunkService.canvasWidth}x${this.chunkService.canvasHeight}). `
        + `캔버스 크기 설정(CANVAS_SIZE_X/Y)이 기존 데이터보다 작은지 확인하세요.`, 400, 'ERROR');
    }

    if (latestByCoordinate.size === 0) {
      log('No canvas events to replay.');
      return 0;
    }

    await this.applyPixels([...latestByCoordinate.values()]);
    log(`Replayed ${latestByCoordinate.size} pixels from ${scanned} events.`);

    return latestByCoordinate.size;
  }

  public async applyPixel(pixel: CachePixel) {
    if (!this.chunkService.isInBounds(pixel.x, pixel.y)) return;

    const { cx, cy } = this.chunkService.getChunkCoordinate(pixel.x, pixel.y);
    const { x, y } = this.chunkService.getInChunkCoordinate(pixel.x, pixel.y);
    const chunkWidth = this.chunkService.getChunkWidth(cx);
    const chunk = await this.getChunkBuffer(cx, cy);

    this.encodeService.writeRgbPixel(chunk, x, y, chunkWidth, pixel);

    await this.redis.set(this.getChunkKey(cx, cy), chunk);
  }

  public async applyPixels(pixels: CachePixel[]) {
    const chunks = new Map<string, Buffer>();

    for (const pixel of pixels) {
      // 캔버스 밖 좌표는 쓸 청크가 없다. 한 픽셀 때문에 배치 전체를 죽이지 않는다.
      if (!this.chunkService.isInBounds(pixel.x, pixel.y)) continue;

      const { cx, cy } = this.chunkService.getChunkCoordinate(pixel.x, pixel.y);
      const { x, y } = this.chunkService.getInChunkCoordinate(pixel.x, pixel.y);
      const chunkKey = this.getChunkKey(cx, cy);
      const chunkWidth = this.chunkService.getChunkWidth(cx);
      let chunk = chunks.get(chunkKey);

      if (!chunk) {
        chunk = await this.getChunkBuffer(cx, cy);
        chunks.set(chunkKey, chunk);
      }

      this.encodeService.writeRgbPixel(chunk, x, y, chunkWidth, pixel);
    }

    // 청크마다 SET을 따로 보내면 왕복이 청크 수만큼 늘어난다. 파이프라인으로 한 번에 묶는다.
    const pipeline = this.redis.pipeline();
    for (const [chunkKey, chunk] of chunks) {
      pipeline.set(chunkKey, chunk);
    }
    await pipeline.exec();
  }

  /**
   * 현재 Redis 캔버스 전체를 새 스냅샷 버전(=리플레이 키프레임)으로 DB에 굳힌다.
   *
   * 두 가지 용도를 겸한다.
   *  1) 재시작 복구: 이 시점부터 이벤트를 재생하면 되므로 부팅이 빨라진다.
   *  2) 리플레이 탐색: 임의 시점으로 점프할 때 가장 가까운 과거 키프레임에서 출발한다.
   *
   * 순서가 중요하다. 먼저 completed=false 로 버전을 만들고, 모든 청크를 다 쓴 뒤에야
   * completed=true 로 뒤집는다. 도중에 죽으면 그 버전은 미완성으로 남고
   * getLatestCompletedSnapshotVersion()이 무시하므로, 직전 스냅샷 + 이벤트 재생으로
   * 여전히 온전히 복구된다.
   *
   * created_at은 버전을 만든 시점(=스냅샷이 담고 있는 상태의 하한)이어야 한다.
   * 스냅샷을 쓰는 동안 들어온 픽셀은 created_at 이후 이벤트로 남아 재생되므로 유실되지 않는다.
   */
  public async createSnapshot() {
    if (this.snapshotInProgress) {
      log('Snapshot already in progress, skipping this run.', 400, 'INFO');
      return null;
    }

    this.snapshotInProgress = true;
    const startedAt = Date.now();

    try {
      const version = await this.prismaService.snapshot_versions.create({
        data: { completed: false },
        select: { version_idx: true, created_at: true },
      });

      const coordinates: Array<{ cx: number; cy: number }> = [];
      for (let cx = 0; cx < this.chunkService.chunkCountX; cx++) {
        for (let cy = 0; cy < this.chunkService.chunkCountY; cy++) {
          coordinates.push({ cx, cy });
        }
      }

      for (let i = 0; i < coordinates.length; i += CacheService.SNAPSHOT_BATCH_SIZE) {
        const batch = coordinates.slice(i, i + CacheService.SNAPSHOT_BATCH_SIZE);
        const buffers = await this.getChunkBuffers(batch);

        await this.prismaService.canvas_snapshot.createMany({
          data: batch.map(({ cx, cy }, index) => ({
            snapshot_cx: cx,
            snapshot_cy: cy,
            snapshot_size: this.chunkService.getChunkPixelCount(cx, cy),
            snapshot_version: version.version_idx,
            snapshot_payload: buffers[index],
          })),
        });
      }

      await this.prismaService.snapshot_versions.update({
        where: { version_idx: version.version_idx },
        data: { completed: true },
      });

      log(`Snapshot version ${version.version_idx} written (${coordinates.length} chunks, ${Date.now() - startedAt}ms)`, 200);

      // 과거 버전과 이벤트는 정리하지 않는다. 전체 기간 리플레이의 원본이기 때문이다.
      return version;
    } catch (error: any) {
      // 미완성 버전은 completed=false 로 남아 무시되므로, 실패해도 복구 경로는 안전하다.
      log(`Snapshot failed: ${error.message}`, 500, 'ERROR');
      return null;
    } finally {
      this.snapshotInProgress = false;
    }
  }

}
