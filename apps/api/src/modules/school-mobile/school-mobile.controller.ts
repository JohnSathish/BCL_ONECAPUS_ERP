import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClsService } from 'nestjs-cls';
import { CLS_TENANT_ID } from '../../common/cls/cls.constants';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import { extractClientIp } from '../../common/utils/request-host';
import { TenantResolutionService } from '../tenants/tenant-resolution.service';
import { SchoolWebGalleryService } from '../school-web/school-web-gallery.service';
import { SchoolWebService } from '../school-web/school-web.service';
import { SchoolSisFeesService } from '../school-sis/school-sis-fees.service';
import { SchoolSisMonthlyFeesService } from '../school-sis/school-sis-monthly-fees.service';
import { SchoolSisTimetableService } from '../school-sis/school-sis-timetable.service';
import { SchoolSisAttendanceService } from '../school-sis/school-sis-attendance.service';
import { SchoolSisExamsService } from '../school-sis/school-sis-exams.service';
import { SchoolSisHrService } from '../school-sis/school-sis-hr.service';
import { SchoolSisTransportService } from '../school-sis/school-sis-transport.service';
import { SchoolSisAccessService } from '../school-sis/school-sis-access.service';
import { SchoolSisLibraryService } from '../school-sis/school-sis-library.service';
import { SchoolSisCalendarService } from '../school-sis/school-sis-calendar.service';
import { SchoolSisPaymentGatewaysService } from '../school-sis/school-sis-payment-gateways.service';
import { SubmitAttendanceDto } from '../school-sis/dto/school-attendance.dto';
import {
  GpsPingDto,
  MobileBoardingDto,
  MobileSosDto,
} from '../school-sis/dto/school-transport.dto';
import {
  SCHOOL_SIS_PERMISSION_MANAGE,
  SCHOOL_SIS_PERMISSION_READ,
} from '../school-sis/school-sis.constants';
import {
  SIS_ATTENDANCE_MARK,
  SIS_ATTENDANCE_VIEW,
} from '../school-sis/school-sis-iam.perms';
import {
  SCHOOL_MOBILE_ACCESS_PERMISSIONS,
  SCHOOL_MOBILE_PERMISSION_MANAGE,
  SCHOOL_MOBILE_PERMISSION_STAFF,
  SCHOOL_MOBILE_TENANT_SLUG,
} from './school-mobile.constants';
import {
  PatchSchoolMobileDeviceDto,
  PatchSchoolMobileInboxDto,
  PatchSchoolMobileSettingsDto,
  RegisterSchoolMobileDeviceDto,
  SchoolAuthChallengeDto,
  SchoolAuthCodeDto,
  SchoolAuthIdentifierDto,
  SchoolAuthLogoutDto,
  SchoolAuthOtpDto,
  SchoolAuthSetPasswordDto,
  SchoolMobileBroadcastDto,
  SchoolMobileChangePasswordDto,
  SchoolMobileFeedbackDto,
  SchoolMobileLeaveDto,
  SchoolMobileLoginDto,
  UpsertSchoolMobilePrayerDto,
} from './dto/school-mobile.dto';
import { SchoolMobileAccessService } from './school-mobile-access.service';
import { SchoolMobileAuthService } from './school-mobile-auth.service';
import { SchoolMobileAccountAuthService } from './school-mobile-account-auth.service';
import { SchoolMobileDeviceService } from './school-mobile-device.service';
import { SchoolMobileHomeService } from './school-mobile-home.service';
import { SchoolMobilePrincipalService } from './school-mobile-principal.service';
import { SchoolMobileInboxService } from './school-mobile-inbox.service';
import { SchoolMobilePrayerService } from './school-mobile-prayer.service';
import { SchoolMobileSettingsService } from './school-mobile-settings.service';

const ACCESS = [...SCHOOL_MOBILE_ACCESS_PERMISSIONS, 'school-sis:read'];
const OFFICE = [
  ...ACCESS,
  SCHOOL_SIS_PERMISSION_READ,
  SCHOOL_SIS_PERMISSION_MANAGE,
] as const;

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
    private readonly auth: SchoolMobileAuthService,
    private readonly accountAuth: SchoolMobileAccountAuthService,
    private readonly web: SchoolWebService,
    private readonly gallery: SchoolWebGalleryService,
    private readonly timetable: SchoolSisTimetableService,
    private readonly fees: SchoolSisFeesService,
    private readonly monthlyFees: SchoolSisMonthlyFeesService,
    private readonly attendance: SchoolSisAttendanceService,
    private readonly exams: SchoolSisExamsService,
    private readonly hr: SchoolSisHrService,
    private readonly transport: SchoolSisTransportService,
    private readonly sisAccess: SchoolSisAccessService,
    private readonly calendar: SchoolSisCalendarService,
    private readonly gateways: SchoolSisPaymentGatewaysService,
    private readonly library: SchoolSisLibraryService,
    private readonly principal: SchoolMobilePrincipalService,
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

  @Public()
  @Post('login')
  async login(
    @Req() req: Request,
    @Body() dto: SchoolMobileLoginDto,
    @Headers('x-tenant-slug') tenantSlug?: string,
    @Headers('host') host?: string,
    @Headers('x-login-host') loginHost?: string,
    @Headers('x-device-id') deviceHeader?: string,
    @Headers('x-app-version') appVersion?: string,
    @Headers('x-app-platform') platform?: string,
  ) {
    const tenantId = await this.tenantFromHost(tenantSlug, host, loginHost);
    return this.accountAuth.login(tenantId, dto.identifier, dto.password, {
      deviceId: dto.deviceId || deviceHeader,
      deviceLabel: dto.deviceLabel,
      clientType: 'mobile',
      appVersion,
      platform,
      userAgent: req.headers['user-agent'],
      ipAddress:
        (req.headers['x-forwarded-for'] as string | undefined)
          ?.split(',')[0]
          ?.trim() || req.ip,
    });
  }

  @Post('change-password')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  changePassword(
    @Req() req: Request,
    @CurrentUser() user: JwtUser,
    @Body() dto: SchoolMobileChangePasswordDto,
    @Headers('x-device-id') deviceHeader?: string,
    @Headers('x-app-version') appVersion?: string,
    @Headers('x-app-platform') platform?: string,
  ) {
    return this.accountAuth.changePassword(
      user.tid,
      user.sub,
      dto.currentPassword,
      dto.newPassword,
      {
        deviceId: deviceHeader,
        clientType: 'mobile',
        appVersion,
        platform,
        userAgent: req.headers['user-agent'],
        ipAddress:
          (req.headers['x-forwarded-for'] as string | undefined)
            ?.split(',')[0]
            ?.trim() || req.ip,
      },
    );
  }

  @Public()
  @Post('auth/activate/start')
  async activateStart(
    @Req() req: Request,
    @Body() dto: SchoolAuthIdentifierDto,
    @Headers('x-tenant-slug') tenantSlug?: string,
    @Headers('host') host?: string,
    @Headers('x-login-host') loginHost?: string,
  ) {
    const tenantId = await this.tenantFromHost(tenantSlug, host, loginHost);
    return this.accountAuth.startChallenge(
      tenantId,
      dto.identifier,
      'ACTIVATE',
      req.ip,
    );
  }

  @Public()
  @Post('auth/forgot-password')
  async forgotStart(
    @Req() req: Request,
    @Body() dto: SchoolAuthIdentifierDto,
    @Headers('x-tenant-slug') tenantSlug?: string,
    @Headers('host') host?: string,
    @Headers('x-login-host') loginHost?: string,
  ) {
    const tenantId = await this.tenantFromHost(tenantSlug, host, loginHost);
    return this.accountAuth.startChallenge(
      tenantId,
      dto.identifier,
      'RESET',
      req.ip,
    );
  }

  @Public()
  @Post('auth/activate/send-otp')
  async activateSendOtp(
    @Req() req: Request,
    @Body() dto: SchoolAuthChallengeDto,
    @Headers('x-tenant-slug') tenantSlug?: string,
    @Headers('host') host?: string,
    @Headers('x-login-host') loginHost?: string,
  ) {
    const tenantId = await this.tenantFromHost(tenantSlug, host, loginHost);
    return this.accountAuth.sendOtp(tenantId, dto.challengeId, req.ip);
  }

  @Public()
  @Post('auth/forgot-password/send-otp')
  async forgotSendOtp(
    @Req() req: Request,
    @Body() dto: SchoolAuthChallengeDto,
    @Headers('x-tenant-slug') tenantSlug?: string,
    @Headers('host') host?: string,
    @Headers('x-login-host') loginHost?: string,
  ) {
    const tenantId = await this.tenantFromHost(tenantSlug, host, loginHost);
    return this.accountAuth.sendOtp(tenantId, dto.challengeId, req.ip);
  }

  @Public()
  @Post('auth/activate/verify-otp')
  async activateVerifyOtp(
    @Body() dto: SchoolAuthOtpDto,
    @Headers('x-tenant-slug') tenantSlug?: string,
    @Headers('host') host?: string,
    @Headers('x-login-host') loginHost?: string,
  ) {
    const tenantId = await this.tenantFromHost(tenantSlug, host, loginHost);
    return this.accountAuth.verifyOtp(tenantId, dto.challengeId, dto.otp);
  }

  @Public()
  @Post('auth/forgot-password/verify-otp')
  async forgotVerifyOtp(
    @Body() dto: SchoolAuthOtpDto,
    @Headers('x-tenant-slug') tenantSlug?: string,
    @Headers('host') host?: string,
    @Headers('x-login-host') loginHost?: string,
  ) {
    const tenantId = await this.tenantFromHost(tenantSlug, host, loginHost);
    return this.accountAuth.verifyOtp(tenantId, dto.challengeId, dto.otp);
  }

  @Public()
  @Post('auth/activate/verify-code')
  async activateVerifyCode(
    @Body() dto: SchoolAuthCodeDto,
    @Headers('x-tenant-slug') tenantSlug?: string,
    @Headers('host') host?: string,
    @Headers('x-login-host') loginHost?: string,
  ) {
    const tenantId = await this.tenantFromHost(tenantSlug, host, loginHost);
    return this.accountAuth.verifyActivationCode(
      tenantId,
      dto.challengeId,
      dto.code,
    );
  }

  @Public()
  @Post('auth/activate/set-password')
  async activateSetPassword(
    @Body() dto: SchoolAuthSetPasswordDto,
    @Headers('x-tenant-slug') tenantSlug?: string,
    @Headers('host') host?: string,
    @Headers('x-login-host') loginHost?: string,
  ) {
    const tenantId = await this.tenantFromHost(tenantSlug, host, loginHost);
    return this.accountAuth.setPasswordFromChallenge(
      tenantId,
      dto.challengeId,
      dto.newPassword,
      dto.confirmPassword,
    );
  }

  @Public()
  @Post('auth/forgot-password/set-password')
  async forgotSetPassword(
    @Body() dto: SchoolAuthSetPasswordDto,
    @Headers('x-tenant-slug') tenantSlug?: string,
    @Headers('host') host?: string,
    @Headers('x-login-host') loginHost?: string,
  ) {
    const tenantId = await this.tenantFromHost(tenantSlug, host, loginHost);
    return this.accountAuth.setPasswordFromChallenge(
      tenantId,
      dto.challengeId,
      dto.newPassword,
      dto.confirmPassword,
    );
  }

  @Get('auth/sessions')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  sessions(
    @CurrentUser() user: JwtUser,
    @Headers('x-refresh-token') refresh?: string,
  ) {
    return this.accountAuth.sessions(user.tid, user.sub, refresh);
  }

  @Post('auth/sessions/revoke')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  revokeSession(
    @CurrentUser() user: JwtUser,
    @Body() body: { sessionId?: string },
  ) {
    return this.accountAuth.revokeSession(
      user.tid,
      user.sub,
      String(body.sessionId || ''),
    );
  }

  @Post('auth/sessions/revoke-others')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  revokeOthers(@CurrentUser() user: JwtUser, @Body() dto: SchoolAuthLogoutDto) {
    return this.accountAuth.revokeOtherSessions(
      user.tid,
      user.sub,
      dto.refreshToken,
    );
  }

  @Post('auth/sessions/revoke-all')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  revokeAllSessions(@CurrentUser() user: JwtUser) {
    return this.accountAuth.logoutAll(user.tid, user.sub);
  }

  @Post('auth/logout')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  logout(@CurrentUser() user: JwtUser, @Body() dto: SchoolAuthLogoutDto) {
    return this.accountAuth.logout(user.tid, user.sub, dto.refreshToken);
  }

  @Post('auth/logout-all')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  logoutAll(@CurrentUser() user: JwtUser) {
    return this.accountAuth.logoutAll(user.tid, user.sub);
  }

  @Post('feedback')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  async feedback(
    @CurrentUser() user: JwtUser,
    @Body() dto: SchoolMobileFeedbackDto,
  ) {
    const me = await this.home.me(user);
    return this.web.submitEnquiry(user.tid, {
      name: me.displayName,
      email: me.email,
      phone: dto.phone,
      subject: dto.subject || 'App feedback',
      message: dto.message,
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

  @Get('principal/desk')
  @ApiBearerAuth()
  @RequireAnyPermission(...OFFICE)
  principalDesk(@CurrentUser() user: JwtUser) {
    return this.principal.desk(user);
  }

  @Get('principal/students')
  @ApiBearerAuth()
  @RequireAnyPermission(...OFFICE)
  principalStudents(
    @CurrentUser() user: JwtUser,
    @Query('q') q?: string,
    @Query('gradeId') gradeId?: string,
  ) {
    return this.principal.students(user, q, gradeId);
  }

  @Get('principal/teachers')
  @ApiBearerAuth()
  @RequireAnyPermission(...OFFICE)
  principalTeachers(@CurrentUser() user: JwtUser, @Query('q') q?: string) {
    return this.principal.teachers(user, q);
  }

  @Get('principal/academics')
  @ApiBearerAuth()
  @RequireAnyPermission(...OFFICE)
  principalAcademics(@CurrentUser() user: JwtUser) {
    return this.principal.academics(user);
  }

  @Get('principal/examinations')
  @ApiBearerAuth()
  @RequireAnyPermission(...OFFICE)
  principalExams(@CurrentUser() user: JwtUser) {
    return this.principal.examinations(user);
  }

  @Get('principal/attendance')
  @ApiBearerAuth()
  @RequireAnyPermission(...OFFICE)
  principalAttendance(@CurrentUser() user: JwtUser) {
    return this.principal.attendanceOverview(user);
  }

  @Get('principal/fees')
  @ApiBearerAuth()
  @RequireAnyPermission(...OFFICE)
  principalFees(@CurrentUser() user: JwtUser) {
    return this.principal.feesOverview(user);
  }

  @Get('principal/notices')
  @ApiBearerAuth()
  @RequireAnyPermission(...OFFICE)
  principalNotices(@CurrentUser() user: JwtUser) {
    return this.principal.notices(user);
  }

  @Get('leave-types')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  leaveTypes(@CurrentUser() user: JwtUser) {
    return this.home.leaveTypes(user);
  }

  @Get('leave')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  leaves(
    @CurrentUser() user: JwtUser,
    @Query('childId') childId?: string,
    @Headers('x-school-child-id') childHeader?: string,
  ) {
    return this.home.leaves(user, childId || childHeader);
  }

  @Post('leave')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  applyLeave(@CurrentUser() user: JwtUser, @Body() dto: SchoolMobileLeaveDto) {
    return this.home.applyLeave(user, dto);
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
    if (!studentId)
      return { structure: null, structures: [], monthly: null, profile: null };
    const [pack, monthly, profile] = await Promise.all([
      this.fees.forStudent(user.tid, studentId).catch(() => ({
        structure: null,
        structures: [],
        student: null,
        enrollment: null,
      })),
      this.monthlyFees.ledger(user.tid, studentId).catch(() => null),
      this.home.me(user, childId),
    ]);
    return { ...pack, monthly, profile: profile.student ?? null };
  }

  @Get('attendance')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  async attendanceNow(
    @CurrentUser() user: JwtUser,
    @Query('childId') childId?: string,
  ) {
    const studentId = await this.access.resolveStudentId(
      user.tid,
      user,
      childId,
    );
    if (!studentId) return { percent: null, calendar: [] };
    return this.attendance.studentProfile(user.tid, studentId);
  }

  @Get('exams')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  async examsNow(
    @CurrentUser() user: JwtUser,
    @Query('childId') childId?: string,
  ) {
    const studentId = await this.access.resolveStudentId(
      user.tid,
      user,
      childId,
    );
    if (!studentId) return [];
    return this.exams.studentPublished(user.tid, studentId);
  }

  @Get('teacher/today')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS, 'attendance.view', 'attendance.create')
  teacherToday(@CurrentUser() user: JwtUser, @Query('date') date?: string) {
    return this.attendance.teacherToday(user.tid, user.sub, date);
  }

  @Get('hr/me')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS, 'hr.self.view')
  async hrMe(@CurrentUser() user: JwtUser) {
    const id = await this.hr.ownStaffId(user.tid, user.sub);
    if (!id) return { staff: null };
    return this.hr.employee(user.tid, id, {
      userId: user.sub,
      manageHr: false,
      payrollView: true,
      payrollCalc: false,
      payrollApprove: false,
      payrollPay: false,
      revealBank: false,
    });
  }

  @Get('payment-gateways/active')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  paymentGatewayActive(@CurrentUser() user: JwtUser) {
    return this.gateways.activePublic(user.tid);
  }

  @Get('calendar')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  calendarMonth(
    @CurrentUser() user: JwtUser,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const now = new Date();
    return this.calendar.monthGrid(
      user.tid,
      Number(year) || now.getFullYear(),
      Number(month) || now.getMonth() + 1,
    );
  }

  @Get('attendance/roster')
  @ApiBearerAuth()
  @RequireAnyPermission(
    SCHOOL_MOBILE_PERMISSION_STAFF,
    SCHOOL_MOBILE_PERMISSION_MANAGE,
    'school-sis:read',
    'school-sis:manage',
    ...SIS_ATTENDANCE_VIEW,
  )
  async attendanceRoster(
    @CurrentUser() user: JwtUser,
    @Query('date') date: string,
    @Query('sectionId') sectionId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('mode') mode?: string,
    @Query('periodKey') periodKey?: string,
  ) {
    await this.sisAccess.assertSectionAccess(user.tid, user, sectionId);
    const perms = user.permissions ?? [];
    const manage =
      perms.includes(SCHOOL_SIS_PERMISSION_MANAGE) || perms.includes('*');
    return this.attendance.roster(
      user.tid,
      { date, sectionId, academicYearId, mode, periodKey },
      {
        userId: user.sub,
        email: user.email,
        manage,
        canApprove: manage,
        canLock: manage,
      },
    );
  }

  @Post('attendance/submit')
  @ApiBearerAuth()
  @RequireAnyPermission(
    SCHOOL_MOBILE_PERMISSION_STAFF,
    SCHOOL_MOBILE_PERMISSION_MANAGE,
    'school-sis:manage',
    ...SIS_ATTENDANCE_MARK,
  )
  async attendanceSubmit(
    @CurrentUser() user: JwtUser,
    @Body() dto: SubmitAttendanceDto,
    @Req() req: Request,
  ) {
    await this.sisAccess.assertSectionAccess(user.tid, user, dto.sectionId);
    const perms = user.permissions ?? [];
    const manage =
      perms.includes(SCHOOL_SIS_PERMISSION_MANAGE) || perms.includes('*');
    return this.attendance.saveRoster(
      user.tid,
      dto,
      {
        userId: user.sub,
        email: user.email,
        manage,
        canApprove: manage,
        canLock: manage,
        ip:
          (req.headers['x-forwarded-for'] as string | undefined)
            ?.split(',')[0]
            ?.trim() || req.ip,
      },
      dto.asDraft ?? false,
    );
  }

  @Post('devices/register')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  register(
    @CurrentUser() user: JwtUser,
    @Body() dto: RegisterSchoolMobileDeviceDto,
    @Req() req: Request,
  ) {
    return this.devices.register(user, dto, extractClientIp(req));
  }

  @Post('devices/heartbeat')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  heartbeat(
    @CurrentUser() user: JwtUser,
    @Body() dto: { deviceId: string; networkType?: string },
    @Req() req: Request,
  ) {
    return this.devices.heartbeat(user, dto, extractClientIp(req));
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
  listDeviceSessions(
    @CurrentUser() user: JwtUser,
    @Headers('x-device-id') deviceHeader?: string,
  ) {
    return this.devices.listMine(user, deviceHeader);
  }

  @Post('devices/sign-out-others')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  signOutOthers(
    @CurrentUser() user: JwtUser,
    @Headers('x-device-id') deviceHeader?: string,
  ) {
    if (!deviceHeader) throw new BadRequestException('Missing device');
    return this.devices.signOutOthers(user, deviceHeader);
  }

  @Delete('devices/sessions/:id')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  revokeDeviceSession(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.devices.revoke(user, id);
  }

  @Get('inbox')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  inboxList(@CurrentUser() user: JwtUser) {
    return this.inbox.list(user);
  }

  @Get('inbox/:id')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  inboxOne(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.inbox.get(user, id);
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

  @Delete('inbox/:id')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  inboxRemove(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.inbox.remove(user, id);
  }

  @Get('transport/my-trip')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS, 'transport.routes.view')
  async myTrip(@CurrentUser() user: JwtUser) {
    const staffId = await this.access.staffIdForUser(user.tid, user);
    return this.transport.mobileMyTrip(user.tid, staffId);
  }

  @Get('transport/students')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS, 'transport.attendance.manage')
  async tripStudents(
    @CurrentUser() user: JwtUser,
    @Query('tripId') tripId: string,
  ) {
    const staffId = await this.access.staffIdForUser(user.tid, user);
    await this.transport.assertTripStaff(user.tid, tripId, staffId);
    return this.transport.tripRoster(user.tid, tripId);
  }

  @Post('transport/boarding')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS, 'transport.attendance.manage')
  async board(@CurrentUser() user: JwtUser, @Body() dto: MobileBoardingDto) {
    const staffId = await this.access.staffIdForUser(user.tid, user);
    await this.transport.assertTripStaff(user.tid, dto.tripId, staffId);
    return this.transport.recordBoarding(
      user.tid,
      { userId: user.sub, manage: false, canOverride: false },
      dto.tripId,
      dto,
    );
  }

  @Post('transport/location')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS, 'transport.attendance.manage')
  async loc(@CurrentUser() user: JwtUser, @Body() dto: GpsPingDto) {
    const staffId = await this.access.staffIdForUser(user.tid, user);
    if (dto.tripId) {
      await this.transport.assertTripStaff(user.tid, dto.tripId, staffId);
    }
    return this.transport.pingGps(
      user.tid,
      { userId: user.sub, manage: false, canOverride: false },
      dto,
    );
  }

  @Post('transport/sos')
  @ApiBearerAuth()
  @RequireAnyPermission(
    ...ACCESS,
    'transport.incident.manage',
    'transport.attendance.manage',
  )
  async sos(@CurrentUser() user: JwtUser, @Body() dto: MobileSosDto) {
    return this.transport.saveIncident(
      user.tid,
      { userId: user.sub, manage: true, canOverride: false },
      {
        kind: 'SOS',
        severity: 'CRITICAL',
        sos: true,
        tripId: dto.tripId,
        vehicleId: dto.vehicleId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        description:
          dto.description || 'Emergency SOS from driver/attendant app',
      },
    );
  }

  @Get('transport/parent')
  @ApiBearerAuth()
  @RequireAnyPermission(
    ...ACCESS,
    'school-mobile:parent',
    'school-mobile:student',
  )
  async parentTransport(
    @CurrentUser() user: JwtUser,
    @Query('childId') childId?: string,
  ) {
    const persona = this.access.persona(user);
    if (persona === 'parent' || persona === 'student') {
      const id = await this.access.resolveStudentId(user.tid, user, childId);
      return this.transport.parentCard(user.tid, id ? [id] : []);
    }
    const children = await this.access.childrenForUser(user.tid, user.sub);
    return this.transport.parentCard(
      user.tid,
      children.map((c) => c.studentId),
    );
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

  @Get('library/me')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  myLibrary(
    @CurrentUser() user: JwtUser,
    @Query('studentId') studentId?: string,
  ) {
    return this.library.mine(user.tid, user.sub, studentId);
  }

  @Get('library/search')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  searchLibrary(@CurrentUser() user: JwtUser, @Query('q') q?: string) {
    return this.library.books(user.tid, { search: q });
  }

  @Post('library/reserve')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  async reserveBook(
    @CurrentUser() user: JwtUser,
    @Body() body: { bookId: string; memberId?: string },
  ) {
    const me = await this.library.mine(user.tid, user.sub);
    const memberId = body.memberId || me?.id;
    if (!memberId)
      throw new BadRequestException('Library membership not found');
    return this.library.reserve(user.tid, body.bookId, memberId);
  }

  @Post('library/renew/:id')
  @ApiBearerAuth()
  @RequireAnyPermission(...ACCESS)
  renewMine(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.library.renew(user.tid, id, user.sub);
  }
}
