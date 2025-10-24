import { Injectable } from '@nestjs/common';
import { paintDTO } from './dtos/paint.dto';
import DB from 'src/util/db.util';

@Injectable()
export class PaintService {
  async paintPixel(PTDTO: paintDTO) {
    console.log(PTDTO.posX, PTDTO.posY)

    let result;
    result = await DB.pixel.upsert({
      where: {
        PIXEL_POS_X_PIXEL_POS_Y: { PIXEL_POS_X: PTDTO.posX, PIXEL_POS_Y: PTDTO.posY }
      },
      update: {
        PIXEL_COLOR_R: PTDTO.colorR,
        PIXEL_COLOR_G: PTDTO.colorG,
        PIXEL_COLOR_B: PTDTO.colorB,
      },
      create: {
        PIXEL_COLOR_R: PTDTO.colorR,
        PIXEL_COLOR_G: PTDTO.colorG,
        PIXEL_COLOR_B: PTDTO.colorB,
        PIXEL_POS_X: PTDTO.posX,
        PIXEL_POS_Y: PTDTO.posY,
      }
    })

    return result;
  }

  async getPixel() {
    const result = await DB.pixel.findMany();
    return result;
  }
}
