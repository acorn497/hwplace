import { Module } from '@nestjs/common';
import { CanvasController } from './canvas.controller';
import { CanvasService } from './canvas.service';
import { UtilModule } from 'src/util/util.module';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [UtilModule, PrismaModule],
  controllers: [CanvasController],
  providers: [CanvasService]
})
export class CanvasModule {}
