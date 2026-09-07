import { Body, Controller, ForbiddenException, Get, HttpException, HttpStatus, ParseArrayPipe, Post, Request, UseGuards } from '@nestjs/common';
import { PaintPixelDTO, PaintPixelsDTO } from './dtos/paint.dto';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '../auth/guard/jwt.guard';
import { RestrictedGuard } from '../auth/guard/restricted.guard';
import { JobType, JobWithUserType } from './job.interface';
import { GlobalResponse } from '../global/global-response.dto';
import { ISC } from '../global/ISC';
import { PaintQuotaService } from './quota/paint-quota.service';
import { AbuseDetectorService } from './quota/abuse-detector.service';

@Controller('paint')
export class PaintController {
  private BATCH_SIZE: number;
  /**
   * 한 요청에 담을 수 있는 픽셀 수의 상한.
   *
   * 쿼터(10분당 N픽셀)만 있고 이 상한이 없으면 요청 하나가 창 전체를 한 번에 삼킬 수 있고,
   * 검증/직렬화 비용도 요청 하나에 몰린다. 쿼터를 넘는 요청은 어차피 거절되므로
   * 쿼터 한도를 그대로 요청 상한으로 쓴다.
   */
  private readonly MAX_PIXELS_PER_REQUEST: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly quotaService: PaintQuotaService,
    private readonly abuseDetector: AbuseDetectorService,

    @InjectQueue('paint-pixel')
    private readonly paintPixelQueue: Queue,
  ) {
    this.BATCH_SIZE = parseInt(this.configService.get('WORKER_BATCH_SIZE') ?? '500')
    this.MAX_PIXELS_PER_REQUEST = this.quotaService.limit;
  };

  /** 현재 남은 칠하기 쿼터 (프론트가 잔여량을 표시하는 데 쓴다) */
  @UseGuards(AuthGuard)
  @Get('/quota')
  async getQuota(@Request() request) {
    const quota = await this.quotaService.peek(request.user.index);

    const response: GlobalResponse = {
      title: '칠하기 쿼터',
      internalStatusCode: ISC.SUCCESS,
      data: {
        limit: quota.limit,
        remaining: quota.remaining,
        used: quota.used,
        resetAfter: quota.resetAfter,
        windowSeconds: this.quotaService.windowSeconds,
      },
    };

    return response;
  }

  // 제재된 계정은 큐에 적재되기 전에 여기서 막힌다.
  // 워커까지 들어가면 이미 DB에 쓰인 뒤라 되돌릴 것이 늘어난다.
  @UseGuards(AuthGuard, RestrictedGuard)
  @Post()
  async paintPixel(@Body(new ParseArrayPipe({ items: PaintPixelDTO })) body: PaintPixelDTO[], @Request() request) {
    const userIdx = request.user.index

    // 1) 요청 크기부터 본다. 쿼터 조회(Redis 왕복)보다 먼저 걸러 비용을 아낀다.
    if (body.length > this.MAX_PIXELS_PER_REQUEST) {
      throw new HttpException({
        title: '칠하기',
        message: `한 번에 최대 ${this.MAX_PIXELS_PER_REQUEST.toLocaleString()}개까지 칠할 수 있습니다.`,
        internalStatusCode: ISC.PIXEL.TOO_MANY_PIXELS,
        data: { limit: this.MAX_PIXELS_PER_REQUEST, requested: body.length },
      } satisfies GlobalResponse, HttpStatus.PAYLOAD_TOO_LARGE);
    }

    // 2) 쿼터를 소비한다. 한도를 넘으면 한 픽셀도 소비하지 않고 거절된다.
    const quota = await this.quotaService.consume(userIdx, body.length);

    if (!quota.allowed) {
      // 반복 위반은 누적해 두고, 임계치를 넘으면 계정을 자동으로 세운다.
      const restricted = await this.abuseDetector.recordViolation(userIdx);

      throw new HttpException({
        title: '칠하기',
        message: restricted
          ? '과도한 요청으로 계정이 제한되었습니다. 관리자에게 문의해 주세요.'
          : `칠하기 한도를 초과했습니다. ${quota.resetAfter}초 후에 다시 시도해 주세요.`,
        internalStatusCode: restricted
          ? ISC.AUTH.AUTO_RESTRICTED
          : ISC.PIXEL.QUOTA_EXCEEDED,
        data: {
          limit: quota.limit,
          remaining: quota.remaining,
          used: quota.used,
          resetAfter: quota.resetAfter,
        },
      } satisfies GlobalResponse, HttpStatus.TOO_MANY_REQUESTS);
    }

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
        // 프론트가 남은 쿼터를 곧바로 갱신할 수 있게 함께 내려준다
        quota: {
          limit: quota.limit,
          remaining: quota.remaining,
          used: quota.used,
          resetAfter: quota.resetAfter,
        },
      },
    };

    return response;
  }
}
