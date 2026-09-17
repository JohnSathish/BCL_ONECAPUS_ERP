import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import { extractClientIp } from '../../common/utils/request-host';
import {
  SIS_DEVICES_BLOCK,
  SIS_DEVICES_LOGS,
  SIS_DEVICES_REVOKE,
  SIS_DEVICES_SIGNOUT,
  SIS_DEVICES_VIEW,
} from './school-sis-iam.perms';
import { SchoolSisDevicesService } from './school-sis-devices.service';

@ApiTags('school-sis-devices')
@ApiBearerAuth()
@Controller({ path: 'school-sis/devices', version: '1' })
export class SchoolSisDevicesController {
  constructor(private readonly devices: SchoolSisDevicesService) {}

  @Get('overview')
  @RequireAnyPermission(...SIS_DEVICES_VIEW)
  overview(@CurrentUser() user: JwtUser) {
    return this.devices.overview(user.tid);
  }

  @Get()
  @RequireAnyPermission(...SIS_DEVICES_VIEW)
  list(
    @CurrentUser() user: JwtUser,
    @Query('search') search?: string,
    @Query('persona') persona?: string,
    @Query('platform') platform?: string,
    @Query('status') status?: string,
    @Query('session') session?: string,
    @Query('appVersion') appVersion?: string,
    @Query('lastActive') lastActive?: string,
    @Query('security') security?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.devices.list(user.tid, user, {
      search,
      persona,
      platform,
      status,
      session,
      appVersion,
      lastActive,
      security,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 25,
    });
  }

  @Get('logs')
  @RequireAnyPermission(...SIS_DEVICES_LOGS)
  logs(
    @CurrentUser() user: JwtUser,
    @Query('page') page?: string,
    @Query('search') search?: string,
    @Query('eventType') eventType?: string,
  ) {
    return this.devices.logs(user.tid, {
      page: page ? Number(page) : 1,
      search,
      eventType,
    });
  }

  @Get(':id')
  @RequireAnyPermission(...SIS_DEVICES_VIEW)
  one(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.devices.get(user.tid, user, id);
  }

  @Post('bulk')
  @RequireAnyPermission(...SIS_DEVICES_SIGNOUT)
  bulk(
    @CurrentUser() user: JwtUser,
    @Body()
    body: {
      ids: string[];
      action: 'revoke' | 'signout' | 'block';
      reason?: string;
    },
    @Req() req: Request,
  ) {
    return this.devices.bulk(
      user.tid,
      user,
      body.ids ?? [],
      body.action,
      body.reason,
      extractClientIp(req),
    );
  }

  @Post('user/:userId/revoke-all')
  @RequireAnyPermission(...SIS_DEVICES_REVOKE)
  revokeAll(
    @CurrentUser() user: JwtUser,
    @Param('userId') userId: string,
    @Body() body: { reason?: string },
    @Req() req: Request,
  ) {
    return this.devices.revokeAll(
      user.tid,
      user,
      userId,
      body?.reason,
      extractClientIp(req),
    );
  }

  @Post(':id/sign-out')
  @RequireAnyPermission(...SIS_DEVICES_SIGNOUT)
  signOut(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Req() req: Request,
  ) {
    return this.devices.signOut(
      user.tid,
      user,
      id,
      body?.reason,
      extractClientIp(req),
    );
  }

  @Post(':id/revoke')
  @RequireAnyPermission(...SIS_DEVICES_REVOKE)
  revoke(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Req() req: Request,
  ) {
    return this.devices.revoke(
      user.tid,
      user,
      id,
      body?.reason,
      extractClientIp(req),
    );
  }

  @Post(':id/block')
  @RequireAnyPermission(...SIS_DEVICES_BLOCK)
  block(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Req() req: Request,
  ) {
    return this.devices.block(
      user.tid,
      user,
      id,
      body?.reason,
      extractClientIp(req),
    );
  }

  @Post(':id/unblock')
  @RequireAnyPermission(...SIS_DEVICES_BLOCK)
  unblock(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.devices.unblock(user.tid, user, id, extractClientIp(req));
  }
}
