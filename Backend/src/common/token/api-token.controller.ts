import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTokenService } from './api-token.service';
import { AuthGuard } from '../auth/guard/jwt.guard';
import { CreateTokenDTO } from '../sandbox/dto/sandbox.dto';

/**
 * API 토큰 관리.
 *
 * 발급/조회/폐기는 로그인 JWT 로만 할 수 있다(AuthGuard).
 * API 토큰으로 또 다른 토큰을 만들 수 있으면, 토큰 하나가 유출됐을 때
 * 계정을 통째로 넘겨주는 것과 같아진다.
 */
@UseGuards(AuthGuard)
@Controller('tokens')
export class ApiTokenController {
  constructor(
    private readonly apiTokenService: ApiTokenService,
  ) { }

  @Get()
  async list(@Request() request) {
    return this.apiTokenService.list(request.user.index);
  }

  @HttpCode(201)
  @Post()
  async create(@Body() body: CreateTokenDTO, @Request() request) {
    return this.apiTokenService.create(request.user.index, body.label);
  }

  @Delete('/:index')
  async revoke(@Param('index', ParseIntPipe) index: number, @Request() request) {
    return this.apiTokenService.revoke(request.user.index, index);
  }
}
