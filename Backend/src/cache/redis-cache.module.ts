import { Module } from "@nestjs/common";
import { CacheService } from "./redis-cache.service";
import { UtilModule } from "src/util/util.module";

@Module({
  imports: [UtilModule],
  providers: [CacheService],
  exports: [CacheService]
})
export class RedisCacheModule {

}
