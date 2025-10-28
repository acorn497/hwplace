import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthService } from './common/auth/auth.service';
import { AuthModule } from './common/auth/auth.module';
import { PaintModule } from './common/paint/paint.module';
import { WebsocketModule } from './common/websocket/websocket.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WorkerModule } from './common/worker/worker.module';

@Module({
  imports: [
    AuthModule,
    PaintModule,
    WebsocketModule,
    ConfigModule.forRoot({ isGlobal: true }),
    WorkerModule,
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
