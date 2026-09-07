import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuthGuard } from '../auth/guard/jwt.guard';
import { AdminGuard } from '../auth/guard/admin.guard';
import {
  ChangeRoleDTO,
  ClearAreaDTO,
  ListUsersQuery,
  RestrictUserDTO,
  RollbackUserDTO,
} from './dto/admin.dto';

/**
 * 관리자 전용 엔드포인트.
 *
 * 컨트롤러 전체에 AuthGuard → AdminGuard 를 건다.
 * (AuthGuard 가 request.user.role 을 채워야 AdminGuard 가 판단할 수 있으므로 순서가 중요하다)
 */
@UseGuards(AuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
  ) { }

  /** 관리자 패널 진입 시 권한 확인용 */
  @Get('/me')
  me(@Request() request) {
    return {
      title: '관리자',
      internalStatusCode: '0000',
      data: { index: request.user.index, role: request.user.role },
    };
  }

  @Get('/users')
  async listUsers(@Query() query: ListUsersQuery) {
    return this.adminService.listUsers(query);
  }

  @Patch('/users/:index/restrict')
  async setRestricted(
    @Param('index', ParseIntPipe) index: number,
    @Body() body: RestrictUserDTO,
    @Request() request,
  ) {
    return this.adminService.setRestricted(request.user.index, index, body);
  }

  @Patch('/users/:index/role')
  async changeRole(
    @Param('index', ParseIntPipe) index: number,
    @Body() body: ChangeRoleDTO,
    @Request() request,
  ) {
    return this.adminService.changeRole(request.user.index, index, body);
  }

  /** 해당 유저가 칠한 픽셀을 흰색으로 되돌린다 */
  @HttpCode(200)
  @Post('/users/:index/rollback')
  async rollbackUser(
    @Param('index', ParseIntPipe) index: number,
    @Body() body: RollbackUserDTO,
    @Request() request,
  ) {
    return this.adminService.rollbackUser(request.user.index, index, body);
  }

  /** 사각 영역을 한 색으로 덮는다 (기본 흰색) */
  @HttpCode(200)
  @Post('/canvas/clear')
  async clearArea(@Body() body: ClearAreaDTO, @Request() request) {
    return this.adminService.clearArea(request.user.index, body);
  }

  @Get('/logs')
  async getLogs(
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('offset', new ParseIntPipe({ optional: true })) offset?: number,
  ) {
    return this.adminService.getLogs(limit, offset);
  }
}
