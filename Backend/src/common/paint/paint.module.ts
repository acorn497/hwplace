import { Module } from '@nestjs/common';
import { PaintController } from './paint.controller';
import { PaintService } from './paint.service';
import { WebsocketModule } from '../websocket/websocket.module';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    WebsocketModule,
    BullModule.forRoot({
      connection: {
        host: 'localhost',
        port: 6379,
        username: 'default',
        password: '1234'
      }
    }),
    BullModule.registerQueue({
      name: 'paint-pixel'
    })
  ],
  controllers: [
    PaintController,
  ],
  providers: [
    PaintService,
  ],
  exports: [
    BullModule
  ]
})
export class PaintModule {}
