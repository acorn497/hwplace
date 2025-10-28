import { Body, Controller, Get, ParseArrayPipe, Post } from '@nestjs/common';
import { PaintService } from './paint.service';
import { PaintPixelDTO, PaintPixelsDTO } from './dtos/paint.dto';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';

@Controller('paint')
export class PaintController {
  constructor(
    private readonly paintService: PaintService,
    private readonly configService: ConfigService,

    @InjectQueue('paint-pixel')
    private readonly paintPixelQueue: Queue,
  ) { };

  @Post()
  async paintPixel(@Body(new ParseArrayPipe({ items: PaintPixelDTO })) body: PaintPixelDTO[]) {
    const BATCH_SIZE = this.configService.get<number>("WORKER_BATCH_SIZE") ?? 20;

    for (let i = 0; i < body.length; i += BATCH_SIZE) {
      const batch = body.slice(i, i + BATCH_SIZE);

      await this.paintPixelQueue.add('paint pixel', batch, {
        priority: 1,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      })
    }
    return { success: true, batches: Math.ceil(body.length / BATCH_SIZE)}
  }

  @Get()
  async getPixel() {
    return this.paintService.getPixel();
  }
}
