import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class ChunkService {
  chunkSize: number;
  canvasWidth: number;
  canvasHeight: number;
  chunkCountX: number;
  chunkCountY: number;

  constructor(
    private readonly configService: ConfigService,
  ) {
    this.chunkSize = configService.getOrThrow<number>('CHUNK_SIZE');
    this.canvasWidth = configService.getOrThrow<number>('CANVAS_SIZE_X');
    this.canvasHeight = configService.getOrThrow<number>('CANVAS_SIZE_Y');
    this.chunkCountX = Math.ceil(this.canvasWidth / this.chunkSize);
    this.chunkCountY = Math.ceil(this.canvasHeight / this.chunkSize);
  };

  getChunkCoordinate(posX: number, posY: number) {
    return { cx: Math.floor(posX / this.chunkSize), cy: Math.floor(posY / this.chunkSize) }
  }

  getInChunkCoordinate(posX: number, posY: number) {
    return { x: posX % this.chunkSize, y: posY % this.chunkSize }
  }

  getChunkPixelCount(cx: number, cy: number) {
    const width = Math.min(this.chunkSize, this.canvasWidth - cx * this.chunkSize);
    const height = Math.min(this.chunkSize, this.canvasHeight - cy * this.chunkSize);
    return Math.max(width, 0) * Math.max(height, 0);
  }

  getChunkWidth(cx: number) {
    return Math.max(Math.min(this.chunkSize, this.canvasWidth - cx * this.chunkSize), 0);
  }

  getChunkHeight(cy: number) {
    return Math.max(Math.min(this.chunkSize, this.canvasHeight - cy * this.chunkSize), 0);
  }
}
