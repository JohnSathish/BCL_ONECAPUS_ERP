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
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import { TenantResolutionService } from '../tenants/tenant-resolution.service';
import { SchoolWebGalleryService } from '../school-web/school-web-gallery.service';
import { SchoolWebService } from '../school-web/school-web.service';
import { SchoolSisFeesService } from '../school-sis/school-sis-fees.service';
import { SchoolSisTimetableService } from '../school-sis/school-sis-timetable.service';
import {
  SCHOOL_MOBILE_ACCESS_PERMISSIONS,
  SCHOOL_MOBILE_PERMISSION_MANAGE,
  SCHOOL_MOBILE_TENANT_SLUG,
} from './school-mobile.constants';
import {
  PatchSchoolMobileDeviceDto,
  PatchSchoolMobileInboxDto,
  PatchSchoolMobileSettingsDto,
  RegisterSchoolMobileDeviceDto,
  SchoolMobileBroadcastDto,
  UpsertSchoolMobilePrayerDto,
} from './dto/school-mobile.dto';
import { SchoolMobileAccessService } from './school-mobile-access.service';
import { SchoolMobileDeviceService } from './school-mobile-device.service';
import { SchoolMobileHomeService } from './school-mobile-home.service';
import { SchoolMobileInboxService } from './school-mobile-inbox.service';
import { SchoolMobilePrayerService } from './school-mobile-prayer.service';
import { SchoolMobileSettingsService } from './school-mobile-settings.service';

const ACCESS = [...SCHOOL_MOBILE_ACCESS_PERMISSIONS, 'school-sis:read'];

@ApiTags('school-mobile')
@Controller({ path: 'school-mobile', version: '1' })
export class SchoolMobileController {
  constructor(
    private readonly cls: ClsService,
    private readonly tenants: TenantResolutionService,
    private readonly settings: SchoolMobileSettingsService,
    private readonly devices: SchoolMobileDeviceService,
    private readonly home: SchoolMobileHomeService,
    private readonly inbox: SchoolMobileInboxService,
    private readonly prayer: SchoolMobilePrayerService,
    private readonly access: SchoolMobileAccessService,
    private readonly web: SchoolWebService,
    private readonly gallery: SchoolWebGalleryService,
    private readonly timetable: SchoolSisTimetableService,
    private readonly fees: SchoolSisFeesService,
  ) {}

  private async tenantFromHost(
    tenantSlug?: string,
    host?: string,
    loginHost?: string,
  ) {
    const fromCls = this.cls.get<string>(CLS_TENANT_ID);
    if (fromCls) return fromCls;
    const slug = tenantSlug?.trim() || SCHOOL_MOBILE_TENANT_SLUG;
    const bySlug = await this.tenants.resolveSlug(slug);
    if (bySlug) return bySlug.id;
    const resolved = await this.tenants.resolveHost(
      loginHost || host || 'erp.stlukestura.in',
    );
    return resolved.id;
  }

  @Public()
  @Get('bootstrap')
  async bootstrap(
    @Headers('x-tenant-slug') tenantSlug?: string,
    @Headers('host') host?: string,
    @Headers('x-login-host') loginHost?: string,
    @Headers('x-app-platform') platform?: string,
    @Headers('x-app-version') appVersion?: string,
    @Query('platform') platformQuery?: string,
    @Query('appVersion') versionQuery?: string,
  ) {
    const tenantId = await this.tenantFromHost(tenantSlug, host, loginHost);
    return this.settings.bootstrap(tenantId, {
      platform: platformQuery || platform,
      appVersion: versionQuery || appVersion,
    });
  }

  @Get('me')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  me(
    @CurrentUser() user: JwtUser,
    @Query('childId') childId?: string,
    @Headers('x-school-child-id') childHeader?: string,
  ) {
    return this.home.me(user, childId || childHeader);
  }

  @Get('home')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  homeFeed(
    @CurrentUser() user: JwtUser,
    @Query('childId') childId?: string,
    @Headers('x-school-child-id') childHeader?: string,
  ) {
    return this.home.home(user, childId || childHeader);
  }

  @Get('prayer')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  prayerToday(@CurrentUser() user: JwtUser) {
    return this.prayer.today(user.tid);
  }

  @Get('notices')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  notices(@CurrentUser() user: JwtUser) {
    return this.web.listPublishedNotices(user.tid);
  }

  @Get('notices/:slug')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  notice(@CurrentUser() user: JwtUser, @Param('slug') slug: string) {
    return this.web.getPublishedNotice(user.tid, slug);
  }

  @Get('events')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  events(@CurrentUser() user: JwtUser) {
    return this.web.listPublishedEvents(user.tid);
  }

  @Get('events/:slug')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  event(@CurrentUser() user: JwtUser, @Param('slug') slug: string) {
    return this.web.getPublishedEvent(user.tid, slug);
  }

  @Get('gallery')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  galleryList(
    @CurrentUser() user: JwtUser,
    @Query('q') q?: string,
    @Query('page') page?: string,
  ) {
    return this.gallery.listPublic(user.tid, {
      q,
      page: page ? Number(page) : 1,
    });
  }

  @Get('gallery/:slug')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  galleryAlbum(@CurrentUser() user: JwtUser, @Param('slug') slug: string) {
    return this.gallery.getPublic(user.tid, slug);
  }

  @Get('pages/:slug')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  page(@CurrentUser() user: JwtUser, @Param('slug') slug: string) {
    return this.web.getPublishedPage(user.tid, slug);
  }

  @Get('timetable')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  async timetableNow(
    @CurrentUser() user: JwtUser,
    @Query('childId') childId?: string,
  ) {
    const persona = this.access.assertAccess(user);
    if (persona === 'teacher') {
      const staffId = await this.access.staffIdForUser(user.tid, user);
      if (!staffId) return { slots: [] };
      return this.timetable.teacherGrid(user.tid, staffId, false);
    }
    const studentId = await this.access.resolveStudentId(
      user.tid,
      user,
      childId,
    );
    if (!studentId) return { slots: [] };
    return this.timetable.studentGrid(user.tid, studentId);
  }

  @Get('fees')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  async feesNow(
    @CurrentUser() user: JwtUser,
    @Query('childId') childId?: string,
  ) {
    const studentId = await this.access.resolveStudentId(
      user.tid,
      user,
      childId,
    );
    if (!studentId) return { structure: null, structures: [] };
    return this.fees.forStudent(user.tid, studentId);
  }

  @Post('devices/register')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  register(
    @CurrentUser() user: JwtUser,
    @Body() dto: RegisterSchoolMobileDeviceDto,
  ) {
    return this.devices.register(user, dto);
  }

  @Patch('devices/:deviceId')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  patchDevice(
    @CurrentUser() user: JwtUser,
    @Param('deviceId') deviceId: string,
    @Body() dto: PatchSchoolMobileDeviceDto,
  ) {
    return this.devices.update(user, deviceId, dto);
  }

  @Delete('devices/:deviceId')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  unregister(
    @CurrentUser() user: JwtUser,
    @Param('deviceId') deviceId: string,
  ) {
    return this.devices.unregister(user, deviceId);
  }

  @Get('devices/sessions')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  sessions(@CurrentUser() user: JwtUser) {
    return this.devices.listMine(user);
  }

  @Delete('devices/sessions/:id')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  revokeSession(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.devices.revoke(user, id);
  }

  @Get('inbox')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  inboxList(@CurrentUser() user: JwtUser) {
    return this.inbox.list(user);
  }

  @Post('inbox/read-all')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  inboxReadAll(@CurrentUser() user: JwtUser) {
    return this.inbox.markAllRead(user);
  }

  @Patch('inbox/:id')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  inboxPatch(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: PatchSchoolMobileInboxDto,
  ) {
    return this.inbox.patch(user, id, dto);
  }

  @Get('admin/settings')
  @ApiBearerAuth()
  @RequireAnyPermission(SCHOOL_MOBILE_PERMISSION_MANAGE, 'school-sis:manage')
  adminSettings(@CurrentUser() user: JwtUser) {
    return this.settings.getSettings(user.tid);
  }

  @Patch('admin/settings')
  @ApiBearerAuth()
  @RequireAnyPermission(SCHOOL_MOBILE_PERMISSION_MANAGE, 'school-sis:manage')
  patchSettings(
    @CurrentUser() user: JwtUser,
    @Body() dto: PatchSchoolMobileSettingsDto,
  ) {
    return this.settings.updateSettings(user.tid, dto);
  }

  @Get('admin/prayers')
  @ApiBearerAuth()
  @RequireAnyPermission(SCHOOL_MOBILE_PERMISSION_MANAGE, 'school-sis:manage')
  adminPrayers(@CurrentUser() user: JwtUser) {
    return this.prayer.list(user.tid);
  }

  @Patch('admin/prayers')
  @ApiBearerAuth()
  @RequireAnyPermission(SCHOOL_MOBILE_PERMISSION_MANAGE, 'school-sis:manage')
  savePrayer(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpsertSchoolMobilePrayerDto,
  ) {
    return this.prayer.upsert(user.tid, dto);
  }

  @Get('admin/broadcasts')
  @ApiBearerAuth()
  @RequireAnyPermission(SCHOOL_MOBILE_PERMISSION_MANAGE, 'school-sis:manage')
  broadcasts(@CurrentUser() user: JwtUser) {
    return this.inbox.listBroadcasts(user.tid);
  }

  @Post('admin/broadcasts')
  @ApiBearerAuth()
  @RequireAnyPermission(SCHOOL_MOBILE_PERMISSION_MANAGE, 'school-sis:manage')
  sendBroadcast(
    @CurrentUser() user: JwtUser,
    @Body() dto: SchoolMobileBroadcastDto,
  ) {
    return this.inbox.broadcast(user, dto);
  }
}
