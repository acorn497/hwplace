import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PaintController } from './paint.controller';
import { PaintService } from './paint.service';
import { WebsocketModule } from '../websocket/websocket.module';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    ConfigModule,
    WebsocketModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          username: configService.get('REDIS_USERNAME', 'default'),
          password: configService.get('REDIS_PASSWORD', '1234'),
        },
      }),
      inject: [ConfigService],
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
export class PaintModule { }