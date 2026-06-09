import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import log from "spectra-log";
import { PrismaService } from "src/prisma/prisma.service";
import { ChunkService } from "src/util/chunk.service";
import { EncodeService } from "src/util/encode.service";

interface CachePixel {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
}

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  isReady: boolean = false;
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
  };

  async onModuleInit() {
    await this.loadSnapshot();
    await this.loadChanges();
    this.isReady = true;
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  private getChunkKey(cx: number, cy: number) {
    return `${cx},${cy}`;
  }

  private normalizeChunkPayload(payload: Buffer | Uint8Array | null | undefined, cx: number, cy: number) {
    if (payload) return Buffer.from(payload);

    return this.encodeService.createRgbChunk(
      this.chunkService.getChunkPixelCount(cx, cy),
    );
  }

  private async getChunkBuffer(cx: number, cy: number) {
    const cachedChunk = await this.redis.getBuffer(this.getChunkKey(cx, cy));

    return this.normalizeChunkPayload(cachedChunk, cx, cy);
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
   * 스냅샷 불러오는 헬퍼 함수,
   * 특정 시간을 기점으로 이후 생성된 변경사항을 모두 종합해 청크 단위로 변경된 픽셀 좌표 반환
   */
  /**
   * 
   */
  public async loadSnapshot() {
    const latestVersion = await this.getLatestCompletedSnapshotVersion();

    for (let i = 0; i < this.chunkService.chunkCountX; i++) {
      for (let j = 0; j < this.chunkService.chunkCountY; j++) {
        const payload = latestVersion ? await this.prismaService.canvas_snapshot.findFirst({
          select: {
            snapshot_payload: true,
          },
          where: {
            snapshot_cx: i,
            snapshot_cy: j,
            snapshot_version: latestVersion.version_idx,
          },
          orderBy: [
            { created_at: 'desc' },
            { snapshot_idx: 'desc' },
          ]
        }) : null;

        await this.redis.set(
          this.getChunkKey(i, j),
          this.normalizeChunkPayload(payload?.snapshot_payload, i, j),
        );
      }
    }
  }

  public async loadChanges() {
    const latestVersion = await this.getLatestCompletedSnapshotVersion();

    if (!latestVersion) {
      log('Skipped load changes. [there is no latest version. it means canvas is empty.]')
      return 0;
    }

    const changes = await this.prismaService.canvas_events.findMany({
      select: {
        event_payload: true,
        event_x: true,
        event_y: true,
      },
      where: {
        created_at: { gte: latestVersion.created_at },
      },
      distinct: ["event_x", "event_y"],
      orderBy: {
        created_at: 'desc'
      }
    });

    if (changes.length === 0) {
      log('Skipping apply change since snapshot. there is no change from snapshot.')
      return 0
    }

    await this.applyPixels(changes.map(change => ({
      x: change.event_x,
      y: change.event_y,
      r: Buffer.from(change.event_payload).readUInt8(0),
      g: Buffer.from(change.event_payload).readUInt8(1),
      b: Buffer.from(change.event_payload).readUInt8(2),
    })));

    return changes.length;
  }

  // 로드 하는 동안 청크 로드 요청을 보내면 일단 대기 시켜야 함
  public async loadChunk() {
    const chunks: Map<string, Buffer> = new Map()
    for (let i = 0; i < this.chunkService.chunkCountX; i++) {
      for (let j = 0; j < this.chunkService.chunkCountY; j++) {
        const chunk = await this.redis.getBuffer(this.getChunkKey(i, j));
        if (!chunk) continue;
        chunks.set(this.getChunkKey(i, j), Buffer.from(chunk));
      }
    }
    return chunks;
  }

  public async getChunkPixels(cx: number, cy: number) {
    const chunk = await this.getChunkBuffer(cx, cy);
    const chunkWidth = this.chunkService.getChunkWidth(cx);
    const chunkHeight = this.chunkService.getChunkHeight(cy);
    const pixels: Array<{
      posX: number;
      posY: number;
      colorR: number;
      colorG: number;
      colorB: number;
    }> = [];

    for (let y = 0; y < chunkHeight; y++) {
      for (let x = 0; x < chunkWidth; x++) {
        const color = this.encodeService.readRgbPixel(chunk, x, y, chunkWidth);
        if (color.r === 255 && color.g === 255 && color.b === 255) continue;

        pixels.push({
          posX: cx * this.chunkService.chunkSize + x,
          posY: cy * this.chunkService.chunkSize + y,
          colorR: color.r,
          colorG: color.g,
          colorB: color.b,
        });
      }
    }

    return pixels;
  }

  public async applyPixel(pixel: CachePixel) {
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

    await Promise.all(
      [...chunks.entries()].map(([chunkKey, chunk]) => this.redis.set(chunkKey, chunk)),
    );
  }

  // 일정 주기로 Cron 돌려서 DB와 동기화 하는 함수

  // 변경된 픽셀은 바로 캐시에 반영
}
