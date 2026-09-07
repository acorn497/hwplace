import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import log from 'spectra-log';
import { PrismaService } from 'src/prisma/prisma.service';

/**
 * 쿼터를 반복해서 넘기는 계정을 자동으로 제재한다.
 *
 * 쿼터만으로도 "캔버스를 순식간에 덮는" 공격은 막힌다. 다만 한도에 계속 부딪히며
 * 최대 속도로 밀어붙이는 계정은 사람이 볼 때까지 방치된다. 그런 계정을 자동으로 세운다.
 *
 * 오탐을 줄이려고 임계치는 넉넉하게 잡는다. 정상 유저는 쿼터를 한두 번 스칠 수는 있어도
 * 짧은 시간에 수십 번 연속으로 넘기지는 않는다.
 */
@Injectable()
export class AbuseDetectorService implements OnModuleDestroy {
  private readonly redis: Redis;

  /** 이 횟수만큼 쿼터를 초과하면 자동 제재 */
  private readonly strikeLimit: number;
  /** 위반 횟수를 세는 창(초) */
  private readonly strikeWindowSeconds: number;
  /** 자동 제재 기능 자체를 끄는 스위치 */
  private readonly enabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    // 환경변수는 문자열로 들어온다. get<number>() 는 변환하지 않으므로 직접 숫자로 만든다.
    this.strikeLimit = Number(this.configService.get('PAINT_ABUSE_STRIKES', 20));
    this.strikeWindowSeconds = Number(this.configService.get('PAINT_ABUSE_WINDOW_SECONDS', 300));
    this.enabled = this.configService.get<string>('PAINT_AUTO_RESTRICT', 'true') !== 'false';

    this.redis = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      username: this.configService.get<string>('REDIS_USERNAME', 'default'),
      password: this.configService.get<string>('REDIS_PASSWORD', '1234'),
      db: this.configService.get<number>('REDIS_DB', 0),
    });
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  /**
   * 쿼터 초과 1회를 기록하고, 누적이 임계치를 넘으면 계정을 제재한다.
   *
   * 제재까지 갔으면 true 를 돌려준다. 호출부는 이 값으로 응답 문구를 바꿀 수 있다.
   * 어떤 실패도 칠하기 요청 처리를 방해해서는 안 되므로 예외는 안에서 삼킨다.
   */
  async recordViolation(userIndex: number): Promise<boolean> {
    if (!this.enabled) return false;

    try {
      const key = `paint:abuse:${userIndex}`;
      const strikes = await this.redis.incr(key);

      // 첫 위반에만 만료를 건다. 이후 위반이 창을 계속 연장하면
      // 오래 전 위반이 영원히 남아 정상 유저도 결국 걸린다.
      if (strikes === 1) {
        await this.redis.expire(key, this.strikeWindowSeconds);
      }

      if (strikes < this.strikeLimit) return false;

      // 이미 제재된 계정을 또 제재하지 않는다 (로그가 중복으로 쌓인다)
      const user = await this.prisma.user.findUnique({
        where: { USER_INDEX: userIndex },
        select: { USER_RESTRICTED: true, USER_EMAIL: true },
      });

      if (!user || user.USER_RESTRICTED) return false;

      await this.prisma.user.update({
        where: { USER_INDEX: userIndex },
        data: { USER_RESTRICTED: true },
      });

      // 관리자 패널의 '기록' 탭에 그대로 보이도록 같은 테이블에 남긴다.
      // 사람이 한 일이 아니므로 admin_id 는 비운다.
      await this.prisma.admin_log.create({
        data: {
          admin_id: null,
          action: 'AUTO_RESTRICT',
          target_user: userIndex,
          detail: {
            email: user.USER_EMAIL,
            strikes,
            windowSeconds: this.strikeWindowSeconds,
            reason: '칠하기 쿼터 반복 초과',
          },
        },
      });

      log(`Auto-restricted user ${userIndex} (${user.USER_EMAIL}) after ${strikes} quota violations`, 400, 'ERROR');

      return true;
    } catch (error: any) {
      log(`Abuse detection failed: ${error.message}`, 500, 'ERROR');
      return false;
    }
  }

  /** 제재 해제 시 누적된 위반 기록도 함께 지운다 (해제 직후 다시 걸리는 것을 막는다) */
  async clearViolations(userIndex: number) {
    try {
      await this.redis.del(`paint:abuse:${userIndex}`);
    } catch (error: any) {
      log(`Failed to clear abuse strikes for ${userIndex}: ${error.message}`, 500, 'ERROR');
    }
  }
}
