import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClsService } from 'nestjs-cls';
import { CLS_TENANT_ID } from '../../common/cls/cls.constants';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import { TenantResolutionService } from '../tenants/tenant-resolution.service';
import {
  IngestAnalyticsEventsDto,
  RegisterDeviceDto,
  UpdateDeviceDto,
  UpdateMobileAppSettingsDto,
} from './dto/mobile-app.dto';
import { MobileAnalyticsService } from './mobile-analytics.service';
import { MobileAppSettingsService } from './mobile-app-settings.service';
import { MobileDeviceService } from './mobile-device.service';
import { MobileHomeService } from './mobile-home.service';
import { MobileSessionService } from './mobile-session.service';
import type { MobileAppType } from './constants/dashboard-config';

@ApiTags('mobile-app')
@Controller({ path: 'mobile-app', version: '1' })
export class MobileAppController {
  constructor(
    private readonly settings: MobileAppSettingsService,
    private readonly devices: MobileDeviceService,
    private readonly analytics: MobileAnalyticsService,
    private readonly home: MobileHomeService,
    private readonly sessions: MobileSessionService,
    private readonly cls: ClsService,
    private readonly tenantResolution: TenantResolutionService,
  ) {}

  @Get('settings')
  @RequirePermissions('mobile:settings:read')
  getSettings(@CurrentUser() user: JwtUser) {
    return this.settings.getSettings(user.tid);
  }

  @Patch('settings')
  @RequirePermissions('mobile:settings:manage')
  updateSettings(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateMobileAppSettingsDto,
  ) {
    return this.settings.updateSettings(user.tid, dto);
  }

  @Public()
  @Get('bootstrap')
  async bootstrap(
    @Headers('x-tenant-slug') tenantSlug: string | undefined,
    @Headers('host') host: string,
    @Query('appType') appTypeQuery?: string,
    @Headers('x-app-type') appTypeHeader?: string,
  ) {
    const slug = tenantSlug?.trim();
    let tenantId = this.cls.get<string>(CLS_TENANT_ID);
    if (!tenantId && slug) {
      const tenant = await this.tenantResolution.resolveSlug(slug);
      tenantId = tenant.id;
    }
    if (!tenantId) {
      const tenant = await this.tenantResolution.resolveHost(host);
      tenantId = tenant.id;
    }
    const raw = (appTypeQuery ?? appTypeHeader ?? 'student').toLowerCase();
    const appType: MobileAppType = raw === 'staff' ? 'STAFF' : 'STUDENT';
    return this.settings.getBootstrapPayload(tenantId, appType);
  }

  @Get('config')
  @RequireAnyPermission('student:portal:self', 'staff:portal:self')
  async config(
    @CurrentUser() user: JwtUser,
    @Headers('x-app-type') appTypeHeader?: string,
  ) {
    const raw = (appTypeHeader ?? '').toLowerCase();
    const appType: MobileAppType =
      raw === 'staff' || user.permissions?.includes('staff:portal:self')
        ? raw === 'student'
          ? 'STUDENT'
          : 'STAFF'
        : user.permissions?.includes('student:portal:self')
          ? 'STUDENT'
          : 'STAFF';
    if (raw === 'student')
      return this.settings.getConfigPayload(user.tid, 'STUDENT');
    if (raw === 'staff')
      return this.settings.getConfigPayload(user.tid, 'STAFF');
    return this.settings.getConfigPayload(
      user.tid,
      user.permissions?.includes('staff:portal:self') &&
        !user.permissions?.includes('student:portal:self')
        ? 'STAFF'
        : 'STUDENT',
    );
  }

  @Post('devices/register')
  @RequireAnyPermission('student:portal:self', 'staff:portal:self')
  registerDevice(@CurrentUser() user: JwtUser, @Body() dto: RegisterDeviceDto) {
    return this.devices.register(user, dto);
  }

  @Patch('devices/:deviceId')
  @RequireAnyPermission('student:portal:self', 'staff:portal:self')
  updateDevice(
    @CurrentUser() user: JwtUser,
    @Param('deviceId') deviceId: string,
    @Body() dto: UpdateDeviceDto,
  ) {
    return this.devices.update(user, deviceId, dto);
  }

  @Delete('devices/:deviceId')
  @RequireAnyPermission('student:portal:self', 'staff:portal:self')
  unregisterDevice(
    @CurrentUser() user: JwtUser,
    @Param('deviceId') deviceId: string,
  ) {
    return this.devices.unregister(user, deviceId);
  }

  @Post('devices/:deviceId/block')
  @RequirePermissions('mobile:settings:manage')
  blockDevice(
    @CurrentUser() user: JwtUser,
    @Param('deviceId') deviceId: string,
  ) {
    return this.devices.blockDevice(user.tid, deviceId);
  }

  @Get('devices/sessions')
  @RequireAnyPermission('student:portal:self', 'staff:portal:self')
  listDeviceSessions(@CurrentUser() user: JwtUser) {
    return this.sessions.listSessions(user);
  }

  @Delete('devices/sessions/:id')
  @RequireAnyPermission('student:portal:self', 'staff:portal:self')
  revokeDeviceSession(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.sessions.revokeSession(user.tid, id);
  }

  @Post('sessions/:id/revoke')
  @RequirePermissions('sessions:manage')
  adminRevokeSession(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.sessions.revokeSession(user.tid, id);
  }

  @Post('users/:userId/revoke-all')
  @RequirePermissions('sessions:manage')
  adminRevokeAll(
    @CurrentUser() user: JwtUser,
    @Param('userId') userId: string,
  ) {
    return this.sessions.revokeAllForUser(user.tid, userId);
  }

  @Get('student/home')
  @RequirePermissions('student:portal:self')
  studentHome(@CurrentUser() user: JwtUser) {
    return this.home.studentHome(user);
  }

  @Get('staff/home')
  @RequirePermissions('staff:portal:self')
  staffHome(@CurrentUser() user: JwtUser) {
    return this.home.staffHome(user);
  }

  @Post('analytics/events')
  @RequireAnyPermission('student:portal:self', 'staff:portal:self')
  ingestEvents(
    @CurrentUser() user: JwtUser,
    @Body() dto: IngestAnalyticsEventsDto,
  ) {
    return this.analytics.ingest(user, dto);
  }

  @Get('analytics/dashboard')
  @RequirePermissions('mobile:settings:read')
  analyticsDashboard(
    @CurrentUser() user: JwtUser,
    @Query('days') days?: string,
  ) {
    return this.analytics.dashboard(user.tid, days ? parseInt(days, 10) : 30);
  }
}
