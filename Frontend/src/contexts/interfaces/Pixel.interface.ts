import { PixelLoadStatus } from "../enums/PixelLoadStatus.enum";
import { PixelPositionContextType } from "./PixelPosition.interface";
import { Dispatch, SetStateAction } from "react";

export interface Pixel {
  posX: number;
  posY: number;
  colorR: number;
  colorG: number;
  colorB: number;
  uuid: string;
}

export interface PixelColor {
  r: number;
  g: number;
  b: number;
}

/** 마지막 렌더 이후 내용이 바뀐 캔버스 영역 */
export interface DirtyRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PixelContextType {
  pixelLoadStatus: PixelLoadStatus;
  loadedChunk: number;
  totalChunk: number;
  chunkSize: number;

  /**
   * 캔버스 전체를 담는 RGB 버퍼 (픽셀당 3바이트, row-major).
   * 서버가 보낸 청크 버퍼를 그대로 눌러 담기 때문에 변환 비용이 없다.
   * chunk_start 전에는 null.
   *
   * 주의: 이 버퍼는 제자리에서 수정된다. 값이 바뀌었는지는 pixelVersion으로 판단할 것.
   */
  getCanvasBuffer: () => Uint8Array | null;

  /** 버퍼가 새로 할당될 때마다 증가. 화면 전체를 다시 그려야 한다는 신호. */
  canvasEpoch: number;
  /** 버퍼 내용이 바뀔 때마다 증가. */
  pixelVersion: number;
  /** 마지막 호출 이후 변경된 영역을 가져가면서 비운다. 렌더러 전용. */
  consumeDirtyRegions: () => DirtyRegion[];

  /** 미도색 좌표나 범위 밖이면 흰색을 반환한다. */
  getPixelColor: (x: number, y: number) => PixelColor;

  selectedPixels: PixelPositionContextType[],
  setSelectedPixels: Dispatch<SetStateAction<PixelPositionContextType[]>>;

  selectedPixel: DetailedPixel | null,
  setSelectedPixel: Dispatch<SetStateAction<DetailedPixel | null>>;
}

export interface DetailedPixel {
  posX: number;
  posY: number;
  colorR: number;
  colorG: number;
  colorB: number;
  uuid: string;
  index: number;
  paintedBy: string;
  paintedAt: string;
}
