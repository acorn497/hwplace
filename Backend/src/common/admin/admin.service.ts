import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import log from 'spectra-log';
import { PrismaService } from 'src/prisma/prisma.service';
import { CacheService } from 'src/cache/redis-cache.service';
import { ChunkService } from 'src/util/chunk.service';
import { EncodeService } from 'src/util/encode.service';
import { GlobalResponse } from '../global/global-response.dto';
import { ISC } from '../global/ISC';
import { WebsocketGateway } from '../paint/websocket/websocket.gateway';
import { AbuseDetectorService } from '../paint/quota/abuse-detector.service';
import {
  ChangeRoleDTO,
  ClearAreaDTO,
  ListUsersQuery,
  RestrictUserDTO,
  RollbackUserDTO,
} from './dto/admin.dto';

/** 감사 로그에 남기는 동작 종류 */
export const AdminAction = {
  BAN: 'BAN',
  UNBAN: 'UNBAN',
  ROLE_CHANGE: 'ROLE_CHANGE',
  CLEAR_AREA: 'CLEAR_AREA',
  ROLLBACK_USER: 'ROLLBACK_USER',
} as const;

/** 사람이 아니라 서버가 수행하는 동작. 로그에서 '삭제된 관리자'로 오해되면 안 된다. */
const SYSTEM_ACTIONS = new Set(['AUTO_RESTRICT']);

/** 영역 초기화의 기본 색(흰색) — 캔버스 초기 상태와 같다 */
const DEFAULT_CLEAR_COLOR = { r: 255, g: 255, b: 255 };

/**
 * 한 번에 처리하는 픽셀 수.
 * 큰 영역을 지울 때 수십만 개의 픽셀을 한 문장에 담으면 쿼리가 max_allowed_packet 을 넘고
 * 메모리도 통째로 잡는다. 잘라서 처리한다.
 */
const WRITE_BATCH_SIZE = 5_000;

/** 브로드캐스트 한 프레임에 담는 픽셀 수 (클라이언트 렌더 부담 분산) */
const BROADCAST_BATCH_SIZE = 10_000;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly chunkService: ChunkService,
    private readonly encodeService: EncodeService,
    private readonly wsGateway: WebsocketGateway,
    private readonly abuseDetector: AbuseDetectorService,
  ) { }

  /* ------------------------------------------------------------------ *
   * 유저 관리
   * ------------------------------------------------------------------ */

  async listUsers(query: ListUsersQuery) {
    const limit = query.limit ?? 25;
    const offset = query.offset ?? 0;

    const where: Prisma.userWhereInput = {};

    if (query.keyword) {
      where.OR = [
        { USER_EMAIL: { contains: query.keyword } },
        { USER_DISPLAY: { contains: query.keyword } },
      ];
    }

    if (query.restrictedOnly) {
      where.USER_RESTRICTED = true;
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          USER_INDEX: true,
          USER_DISPLAY: true,
          USER_EMAIL: true,
          USER_RESTRICTED: true,
          USER_ROLE: true,
          // USER_PAINTED 는 현재 어디서도 증가시키지 않는 죽은 카운터라 신뢰할 수 없다.
          // 실제 보유 픽셀 수는 관계 카운트로 센다.
          _count: { select: { pixels: true } },
        },
        orderBy: { USER_INDEX: 'asc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    const response: GlobalResponse = {
      title: '유저 목록',
      internalStatusCode: ISC.SUCCESS,
      data: {
        total,
        offset,
        limit,
        users: users.map(user => ({
          index: user.USER_INDEX,
          username: user.USER_DISPLAY,
          email: user.USER_EMAIL,
          restricted: user.USER_RESTRICTED,
          role: user.USER_ROLE,
          paintedPixels: user._count.pixels,
        })),
      },
    };

    return response;
  }

  async setRestricted(adminIndex: number, targetIndex: number, request: RestrictUserDTO) {
    this.assertNotSelf(adminIndex, targetIndex, '자기 자신을 제재할 수 없습니다.');

    const target = await this.findUserOrThrow(targetIndex);

    await this.prisma.user.update({
      where: { USER_INDEX: targetIndex },
      data: { USER_RESTRICTED: request.restricted },
    });

    // 제재를 풀 때 누적된 쿼터 위반 기록도 함께 지운다.
    // 남겨두면 다음 위반 한 번에 임계치를 다시 넘겨 즉시 자동 제재된다.
    if (!request.restricted) {
      await this.abuseDetector.clearViolations(targetIndex);
    }

    await this.writeLog(adminIndex, request.restricted ? AdminAction.BAN : AdminAction.UNBAN, targetIndex, {
      email: target.USER_EMAIL,
      reason: request.reason ?? null,
    });

    const response: GlobalResponse = {
      title: request.restricted ? '제재 완료' : '제재 해제',
      message: `${target.USER_DISPLAY} 님을 ${request.restricted ? '제재했습니다.' : '제재 해제했습니다.'}`,
      internalStatusCode: ISC.SUCCESS,
      data: { index: targetIndex, restricted: request.restricted },
    };

    return response;
  }

  async changeRole(adminIndex: number, targetIndex: number, request: ChangeRoleDTO) {
    // 마지막 관리자가 스스로를 강등하면 아무도 관리 기능에 접근할 수 없게 된다.
    this.assertNotSelf(adminIndex, targetIndex, '자기 자신의 권한은 변경할 수 없습니다.');

    const target = await this.findUserOrThrow(targetIndex);
    const role = request.role === 'ADMIN' ? Role.ADMIN : Role.USER;

    await this.prisma.user.update({
      where: { USER_INDEX: targetIndex },
      data: { USER_ROLE: role },
    });

    await this.writeLog(adminIndex, AdminAction.ROLE_CHANGE, targetIndex, {
      email: target.USER_EMAIL,
      from: target.USER_ROLE,
      to: role,
    });

    const response: GlobalResponse = {
      title: '권한 변경',
      message: `${target.USER_DISPLAY} 님의 권한을 ${role} 로 변경했습니다.`,
      internalStatusCode: ISC.SUCCESS,
      data: { index: targetIndex, role },
    };

    return response;
  }

  /* ------------------------------------------------------------------ *
   * 캔버스 관리
   * ------------------------------------------------------------------ */

  /**
   * 사각 영역을 한 가지 색으로 덮는다.
   *
   * 캔버스 상태는 세 곳에 있고 셋 다 갱신해야 화면과 재시작 후 상태가 어긋나지 않는다.
   *   1) pixel 테이블      — 픽셀 정보 조회(누가 칠했나)의 출처
   *   2) Redis 청크        — 접속 시 내려주는 캔버스의 출처
   *   3) canvas_events     — 리플레이의 출처. 덮어쓴 것도 '사건'이므로 append 한다.
   *
   * 3번을 지우지 않는 게 중요하다. 이력을 지우면 그 구간 리플레이가 사라진다.
   * 초기화 역시 하나의 이벤트로 쌓아 리플레이에서 "지워지는 장면"으로 재생되게 한다.
   */
  async clearArea(adminIndex: number, request: ClearAreaDTO) {
    const { x1, y1, x2, y2 } = this.normalizeArea(request);

    const color = {
      r: request.colorR ?? DEFAULT_CLEAR_COLOR.r,
      g: request.colorG ?? DEFAULT_CLEAR_COLOR.g,
      b: request.colorB ?? DEFAULT_CLEAR_COLOR.b,
    };

    const width = x2 - x1 + 1;
    const height = y2 - y1 + 1;
    const pixelCount = width * height;

    // pixel 테이블에서 지운다. 이 좌표에 칠해진 기록 자체를 없애는 것이라
    // 이후 픽셀 정보 조회는 "칠해진 적 없음"으로 나온다.
    const deleted = await this.prisma.pixel.deleteMany({
      where: {
        PIXEL_POS_X: { gte: x1, lte: x2 },
        PIXEL_POS_Y: { gte: y1, lte: y2 },
      },
    });

    // Redis 캔버스를 덮어쓴다. 좌표를 한꺼번에 만들면 큰 영역에서 메모리를 통째로 잡으므로
    // 배치 단위로 만들어 적용하고 버린다.
    const payload = this.encodeService.serializeRgbPixel(color);
    let batch: Array<{ x: number; y: number; r: number; g: number; b: number }> = [];
    let broadcastBuffer: Array<{ x: number; y: number }> = [];

    const flush = async () => {
      if (batch.length === 0) return;

      await this.cacheService.applyPixels(batch);

      // 초기화도 이력이다. 관리자 동작이므로 userId 는 비워 둔다(시스템 이벤트).
      await this.prisma.canvas_events.createMany({
        data: batch.map(pixel => ({
          userId: null,
          event_x: pixel.x,
          event_y: pixel.y,
          event_payload: payload,
        })),
      });

      batch = [];
    };

    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        batch.push({ x, y, ...color });
        broadcastBuffer.push({ x, y });

        if (batch.length >= WRITE_BATCH_SIZE) await flush();

        if (broadcastBuffer.length >= BROADCAST_BATCH_SIZE) {
          this.broadcast(broadcastBuffer, color);
          broadcastBuffer = [];
        }
      }
    }

    await flush();
    if (broadcastBuffer.length > 0) this.broadcast(broadcastBuffer, color);

    await this.writeLog(adminIndex, AdminAction.CLEAR_AREA, null, {
      area: { x1, y1, x2, y2 },
      color,
      pixels: pixelCount,
      deletedRows: deleted.count,
      reason: request.reason ?? null,
    });

    log(`Admin ${adminIndex} cleared area (${x1},${y1})-(${x2},${y2}): ${pixelCount} pixels`, 200);

    const response: GlobalResponse = {
      title: '영역 초기화',
      message: `${pixelCount.toLocaleString()}개의 픽셀을 초기화했습니다.`,
      internalStatusCode: ISC.SUCCESS,
      data: { area: { x1, y1, x2, y2 }, pixels: pixelCount, color },
    };

    return response;
  }

  /**
   * 특정 유저가 칠한 픽셀을 전부(혹은 특정 시각 이후) 되돌린다.
   *
   * "되돌린다"는 그 좌표를 흰색으로 만든다는 뜻이다. 이전에 다른 사람이 칠했던 색으로
   * 복원하려면 좌표별 직전 이벤트를 역추적해야 하는데, 그건 리플레이 전체를 재생하는
   * 것과 같은 비용이라 대량 정리 용도로는 맞지 않는다. 도배 정리가 목적이므로 흰색으로 민다.
   */
  async rollbackUser(adminIndex: number, targetIndex: number, request: RollbackUserDTO) {
    const target = await this.findUserOrThrow(targetIndex);

    let since: Date | undefined;
    if (request.since) {
      since = new Date(request.since);
      if (Number.isNaN(since.getTime())) {
        throw new BadRequestException({
          title: '롤백',
          message: 'since 는 유효한 ISO 8601 시각이어야 합니다.',
          internalStatusCode: ISC.SERVER.FOLLOW_STATUS,
        } satisfies GlobalResponse);
      }
    }

    const where: Prisma.pixelWhereInput = {
      PIXEL_PAINTED_BY: targetIndex,
      ...(since ? { PIXEL_PAINTED_AT: { gte: since } } : {}),
    };

    const color = DEFAULT_CLEAR_COLOR;
    const payload = this.encodeService.serializeRgbPixel(color);

    let rolledBack = 0;

    // 지운 뒤 다음 페이지를 읽으면 커서가 밀리므로, 항상 앞에서부터 한 배치씩 읽고 지운다.
    for (; ;) {
      const pixels = await this.prisma.pixel.findMany({
        where,
        select: { PIXEL_INDEX: true, PIXEL_POS_X: true, PIXEL_POS_Y: true },
        take: WRITE_BATCH_SIZE,
        orderBy: { PIXEL_INDEX: 'asc' },
      });

      if (pixels.length === 0) break;

      const coordinates = pixels.map(pixel => ({
        x: pixel.PIXEL_POS_X,
        y: pixel.PIXEL_POS_Y,
      }));

      await this.prisma.pixel.deleteMany({
        where: { PIXEL_INDEX: { in: pixels.map(pixel => pixel.PIXEL_INDEX) } },
      });

      await this.cacheService.applyPixels(coordinates.map(c => ({ ...c, ...color })));

      await this.prisma.canvas_events.createMany({
        data: coordinates.map(c => ({
          userId: null,
          event_x: c.x,
          event_y: c.y,
          event_payload: payload,
        })),
      });

      this.broadcast(coordinates, color);
      rolledBack += pixels.length;
    }

    await this.writeLog(adminIndex, AdminAction.ROLLBACK_USER, targetIndex, {
      email: target.USER_EMAIL,
      since: since?.toISOString() ?? null,
      pixels: rolledBack,
      reason: request.reason ?? null,
    });

    log(`Admin ${adminIndex} rolled back ${rolledBack} pixels of user ${targetIndex}`, 200);

    const response: GlobalResponse = {
      title: '픽셀 롤백',
      message: `${target.USER_DISPLAY} 님이 칠한 ${rolledBack.toLocaleString()}개의 픽셀을 되돌렸습니다.`,
      internalStatusCode: ISC.SUCCESS,
      data: { index: targetIndex, pixels: rolledBack },
    };

    return response;
  }

  /* ------------------------------------------------------------------ *
   * 감사 로그
   * ------------------------------------------------------------------ */

  async getLogs(limit = 50, offset = 0) {
    const [logs, total] = await Promise.all([
      this.prisma.admin_log.findMany({
        select: {
          log_idx: true,
          action: true,
          target_user: true,
          detail: true,
          created_at: true,
          admin: { select: { USER_INDEX: true, USER_DISPLAY: true } },
        },
        orderBy: { log_idx: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.admin_log.count(),
    ]);

    const response: GlobalResponse = {
      title: '관리 기록',
      internalStatusCode: ISC.SUCCESS,
      data: {
        total,
        logs: logs.map(entry => ({
          index: entry.log_idx,
          action: entry.action,
          // admin_id 가 비어 있는 경우는 둘이다: 시스템이 한 일(자동 제재)과
          // 관리자 계정이 지워진 경우. 앞을 '삭제된 관리자'로 보여주면 사실과 다르다.
          admin: entry.admin?.USER_DISPLAY
            ?? (SYSTEM_ACTIONS.has(entry.action) ? '시스템(자동)' : '(삭제된 관리자)'),
          targetUser: entry.target_user,
          detail: entry.detail,
          createdAt: entry.created_at,
        })),
      },
    };

    return response;
  }

  /* ------------------------------------------------------------------ *
   * 내부 헬퍼
   * ------------------------------------------------------------------ */

  /**
   * 감사 로그 한 줄을 남긴다.
   *
   * 로그 기록이 실패해도 이미 수행된 동작을 되돌릴 수는 없다.
   * 여기서 예외를 던지면 "제재는 됐는데 요청은 실패"로 보여 더 헷갈리므로,
   * 실패는 서버 로그로만 남기고 응답은 성공으로 돌려준다.
   */
  private async writeLog(
    adminIndex: number,
    action: string,
    targetIndex: number | null,
    detail: Prisma.InputJsonValue,
  ) {
    try {
      await this.prisma.admin_log.create({
        data: {
          admin_id: adminIndex,
          action,
          target_user: targetIndex,
          detail,
        },
      });
    } catch (error: any) {
      log(`관리 기록 저장 실패 (${action}): ${error.message}`, 500, 'ERROR');
    }
  }

  private async findUserOrThrow(index: number) {
    const user = await this.prisma.user.findUnique({
      where: { USER_INDEX: index },
      select: {
        USER_INDEX: true,
        USER_DISPLAY: true,
        USER_EMAIL: true,
        USER_ROLE: true,
        USER_RESTRICTED: true,
      },
    });

    if (!user) {
      throw new NotFoundException({
        title: '대상 없음',
        message: '해당 사용자를 찾을 수 없습니다.',
        internalStatusCode: ISC.ADMIN.TARGET_NOT_FOUND,
      } satisfies GlobalResponse);
    }

    return user;
  }

  private assertNotSelf(adminIndex: number, targetIndex: number, message: string) {
    if (adminIndex !== targetIndex) return;

    throw new BadRequestException({
      title: '잘못된 요청',
      message,
      internalStatusCode: ISC.ADMIN.SELF_TARGET,
    } satisfies GlobalResponse);
  }

  /** 좌표를 정렬하고 캔버스 안으로 가둔다. 범위를 완전히 벗어났으면 거부한다. */
  private normalizeArea(area: ClearAreaDTO) {
    const { canvasWidth, canvasHeight } = this.chunkService;

    const x1 = Math.min(area.x1, area.x2);
    const x2 = Math.max(area.x1, area.x2);
    const y1 = Math.min(area.y1, area.y2);
    const y2 = Math.max(area.y1, area.y2);

    if (x1 >= canvasWidth || y1 >= canvasHeight) {
      throw new BadRequestException({
        title: '잘못된 범위',
        message: `캔버스(${canvasWidth}x${canvasHeight}) 밖의 좌표입니다.`,
        internalStatusCode: ISC.ADMIN.INVALID_AREA,
      } satisfies GlobalResponse);
    }

    return {
      x1,
      y1,
      x2: Math.min(x2, canvasWidth - 1),
      y2: Math.min(y2, canvasHeight - 1),
    };
  }

  /** 칠하기와 같은 이벤트로 내보내 클라이언트가 별도 처리 없이 반영하게 한다. */
  private broadcast(coordinates: Array<{ x: number; y: number }>, color: { r: number; g: number; b: number }) {
    const connected = this.wsGateway.server?.sockets?.sockets?.size || 0;
    if (connected === 0) return;

    this.wsGateway.server.emit('batch-pixels-updated', {
      pixels: coordinates.map(c => ({ x: c.x, y: c.y, color })),
      uuid: 'admin-batch',
      timestamp: new Date().toISOString(),
      batchSize: coordinates.length,
    });
  }
}
