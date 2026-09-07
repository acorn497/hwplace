import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDTO } from './dto/register.dto';
import { LoginDTO } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) { };
  /*
    need email verification to make unavailable to create ghost account
    password reset

  */

  /*
    회원가입에는 훨씬 좁은 제한을 건다.

    전역 제한(초당 20 / 분당 300)은 이 경로를 사실상 못 막는다.
    bcrypt cost 15 때문에 요청 하나가 1.7초쯤 걸려서, 순차로 두드리면
    초당 한도에 닿지 않고 분당 한도도 채우기 전에 계정이 수십 개 만들어진다.
    (유저별 쿼터는 계정 단위이므로, 계정을 찍어내면 우회된다)

    한 IP에서 정상적으로 필요한 가입은 시간당 몇 건이면 충분하다.
    실제 한도는 app.module 의 'register' 스로틀러 정의(THROTTLE_REGISTER)를 따른다.
  */
  @Throttle({ register: {} })
  @Post('/register')
  async register(@Body() request: RegisterDTO) {
    return this.authService.register(request);
  }

  @HttpCode(200)
  @Post('/login')
  async login(@Body() request: LoginDTO) {
    const response = await this.authService.login(request);
    return response;
  }
}
