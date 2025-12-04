import { Injectable } from '@nestjs/common';
import { GlobalResponse } from '../global/global-response.dto';
import bcrypt from 'bcrypt';
import DB from 'src/util/db.util';
import { RegisterDTO } from './dto/register.dto';
import { LoginDTO } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import log from 'spectra-log';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService
  ) { };
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
    response.title = "회원가입"

    const conflict = await DB.user.findFirst({
      where: {
        USER_EMAIL: request.email
      }
    });

    if (conflict) {
      response.message = "다른 이메일을 사용해주세요.";
      response.internalStatusCode = "1110";
      return response;
    }

    const encryptedPass = await bcrypt.hash(request.password, 15);

    await DB.user.create({
      data: {
        USER_EMAIL: request.email,
        USER_PASSWORD: encryptedPass,
        USER_DISPLAY: request.email.split('@')[0],
      }
    });

    response.title = "회원가입이 완료되었습니다.";
    response.internalStatusCode = "0000";

    return response;
  }

  async login(request: LoginDTO) {
    let response: GlobalResponse = {};
    response.title = "로그인";

    const exist = await DB.user.findFirst({
      where: {
        USER_EMAIL: request.email
      }
    })
      .then(data => {
        return data;
      })
      .catch(() => {
        return null;
      })

    log(exist)
    if (!exist || !await bcrypt.compare(request.password, exist.USER_PASSWORD)) {
      response.message = "이메일 또는 비밀번호가 일치하지 않습니다.";
      response.internalStatusCode = '1110' // Temporary
      return response;
    }

    const payload = { email: exist.USER_EMAIL, timestamp: Date.now() };

    const token = await this.jwtService.signAsync(payload);

    response.message = '로그인이 완료되었습니다.'
    response.data = {
      email: exist.USER_EMAIL,
      username: exist.USER_DISPLAY,
      accessToken: token,
    };
    response.internalStatusCode = '0000';

    return response;
  }
}
