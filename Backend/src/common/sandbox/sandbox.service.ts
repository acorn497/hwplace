import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import log from 'spectra-log';
import { EncodeService } from 'src/util/encode.service';

export interface SandboxPixel {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
}

/**
 * 샌드박스 캔버스.
 *
 * 본 캔버스와 의도적으로 다르게 만들었다.
 *  - canvas_events 에 이력을 쓰지 않는다. 1시간마다 지워지므로 리플레이할 가치가 없고,
 *    무제한 칠하기를 허용하면서 이력을 남기면 디스크가 무한히 커진다(봇 20명이면 시간당 2GB).
 *  - DB의 pixel 테이블도 쓰지 않는다. 누가 칠했는지 추적할 이유가 없다.
 *  - Redis 한 곳만 갱신한다. 그래서 서버가 죽으면 내용이 사라지는데, 어차피 휘발이 정상이다.
 *
 * 청크로 쪼개지 않고 캔버스 전체를 버퍼 하나로 둔다.
 * 512x512x3 = 768KB 라 통째로 다뤄도 부담이 없고, 초기화가 SET 한 번으로 끝난다.
 */
@Injectable()
export class SandboxService implements OnModuleInit, OnModuleDestroy {
  private readonly redis: Redis;

  public readonly width: number;
  public readonly height: number;
  /** 초기화 주기(분). 프론트에 다음 초기화 시각을 알려주는 데도 쓴다. */
  public readonly resetMinutes: number;

  /**
   * 메인 캔버스 오른쪽 끝에서 샌드박스 왼쪽 끝까지의 빈 간격(픽셀).
   *
   * 두 구역이 붙어 있으면 축소했을 때 한 덩어리로 보인다. 간격을 둬서 어느 배율에서도
   * 서로 다른 공간임이 드러나게 한다. 좌표 자체는 각자 0부터 시작하는 독립 체계다.
   */
  public readonly gap: number;

  private static readonly KEY = 'sandbox:canvas';
  /** 마지막 초기화 시각을 담는 키 (다음 초기화까지 남은 시간 계산용) */
  private static readonly RESET_KEY = 'sandbox:last-reset';

  constructor(
    private readonly configService: ConfigService,
    private readonly encodeService: EncodeService,
  ) {
    this.width = Number(this.configService.get('SANDBOX_SIZE_X', 512));
    this.height = Number(this.configService.get('SANDBOX_SIZE_Y', 512));
    this.resetMinutes = Number(this.configService.get('SANDBOX_RESET_MINUTES', 60));
    this.gap = Number(this.configService.get('SANDBOX_GAP', 64));

    this.redis = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      username: this.configService.get<string>('REDIS_USERNAME', 'default'),
      password: this.configService.get<string>('REDIS_PASSWORD', '1234'),
      db: this.configService.get<number>('REDIS_DB', 0),
    });
  }

  async onModuleInit() {
    // 키가 없으면(첫 부팅/재시작) 흰 캔버스를 깔아둔다.
    const exists = await this.redis.exists(SandboxService.KEY);
    if (!exists) await this.reset('boot');
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  private get pixelCount() {
    return this.width * this.height;
  }

  public isInBounds(x: number, y: number) {
    return Number.isInteger(x) && Number.isInteger(y)
      && x >= 0 && x < this.width
      && y >= 0 && y < this.height;
  }

  /** 캔버스 전체를 흰색으로 되돌린다. */
  async reset(reason: string) {
    const blank = this.encodeService.createRgbChunk(this.pixelCount);

    await this.redis
      .multi()
      .set(SandboxService.KEY, blank)
      .set(SandboxService.RESET_KEY, Date.now())
      .exec();

    log(`Sandbox canvas reset (${reason}).`);
  }

  async getCanvas(): Promise<Buffer> {
    const buffer = await this.redis.getBuffer(SandboxService.KEY);

    // 키가 사라졌더라도(수동 삭제/만료) 빈 화면 대신 흰 캔버스를 돌려준다.
    if (!buffer || buffer.length !== this.pixelCount * 3) {
      await this.reset('missing or malformed');
      return this.encodeService.createRgbChunk(this.pixelCount);
    }

    return buffer;
  }

  /** 다음 초기화까지 남은 초 */
  async getSecondsUntilReset(): Promise<number> {
    const last = await this.redis.get(SandboxService.RESET_KEY);
    if (!last) return this.resetMinutes * 60;

    const elapsed = (Date.now() - Number(last)) / 1000;

    return Math.max(0, Math.ceil(this.resetMinutes * 60 - elapsed));
  }

  /**
   * 픽셀을 적용한다.
   *
   * 버퍼를 통째로 읽어 고치고 다시 쓴다. 동시에 두 요청이 들어오면 나중 것이 앞 것을
   * 덮을 수 있지만(read-modify-write 경합), 샌드박스에서 픽셀 몇 개가 밀리는 것은
   * 감수할 만하다. 여기서 Lua로 원자성을 맞추면 768KB 버퍼를 스크립트로 넘겨야 해서
   * 오히려 더 비싸다.
   *
   * 범위 밖 좌표는 조용히 버린다(개수만 반환).
   */
  async applyPixels(pixels: SandboxPixel[]): Promise<number> {
    const canvas = await this.getCanvas();
    let applied = 0;

    for (const pixel of pixels) {
      if (!this.isInBounds(pixel.x, pixel.y)) continue;

      this.encodeService.writeRgbPixel(canvas, pixel.x, pixel.y, this.width, pixel);
      applied++;
    }

    if (applied > 0) await this.redis.set(SandboxService.KEY, canvas);

    return applied;
  }
}
