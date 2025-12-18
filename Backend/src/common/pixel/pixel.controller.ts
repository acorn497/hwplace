import { Controller, Get, Query } from '@nestjs/common';
import log from 'spectra-log';
import { PixelService } from './pixel.service';

@Controller('pixel')
export class PixelController {
  constructor (
    private readonly pixelService: PixelService,  
  ) { };

  @Get('/')
  async handlePixelInformation(@Query('x') x: number, @Query('y') y: number) {
    return this.pixelService.getDetailedPixelInformation(x, y);
  }
}
