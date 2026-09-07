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
    // 환경변수는 문자열로 들어오고 getOrThrow<number>() 는 변환하지 않는다.
    // 지금은 비교/사칙연산이 강제 변환 덕에 우연히 동작하지만,
    // 이 값들은 캔버스 크기 계산 전반에 쓰이므로 여기서 확실히 숫자로 만든다.
    this.chunkSize = Number(configService.getOrThrow('CHUNK_SIZE'));
    this.canvasWidth = Number(configService.getOrThrow('CANVAS_SIZE_X'));
    this.canvasHeight = Number(configService.getOrThrow('CANVAS_SIZE_Y'));
    this.chunkCountX = Math.ceil(this.canvasWidth / this.chunkSize);
    this.chunkCountY = Math.ceil(this.canvasHeight / this.chunkSize);
  };

  /**
   * 좌표가 현재 캔버스 안에 있는지.
   *
   * 캔버스 크기는 환경변수라 배포마다 달라질 수 있는데, DB의 픽셀/이벤트 이력은 그대로 남는다.
   * 캔버스를 줄여서 재배포하면 범위 밖 좌표가 그대로 재생되고,
   * 그 좌표의 청크는 getChunkPixelCount가 0이라 0바이트 버퍼가 만들어져
   * 첫 쓰기에서 ERR_BUFFER_OUT_OF_BOUNDS로 부팅이 죽는다.
   * 버퍼에 쓰기 전에 반드시 이걸로 거른다.
   */
  isInBounds(posX: number, posY: number) {
    return Number.isInteger(posX) && Number.isInteger(posY)
      && posX >= 0 && posX < this.canvasWidth
      && posY >= 0 && posY < this.canvasHeight;
  }

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
