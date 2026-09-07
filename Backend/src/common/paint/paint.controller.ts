import { Body, Controller, Get, ParseArrayPipe, Post, Request, UseGuards } from '@nestjs/common';
import { PaintPixelDTO, PaintPixelsDTO } from './dtos/paint.dto';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '../auth/guard/jwt.guard';
import { RestrictedGuard } from '../auth/guard/restricted.guard';
import { JobType, JobWithUserType } from './job.interface';
import { GlobalResponse } from '../global/global-response.dto';
import { ISC } from '../global/ISC';

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

  // 제재된 계정은 큐에 적재되기 전에 여기서 막힌다.
  // 워커까지 들어가면 이미 DB에 쓰인 뒤라 되돌릴 것이 늘어난다.
  @UseGuards(AuthGuard, RestrictedGuard)
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

    // 프론트는 internalStatusCode 로 성공 여부를 가린다.
    // 이 필드가 빠지면 큐 적재에 성공해도 UI가 실패로 처리하므로 반드시 담아 보낸다.
    const response: GlobalResponse = {
      title: '칠하기',
      message: `${pixelsWithUser.length}개의 픽셀을 칠했습니다.`,
      internalStatusCode: ISC.SUCCESS,
      data: {
        pixels: pixelsWithUser.length,
        batches: jobs.length,
      },
    };

    return response;
  }
}
