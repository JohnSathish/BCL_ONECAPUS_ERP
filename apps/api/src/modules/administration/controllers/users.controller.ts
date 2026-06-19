import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  CurrentUser,
  type JwtUser,
} from '../../../common/decorators/current-user.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../../common/decorators/require-permissions.decorator';
import { extractClientIp } from '../../../common/utils/request-host';
import { AuthService } from '../../auth/auth.service';
import {
  BulkResetPasswordDto,
  BulkUserActionDto,
  CreateUserDto,
  ListUsersQueryDto,
  ResetPasswordDto,
  UpdateUserDto,
} from '../dto/users.dto';
import { UsersService } from '../services/users.service';

@ApiBearerAuth()
@ApiTags('admin-users')
@Controller({ path: 'admin/users', version: '1' })
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly auth: AuthService,
  ) {}

  @Get('summary')
  @RequirePermissions('users:read')
  summary(@CurrentUser() user: JwtUser) {
    return this.users.getSummary(user.tid);
  }

  @Get()
  @RequirePermissions('users:read')
  list(@CurrentUser() user: JwtUser, @Query() query: ListUsersQueryDto) {
    return this.users.list(user.tid, query);
  }

  @Get('activation')
  @RequirePermissions('users:read')
  activationList(
    @CurrentUser() user: JwtUser,
    @Query() query: ListUsersQueryDto,
  ) {
    return this.users.listForActivation(user.tid, query);
  }

  @Get(':id')
  @RequirePermissions('users:read')
  getOne(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.users.getById(user.tid, id);
  }

  @Post()
  @RequirePermissions('users:manage')
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateUserDto) {
    return this.users.create(user.tid, dto, user.sub);
  }

  @Patch(':id')
  @RequirePermissions('users:manage')
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.update(user.tid, id, dto, user.sub);
  }

  @Post(':id/activate')
  @RequirePermissions('users:manage')
  activate(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.users.setStatus(user.tid, id, 'active', user.sub);
  }

  @Post(':id/suspend')
  @RequirePermissions('users:manage')
  suspend(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.users.setStatus(user.tid, id, 'suspended', user.sub);
  }

  @Post(':id/reset-password')
  @RequirePermissions('users:manage')
  resetPassword(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.users.resetPassword(user.tid, id, user.sub, dto);
  }

  @Post('bulk/reset-password')
  @RequirePermissions('users:manage')
  bulkReset(@CurrentUser() user: JwtUser, @Body() dto: BulkResetPasswordDto) {
    return this.users.bulkResetPassword(user.tid, dto, user.sub);
  }

  @Post('bulk/activate')
  @RequirePermissions('users:manage')
  bulkActivate(@CurrentUser() user: JwtUser, @Body() dto: BulkUserActionDto) {
    return this.users.bulkActivate(user.tid, dto, user.sub);
  }

  @Post(':id/send-credentials')
  @RequirePermissions('users:manage')
  sendCredentials(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.users.sendCredentials(user.tid, id, user.sub);
  }

  @Post(':id/impersonate')
  @RequirePermissions('users:impersonate')
  async impersonate(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.auth.startImpersonation(user.tid, user.sub, id, {
      userAgent: req.headers['user-agent'],
      ipAddress: extractClientIp(req),
    });
  }

  @Post('impersonate/end')
  @RequirePermissions('users:impersonate')
  async endImpersonation(
    @CurrentUser() user: JwtUser,
    @Body() body: { impersonationSessionId?: string },
    @Req() req: Request,
  ) {
    return this.auth.endImpersonation(
      user.tid,
      user.sub,
      body.impersonationSessionId ?? user.impersonationSessionId,
      {
        userAgent: req.headers['user-agent'],
        ipAddress: extractClientIp(req),
      },
    );
  }
}
