import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { EncodeService } from 'src/util/encode.service';
import { FullPixel } from './dto/FullPixel.dto';

@Injectable()
export class CanvasService {
  constructor (
    private readonly prismaService: PrismaService,
    private readonly encodeService: EncodeService,
  ) { };

  async paintPixel(pixels: FullPixel[]) {
    
  }

  async getPixelInformation(x: number, y: number) {
    const response = await this.prismaService.canvas_events.findFirst({
      orderBy: {
        created_at: 'desc'
      },
      select: {
        created_at: true,
        userId: true,
        event_payload: true,
        event_idx: true,
      },
      where: {
        event_x: x,
        event_y: y,
      }
    });
    return response;
  }
}
