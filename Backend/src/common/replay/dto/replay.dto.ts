import { Type } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, Max, Min } from 'class-validator';

export class ReplayCanvasQuery {
  /** 복원할 시점 (ISO 8601) */
  @IsISO8601()
  at: string;
}

export class ReplayStreamQuery {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  /** 이 event_idx 다음부터 읽는다 (커서) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  after?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20_000)
  limit?: number;
}
