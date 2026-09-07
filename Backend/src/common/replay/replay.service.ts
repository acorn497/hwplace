import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { ChunkService } from "src/util/chunk.service";
import { EncodeService } from "src/util/encode.service";

/** 리플레이 한 프레임의 픽셀 변경 하나 */
export interface ReplayEvent {
  idx: number;
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  at: Date;
  userId: number | null;
}

@Injectable()
export class ReplayService {
  /** 이벤트를 재생하며 읽는 페이지 크기 */
  private static readonly REPLAY_PAGE_SIZE = 10_000;
  /** 한 번의 스트림 요청이 돌려줄 수 있는 최대 이벤트 수 */
  public static readonly MAX_STREAM_LIMIT = 20_000;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly chunkService: ChunkService,
    private readonly encodeService: EncodeService,
  ) { }

  /**
   * 리플레이가 다룰 수 있는 전체 기간.
   * 이벤트가 하나도 없으면 null 이다.
   */
  public async getTimeline() {
    const [first, last, total] = await Promise.all([
      this.prismaService.canvas_events.findFirst({
        select: { created_at: true },
        orderBy: { event_idx: 'asc' },
      }),
      this.prismaService.canvas_events.findFirst({
        select: { created_at: true, event_idx: true },
        orderBy: { event_idx: 'desc' },
      }),
      this.prismaService.canvas_events.count(),
    ]);

    if (!first || !last) return null;

    const keyframes = await this.prismaService.snapshot_versions.findMany({
      select: { version_idx: true, created_at: true },
      where: { completed: true },
      orderBy: { created_at: 'asc' },
    });

    return {
      start: first.created_at,
      end: last.created_at,
      totalEvents: total,
      lastEventIdx: last.event_idx,
      canvasWidth: this.chunkService.canvasWidth,
      canvasHeight: this.chunkService.canvasHeight,
      // 프론트가 탐색 시 어디로 점프하면 싼지 알 수 있도록 키프레임 시점을 함께 준다
      keyframes: keyframes.map(k => ({ version: k.version_idx, at: k.created_at })),
    };
  }

  /**
   * 타임라인을 일정 간격(bucket)으로 잘라 구간별 이벤트 수를 센다.
   *
   * 실시간 모드는 "실제로 흐른 시간"을 따라가므로, 아무도 그리지 않은 구간에서는
   * 화면이 그대로 멈춘다. 프론트가 그 빈 구간을 건너뛰거나 색으로 표시하려면
   * 어디에 활동이 몰려 있는지 알아야 한다.
   *
   * 수백만 행을 그대로 내려보내는 대신 DB에서 집계해 버킷 배열만 돌려준다.
   */
  public async getActivity(bucketCount = 240) {
    const range = await Promise.all([
      this.prismaService.canvas_events.findFirst({
        select: { created_at: true }, orderBy: { event_idx: 'asc' },
      }),
      this.prismaService.canvas_events.findFirst({
        select: { created_at: true }, orderBy: { event_idx: 'desc' },
      }),
    ]);
    const [first, last] = range;
    if (!first || !last) return null;

    const start = first.created_at.getTime();
    const end = last.created_at.getTime();
    // 전 구간이 한 시점에 몰려 있으면 1ms 폭이라도 줘서 0으로 나누지 않게 한다
    const span = Math.max(end - start, 1);
    const buckets = Math.max(1, Math.min(bucketCount, 1_000));
    const bucketMs = Math.max(1, Math.ceil(span / buckets));

    /*
      created_at 을 버킷 인덱스로 바꿔 GROUP BY 한다.

      UNIX_TIMESTAMP()는 세션 타임존 해석이 끼어들고 DATETIME의 소수점 이하를 버린다.
      Prisma가 저장한 값과 어긋나지 않도록 기준 시각과의 '차이'를 마이크로초로 직접 구한다.
      (TIMESTAMPDIFF는 두 DATETIME의 차이라 타임존과 무관하다)
    */
    const startAt = new Date(start);
    const rows = await this.prismaService.$queryRaw<Array<{ bucket: bigint | number; count: bigint | number }>>`
      SELECT
        FLOOR(TIMESTAMPDIFF(MICROSECOND, ${startAt}, created_at) / 1000 / ${bucketMs}) AS bucket,
        COUNT(*) AS count
      FROM canvas_events
      GROUP BY bucket
      ORDER BY bucket ASC
    `;

    const counts = new Array<number>(buckets).fill(0);
    for (const row of rows) {
      const index = Number(row.bucket);
      if (index >= 0 && index < buckets) counts[index] = Number(row.count);
    }

    return { start, end, bucketMs, counts };
  }

  /**
   * 지정 시점 이전의 가장 최근 완료 키프레임을 찾는다.
   * 없으면 null (=빈 캔버스에서 출발해야 한다).
   */
  private async findKeyframeBefore(at: Date) {
    return this.prismaService.snapshot_versions.findFirst({
      select: { version_idx: true, created_at: true },
      where: { completed: true, created_at: { lte: at } },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * 키프레임의 청크들을 하나의 캔버스 버퍼(픽셀당 3바이트, 캔버스 기준 row-major)로 펼친다.
   * 키프레임이 없으면 흰 캔버스를 만든다.
   */
  private async buildCanvasFromKeyframe(versionIdx: number | null) {
    const { canvasWidth, canvasHeight } = this.chunkService;
    const canvas = this.encodeService.createRgbChunk(canvasWidth * canvasHeight);

    if (versionIdx === null) return canvas;

    const snapshots = await this.prismaService.canvas_snapshot.findMany({
      select: { snapshot_cx: true, snapshot_cy: true, snapshot_payload: true },
      where: { snapshot_version: versionIdx },
    });

    for (const snapshot of snapshots) {
      if (!snapshot.snapshot_payload) continue;

      const chunk = Buffer.from(snapshot.snapshot_payload);
      const chunkWidth = this.chunkService.getChunkWidth(snapshot.snapshot_cx);
      const chunkHeight = this.chunkService.getChunkHeight(snapshot.snapshot_cy);
      const originX = snapshot.snapshot_cx * this.chunkService.chunkSize;
      const originY = snapshot.snapshot_cy * this.chunkService.chunkSize;
      const rowBytes = chunkWidth * 3;

      // 청크는 청크 기준 row-major, 캔버스는 캔버스 기준 row-major 이므로 행 단위로 옮긴다
      for (let row = 0; row < chunkHeight; row++) {
        const source = row * rowBytes;
        if (source + rowBytes > chunk.length) break;

        const destination = ((originY + row) * canvasWidth + originX) * 3;
        chunk.copy(canvas, destination, source, source + rowBytes);
      }
    }

    return canvas;
  }

  /**
   * 임의 시점의 캔버스 상태를 복원한다.
   *
   * 가장 가까운 과거 키프레임에서 출발해 그 이후 ~ 지정 시점까지의 이벤트만 얹는다.
   * 덕분에 전체 기간이 아무리 길어도 재생 비용은 "키프레임 간격"에 비례한다.
   */
  public async getCanvasAt(at: Date) {
    const keyframe = await this.findKeyframeBefore(at);
    const canvas = await this.buildCanvasFromKeyframe(keyframe?.version_idx ?? null);
    const { canvasWidth, canvasHeight } = this.chunkService;

    let cursor: number | undefined;
    let applied = 0;

    for (;;) {
      const page = await this.prismaService.canvas_events.findMany({
        select: { event_idx: true, event_x: true, event_y: true, event_payload: true },
        where: {
          created_at: {
            // 키프레임 시각의 동시 이벤트는 이미 반영돼 있을 수도, 아닐 수도 있다.
            // 다시 얹어도 같은 값이거나 더 최신이므로 gte 로 포함시키는 쪽이 안전하다.
            ...(keyframe ? { gte: keyframe.created_at } : {}),
            lte: at,
          },
        },
        orderBy: { event_idx: 'asc' },
        take: ReplayService.REPLAY_PAGE_SIZE,
        ...(cursor === undefined ? {} : { cursor: { event_idx: cursor }, skip: 1 }),
      });

      if (page.length === 0) break;

      for (const event of page) {
        const payload = Buffer.from(event.event_payload);
        if (payload.length < 3) continue;
        if (event.event_x < 0 || event.event_y < 0) continue;
        if (event.event_x >= canvasWidth || event.event_y >= canvasHeight) continue;

        this.encodeService.writeRgbPixel(
          canvas, event.event_x, event.event_y, canvasWidth,
          { r: payload.readUInt8(0), g: payload.readUInt8(1), b: payload.readUInt8(2) },
        );
        applied++;
      }

      cursor = page[page.length - 1].event_idx;
      if (page.length < ReplayService.REPLAY_PAGE_SIZE) break;
    }

    return {
      canvas,
      width: canvasWidth,
      height: canvasHeight,
      at,
      fromKeyframe: keyframe?.version_idx ?? null,
      appliedEvents: applied,
    };
  }

  /**
   * 재생용 이벤트 스트림. 커서(event_idx) 기반이라 페이지가 밀리지 않는다.
   *
   * 프론트는 getCanvasAt 으로 시작 상태를 받은 뒤, 이걸로 이후 이벤트를 순서대로 받아
   * 한 픽셀씩 얹으며 재생한다.
   */
  public async getEventStream(options: {
    from?: Date;
    to?: Date;
    afterIdx?: number;
    limit?: number;
  }): Promise<{ events: ReplayEvent[]; nextCursor: number | null; hasMore: boolean }> {
    const limit = Math.min(
      Math.max(options.limit ?? 5_000, 1),
      ReplayService.MAX_STREAM_LIMIT,
    );

    const createdAt: { gte?: Date; lte?: Date } = {};
    if (options.from) createdAt.gte = options.from;
    if (options.to) createdAt.lte = options.to;

    const rows = await this.prismaService.canvas_events.findMany({
      select: {
        event_idx: true, event_x: true, event_y: true,
        event_payload: true, created_at: true, userId: true,
      },
      where: {
        ...(options.afterIdx === undefined ? {} : { event_idx: { gt: options.afterIdx } }),
        ...(Object.keys(createdAt).length ? { created_at: createdAt } : {}),
      },
      orderBy: { event_idx: 'asc' },
      // 다음 페이지 존재 여부를 알기 위해 한 건 더 읽는다
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    const events: ReplayEvent[] = [];
    for (const row of page) {
      const payload = Buffer.from(row.event_payload);
      if (payload.length < 3) continue;

      events.push({
        idx: row.event_idx,
        x: row.event_x,
        y: row.event_y,
        r: payload.readUInt8(0),
        g: payload.readUInt8(1),
        b: payload.readUInt8(2),
        at: row.created_at,
        userId: row.userId,
      });
    }

    return {
      events,
      nextCursor: page.length ? page[page.length - 1].event_idx : null,
      hasMore,
    };
  }
}
