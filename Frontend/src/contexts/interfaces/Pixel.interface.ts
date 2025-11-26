import type { RefObject } from "react";
import type { CanvasStatus } from "../enums/CanvasStatus.enum";

export interface Pixel {
  posX: number,
  posY: number,
  colorR: number,
  colorG: number,
  colorB: number,
  uuid: string,
  author: string,
}

export interface PixelContext {
  canvasStatus: CanvasStatus,
  setCanvasStatus: (parameter: CanvasStatus) => void,

  canvasWidth: number,
  canvasHeight: number,

  chunkWidth: number,
  chunkHeight: number,
  totalChunk: number,
  loadedChunk: number,

  pixels: RefObject<Map<string, Pixel>> 
}