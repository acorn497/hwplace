import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import DB from "src/util/db.util";
import { PaintPixelDTO } from "../paint/dtos/paint.dto";
import { WebsocketGateway } from "../websocket/websocket.gateway";
import { randomUUID } from "crypto";
import log from "spectra-log";
import { ConfigService } from "@nestjs/config";

@Processor('paint-pixel', {
  concurrency: 6,
})
export class PaintPixelProcess extends WorkerHost {
  private buffer: PaintPixelDTO[] = [];
  private flushScheduled = false;
  private processing = 0;
  private WORKER_BATCH_TIMEOUT: number;
  private WORKER_MAX_CONCURRENT: number;
  private WORKER_MAX_BATCH_SIZE: number;
  private WORKER_MAX_RETRY: number;

  constructor(
    private readonly wsGateway: WebsocketGateway,
    private readonly configService: ConfigService,
  ) {
    super();
    this.WORKER_MAX_BATCH_SIZE = configService.get<number>("WORKER_MAX_BATCH_SIZE") ?? 100;
    this.WORKER_BATCH_TIMEOUT = configService.get<number>("WORKER_BATCH_TIMEOUT") ?? 10;
    this.WORKER_MAX_CONCURRENT = configService.get<number>("WORKER_MAX_CONCURRENT") ?? 6;
    this.WORKER_MAX_RETRY = configService.get<number>("WORKER_MAX_RETRY") ?? 3;

    setInterval(() => {
      if (this.buffer.length > 0 && !this.flushScheduled) {
        this.flushScheduled = true;
        setImmediate(() => this.tryFlush('timer'));
      }
    }, this.WORKER_BATCH_TIMEOUT);
  }

  async process(job: Job): Promise<any> {
    const pixels: PaintPixelDTO[] = Array.isArray(job.data) ? job.data : [job.data];
    this.buffer.push(...pixels);

    if (!this.flushScheduled && this.buffer.length >= this.WORKER_MAX_BATCH_SIZE) {
      this.flushScheduled = true;
      setImmediate(() => this.tryFlush(job.id!));
    }

    return { buffered: pixels.length };
  }

  private async tryFlush(source: string | number): Promise<void> {
    if (this.processing >= this.WORKER_MAX_CONCURRENT || this.buffer.length === 0) {
      this.flushScheduled = false;
      return;
    }

    this.processing++;
    const batch = this.buffer.splice(0, this.WORKER_MAX_BATCH_SIZE);
    let success = false;
    let retries = 0;

    while (retries <= this.WORKER_MAX_RETRY && !success) {
      try {
        const values = batch
          .map(p => `(${p.posX},${p.posY},${p.colorR},${p.colorG},${p.colorB},'${randomUUID()}')`)
          .join(', ');

        await DB.$executeRawUnsafe(`
          INSERT INTO pixel (PIXEL_POS_X, PIXEL_POS_Y, PIXEL_COLOR_R, PIXEL_COLOR_G, PIXEL_COLOR_B, PIXEL_UUID)
          VALUES ${values}
          ON DUPLICATE KEY UPDATE
            PIXEL_COLOR_R = VALUES(PIXEL_COLOR_R),
            PIXEL_COLOR_G = VALUES(PIXEL_COLOR_G),
            PIXEL_COLOR_B = VALUES(PIXEL_COLOR_B)
        `);

        this.broadcast(batch);
        log(`${batch.length} pixels OK`, 200);
        success = true;
      } catch (err: any) {
        const isDeadlock = err.code === 'P2010' && err.meta?.code === '1213';

        if (isDeadlock && retries < this.WORKER_MAX_RETRY) {
          retries++;
          const delay = 5 * retries;
          log(`Deadlock → retry ${retries}/${this.WORKER_MAX_RETRY} after ${delay}ms`, 400, 'ERROR');
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        log(`FAILED after ${retries} retries. Restoring ${batch.length} pixels`, 500, 'ERROR');
        this.buffer.unshift(...batch);
        success = true;
      }
    }

    this.processing--;
    this.flushScheduled = false;

    if (this.buffer.length >= this.WORKER_MAX_BATCH_SIZE) {
      this.flushScheduled = true;
      const nextSource = typeof source === 'string' && source === 'timer' ? 'timer' : source;
      setImmediate(() => this.tryFlush(nextSource));
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

  async onModuleDestroy() {
    while (this.buffer.length > 0) {
      await this.tryFlush('shutdown');
      await new Promise(r => setTimeout(r, 10));
    }

    while (this.processing > 0) {
      await new Promise(r => setTimeout(r, 50));
    }
  }
}