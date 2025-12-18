import { Module } from '@nestjs/common';
import { PixelController } from './pixel.controller';
import { PixelService } from './pixel.service';

@Module({
  controllers: [PixelController],
  providers: [PixelService]
})
export class PixelModule {}
