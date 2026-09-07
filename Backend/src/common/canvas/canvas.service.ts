import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { EncodeService } from 'src/util/encode.service';
import { GlobalResponse } from 'src/common/global/global-response.dto';
import { ISC } from 'src/common/global/ISC';

@Injectable()
export class CanvasService {
  constructor (
    private readonly prismaService: PrismaService,
    private readonly encodeService: EncodeService,
  ) { };

  async getPixelInformation(x: number, y: number) {
    const response: GlobalResponse = {};

    const pixel = await this.prismaService.pixel.findFirst({
      where: {
        PIXEL_POS_X: x,
        PIXEL_POS_Y: y,
      },
      select: {
        PIXEL_INDEX: true,
        PIXEL_POS_X: true,
        PIXEL_POS_Y: true,
        PIXEL_COLOR_R: true,
        PIXEL_COLOR_G: true,
        PIXEL_COLOR_B: true,
        PIXEL_UUID: true,
        PIXEL_PAINTED_AT: true,
        user: {
          select: {
            USER_DISPLAY: true,
          },
        },
      },
    });

    if (!pixel) {
      response.title = "No Data";
      response.message = "해당 좌표에 페인트된 픽셀이 없습니다.";
      response.internalStatusCode = ISC.PIXEL.NO_DATA;
      return response;
    }

    response.title = "Found Data";
    response.internalStatusCode = ISC.PIXEL.FOUND_DATA;
    response.data = {
      index: pixel.PIXEL_INDEX,
      posX: pixel.PIXEL_POS_X,
      posY: pixel.PIXEL_POS_Y,
      colorR: pixel.PIXEL_COLOR_R,
      colorG: pixel.PIXEL_COLOR_G,
      colorB: pixel.PIXEL_COLOR_B,
      uuid: pixel.PIXEL_UUID,
      paintedBy: pixel.user?.USER_DISPLAY,
      paintedAt: pixel.PIXEL_PAINTED_AT,
    };

    return response;
  }
}
