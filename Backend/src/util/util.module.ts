import { Module } from "@nestjs/common";
import { ChunkService } from "./chunk.service";
import { ConfigModule } from "@nestjs/config";

@Module({
  imports: [ConfigModule],
  providers: [ChunkService],
  exports: [ChunkService],
})
export class UtilModule { }