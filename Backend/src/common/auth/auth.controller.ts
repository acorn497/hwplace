import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDTO } from './dto/register.dto';

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
}
