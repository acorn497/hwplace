import { Injectable } from '@nestjs/common';
import { GlobalResponse } from '../global/global-response.dto';
import DB from 'src/util/db.util';
import { RegisterDTO } from './dto/register.dto';

@Injectable()
export class AuthService {
  /**
   * ISC
   * 
   * 200: OK
   * 
   * 1000: Input 1 is problem
   * 1001: Input 2 is problem
   */
  async register(request: RegisterDTO) {
    let response: GlobalResponse = {};

    const conflict = await DB.user.findFirstOrThrow({
      where: {
        USER_EMAIL: request.email
      }
    });

    if (conflict) {
      response.title = "이미 사용중인 이메일입니다.",
      response.message = "다른 이메일을 사용해주세요.",
      response.internalStatusCode = 1100
      return response;
    }

    const result = await DB.user.create({
      data: {
        USER_EMAIL: request.email,
        USER_PASSWORD: request.password,
        USER_DISPLAY: request.email.split('@')[0],
      }
    });

    response.title = "회원가입이 완료되었습니다.";
    response.internalStatusCode = 1000;

    return response;
  }
}
