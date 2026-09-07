import { BadRequestException, Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ReplayService } from './replay.service';
import { ReplayCanvasQuery, ReplayStreamQuery } from './dto/replay.dto';

@Controller('replay')
export class ReplayController {
  constructor(
    private readonly replayService: ReplayService,
  ) { }

  /** 리플레이 가능한 전체 기간과 키프레임 목록 */
  @Get('/timeline')
  async getTimeline() {
    const timeline = await this.replayService.getTimeline();

    if (!timeline) {
      return { available: false, message: '리플레이할 이벤트가 아직 없습니다.' };
    }

    return { available: true, ...timeline };
  }

  /**
   * 구간별 활동량(픽셀 변경 수).
   * 실시간 재생에서 "비어 있는 시간대"를 건너뛰거나 색으로 표시하는 데 쓴다.
   */
  @Get('/activity')
  async getActivity(@Query('buckets') buckets?: string) {
    const parsed = Number(buckets);
    const activity = await this.replayService.getActivity(
      Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined,
    );

    if (!activity) return { available: false };
    return { available: true, ...activity };
  }

  /**
   * 특정 시점의 캔버스 상태를 원본 RGB 버퍼로 내려준다.
   * 3MB짜리 픽셀 배열을 JSON으로 부풀리지 않기 위해 바이너리로 보낸다.
   */
  @Get('/canvas')
  async getCanvasAt(@Query() query: ReplayCanvasQuery, @Res() response: Response) {
    const at = new Date(query.at);

    if (Number.isNaN(at.getTime())) {
      throw new BadRequestException('at 은 유효한 ISO 8601 시각이어야 합니다.');
    }

    const result = await this.replayService.getCanvasAt(at);

    response.setHeader('Content-Type', 'application/octet-stream');
    response.setHeader('X-Canvas-Width', String(result.width));
    response.setHeader('X-Canvas-Height', String(result.height));
    response.setHeader('X-Applied-Events', String(result.appliedEvents));
    response.setHeader('X-From-Keyframe', String(result.fromKeyframe ?? 'none'));
    // 과거 시점의 캔버스는 불변이므로 마음껏 캐시해도 된다
    response.setHeader('Cache-Control', 'public, max-age=3600');
    response.send(result.canvas);
  }

  /** 재생용 이벤트 스트림 (커서 기반) */
  @Get('/events')
  async getEvents(@Query() query: ReplayStreamQuery) {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;

    if (from && Number.isNaN(from.getTime())) {
      throw new BadRequestException('from 은 유효한 ISO 8601 시각이어야 합니다.');
    }
    if (to && Number.isNaN(to.getTime())) {
      throw new BadRequestException('to 는 유효한 ISO 8601 시각이어야 합니다.');
    }

    return this.replayService.getEventStream({
      from,
      to,
      afterIdx: query.after,
      limit: query.limit,
    });
  }
}
