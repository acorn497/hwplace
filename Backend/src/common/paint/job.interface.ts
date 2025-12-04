import { JobsOptions } from "bullmq";
import { PaintPixelDTO } from "./dtos/paint.dto";

export interface JobType {
  name: string,
  data: {
    pixels: JobWithUserType[],
  }
  opts: JobsOptions
}

export interface JobWithUserType {
  userIndex: number;
  posX: number;
  posY: number;
  colorR: number;
  colorG: number;
  colorB: number;
}