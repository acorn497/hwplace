import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ISC } from 'src/common/global/ISC';
import { GlobalResponse } from 'src/common/global/global-response.dto';

/**
 * 제재된 계정의 쓰기 동작을 막는 가드.
 *
 * 제재는 로그인 자체를 막지 않는다. 캔버스를 보거나 리플레이를 재생하는 건 그대로 두고
 * 픽셀을 칠하는 것만 거부한다. AuthGuard 가 채워준 request.user.restricted 를 본다.
 */
@Injectable()
export class RestrictedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    if (request.user?.restricted) {
      const response: GlobalResponse = {
        title: '제재된 계정',
        message: '제재된 계정은 픽셀을 칠할 수 없습니다.',
        internalStatusCode: ISC.AUTH.RESTRICTED,
      };
      throw new ForbiddenException(response);
    }

    return true;
  }
}
