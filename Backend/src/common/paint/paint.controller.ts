import { Body, Controller, Get, Post } from '@nestjs/common';
import { PaintService } from './paint.service';
import { paintDTO, paintDTOArray } from './dtos/paint.dto';
import { plainToInstance } from 'class-transformer';
import { WebsocketGateway } from '../websocket/websocket.gateway';

@Controller('paint')
export class PaintController {
  constructor(
    private readonly paintService: PaintService,
    private readonly wsGateway: WebsocketGateway,
  ) { };

  @Post()
  async paintPixel(@Body() body: any) {
    const dtoArray: paintDTO[] = plainToInstance(paintDTO, Array.isArray(body) ? body : [body]);
    
    try {
      const connectedClients = this.wsGateway.server?.sockets?.sockets?.size || 0;

      if (connectedClients > 0) {
        const payload = {
          pixels: dtoArray.map(p => ({
            x: p.posX,
            y: p.posY,
            color: { r: p.colorR, g: p.colorG, b: p.colorB }
          })),
          uuid: 'server-http',
          timestamp: new Date().toISOString()
        };

        this.wsGateway.server.emit('batch-pixels-updated', payload);
      }
    } catch (error) {
      console.error('WS Broadcast failed');
    }

    const result = await Promise.all(
      dtoArray.map(dto => this.paintService.paintPixel(dto))
    );

    return result;
  }

  @Get()
  async getPixel() {
    return this.paintService.getPixel();
  }
}
