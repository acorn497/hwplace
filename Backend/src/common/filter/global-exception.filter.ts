import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { GlobalResponse } from '../global/global-response.dto';
import { ISC } from '../global/ISC';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse: any = exception.getResponse();

    let globalResponse: GlobalResponse;

    // Bad Request Exception은 Validation Exception에서 처리함.
    if (status === HttpStatus.BAD_REQUEST) {
      return;
    }

    // 다른 HTTP 예외들 처리
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        globalResponse = {
          title: exceptionResponse.title,
          message: exceptionResponse.message || '인증이 필요합니다.',
          internalStatusCode: exceptionResponse.internalStatusCode ?? ISC.SERVER.FOLLOW_STATUS,
        };
        break;
      case HttpStatus.FORBIDDEN:
        globalResponse = {
          title: exceptionResponse.title,
          message: exceptionResponse.message || '접근 권한이 없습니다.',
          internalStatusCode: exceptionResponse.internalStatusCode ?? ISC.SERVER.FOLLOW_STATUS,
        };
        break;
      case HttpStatus.NOT_FOUND:
        globalResponse = {
          title: exceptionResponse.title,
          message: exceptionResponse.message || '요청한 리소스를 찾을 수 없습니다.',
          internalStatusCode: exceptionResponse.internalStatusCode ?? ISC.SERVER.FOLLOW_STATUS,
        };
        break;
      case HttpStatus.CONFLICT:
        globalResponse = {
          title: exceptionResponse.title,
          message: exceptionResponse.message || '이미 존재하는 리소스입니다.',
          internalStatusCode: exceptionResponse.internalStatusCode ?? ISC.SERVER.FOLLOW_STATUS,
        };
      
      default:
        globalResponse = {
          title: exceptionResponse.title || "서버 오류",
          message: exceptionResponse.message || '알 수 없는 오류가 발생했습니다.',
          internalStatusCode: exceptionResponse.internalStatusCode ?? ISC.SERVER.UNKNOWN_ERROR,
        };
    }

    response.status(status).json(globalResponse);
  }
}