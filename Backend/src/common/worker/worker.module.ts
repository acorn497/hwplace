import { Module } from '@nestjs/common';
import { PaintPixelProcess } from './paint.worker';
import { WebsocketModule } from '../websocket/websocket.module';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    WebsocketModule,
    BullModule.registerQueue({
      name: 'paint-pixel'
    })
  ],
  providers: [
    PaintPixelProcess
  ]
})
export class WorkerModule {}
