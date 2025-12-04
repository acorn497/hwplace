import { Body, Controller, Get, ParseArrayPipe, Post, Request, UseGuards } from '@nestjs/common';
import { PaintService } from './paint.service';
import { PaintPixelDTO, PaintPixelsDTO } from './dtos/paint.dto';
import { JobsOptions, Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '../auth/guard/jwt.guard';
import { JobType, JobWithUserType } from './job.interface';

@Controller('paint')
export class PaintController {
  constructor(
    private readonly paintService: PaintService,
    private readonly configService: ConfigService,

    @InjectQueue('paint-pixel')
    private readonly paintPixelQueue: Queue,
  ) { };

  @UseGuards(AuthGuard)
  @Post()
  async paintPixel(@Body(new ParseArrayPipe({ items: PaintPixelDTO })) body: PaintPixelDTO[], @Request() request) {
    const BATCH_SIZE = this.configService.get<number>("WORKER_BATCH_SIZE") ?? 100;
    const userIdx = request.user.index

    const pixelsWithUser: JobWithUserType[] = body.map(pixel => ({ ...pixel, userIndex: userIdx }));

    const jobs: JobType[] = [];

    for (let i = 0; i < pixelsWithUser.length; i += BATCH_SIZE) {
      jobs.push({
        name: 'paint pixel', data: {pixels: pixelsWithUser.slice(i, i + BATCH_SIZE)}, opts:
          { priority: 1, attempts: 3, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: true, removeOnFail: false }
      })
    }
    await this.paintPixelQueue.addBulk(jobs);

    return { success: true, batches: Math.ceil(pixelsWithUser.length / BATCH_SIZE) }
  }

  @Get()
  async getPixel() {
    return this.paintService.getPixel();
  }
}
