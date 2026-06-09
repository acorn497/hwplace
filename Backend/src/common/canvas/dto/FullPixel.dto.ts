import { IsNotEmpty, IsNumber } from "class-validator";

export class FullPixel {
  @IsNotEmpty()
  @IsNumber()
  x!: number;

  @IsNotEmpty()
  @IsNumber()
  y!: number;

  @IsNotEmpty()
  @IsNumber()
  r!: number;

  @IsNotEmpty()
  @IsNumber()
  g!: number;

  @IsNotEmpty()
  @IsNumber()
  b!: number;
}
