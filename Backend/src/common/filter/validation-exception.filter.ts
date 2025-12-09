import { ArgumentsHost, BadRequestException, Catch, ExceptionFilter, HttpStatus } from "@nestjs/common";
import { GlobalResponse } from "../global/global-response.dto";
import { Response } from "express";

@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const exceptionResponse: any = exception.getResponse();

    const globalResponse: GlobalResponse = {
      title: '데이터 불일치',
      message: '입력 값을 검증하는데 실패했습니다.',
      internalStatusCode: exceptionResponse.message[0] ?? exceptionResponse.message,
    }

    response.status(400).json(globalResponse);
  }
} 