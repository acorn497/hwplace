import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { PaintPixelDTO } from "../dtos/paint.dto";
import { WebsocketGateway } from "../websocket/websocket.gateway";
import { randomUUID } from "crypto";
import log from "spectra-log";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "src/prisma/prisma.service";
import { CacheService } from "src/cache/redis-cache.service";
import { EncodeService } from "src/util/encode.service";

/** 재시도해도 회복되지 않는 실패 (예: 존재하지 않는 유저) */
export class UnrecoverablePaintError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnrecoverablePaintError';
  }
}

@Processor('paint-pixel')
export class PaintPixelProcess extends WorkerHost {
  private WORKER_MAX_RETRY: number;

  constructor(
    private readonly wsGateway: WebsocketGateway,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly encodeService: EncodeService,
  ) {
    super();
    this.WORKER_MAX_RETRY = this.configService.get<number>("WORKER_MAX_RETRY") ?? 3;
  }

  async process(job: Job): Promise<any> {
    let retries = 0;

    // 성공하면 반환, 재시도할 값이면 continue, 그 외에는 throw 해서 BullMQ에 실패를 알린다.
    for (;;) {
      try {
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const values = job.data.pixels
          .map(p => `(${p.posX},${p.posY},${p.colorR},${p.colorG},${p.colorB},'${randomUUID()}', ${p.userIndex}, '${now}')`)
          .join(', ');

        await this.prisma.$transaction([
          this.prisma.$executeRawUnsafe(`
            INSERT INTO pixel (PIXEL_POS_X, PIXEL_POS_Y, PIXEL_COLOR_R, PIXEL_COLOR_G, PIXEL_COLOR_B, PIXEL_UUID, PIXEL_PAINTED_BY, PIXEL_PAINTED_AT)
            VALUES ${values}
            ON DUPLICATE KEY UPDATE
              PIXEL_COLOR_R = VALUES(PIXEL_COLOR_R),
              PIXEL_COLOR_G = VALUES(PIXEL_COLOR_G),
              PIXEL_COLOR_B = VALUES(PIXEL_COLOR_B),
              PIXEL_UUID = VALUES(PIXEL_UUID),
              PIXEL_PAINTED_BY = VALUES(PIXEL_PAINTED_BY),
              PIXEL_PAINTED_AT = VALUES(PIXEL_PAINTED_AT)
              `),
          this.prisma.canvas_events.createMany({
            data: job.data.pixels.map(p => ({
              userId: p.userIndex,
              event_x: p.posX,
              event_y: p.posY,
              event_payload: this.encodeService.serializeRgbPixel({
                r: p.colorR,
                g: p.colorG,
                b: p.colorB,
              }),
            })),
          }),
        ]);

        await this.cacheService.applyPixels(job.data.pixels.map(p => ({
          x: p.posX,
          y: p.posY,
          r: p.colorR,
          g: p.colorG,
          b: p.colorB,
        })));

        this.broadcast(job.data.pixels);
        log(`${job.data.pixels.length} pixels OK`, 200);

        return { painted: job.data.pixels.length };
      } catch (err: any) {
        const isDeadlock = err.code === 'P2010' && err.meta?.code === '1213';

        if (isDeadlock && retries < this.WORKER_MAX_RETRY) {
          retries++;
          const delay = 5 * retries;
          log(`Deadlock → retry ${retries}/${this.WORKER_MAX_RETRY} after ${delay}ms`, 400, 'ERROR');
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        // 외래키 위반(1452)은 재시도해도 절대 낫지 않는다.
        // 토큰에 담긴 유저가 DB에 없다는 뜻이므로, 원인을 분명히 남기고 즉시 실패시킨다.
        const isMissingUser = err.meta?.code === '1452';
        if (isMissingUser) {
          const userIndexes = [...new Set(job.data.pixels.map((p: any) => p.userIndex))];
          log(`Paint failed: user ${userIndexes.join(', ')} 가 DB에 없습니다. `
            + `${job.data.pixels.length} pixels dropped.`, 500, 'ERROR');
          throw new UnrecoverablePaintError(
            `존재하지 않는 사용자(${userIndexes.join(', ')})의 픽셀 요청입니다.`,
          );
        }

        // 여기서 삼키면 큐는 성공으로 마무리되고 픽셀은 조용히 사라진다.
        // BullMQ가 재시도/실패 처리할 수 있도록 반드시 다시 던진다.
        log(`Paint failed after ${retries} retries. ${job.data.pixels.length} pixels at risk.\n`
          + `Stack: ${err.message}`, 500, 'ERROR');
        throw err;
      }
    }
  }

  private broadcast(pixels: PaintPixelDTO[]) {
    const count = this.wsGateway.server?.sockets?.sockets?.size || 0;
    if (count === 0) return;

    this.wsGateway.server.emit('batch-pixels-updated', {
      pixels: pixels.map(p => ({ x: p.posX, y: p.posY, color: { r: p.colorR, g: p.colorG, b: p.colorB } })),
      uuid: 'server-batch',
      timestamp: new Date().toISOString(),
      batchSize: pixels.length
    });
  }
}
