import { Injectable } from '@nestjs/common';
import DB from 'src/util/db.util';
import { GlobalResponse } from '../global/global-response.dto';
import { ISC } from '../global/ISC';
import log from 'spectra-log';

@Injectable()
export class PixelService {
  async getDetailedPixelInformation(x: number, y: number) {
    const response: GlobalResponse = {};
    
    const pixel = await DB.pixel.findFirst({
      where: {
        PIXEL_POS_X: x,
        PIXEL_POS_Y: y,
      }
    });

    response.message = "픽셀 조회 완료";
    if (!pixel) {
      response.internalStatusCode = ISC.PIXEL.NO_DATA;
      return response;
    }

    const user = await DB.user.findFirst({
      where: {
        USER_INDEX: pixel.PIXEL_PAINTED_BY,
        USER_RESTRICTED: false,
      }
    });

    response.internalStatusCode = ISC.PIXEL.FOUND_DATA;
    response.data = {
      posX: pixel.PIXEL_POS_X,
      posY: pixel.PIXEL_POS_Y,
      colorR: pixel.PIXEL_COLOR_R,
      colorG: pixel.PIXEL_COLOR_G,
      colorB: pixel.PIXEL_COLOR_B,
      uuid: pixel.PIXEL_UUID,
      index: pixel.PIXEL_INDEX,
      paintedBy: user?.USER_DISPLAY ?? 'Deleted / Restricted User',
      paintedAt: pixel.PIXEL_PAINTED_AT
    }

    return response;
  }
}
