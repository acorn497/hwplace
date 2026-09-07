import { Module } from '@nestjs/common';
import { WebsocketGateway } from './websocket.gateway';
import { RedisCacheModule } from 'src/cache/redis-cache.module';
import { UtilModule } from 'src/util/util.module';

@Module({
  imports: [RedisCacheModule, UtilModule],
  providers: [WebsocketGateway],
  exports: [WebsocketGateway],
})
export class WebsocketModule {}
