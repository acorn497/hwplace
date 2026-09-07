import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import log from "spectra-log";
import { CacheService } from "./redis-cache.service";

/**
 * 주기적으로 Redis 캔버스를 DB 스냅샷으로 굳힌다.
 *
 * 스냅샷이 없으면 부팅 복구가 canvas_events 전체 재생에 의존하게 되고,
 * 이벤트 테이블도 무한히 커진다. 이 스케줄러가 그 두 가지를 함께 막는다.
 *
 * 주기는 SNAPSHOT_CRON 으로 바꿀 수 있다. (기본: 매시 정각)
 */
@Injectable()
export class SnapshotScheduler {
  constructor(
    private readonly cacheService: CacheService,
  ) { }

  @Cron(process.env.SNAPSHOT_CRON ?? '0 * * * *', { name: 'canvas-snapshot' })
  async handleSnapshot() {
    // 부팅 로드가 끝나기 전에 스냅샷을 찍으면 빈 캔버스를 굳혀버린다.
    if (!this.cacheService.isReady) {
      log('Skipping scheduled snapshot: cache is still loading.', 400, 'INFO');
      return;
    }

    await this.cacheService.createSnapshot();
  }
}
