import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Response } from 'express';
import { GlobalResponse } from '../global/global-response.dto';
import { ISC } from '../global/ISC';

/**
 * ThrottlerGuard 가 던지는 예외를 앱 공통 응답(GlobalResponse) 형태로 바꾼다.
 *
 * 프론트는 internalStatusCode 로 성공/실패를 가리므로, 이 필드가 없는 응답은
 * "알 수 없는 오류"로 표시된다. 요청이 많아 막혔다는 사실이 사용자에게 전달되도록 감싼다.
 */
@Catch(ThrottlerException)
export class ThrottlerExceptionFilter implements ExceptionFilter {
  catch(_exception: ThrottlerException, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    const globalResponse: GlobalResponse = {
      title: '요청이 너무 많습니다',
      message: '잠시 후 다시 시도해 주세요.',
      internalStatusCode: ISC.PIXEL.RATE_LIMITED,
    };

    response.status(HttpStatus.TOO_MANY_REQUESTS).json(globalResponse);
  }
}
