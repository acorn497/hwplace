import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthService } from './common/auth/auth.service';
import { AuthModule } from './common/auth/auth.module';
import { PaintModule } from './common/paint/paint.module';
import { WebsocketModule } from './common/websocket/websocket.module';

@Module({
  imports: [AuthModule, PaintModule, WebsocketModule],
  controllers: [AppController],
  providers: [AppService, AuthService],
})
export class AppModule {}
