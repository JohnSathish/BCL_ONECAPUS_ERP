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
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import { TenantResolutionService } from '../tenants/tenant-resolution.service';
import { AuthService } from '../auth/auth.service';
import { setRefreshCookie } from '../auth/auth-cookie.util';
import { SchoolAdmissionsDocumentService } from './school-admissions-document.service';
import { SchoolAdmissionsFormService } from './school-admissions-form.service';
import { SchoolAdmissionsPdfService } from './school-admissions-pdf.service';
import { SchoolAdmissionsPortalService } from './school-admissions-portal.service';
import { SchoolPortalPresenceService } from './school-portal-presence.service';
import {
  SchoolApplicantLoginDto,
  SchoolApplicantRegisterDto,
  SchoolPasswordResetConfirmDto,
  SchoolPasswordResetRequestDto,
  SchoolPortalHeartbeatDto,
  SchoolRequestOtpDto,
  SchoolSaveFormDraftDto,
  SchoolSavePaymentTransactionDto,
} from './dto/school-admissions.dto';

const MAX_FILE_BYTES = 5 * 1024 * 1024;

@ApiTags('school-admissions-portal')
@Controller({ path: 'school-admissions/portal', version: '1' })
export class SchoolAdmissionsPortalController {
  constructor(
    private readonly portal: SchoolAdmissionsPortalService,
    private readonly presence: SchoolPortalPresenceService,
    private readonly form: SchoolAdmissionsFormService,
    private readonly documents: SchoolAdmissionsDocumentService,
    private readonly pdf: SchoolAdmissionsPdfService,
    private readonly tenantResolution: TenantResolutionService,
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  private async resolveTenantId(host: string | undefined): Promise<string> {
    const loginHost = host?.trim() || 'admission.tps.localhost';
    const tenant = await this.tenantResolution.resolveHost(loginHost);
    if (!tenant) throw new BadRequestException('Unknown portal host');
    return tenant.id;
  }

  @Public()
  @Get('info')
  async info(
    @Headers('host') host: string,
    @Headers('x-login-host') loginHost?: string,
  ) {
    const tenantId = await this.resolveTenantId(loginHost || host);
    return this.portal.getPortalInfo(tenantId);
  }

  @Public()
  @Get('traffic')
  async traffic(
    @Headers('host') host: string,
    @Headers('x-login-host') loginHost?: string,
  ) {
    const tenantId = await this.resolveTenantId(loginHost || host);
    return this.presence.stats(tenantId);
  }

  @Public()
  @Post('traffic/heartbeat')
  async trafficHeartbeat(
    @Headers('host') host: string,
    @Headers('x-login-host') loginHost: string | undefined,
    @Body() dto: SchoolPortalHeartbeatDto,
    @Req() req: Request,
  ) {
    const tenantId = await this.resolveTenantId(loginHost || host);
    return this.presence.heartbeat(tenantId, dto.sessionId, req);
  }

  @Public()
  @Post('otp')
  async requestOtp(
    @Headers('host') host: string,
    @Headers('x-login-host') loginHost: string | undefined,
    @Body() dto: SchoolRequestOtpDto,
  ) {
    const tenantId = await this.resolveTenantId(loginHost || host);
    return this.portal.requestEmailOtp(tenantId, dto);
  }

  @Public()
  @Post('register')
  async register(
    @Headers('host') host: string,
    @Headers('x-login-host') loginHost: string | undefined,
    @Body() dto: SchoolApplicantRegisterDto,
  ) {
    const tenantId = await this.resolveTenantId(loginHost || host);
    return this.portal.register(tenantId, dto);
  }

  @Public()
  @Post('login')
  async login(
    @Headers('host') host: string,
    @Headers('x-login-host') loginHost: string | undefined,
    @Body() dto: SchoolApplicantLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tenantId = await this.resolveTenantId(loginHost || host);
    const session = await this.portal.login(
      tenantId,
      dto.applicationNumber,
      dto.password,
      {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      },
      dto.rememberMe,
    );
    const cookieSecure =
      this.config.get<string>('COOKIE_SECURE') === 'true' ||
      (this.config.get<string>('COOKIE_SECURE') === undefined &&
        this.config.get<string>('NODE_ENV') === 'production');
    setRefreshCookie(
      res,
      session.refreshToken,
      session.refreshMaxAgeSeconds,
      cookieSecure,
      '/',
    );
    return this.auth.toPublicSession(session);
  }

  @Public()
  @Post('password-reset/request')
  async requestPasswordReset(
    @Headers('host') host: string,
    @Headers('x-login-host') loginHost: string | undefined,
    @Body() dto: SchoolPasswordResetRequestDto,
  ) {
    const tenantId = await this.resolveTenantId(loginHost || host);
    return this.portal.requestPasswordResetOtp(tenantId, dto);
  }

  @Public()
  @Post('password-reset/confirm')
  async confirmPasswordReset(
    @Headers('host') host: string,
    @Headers('x-login-host') loginHost: string | undefined,
    @Body() dto: SchoolPasswordResetConfirmDto,
  ) {
    const tenantId = await this.resolveTenantId(loginHost || host);
    return this.portal.resetPasswordWithOtp(tenantId, dto);
  }

  @ApiBearerAuth()
  @RequireAnyPermission('admissions:portal:self')
  @Get('me')
  me(@CurrentUser() user: JwtUser) {
    return this.portal.getMe(user.sub, user.tid);
  }

  @ApiBearerAuth()
  @RequireAnyPermission('admissions:portal:self')
  @Patch('form/save-draft')
  saveDraft(@CurrentUser() user: JwtUser, @Body() dto: SchoolSaveFormDraftDto) {
    return this.form.saveDraft(user.tid, user.sub, dto);
  }

  @ApiBearerAuth()
  @RequireAnyPermission('admissions:portal:self')
  @Patch('payment/transaction-reference')
  savePaymentTransactionReference(
    @CurrentUser() user: JwtUser,
    @Body() dto: SchoolSavePaymentTransactionDto,
  ) {
    return this.form.savePaymentTransactionReference(
      user.tid,
      user.sub,
      dto.paymentTransactionReference,
    );
  }

  @ApiBearerAuth()
  @RequireAnyPermission('admissions:portal:self')
  @Post('form/submit')
  submit(@CurrentUser() user: JwtUser) {
    return this.form.submit(user.tid, user.sub);
  }

  @ApiBearerAuth()
  @RequireAnyPermission('admissions:portal:self')
  @Get('application-pdf')
  async downloadApplicationPdf(
    @CurrentUser() user: JwtUser,
    @Res() res: Response,
  ) {
    const file = await this.pdf.getStoredPdfForApplicant(user.tid, user.sub);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    res.send(file.buffer);
  }

  @ApiBearerAuth()
  @RequireAnyPermission('admissions:portal:self')
  @Get('documents/:slotCode/file')
  async downloadOwnDocument(
    @CurrentUser() user: JwtUser,
    @Param('slotCode') slotCode: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.documents.streamOwnDocument(
      user.tid,
      user.sub,
      slotCode,
    );
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
    return file.stream;
  }

  @ApiBearerAuth()
  @RequireAnyPermission('admissions:portal:self')
  @Post('documents/upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_BYTES },
    }),
  )
  uploadDocument(
    @CurrentUser() user: JwtUser,
    @Body('slotCode') slotCode: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('File is required');
    return this.documents.upload(user.tid, user.sub, slotCode, file);
  }

  @ApiBearerAuth()
  @RequireAnyPermission('admissions:portal:self')
  @Delete('documents/:slotCode')
  removeDocument(
    @CurrentUser() user: JwtUser,
    @Param('slotCode') slotCode: string,
  ) {
    return this.documents.remove(user.tid, user.sub, slotCode);
  }
}
