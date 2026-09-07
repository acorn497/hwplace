import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthService } from './common/auth/auth.service';
import { AuthModule } from './common/auth/auth.module';
import { PaintModule } from './common/paint/paint.module';
import { WebsocketModule } from './common/paint/websocket/websocket.module';
import { ConfigModule } from '@nestjs/config';
import { WorkerModule } from './common/paint/worker/worker.module';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from './prisma/prisma.module';
import { CanvasModule } from './common/canvas/canvas.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ReplayModule } from './common/replay/replay.module';

@Module({
  imports: [
    AuthModule,
    PaintModule,
    WebsocketModule,
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    WorkerModule,
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? "TEMPORARY_SECRET",
    }),
    CanvasModule,
    ReplayModule,
  ],
  controllers: [
    AppController,
  ],
  providers: [
    AppService,
    AuthService,
  ],
})
export class AppModule { }
