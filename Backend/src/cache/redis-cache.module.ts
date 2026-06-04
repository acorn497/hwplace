import { Module } from "@nestjs/common";
import { CacheModule } from "@nestjs/cache-manager";
import { CacheService } from "./redis-cache.service";

@Module({
  imports: [CacheModule.register()],
  providers: [CacheService],
  exports: [CacheService]
})
export class RedisCacheModule {

}