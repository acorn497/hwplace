import { IsNotEmpty, IsNumber } from "class-validator";

export class PixelLocation {
  @IsNotEmpty()
  @IsNumber()
  x!: number;

  @IsNotEmpty()
  @IsNumber()
  y!: number;
}
