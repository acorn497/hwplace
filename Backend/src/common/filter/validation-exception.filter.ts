import { ArgumentsHost, BadRequestException, Catch, ExceptionFilter } from "@nestjs/common";
import { GlobalResponse } from "../global/global-response.dto";
import { Response } from "express";

@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const exceptionResponse: any = exception.getResponse();

    /*
      이 필터는 원래 ValidationPipe 전용이었다. ValidationPipe는 message에 위반 메시지
      '배열'을 담으므로 message[0]을 꺼내는 게 맞다.

      그런데 @Catch(BadRequestException)은 앱이 던지는 모든 400을 잡는다.
      서비스가 직접 던진 BadRequestException은 message가 문자열이라
      message[0]이 '첫 글자'가 되어 internalStatusCode에 "자" 같은 값이 들어갔다.

      그래서 이미 internalStatusCode를 갖춘 응답은 그대로 통과시키고,
      배열일 때만 기존처럼 첫 위반 메시지를 꺼낸다.
    */
    if (exceptionResponse?.internalStatusCode) {
      response.status(400).json({
        title: exceptionResponse.title ?? '잘못된 요청',
        message: exceptionResponse.message,
        internalStatusCode: exceptionResponse.internalStatusCode,
      } satisfies GlobalResponse);
      return;
    }

    const globalResponse: GlobalResponse = {
      title: '데이터 불일치',
      message: '입력 값을 검증하는데 실패했습니다.',
      internalStatusCode: Array.isArray(exceptionResponse.message)
        ? exceptionResponse.message[0]
        : exceptionResponse.message,
    }

    response.status(400).json(globalResponse);
  }
} 
