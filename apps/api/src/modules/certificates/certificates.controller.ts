import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';

import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';

import type { Request } from 'express';

import { memoryStorage } from 'multer';

import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';

import { Public } from '../../common/decorators/public.decorator';

import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';

import { extractClientIp } from '../../common/utils/request-host';

import { CertificatesService } from './certificates.service';

import { CertificateAssetsService } from './certificate-assets.service';

import {
  CertificateApprovalDto,
  CertificateBulkIssueDto,
  CertificateCategoryDto,
  CertificateIssueDto,
  CertificatePreviewDto,
  CertificateQueryDto,
  CertificateRequestDto,
  CertificateSequenceDto,
  CertificateSignatureDto,
  CertificateTemplateDto,
} from './dto/certificates.dto';

const CERT_READ = [
  'certificates:read',
  'students:read',
  'students:manage',
  'academic:read',
] as const;

const CERT_MANAGE = ['certificates:manage', 'students:manage'] as const;

const CERT_APPROVE = [
  'certificates:approve',
  'certificates:manage',
  'students:manage',
  'academic:manage',
] as const;

const CERT_SELF = ['certificates:self'] as const;

@ApiBearerAuth()
@ApiTags('certificates')
@Controller({ path: 'certificates', version: '1' })
export class CertificatesController {
  constructor(
    private readonly service: CertificatesService,

    private readonly assets: CertificateAssetsService,
  ) {}

  @Get('me/profile')
  @RequirePermissions('certificates:self')
  myProfile(@CurrentUser() user: JwtUser) {
    return this.service.myProfile(user);
  }

  @Get('me/requests')
  @RequirePermissions('certificates:self')
  myRequests(@CurrentUser() user: JwtUser) {
    return this.service.myRequests(user);
  }

  @Post('me/requests')
  @RequirePermissions('certificates:self')
  createMyRequest(
    @CurrentUser() user: JwtUser,
    @Body() dto: CertificateRequestDto,
  ) {
    return this.service.createMyRequest(user, dto);
  }

  @Get('me/issues')
  @RequirePermissions('certificates:self')
  myIssues(@CurrentUser() user: JwtUser) {
    return this.service.myIssues(user);
  }

  @Post('me/preview')
  @RequirePermissions('certificates:self')
  previewMyCertificate(
    @CurrentUser() user: JwtUser,
    @Body() dto: CertificatePreviewDto,
  ) {
    return this.service.previewMyCertificate(user, dto);
  }

  @Get('me/issues/:id/download')
  @RequirePermissions('certificates:self')
  async downloadMyIssue(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    const doc = await this.service.getMyIssueDocumentStream(user, id);

    return new StreamableFile(doc.stream, {
      type: doc.mimeType,

      disposition: `attachment; filename="${doc.filename}"`,
    });
  }

  @Get('dashboard')
  @RequireAnyPermission(...CERT_READ)
  dashboard(@CurrentUser() user: JwtUser) {
    return this.service.dashboard(user.tid);
  }

  @Post('seed-defaults')
  @RequireAnyPermission(...CERT_MANAGE)
  seedDefaults(@CurrentUser() user: JwtUser) {
    return this.service.seedDefaultCategories(user);
  }

  @Post('seed-dbc-official')
  @RequireAnyPermission(...CERT_MANAGE)
  seedDbcOfficial(@CurrentUser() user: JwtUser) {
    return this.service.seedDbcOfficialTemplates(user);
  }

  @Get('categories')
  @RequireAnyPermission(...CERT_READ, ...CERT_SELF)
  categories(@CurrentUser() user: JwtUser) {
    return this.service.listCategories(user.tid);
  }

  @Post('categories')
  @RequireAnyPermission(...CERT_MANAGE)
  createCategory(
    @CurrentUser() user: JwtUser,
    @Body() dto: CertificateCategoryDto,
  ) {
    return this.service.createCategory(user, dto);
  }

  @Get('templates')
  @RequireAnyPermission(...CERT_READ, ...CERT_SELF)
  templates(@CurrentUser() user: JwtUser, @Query() query: CertificateQueryDto) {
    return this.service.listTemplates(user.tid, query);
  }

  @Post('templates')
  @RequireAnyPermission(...CERT_MANAGE)
  createTemplate(
    @CurrentUser() user: JwtUser,
    @Body() dto: CertificateTemplateDto,
  ) {
    return this.service.createTemplate(user, dto);
  }

  @Post('templates/:id/publish')
  @RequireAnyPermission(...CERT_MANAGE)
  publishTemplate(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.publishTemplate(user, id);
  }

  @Post('templates/:id/clone')
  @RequireAnyPermission(...CERT_MANAGE)
  cloneTemplate(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.cloneTemplate(user, id);
  }

  @Get('requests')
  @RequireAnyPermission(...CERT_READ)
  requests(@CurrentUser() user: JwtUser, @Query() query: CertificateQueryDto) {
    return this.service.listRequests(user.tid, query);
  }

  @Post('requests')
  @RequireAnyPermission(...CERT_READ, ...CERT_SELF)
  createRequest(
    @CurrentUser() user: JwtUser,
    @Body() dto: CertificateRequestDto,
  ) {
    return this.service.createRequest(user, dto);
  }

  @Post('approvals/:id/action')
  @RequireAnyPermission(...CERT_APPROVE)
  actOnApproval(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: CertificateApprovalDto,
  ) {
    return this.service.actOnApproval(user, id, dto);
  }

  @Get('issues')
  @RequireAnyPermission(...CERT_READ)
  issues(@CurrentUser() user: JwtUser, @Query() query: CertificateQueryDto) {
    return this.service.listIssues(user.tid, query);
  }

  @Get('issues/:id')
  @RequireAnyPermission(...CERT_READ)
  getIssue(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.getIssue(user.tid, id);
  }

  @Post('preview')
  @RequireAnyPermission(...CERT_READ, ...CERT_SELF)
  preview(@CurrentUser() user: JwtUser, @Body() dto: CertificatePreviewDto) {
    return this.service.previewCertificate(user, dto);
  }

  @Get('reports/register')
  @RequireAnyPermission(...CERT_READ)
  issuanceRegister(
    @CurrentUser() user: JwtUser,
    @Query() query: CertificateQueryDto,
  ) {
    return this.service.issuanceRegister(user.tid, query);
  }

  @Get('issues/:id/download')
  @RequireAnyPermission(...CERT_READ, ...CERT_SELF)
  async downloadIssue(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    const doc = await this.service.getIssueDocumentStream(user.tid, id, user);

    return new StreamableFile(doc.stream, {
      type: doc.mimeType,

      disposition: `attachment; filename="${doc.filename}"`,
    });
  }

  @Post('issues')
  @RequireAnyPermission(...CERT_MANAGE)
  issue(@CurrentUser() user: JwtUser, @Body() dto: CertificateIssueDto) {
    return this.service.issueCertificate(user, dto);
  }

  @Post('issues/bulk')
  @RequireAnyPermission(...CERT_MANAGE)
  bulkIssue(
    @CurrentUser() user: JwtUser,
    @Body() dto: CertificateBulkIssueDto,
  ) {
    return this.service.bulkIssue(user, dto);
  }

  @Post('issues/:id/revoke')
  @RequireAnyPermission(...CERT_MANAGE)
  revoke(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.service.revokeIssue(user, id, body.reason);
  }

  @Public()
  @Get('verify/:token')
  verify(@Param('token') token: string, @Req() req: Request) {
    return this.service.verify(token, {
      ipAddress: extractClientIp(req),

      userAgent: req.headers['user-agent'],
    });
  }

  @Get('settings/sequences')
  @RequireAnyPermission(...CERT_READ, ...CERT_MANAGE)
  sequences(@CurrentUser() user: JwtUser) {
    return this.service.sequences(user.tid);
  }

  @Post('settings/sequences')
  @RequireAnyPermission(...CERT_MANAGE)
  upsertSequence(
    @CurrentUser() user: JwtUser,
    @Body() dto: CertificateSequenceDto,
  ) {
    return this.service.upsertSequence(user, dto);
  }

  @Get('settings/signatures')
  @RequireAnyPermission(...CERT_READ, ...CERT_MANAGE)
  signatures(@CurrentUser() user: JwtUser) {
    return this.service.signatures(user.tid);
  }

  @Post('settings/signatures')
  @RequireAnyPermission(...CERT_MANAGE)
  upsertSignature(
    @CurrentUser() user: JwtUser,
    @Body() dto: CertificateSignatureDto,
  ) {
    return this.service.upsertSignature(user, dto);
  }

  @Post('settings/signatures/upload')
  @RequireAnyPermission(...CERT_MANAGE)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  async uploadSignatureAsset(
    @CurrentUser() user: JwtUser,

    @Body() body: { roleSlug: string; kind?: 'signature' | 'seal' },

    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('File is required');

    const path = await this.assets.saveSignatureAsset(
      user.tid,

      body.roleSlug,

      file,

      body.kind === 'seal' ? 'seal' : 'signature',
    );

    return { path };
  }

  @Get('audit-logs')
  @RequireAnyPermission(...CERT_READ, ...CERT_MANAGE)
  audit(@CurrentUser() user: JwtUser) {
    return this.service.auditLogs(user.tid);
  }
}
