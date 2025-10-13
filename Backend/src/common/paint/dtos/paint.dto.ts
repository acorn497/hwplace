import { IsNotEmpty, IsNumber } from "class-validator";

export class paintDTO {
  posX: number;
  posY: number;
  colorR: number;
  colorG: number;
  colorB: number;
}

export class paintDTOArray {
  pixels: paintDTO[];
}