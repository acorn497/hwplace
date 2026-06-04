import { ConfigService } from "@nestjs/config";

export class ChunkService {
  chunkSize; canvasWidth; canvasHeight;

  constructor(
    private readonly configService: ConfigService,
  ) {
    this.chunkSize = configService.getOrThrow<number>('CHUNK_SIZE');
    this.canvasWidth = configService.getOrThrow<number>('CANVAS_SIZE_X');
    this.canvasHeight = configService.getOrThrow<number>('CANVAS_SIZE_Y');
  };

  getChunkCoordinate(posX: number, posY: number) {
    return { posX: Math.floor(posX / this.chunkSize), posY: Math.floor(posY / this.chunkSize) }
  }

  getInChunkCoordinate(posX: number, posY: number) {
    return { posX: posX % this.chunkSize, posY: posY % this.chunkSize }
  }
}