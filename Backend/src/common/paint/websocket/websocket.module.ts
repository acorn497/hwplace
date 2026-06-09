import { Module } from '@nestjs/common';
import { WebsocketGateway } from './websocket.gateway';
import { RedisCacheModule } from 'src/cache/redis-cache.module';

@Module({
  imports: [RedisCacheModule],
  providers: [WebsocketGateway],
  exports: [WebsocketGateway],
})
export class WebsocketModule {}
