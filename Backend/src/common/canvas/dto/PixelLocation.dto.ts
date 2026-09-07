import { Type } from "class-transformer";
import { IsInt, IsNotEmpty, Min } from "class-validator";

export class PixelLocation {
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  x!: number;

  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  y!: number;
}
