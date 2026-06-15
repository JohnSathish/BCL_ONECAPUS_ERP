import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import { TenantResolutionService } from '../tenants/tenant-resolution.service';
import { AdmissionsDocumentService } from './admissions-document.service';
import { AdmissionsFormService } from './admissions-form.service';
import { AdmissionsPaymentService } from './admissions-payment.service';
import { AdmissionsPortalPasswordService } from './admissions-portal-password.service';
import { AdmissionsPortalService } from './admissions-portal.service';
import {
  ApplicantLoginDto,
  ApplicantPasswordResetConfirmDto,
  ApplicantPasswordResetRequestDto,
  ApplicantRegisterDto,
  SaveFormDraftDto,
  VerifyAdmissionPaymentDto,
} from './dto/admissions-portal.dto';

const MAX_FILE_BYTES = 5 * 1024 * 1024;

@ApiTags('admissions-portal')
@Controller({ path: 'admissions/portal', version: '1' })
export class AdmissionsPortalController {
  constructor(
    private readonly portal: AdmissionsPortalService,
    private readonly form: AdmissionsFormService,
    private readonly documents: AdmissionsDocumentService,
    private readonly payments: AdmissionsPaymentService,
    private readonly portalPassword: AdmissionsPortalPasswordService,
    private readonly tenantResolution: TenantResolutionService,
    private readonly config: ConfigService,
  ) {}

  private async resolveTenantId(host: string | undefined): Promise<string> {
    const loginHost = host?.trim() || 'demo.localhost';
    const tenant = await this.tenantResolution.resolveHost(loginHost);
    if (!tenant) throw new BadRequestException('Unknown portal host');
    return tenant.id;
  }

  private resolvePortalOrigin(host: string | undefined): string {
    const configured = this.config.get<string>('ADMISSIONS_PORTAL_ORIGIN');
    if (configured?.trim()) return configured.trim().replace(/\/$/, '');

    const hostname = host?.split(':')[0]?.trim() || 'admissions.demo.localhost';
    const webOrigin = this.config.get<string>(
      'WEB_ORIGIN',
      'http://localhost:3000',
    );
    try {
      const url = new URL(webOrigin);
      url.hostname = hostname;
      return url.origin;
    } catch {
      return `http://${hostname}:3000`;
    }
  }

  @Public()
  @Get('info')
  async info(@Headers('host') host: string) {
    const tenantId = await this.resolveTenantId(host);
    return this.portal.getPortalInfo(tenantId);
  }

  @Public()
  @Post('register')
  async register(
    @Headers('host') host: string,
    @Body() dto: ApplicantRegisterDto,
  ) {
    const tenantId = await this.resolveTenantId(host);
    return this.portal.register(tenantId, dto);
  }

  @Public()
  @Post('login')
  async login(
    @Headers('host') host: string,
    @Body() dto: ApplicantLoginDto,
    @Req() req: Request,
  ) {
    const tenantId = await this.resolveTenantId(host);
    return this.portal.login(
      tenantId,
      dto.applicationNumber,
      dto.password,
      {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      },
      dto.rememberMe,
    );
  }

  @ApiBearerAuth()
  @RequireAnyPermission('admissions:portal:self')
  @Get('me')
  me(@CurrentUser() user: JwtUser) {
    return this.portal.getMe(user.sub, user.tid);
  }

  @ApiBearerAuth()
  @RequireAnyPermission('admissions:portal:self')
  @Get('status')
  status(@CurrentUser() user: JwtUser) {
    return this.portal.getStatusTimeline(user.sub, user.tid);
  }

  @ApiBearerAuth()
  @RequireAnyPermission('admissions:portal:self')
  @Patch('form/save-draft')
  saveDraft(@CurrentUser() user: JwtUser, @Body() dto: SaveFormDraftDto) {
    return this.form.saveDraft(user.tid, user.sub, dto);
  }

  @ApiBearerAuth()
  @RequireAnyPermission('admissions:portal:self')
  @Post('form/submit')
  submit(@CurrentUser() user: JwtUser) {
    return this.form.submit(user.tid, user.sub);
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
  @Get('payment/info')
  paymentInfo(@CurrentUser() user: JwtUser) {
    return this.payments.getPaymentInfo(user.tid, user.sub);
  }

  @ApiBearerAuth()
  @RequireAnyPermission('admissions:portal:self')
  @Post('payment/create-order')
  createPaymentOrder(@CurrentUser() user: JwtUser) {
    return this.payments.createOrder(user.tid, user.sub);
  }

  @ApiBearerAuth()
  @RequireAnyPermission('admissions:portal:self')
  @Post('payment/verify')
  verifyPayment(
    @CurrentUser() user: JwtUser,
    @Body() dto: VerifyAdmissionPaymentDto,
  ) {
    return this.payments.verifyPayment(user.tid, user.sub, dto);
  }

  @Public()
  @Post('payment/webhook')
  async paymentWebhook(
    @Headers('host') host: string,
    @Headers('x-razorpay-signature') signature: string | undefined,
    @Req() req: Request & { rawBody?: Buffer },
    @Body() body: Record<string, unknown>,
  ) {
    const tenantId = await this.resolveTenantId(host);
    const raw =
      req.rawBody?.toString('utf8') ??
      (typeof body === 'object' ? JSON.stringify(body) : String(body));
    return this.payments.handleWebhook(tenantId, raw, signature);
  }

  @Public()
  @Post('password-reset/request')
  async requestPasswordReset(
    @Headers('host') host: string,
    @Body() dto: ApplicantPasswordResetRequestDto,
  ) {
    if (!dto.email?.trim() && !dto.applicationNumber?.trim()) {
      throw new BadRequestException('Email or application number is required');
    }
    const tenantId = await this.resolveTenantId(host);
    return this.portalPassword.requestReset(
      tenantId,
      {
        email: dto.email?.trim(),
        applicationNumber: dto.applicationNumber?.trim(),
      },
      this.resolvePortalOrigin(host),
    );
  }

  @Public()
  @Post('password-reset/confirm')
  async confirmPasswordReset(
    @Headers('host') host: string,
    @Body() dto: ApplicantPasswordResetConfirmDto,
  ) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException(
        'New password and confirmation do not match',
      );
    }
    const tenantId = await this.resolveTenantId(host);
    return this.portalPassword.confirmReset(
      tenantId,
      dto.token,
      dto.newPassword,
    );
  }
}
