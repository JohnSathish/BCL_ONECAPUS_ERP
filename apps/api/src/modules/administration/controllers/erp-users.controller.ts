import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import {
  CreateErpUserDto,
  ErpUserResetPasswordDto,
  ListErpUsersQueryDto,
  UpdateErpUserDto,
} from '../dto/erp-users.dto';
import { ErpUsersService } from '../services/erp-users.service';

@ApiBearerAuth()
@ApiTags('admin-erp-users')
@Controller({ path: 'admin/erp-users', version: '1' })
export class ErpUsersController {
  constructor(private readonly erpUsers: ErpUsersService) {}

  @Get('summary')
  @RequirePermissions('users:read')
  summary(@CurrentUser() user: JwtUser) {
    return this.erpUsers.summary(user.tid);
  }

  @Get('options')
  @RequirePermissions('users:read')
  options(@CurrentUser() user: JwtUser) {
    return this.erpUsers.options(user.tid, user);
  }

  @Get()
  @RequirePermissions('users:read')
  list(@CurrentUser() user: JwtUser, @Query() query: ListErpUsersQueryDto) {
    return this.erpUsers.list(user.tid, query);
  }

  @Get(':id')
  @RequirePermissions('users:read')
  getOne(@CurrentUser() user: JwtUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.erpUsers.getOne(user.tid, id);
  }

  @Get(':id/login-history')
  @RequirePermissions('users:read')
  loginHistory(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.erpUsers.loginHistory(user.tid, id, page, limit);
  }

  @Post()
  @RequirePermissions('users:manage', 'rbac:manage')
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateErpUserDto) {
    return this.erpUsers.create(user.tid, dto, user);
  }

  @Patch(':id')
  @RequirePermissions('users:manage', 'rbac:manage')
  update(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateErpUserDto,
  ) {
    return this.erpUsers.update(user.tid, id, dto, user);
  }

  @Post(':id/activate')
  @RequirePermissions('users:manage')
  activate(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.erpUsers.activate(user.tid, id, user);
  }

  @Post(':id/deactivate')
  @RequirePermissions('users:manage')
  deactivate(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.erpUsers.deactivate(user.tid, id, user);
  }

  @Post(':id/lock')
  @RequirePermissions('users:manage')
  lock(@CurrentUser() user: JwtUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.erpUsers.lock(user.tid, id, user);
  }

  @Post(':id/unlock')
  @RequirePermissions('users:manage')
  unlock(@CurrentUser() user: JwtUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.erpUsers.unlock(user.tid, id, user);
  }

  @Post(':id/reset-password')
  @RequirePermissions('users:manage')
  resetPassword(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ErpUserResetPasswordDto,
  ) {
    return this.erpUsers.resetPassword(user.tid, id, dto, user);
  }

  @Post(':id/force-password-change')
  @RequirePermissions('users:manage')
  forcePasswordChange(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.erpUsers.forcePasswordChange(user.tid, id, user);
  }

  @Post(':id/revoke-sessions')
  @RequirePermissions('users:manage')
  revokeSessions(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.erpUsers.revokeSessions(user.tid, id, user);
  }
}
