import { Type } from 'class-transformer';
import { IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class SandboxPixelDTO {
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

export class CreateTokenDTO {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  label: string;
}
