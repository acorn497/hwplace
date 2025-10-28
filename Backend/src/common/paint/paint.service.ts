import { Injectable } from '@nestjs/common';
import { PaintPixelDTO } from './dtos/paint.dto';
import DB from 'src/util/db.util';

@Injectable()
export class PaintService {
  async getPixel() {
    const result = await DB.pixel.findMany();
    return result;
  }
}
