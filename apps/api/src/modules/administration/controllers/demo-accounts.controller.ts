import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../../common/decorators/require-permissions.decorator';
import { DemoAccountsService } from '../services/demo-accounts.service';
import {
  CreateDemoAccountDto,
  ResetDemoPasswordDto,
  SendDemoNotificationDto,
  SetDemoActiveDto,
} from '../dto/demo-accounts.dto';

@ApiBearerAuth()
@ApiTags('administration')
@Controller({ path: 'admin/demo-accounts', version: '1' })
export class DemoAccountsController {
  constructor(private readonly demo: DemoAccountsService) {}

  @Get()
  @RequireAnyPermission('users:read', 'users:manage')
  list(@CurrentUser() user: JwtUser) {
    return this.demo.list(user.tid);
  }

  @Post()
  @RequireAnyPermission('users:manage')
  create(@CurrentUser() user: JwtUser, @Body() body: CreateDemoAccountDto) {
    return this.demo.create(user.tid, body);
  }

  @Post(':userId/password')
  @RequireAnyPermission('users:manage')
  resetPassword(
    @CurrentUser() user: JwtUser,
    @Param('userId') userId: string,
    @Body() body: ResetDemoPasswordDto,
  ) {
    return this.demo.resetPassword(user.tid, userId, body.password);
  }

  @Patch(':userId/status')
  @RequireAnyPermission('users:manage')
  setActive(
    @CurrentUser() user: JwtUser,
    @Param('userId') userId: string,
    @Body() body: SetDemoActiveDto,
  ) {
    return this.demo.setActive(user.tid, userId, body.active);
  }

  @Get(':userId/devices')
  @RequireAnyPermission('users:read', 'users:manage')
  devices(@CurrentUser() user: JwtUser, @Param('userId') userId: string) {
    return this.demo.devices(user.tid, userId);
  }

  @Get(':userId/notifications')
  @RequireAnyPermission('users:read', 'users:manage')
  notifications(@CurrentUser() user: JwtUser, @Param('userId') userId: string) {
    return this.demo.notificationHistory(user.tid, userId);
  }

  @Post(':userId/notifications')
  @RequireAnyPermission('users:manage')
  send(
    @CurrentUser() user: JwtUser,
    @Param('userId') userId: string,
    @Body() body: SendDemoNotificationDto,
  ) {
    return this.demo.sendTest(user, userId, body);
  }
}
