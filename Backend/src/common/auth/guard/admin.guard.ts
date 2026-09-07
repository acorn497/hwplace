import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { ISC } from 'src/common/global/ISC';
import { GlobalResponse } from 'src/common/global/global-response.dto';

/**
 * 관리자 전용 가드.
 *
 * AuthGuard 가 먼저 돌면서 request.user.role 에 DB의 최신 권한을 실어주므로
 * 여기서는 그 값만 확인한다. 반드시 AuthGuard 뒤에 배치할 것.
 * (@UseGuards(AuthGuard, AdminGuard) — 순서가 곧 실행 순서다)
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    if (request.user?.role !== Role.ADMIN) {
      const response: GlobalResponse = {
        title: '권한 없음',
        message: '관리자만 사용할 수 있는 기능입니다.',
        internalStatusCode: ISC.AUTH.FORBIDDEN,
      };
      throw new ForbiddenException(response);
    }

    return true;
  }
}
