import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CanvasService } from './canvas.service';
import { AuthGuard } from '../auth/guard/jwt.guard';
import { PixelLocation } from './dto/PixelLocation.dto';
import { FullPixel } from './dto/FullPixel.dto';

@Controller('canvas')
export class CanvasController {
  constructor (
    private readonly canvasService: CanvasService,
  ) { };

  // 이 컨트롤러는 앞으로 픽셀 처리 API와 픽셀 데이터를 반환하는 역할을 수행합니다.
  @Post('/paint')
  @UseGuards(AuthGuard)
  async paintCanvas(@Body() body: FullPixel[]) {
    return this.canvasService.paintPixel(body);
  }

  @Get('/pixel')
  async getPixelInformation(@Body() body: PixelLocation) {
    return this.canvasService.getPixelInformation(body.x, body.y);
  }
}
