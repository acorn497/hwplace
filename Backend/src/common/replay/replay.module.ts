import { Module } from '@nestjs/common';
import { ReplayController } from './replay.controller';
import { ReplayService } from './replay.service';
import { UtilModule } from 'src/util/util.module';

@Module({
  imports: [UtilModule],
  controllers: [ReplayController],
  providers: [ReplayService],
  exports: [ReplayService],
})
export class ReplayModule { }
