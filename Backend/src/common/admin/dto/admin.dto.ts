import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** 유저 목록 조회 (검색 + 페이지네이션) */
export class ListUsersQuery {
  /** 이메일/닉네임 부분 일치 검색 */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  keyword?: string;

  /** true 면 제재된 계정만 */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  restrictedOnly?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

/** 제재 / 제재 해제 */
export class RestrictUserDTO {
  @IsBoolean()
  restricted: boolean;

  /** 감사 로그에 남길 사유 */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

/** 권한 변경 */
export class ChangeRoleDTO {
  @IsIn(['USER', 'ADMIN'])
  role: 'USER' | 'ADMIN';
}

/**
 * 사각 영역 초기화.
 * x2/y2 는 포함(inclusive)이다. 한 픽셀만 지우려면 x1==x2, y1==y2.
 */
export class ClearAreaDTO {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  x1: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  y1: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  x2: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  y2: number;

  /** 채울 색. 생략하면 흰색으로 초기화한다. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(255)
  colorR?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(255)
  colorG?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(255)
  colorB?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

/** 특정 유저가 칠한 픽셀 일괄 롤백 */
export class RollbackUserDTO {
  /** 이 시각 이후에 칠한 것만 되돌린다 (ISO 8601). 생략하면 전체. */
  @IsOptional()
  @IsString()
  since?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
