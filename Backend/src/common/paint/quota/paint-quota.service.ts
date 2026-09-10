import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import log from 'spectra-log';

export interface QuotaResult {
  /** 이번 요청이 허용됐는지 */
  allowed: boolean;
  /** 이번 요청 이후 남은 픽셀 수 */
  remaining: number;
  /** 창 전체 한도 */
  limit: number;
  /** 한도가 다시 차오르기까지 남은 초 */
  resetAfter: number;
  /** 창 안에서 이미 사용한 픽셀 수 */
  used: number;
}

/**
 * 유저별 칠하기 쿼터.
 *
 * "최근 N분 동안 최대 M픽셀" 슬라이딩 윈도우다.
 * 고정 창(예: 매 정각 리셋)으로 하면 창 경계에서 두 배가 통과하므로 슬라이딩으로 센다.
 *
 * 상태는 Redis에 둔다. 서버가 여러 대로 늘어나도 한도가 인스턴스 수만큼 뻥튀기되지 않고,
 * 재시작해도 창이 초기화되지 않는다.
 */
@Injectable()
export class PaintQuotaService implements OnModuleDestroy {
  private readonly redis: Redis;

  /** 창 길이(초) */
  public readonly windowSeconds: number;
  /** 창 안에서 허용하는 픽셀 수 */
  public readonly limit: number;

  /** 갓 가입한 계정에 적용하는 낮은 한도 */
  public readonly newAccountLimit: number;
  /** 이 시간이 지나야 정상 한도를 받는다 */
  public readonly newAccountHours: number;

  /**
   * IP 단위 총량.
   *
   * 유저별 쿼터는 계정을 새로 만들면 초기화된다. 계정을 여러 개 찍어 우회하는 것을 막으려면
   * 계정과 무관한 축이 하나 더 필요하다. 여러 사람이 같은 공유망(학교/회사)을 쓸 수 있으므로
   * 유저 한도보다 넉넉하게 잡는다.
   */
  public readonly ipLimit: number;

  /**
   * 소비 스크립트.
   *
   * 체크와 기록을 분리하면 동시에 들어온 요청들이 모두 "아직 여유 있음"을 보고 통과한다(TOCTOU).
   * Lua로 묶어 원자적으로 처리한다.
   *
   * ZSET에 (점수=타임스탬프ms, 멤버=고유값) 으로 픽셀 사용량을 기록하되,
   * 요청 하나당 멤버 하나에 개수를 함께 담아 픽셀 수만큼 멤버를 만들지 않는다.
   * (2만 픽셀 요청 하나가 ZSET 원소 2만 개가 되면 메모리가 감당이 안 된다)
   */
  private static readonly CONSUME_SCRIPT = `
    local key = KEYS[1]
    local now = tonumber(ARGV[1])
    local windowMs = tonumber(ARGV[2])
    local limit = tonumber(ARGV[3])
    local cost = tonumber(ARGV[4])
    local member = ARGV[5]

    -- 창을 벗어난 기록은 버린다
    redis.call('ZREMRANGEBYSCORE', key, 0, now - windowMs)

    -- 남아있는 기록의 사용량 합계. 멤버는 "고유값:개수" 형태다.
    local used = 0
    local entries = redis.call('ZRANGE', key, 0, -1)
    for i = 1, #entries do
      local count = string.match(entries[i], ':(%d+)$')
      if count then used = used + tonumber(count) end
    end

    if used + cost > limit then
      -- 거절된 요청은 기록하지 않는다. 거절이 창을 채워 회복을 늦추면 안 된다.
      local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
      local resetAfter = 0
      if oldest[2] then
        resetAfter = math.ceil((tonumber(oldest[2]) + windowMs - now) / 1000)
      end
      return { 0, limit - used, used, resetAfter }
    end

    redis.call('ZADD', key, now, member .. ':' .. cost)
    -- 창 길이만큼만 살려두면 유휴 유저의 키는 알아서 사라진다
    redis.call('PEXPIRE', key, windowMs)

    return { 1, limit - used - cost, used + cost, math.ceil(windowMs / 1000) }
  `;

  constructor(
    private readonly configService: ConfigService,
  ) {
    /*
      Number() 로 한 번 감싼다.

      ConfigService.get<number>() 의 제네릭은 '타입 단언'일 뿐 변환을 하지 않는다.
      .env 파일이든 docker-compose 든 환경변수는 전부 문자열로 들어오므로,
      그대로 두면 limit 이 "20000"(문자열)이 되어 응답 JSON에 문자열로 실린다.
      비교는 강제 변환으로 우연히 동작하지만 산술(+)은 문자열 연결이 되고,
      프론트의 toLocaleString() 도 천단위 구분을 잃는다.
    */
    this.windowSeconds = Number(this.configService.get('PAINT_QUOTA_WINDOW_SECONDS', 180));
    this.limit = Number(this.configService.get('PAINT_QUOTA_PIXELS', 5_000));

    this.newAccountLimit = Number(this.configService.get('PAINT_QUOTA_NEW_ACCOUNT_PIXELS', 1_000));
    this.newAccountHours = Number(this.configService.get('PAINT_NEW_ACCOUNT_HOURS', 24));

    this.ipLimit = Number(this.configService.get('PAINT_QUOTA_IP_PIXELS', 15_000));

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

  private getKey(userIndex: number) {
    return `paint:quota:${userIndex}`;
  }

  private getIpKey(ip: string) {
    return `paint:quota:ip:${ip}`;
  }

  /**
   * 가입 시각으로 정할 이 계정의 한도.
   * 갓 만든 계정은 낮은 한도를 받으므로, 계정을 찍어내도 얻는 것이 적다.
   */
  public resolveLimit(createdAt: Date | null | undefined) {
    if (!createdAt) return this.limit;

    const ageHours = (Date.now() - createdAt.getTime()) / 3_600_000;

    return ageHours < this.newAccountHours ? this.newAccountLimit : this.limit;
  }

  /**
   * 쿼터에서 pixelCount 만큼 소비를 시도한다.
   * 한도를 넘으면 아무것도 소비하지 않고 allowed=false 를 돌려준다(전부 아니면 전무).
   *
   * limitOverride 를 주면 그 한도로 판단한다 (신규 계정의 낮은 한도).
   */
  async consume(userIndex: number, pixelCount: number, limitOverride?: number): Promise<QuotaResult> {
    return this.consumeKey(this.getKey(userIndex), pixelCount, limitOverride ?? this.limit);
  }

  /**
   * IP 단위 총량에서 소비한다.
   * 계정을 몇 개 만들든 한 IP에서 나가는 픽셀 총합이 여기서 묶인다.
   */
  async consumeIp(ip: string, pixelCount: number): Promise<QuotaResult> {
    return this.consumeKey(this.getIpKey(ip), pixelCount, this.ipLimit);
  }

  private async consumeKey(key: string, pixelCount: number, limit: number): Promise<QuotaResult> {
    const now = Date.now();
    const windowMs = this.windowSeconds * 1000;
    const member = `${now}-${Math.random().toString(36).slice(2, 10)}`;

    try {
      const [allowed, remaining, used, resetAfter] = await this.redis.eval(
        PaintQuotaService.CONSUME_SCRIPT,
        1,
        key,
        now,
        windowMs,
        limit,
        pixelCount,
        member,
      ) as [number, number, number, number];

      return {
        allowed: allowed === 1,
        remaining: Math.max(remaining, 0),
        limit,
        used,
        resetAfter: Math.max(resetAfter, 0),
      };
    } catch (error: any) {
      // Redis가 죽었다고 캔버스를 못 쓰게 만들 수는 없다.
      // 다만 이 상태에서는 쿼터가 사실상 없는 것이므로 반드시 눈에 띄게 남긴다.
      log(`Paint quota check failed (fail-open): ${error.message}`, 500, 'ERROR');

      return {
        allowed: true,
        remaining: limit,
        limit,
        used: 0,
        resetAfter: 0,
      };
    }
  }

  /** 소비하지 않고 현재 남은 쿼터만 조회한다 (UI 표시용) */
  async peek(userIndex: number, limitOverride?: number): Promise<QuotaResult> {
    return this.consume(userIndex, 0, limitOverride);
  }
}
