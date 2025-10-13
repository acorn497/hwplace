import { Module } from '@nestjs/common';
import { PaintController } from './paint.controller';
import { PaintService } from './paint.service';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [WebsocketModule],
  controllers: [PaintController],
  providers: [PaintService]
})
export class PaintModule {}
