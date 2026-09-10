
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { ISC } from 'src/common/global/ISC';
import { GlobalResponse } from 'src/common/global/global-response.dto';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException();
    }
    try {
      const payload = await this.jwtService.verifyAsync(
        token,
        {
          secret: this.configService.get<string>('JWT_SECRET'),
        }
      );
      request['user'] = payload;
    } catch {
      throw new UnauthorizedException();
    }

    // 서명이 유효해도 그 유저가 아직 존재한다는 보장은 없다.
    // 토큰은 로그인 시점의 USER_INDEX를 담고 만료 전까지 유효하므로, 그 사이 유저가
    // 사라지면(탈퇴/DB 초기화) 요청은 통과하고 DB 쓰기 단계에서 FK 위반으로 터진다.
    // 여기서 걸러 재로그인을 유도한다.
    const index = request['user']?.index;
    const exist = index === undefined
      ? null
      : await this.prisma.user.findUnique({
        where: { USER_INDEX: index },
        select: { USER_INDEX: true, USER_ROLE: true, USER_RESTRICTED: true, USER_CREATED_AT: true },
      });

    if (!exist) {
      const response: GlobalResponse = {
        message: '사용자 정보를 찾을 수 없습니다. 다시 로그인해 주세요.',
        internalStatusCode: ISC.AUTH.USER_NOT_FOUND,
      };
      throw new UnauthorizedException(response);
    }

    // 권한과 제재 여부는 토큰이 아니라 DB가 단일 출처다.
    // 토큰에 담아두면 제재/강등이 토큰 만료 전까지 반영되지 않으므로,
    // 이미 조회한 김에 최신 값을 요청에 실어 뒤쪽 가드/컨트롤러가 쓰게 한다.
    request['user'].role = exist.USER_ROLE;
    request['user'].restricted = exist.USER_RESTRICTED;
    // 신규 계정 쿼터 판정에 쓴다. 이미 조회한 행이라 추가 쿼리가 들지 않는다.
    request['user'].createdAt = exist.USER_CREATED_AT;

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}