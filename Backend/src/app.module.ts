import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthService } from './common/auth/auth.service';
import { AuthModule } from './common/auth/auth.module';
import { PaintModule } from './common/paint/paint.module';
import { WebsocketModule } from './common/paint/websocket/websocket.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WorkerModule } from './common/paint/worker/worker.module';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from './prisma/prisma.module';
import { CanvasModule } from './common/canvas/canvas.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ReplayModule } from './common/replay/replay.module';
import { AdminModule } from './common/admin/admin.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    AuthModule,
    PaintModule,
    WebsocketModule,
    ConfigModule.forRoot({ isGlobal: true }),
    /*
      IP 기준 요청 수 제한.

      유저별 쿼터는 '로그인한 계정'만 막는다. 회원가입/로그인을 무한히 두드리거나
      계정을 대량으로 찍어내는(고스트 계정) 경로는 인증 이전이라 쿼터가 닿지 않는다.
      그 층을 여기서 막는다.

      short/medium/long 세 창을 함께 둔다. 한 창만 쓰면 그 창에 맞춰 일정한 간격으로
      두드리는 요청을 놓친다.
    */
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          { name: 'short', ttl: 1_000, limit: Number(configService.get('THROTTLE_SHORT', 20)) },
          { name: 'medium', ttl: 60_000, limit: Number(configService.get('THROTTLE_MEDIUM', 300)) },
          { name: 'long', ttl: 3_600_000, limit: Number(configService.get('THROTTLE_LONG', 5_000)) },
          /*
            계정 생성 전용 창.
            느린 엔드포인트(bcrypt)는 위의 초/분 단위 창에 걸리지 않으므로 따로 둔다.
            @Throttle({ register: {} }) 이 붙은 라우트에만 적용되도록,
            나머지 라우트에서는 이 창을 건너뛴다(skipIf).
          */
          {
            name: 'register',
            ttl: 3_600_000,
            limit: Number(configService.get('THROTTLE_REGISTER', 5)),
            // 회원가입 외의 경로까지 시간당 5회로 묶이면 서비스가 멈춘다.
            skipIf: (context) => context.switchToHttp().getRequest().url !== '/auth/register',
          },
        ],
      }),
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    WorkerModule,
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? "TEMPORARY_SECRET",
    }),
    CanvasModule,
    ReplayModule,
    AdminModule,
  ],
  controllers: [
    AppController,
  ],
  providers: [
    AppService,
    AuthService,
    // 전역 적용. 특정 라우트만 빼려면 해당 핸들러에 @SkipThrottle() 을 단다.
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule { }
