import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import {
  SCHOOL_SIS_PERMISSION_MANAGE,
  SCHOOL_SIS_PERMISSION_READ,
} from './school-sis.constants';
import { SkipSchoolLicense } from './school-sis-license.decorators';
import { SchoolSisLicenseService } from './school-sis-license.service';
import {
  ActivateSchoolLicenseDto,
  RenewSchoolLicenseDto,
} from './dto/school-license.dto';

const MANAGE = [
  SCHOOL_SIS_PERMISSION_MANAGE,
  'license:activate',
  'license.manage',
] as const;
const VIEW = [
  SCHOOL_SIS_PERMISSION_READ,
  SCHOOL_SIS_PERMISSION_MANAGE,
  'license:read',
  'license:activate',
] as const;

@ApiBearerAuth()
@ApiTags('school-sis-license')
@SkipSchoolLicense()
@Controller({ path: 'school-sis/license', version: '1' })
export class SchoolSisLicenseController {
  constructor(private readonly licenses: SchoolSisLicenseService) {}

  @Get('status')
  @RequireAnyPermission(...VIEW)
  status(@CurrentUser() user: JwtUser) {
    return this.licenses.snapshot(user.tid);
  }

  @Get('modules')
  @RequireAnyPermission(...VIEW)
  async modules(@CurrentUser() user: JwtUser) {
    const snap = await this.licenses.snapshot(user.tid);
    return { modules: snap.enabledModules };
  }

  @Get('events')
  @RequireAnyPermission(...MANAGE)
  events(@CurrentUser() user: JwtUser) {
    return this.licenses.events(user.tid, user);
  }

  @Post('activate')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @RequireAnyPermission(...MANAGE)
  activate(
    @CurrentUser() user: JwtUser,
    @Body() body: ActivateSchoolLicenseDto,
    @Req() req: { ip?: string; headers?: { 'user-agent'?: string } },
  ) {
    return this.licenses.activate(user.tid, user, body, {
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
  }

  @Post('validate')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @RequireAnyPermission(...VIEW)
  validate(@CurrentUser() user: JwtUser) {
    return this.licenses.validate(user.tid, user, 'manual');
  }

  @Post('renew')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @RequireAnyPermission(...MANAGE)
  renew(
    @CurrentUser() user: JwtUser,
    @Body() body: RenewSchoolLicenseDto,
    @Req() req: { ip?: string; headers?: { 'user-agent'?: string } },
  ) {
    return this.licenses.renew(user.tid, user, body, {
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
  }

  @Post('deactivate')
  @RequireAnyPermission(...MANAGE)
  deactivate(
    @CurrentUser() user: JwtUser,
    @Req() req: { ip?: string; headers?: { 'user-agent'?: string } },
  ) {
    return this.licenses.deactivate(user.tid, user, {
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
  }
}
