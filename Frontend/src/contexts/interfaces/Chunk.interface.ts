import type { Pixel } from "./Pixel.interface";

export interface Chunk {
  chunkX: number,
  chunkY: number,
  pixels: Pixel[]
}