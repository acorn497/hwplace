import { Type } from "class-transformer";
import { IsArray, IsInt, IsNotEmpty, IsNumber, Max, Min, ValidateNested } from "class-validator";

export class PaintPixelDTO {
  @IsInt()
  @Min(0)
  posX: number;

  @IsInt()
  @Min(0)
  posY: number;
  
  @IsInt()
  @Min(0)
  @Max(255)
  colorR: number;

  @IsInt()
  @Min(0)
  @Max(255)
  colorG: number;

  @IsInt()
  @Min(0)
  @Max(255)
  colorB: number;
}

export class PaintPixelsDTO {
  @ValidateNested({ each: true })
  @Type(() => PaintPixelDTO)
  pixels: PaintPixelDTO[];
}