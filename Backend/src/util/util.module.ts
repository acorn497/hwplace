import { Module } from "@nestjs/common";
import { ChunkService } from "./chunk.service";
import { ConfigModule } from "@nestjs/config";
import { EncodeService } from "./encode.service";

@Module({
  imports: [ConfigModule],
  providers: [ChunkService, EncodeService],
  exports: [ChunkService, EncodeService],
})
export class UtilModule { }