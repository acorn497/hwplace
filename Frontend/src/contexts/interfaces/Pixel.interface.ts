import { PixelLoadStatus } from "../enums/PixelLoadStatus.enum";
import { PixelPositionContextType } from "./PixelPosition.interface";

export interface Pixel {
  posX: number;
  posY: number;
  colorR: number;
  colorG: number;
  colorB: number;
  uuid: string;
}

export interface PixelContextType {
  pixelLoadStatus: PixelLoadStatus;
  loadedChunk: number;
  totalChunk: number;
  chunkWidth: number;
  chunkHeight: number;
  chunkSize: number;
  pixels: Map<string, Pixel>; // key: "x,y"
  getPixel: (x: number, y: number) => Pixel | undefined;
  setPixel: (x: number, y: number, pixel: Pixel) => void;

  selectedPixels: PixelPositionContextType[],
  setSelectedPixels: (position: PixelPositionContextType[]) => void;
}