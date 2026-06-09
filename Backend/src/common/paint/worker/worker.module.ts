import { Module } from '@nestjs/common';
import { PaintPixelProcess } from './paint.worker';
import { WebsocketModule } from '../websocket/websocket.module';
import { BullModule } from '@nestjs/bullmq';
import { RedisCacheModule } from 'src/cache/redis-cache.module';
import { UtilModule } from 'src/util/util.module';

@Module({
  imports: [
    WebsocketModule,
    RedisCacheModule,
    UtilModule,
    BullModule.registerQueue({
      name: 'paint-pixel'
    })
  ],
  providers: [
    PaintPixelProcess
  ]
})
export class WorkerModule {}
