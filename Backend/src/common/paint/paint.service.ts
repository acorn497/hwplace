import { Injectable } from '@nestjs/common';
import { paintDTO } from './dtos/paint.dto';
import DB from 'src/util/db.util';

@Injectable()
export class PaintService {
  async paintPixel(PTDTO: paintDTO) {
    const exist = await DB.pixel.findFirst({
      where: {
        PIXEL_POS_X: PTDTO.posX,
        PIXEL_POS_Y: PTDTO.posY,
      }
    });
    let result;
    if (exist) {
      result = await DB.pixel.update({
        where: {
          PIXEL_INDEX: exist.PIXEL_INDEX,
        },
        data: {
          PIXEL_COLOR_R: PTDTO.colorR,
          PIXEL_COLOR_G: PTDTO.colorG,
          PIXEL_COLOR_B: PTDTO.colorB,
        }
      })
    } else {
      result = await DB.pixel.create({
        data: {
          PIXEL_COLOR_R: PTDTO.colorR,
          PIXEL_COLOR_G: PTDTO.colorG,
          PIXEL_COLOR_B: PTDTO.colorB,
          PIXEL_POS_X: PTDTO.posX,
          PIXEL_POS_Y: PTDTO.posY, 
        }
      })
    }

    return result;
  }

  async getPixel() {
    const result = await DB.pixel.findMany();
    return result;
  }
}
