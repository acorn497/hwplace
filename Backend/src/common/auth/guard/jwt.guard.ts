
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
        select: { USER_INDEX: true },
      });

    if (!exist) {
      const response: GlobalResponse = {
        message: '사용자 정보를 찾을 수 없습니다. 다시 로그인해 주세요.',
        internalStatusCode: ISC.AUTH.USER_NOT_FOUND,
      };
      throw new UnauthorizedException(response);
    }

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}