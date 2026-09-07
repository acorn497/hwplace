import { Module } from "@nestjs/common";
import { CacheService } from "./redis-cache.service";
import { SnapshotScheduler } from "./snapshot.scheduler";
import { UtilModule } from "src/util/util.module";

@Module({
  imports: [UtilModule],
  providers: [CacheService, SnapshotScheduler],
  exports: [CacheService]
})
export class RedisCacheModule {

}
