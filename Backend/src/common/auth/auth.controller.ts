import { Body, Controller, HttpCode, Post } from '@nestjs/common';
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
