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
import { ApiTokenService } from 'src/common/token/api-token.service';
import { ISC } from 'src/common/global/ISC';
import { GlobalResponse } from 'src/common/global/global-response.dto';

/**
 * 샌드박스 전용 인증.
 *
 * 로그인 JWT 와 API 토큰을 '둘 다' 받는다. 본 캔버스(AuthGuard)는 JWT만 받으므로,
 * API 토큰을 가진 스크립트는 샌드박스에서만 칠할 수 있다.
 *
 * "브라우저에서 온 요청만 허용"은 불가능하다. Origin/Referer/User-Agent 는 전부
 * 위조되고 CORS 는 브라우저 스스로 지키는 규칙이라 curl 에는 효과가 없다.
 * 그래서 클라이언트 종류가 아니라 '자격증명의 종류'로 권한을 가른다. 이건 위조할 수 없다.
 */
@Injectable()
export class SandboxGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly apiTokenService: ApiTokenService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) throw new UnauthorizedException();

    // API 토큰은 접두사로 구분한다. JWT 검증을 먼저 시도해 실패를 기다릴 필요가 없다.
    if (token.startsWith('hwp_')) {
      const resolved = await this.apiTokenService.resolve(token);

      if (!resolved) {
        const response: GlobalResponse = {
          title: '인증',
          message: '유효하지 않은 API 토큰입니다.',
          internalStatusCode: ISC.TOKEN.INVALID,
        };
        throw new UnauthorizedException(response);
      }

      request['user'] = { index: resolved.userIndex, viaApiToken: true };
      return true;
    }

    // 여기부터는 로그인 JWT 경로. AuthGuard 와 같은 규칙으로 검증한다.
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
      request['user'] = payload;
    } catch {
      throw new UnauthorizedException();
    }

    const index = request['user']?.index;
    const exist = index === undefined
      ? null
      : await this.prisma.user.findUnique({
        where: { USER_INDEX: index },
        select: { USER_INDEX: true, USER_RESTRICTED: true },
      });

    if (!exist) {
      const response: GlobalResponse = {
        message: '사용자 정보를 찾을 수 없습니다. 다시 로그인해 주세요.',
        internalStatusCode: ISC.AUTH.USER_NOT_FOUND,
      };
      throw new UnauthorizedException(response);
    }

    // 제재된 계정은 샌드박스에서도 막는다.
    request['user'].restricted = exist.USER_RESTRICTED;
    request['user'].viaApiToken = false;

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
