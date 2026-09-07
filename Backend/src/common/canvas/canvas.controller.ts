import { Controller, Get, Query } from '@nestjs/common';
import { CanvasService } from './canvas.service';
import { PixelLocation } from './dto/PixelLocation.dto';

@Controller('canvas')
export class CanvasController {
  constructor (
    private readonly canvasService: CanvasService,
  ) { };

  // 픽셀 칠하기는 PaintController(POST /paint)가 큐를 통해 처리한다.
  // 여기 있던 POST /canvas/paint 는 본문이 비어 있어 인증만 통과하면 조용히 성공하던 죽은 경로라 제거했다.
  @Get('/pixel')
  async getPixelInformation(@Query() query: PixelLocation) {
    return this.canvasService.getPixelInformation(query.x, query.y);
  }
}
