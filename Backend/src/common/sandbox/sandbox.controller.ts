import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  ParseArrayPipe,
  Post,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { SandboxService } from './sandbox.service';
import { SandboxPixelDTO } from './dto/sandbox.dto';
import { SandboxGuard } from '../auth/guard/sandbox.guard';
import { GlobalResponse } from '../global/global-response.dto';
import { ISC } from '../global/ISC';
import { WebsocketGateway } from '../paint/websocket/websocket.gateway';

@Controller('sandbox')
export class SandboxController {
  /**
   * 샌드박스도 요청 하나의 크기는 제한한다.
   * '무제한'은 총량 얘기지, 요청 하나로 서버 메모리를 통째로 잡으라는 뜻이 아니다.
   * 본문 크기 제한(BODY_SIZE_LIMIT)과 함께 파싱 비용을 묶어둔다.
   */
  private readonly MAX_PIXELS_PER_REQUEST: number;

  constructor(
    private readonly sandboxService: SandboxService,
    private readonly configService: ConfigService,
    private readonly wsGateway: WebsocketGateway,
  ) {
    this.MAX_PIXELS_PER_REQUEST = Number(
      this.configService.get('SANDBOX_MAX_PIXELS_PER_REQUEST', 50_000),
    );
  }

  /** 샌드박스 캔버스 정보 (크기, 다음 초기화까지 남은 시간) */
  @Get('/info')
  async getInfo() {
    const response: GlobalResponse = {
      title: '샌드박스',
      internalStatusCode: ISC.SUCCESS,
      data: {
        width: this.sandboxService.width,
        height: this.sandboxService.height,
        resetMinutes: this.sandboxService.resetMinutes,
        resetAfter: await this.sandboxService.getSecondsUntilReset(),
        maxPixelsPerRequest: this.MAX_PIXELS_PER_REQUEST,
        // 프론트가 배치를 하드코딩하지 않도록 서버가 간격을 알려준다
        gap: this.sandboxService.gap,
      },
    };

    return response;
  }

  /**
   * 캔버스 전체를 원본 RGB 버퍼로 내려준다.
   * 512x512x3 = 768KB. JSON으로 부풀리지 않는다.
   */
  @Get('/canvas')
  async getCanvas(@Res() response: Response) {
    const canvas = await this.sandboxService.getCanvas();

    response.setHeader('Content-Type', 'application/octet-stream');
    response.setHeader('X-Sandbox-Width', String(this.sandboxService.width));
    response.setHeader('X-Sandbox-Height', String(this.sandboxService.height));
    // 매 순간 바뀌는 화면이라 캐시하면 안 된다
    response.setHeader('Cache-Control', 'no-store');
    response.send(canvas);
  }

  /*
    샌드박스는 봇을 위한 공간이므로 IP 요청 수 제한(전역 ThrottlerGuard)에서 뺀다.
    이 구역을 만든 이유 자체가 "마음껏 두드릴 곳"을 주기 위해서다.
    대신 요청당 픽셀 수 상한과 본문 크기 제한은 그대로 적용된다.
  */
  @SkipThrottle()
  @UseGuards(SandboxGuard)
  @HttpCode(200)
  @Post('/paint')
  async paint(
    @Body(new ParseArrayPipe({ items: SandboxPixelDTO })) body: SandboxPixelDTO[],
    @Request() request,
  ) {
    // 제재된 계정은 샌드박스에서도 칠할 수 없다 (API 토큰 경로는 resolve 에서 이미 걸러진다)
    if (request.user.restricted) {
      throw new HttpException({
        title: '샌드박스',
        message: '제재된 계정은 픽셀을 칠할 수 없습니다.',
        internalStatusCode: ISC.AUTH.RESTRICTED,
      } satisfies GlobalResponse, HttpStatus.FORBIDDEN);
    }

    if (body.length > this.MAX_PIXELS_PER_REQUEST) {
      throw new HttpException({
        title: '샌드박스',
        message: `한 번에 최대 ${this.MAX_PIXELS_PER_REQUEST.toLocaleString()}개까지 칠할 수 있습니다.`,
        internalStatusCode: ISC.PIXEL.TOO_MANY_PIXELS,
        data: { limit: this.MAX_PIXELS_PER_REQUEST, requested: body.length },
      } satisfies GlobalResponse, HttpStatus.PAYLOAD_TOO_LARGE);
    }

    const applied = await this.sandboxService.applyPixels(
      body.map(pixel => ({
        x: pixel.posX,
        y: pixel.posY,
        r: pixel.colorR,
        g: pixel.colorG,
        b: pixel.colorB,
      })),
    );

    this.broadcast(body);

    const response: GlobalResponse = {
      title: '샌드박스',
      message: `${applied.toLocaleString()}개의 픽셀을 칠했습니다.`,
      internalStatusCode: ISC.SUCCESS,
      data: {
        applied,
        // 범위 밖 좌표는 조용히 버려지므로, 몇 개가 무시됐는지 알려준다
        ignored: body.length - applied,
        resetAfter: await this.sandboxService.getSecondsUntilReset(),
      },
    };

    return response;
  }

  /**
   * 본 캔버스와 다른 이벤트 이름으로 보낸다.
   * 같은 이름을 쓰면 본 캔버스를 보고 있는 클라이언트가 샌드박스 픽셀을 자기 화면에 그린다.
   */
  private broadcast(pixels: SandboxPixelDTO[]) {
    const connected = this.wsGateway.server?.sockets?.sockets?.size || 0;
    if (connected === 0) return;

    this.wsGateway.server.emit('sandbox-pixels-updated', {
      pixels: pixels.map(p => ({
        x: p.posX, y: p.posY,
        color: { r: p.colorR, g: p.colorG, b: p.colorB },
      })),
      batchSize: pixels.length,
      timestamp: new Date().toISOString(),
    });
  }
}
