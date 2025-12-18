import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import DB from "src/util/db.util";
import { PaintPixelDTO } from "../dtos/paint.dto";
import { WebsocketGateway } from "../websocket/websocket.gateway";
import { randomUUID } from "crypto";
import log from "spectra-log";
import { ConfigService } from "@nestjs/config";

@Processor('paint-pixel')
export class PaintPixelProcess extends WorkerHost {
  private WORKER_MAX_RETRY: number;

  constructor(
    private readonly wsGateway: WebsocketGateway,
    private readonly configService: ConfigService,
  ) {
    super();
    this.WORKER_MAX_RETRY = this.configService.get<number>("WORKER_MAX_RETRY") ?? 3;
  }

  async process(job: Job): Promise<any> {
    let success = false;
    let retries = 0;

    while (retries <= this.WORKER_MAX_RETRY && !success) {
      try {
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const values = job.data.pixels
          .map(p => `(${p.posX},${p.posY},${p.colorR},${p.colorG},${p.colorB},'${randomUUID()}', ${p.userIndex}, '${now}')`)
          .join(', ');

        await DB.$executeRawUnsafe(`
          INSERT INTO pixel (PIXEL_POS_X, PIXEL_POS_Y, PIXEL_COLOR_R, PIXEL_COLOR_G, PIXEL_COLOR_B, PIXEL_UUID, PIXEL_PAINTED_BY, PIXEL_PAINTED_AT)
          VALUES ${values}
          ON DUPLICATE KEY UPDATE
            PIXEL_COLOR_R = VALUES(PIXEL_COLOR_R),
            PIXEL_COLOR_G = VALUES(PIXEL_COLOR_G),
            PIXEL_COLOR_B = VALUES(PIXEL_COLOR_B),
            PIXEL_UUID = VALUES(PIXEL_UUID),
            PIXEL_PAINTED_BY = VALUES(PIXEL_PAINTED_BY),
            PIXEL_PAINTED_AT = VALUES(PIXEL_PAINTED_AT)
            `);

        this.broadcast(job.data.pixels);
        log(`${job.data.pixels.length} pixels OK`, 200);
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

        log(`FAILED after ${retries} retries. Restoring ${job.data.pixels.length} pixels\nStack: ${err.message}`, 500, 'ERROR');
        success = true;
      }
      return { buffered: job.data.pixels.length };
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