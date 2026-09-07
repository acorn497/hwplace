import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PaintController } from './paint.controller';
import { WebsocketModule } from './websocket/websocket.module';
import { BullModule } from '@nestjs/bullmq';
import { PaintQuotaService } from './quota/paint-quota.service';
import { AbuseDetectorService } from './quota/abuse-detector.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [
    ConfigModule,
    WebsocketModule,
    // 자동 제재가 user/admin_log 를 건드린다
    PrismaModule,
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
    PaintQuotaService,
    AbuseDetectorService,
  ],
  exports: [
    BullModule,
    // 관리자가 제재를 풀 때 누적 위반 기록도 함께 지우기 위해 내보낸다
    AbuseDetectorService,
  ]
})
export class PaintModule { }