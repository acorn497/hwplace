import { Body, Controller, Get, ParseArrayPipe, Post, Request, UseGuards } from '@nestjs/common';
import { PaintPixelDTO, PaintPixelsDTO } from './dtos/paint.dto';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '../auth/guard/jwt.guard';
import { JobType, JobWithUserType } from './job.interface';

@Controller('paint')
export class PaintController {
  private BATCH_SIZE: number;
  constructor(
    private readonly configService: ConfigService,

    @InjectQueue('paint-pixel')
    private readonly paintPixelQueue: Queue,
  ) {
    this.BATCH_SIZE = parseInt(this.configService.get('WORKER_BATCH_SIZE') ?? '500')
  };

  @UseGuards(AuthGuard)
  @Post()
  async paintPixel(@Body(new ParseArrayPipe({ items: PaintPixelDTO })) body: PaintPixelDTO[], @Request() request) {
    const userIdx = request.user.index
    const pixelsWithUser: JobWithUserType[] = body.map(pixel => ({ ...pixel, userIndex: userIdx }));
    const jobs: JobType[] = [];

    for (let i = 0; i < pixelsWithUser.length; i += this.BATCH_SIZE) {
      jobs.push({
        name: 'paint pixel', data: { pixels: pixelsWithUser.slice(i, Math.min(i + this.BATCH_SIZE, pixelsWithUser.length)) }, opts:
          { priority: 1, attempts: 3, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: true, removeOnFail: false }
      });
    }
    await this.paintPixelQueue.addBulk(jobs);

    return { success: true, batches: Math.ceil(pixelsWithUser.length / this.BATCH_SIZE) }
  }
}
