import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import {
  ApprovalNoteDto,
  CreateIssuerDto,
  CreateLetterheadDto,
  CreateOfficialDocumentDto,
  CreateTemplateDto,
  ListOfficialDocumentsQueryDto,
  RejectDocumentDto,
  UpdateIssuerDto,
  UpdateLetterheadDto,
  UpdateOfficialDocumentDto,
  UpdateTemplateDto,
  UpsertOfficialDocumentSettingsDto,
} from './dto/official-documents.dto';
import { OfficialDocumentApprovalService } from './services/official-document-approval.service';
import { OfficialDocumentDashboardService } from './services/official-document-dashboard.service';
import { OfficialDocumentSettingsService } from './services/official-document-settings.service';
import { OfficialDocumentAuditService } from './services/official-document-audit.service';
import { OfficialDocumentService } from './services/official-document.service';
import { OfficialDocumentsSeedService } from './official-documents.seed';

@ApiBearerAuth()
@ApiTags('official-documents')
@Controller({ path: 'admin/official-documents', version: '1' })
export class OfficialDocumentsController {
  constructor(
    private readonly documents: OfficialDocumentService,
    private readonly approval: OfficialDocumentApprovalService,
    private readonly dashboard: OfficialDocumentDashboardService,
    private readonly settings: OfficialDocumentSettingsService,
    private readonly audit: OfficialDocumentAuditService,
    private readonly seed: OfficialDocumentsSeedService,
  ) {}

  @Get('dashboard')
  @RequireAnyPermission('official-documents:read', 'official-documents:manage')
  async dashboardStats(@CurrentUser() user: JwtUser) {
    const issuers = await this.settings.listIssuers(user.tid);
    if (!issuers.length) {
      await this.seed.seedTenant(user.tid);
    }
    return this.dashboard.getDashboard(user.tid);
  }

  @Get('search')
  @RequireAnyPermission('official-documents:read', 'official-documents:manage')
  search(
    @CurrentUser() user: JwtUser,
    @Query() query: ListOfficialDocumentsQueryDto,
  ) {
    return this.documents.list(user.tid, query);
  }

  @Get('settings/config')
  @RequirePermissions('official-documents:settings')
  getSettings(@CurrentUser() user: JwtUser) {
    return this.settings.get(user.tid);
  }

  @Patch('settings/config')
  @RequirePermissions('official-documents:settings')
  updateSettings(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpsertOfficialDocumentSettingsDto,
  ) {
    return this.settings.update(user.tid, dto);
  }

  @Get('settings/letterheads')
  @RequireAnyPermission(
    'official-documents:read',
    'official-documents:settings',
  )
  listLetterheads(@CurrentUser() user: JwtUser) {
    return this.settings.listLetterheads(user.tid);
  }

  @Post('settings/letterheads')
  @RequirePermissions('official-documents:settings')
  createLetterhead(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateLetterheadDto,
  ) {
    return this.settings.createLetterhead(user.tid, dto);
  }

  @Patch('settings/letterheads/:letterheadId')
  @RequirePermissions('official-documents:settings')
  updateLetterhead(
    @CurrentUser() user: JwtUser,
    @Param('letterheadId') id: string,
    @Body() dto: UpdateLetterheadDto,
  ) {
    return this.settings.updateLetterhead(user.tid, id, dto);
  }

  @Get('settings/issuers')
  @RequireAnyPermission(
    'official-documents:read',
    'official-documents:settings',
  )
  listIssuers(@CurrentUser() user: JwtUser) {
    return this.settings.listIssuers(user.tid);
  }

  @Post('settings/issuers')
  @RequirePermissions('official-documents:settings')
  createIssuer(@CurrentUser() user: JwtUser, @Body() dto: CreateIssuerDto) {
    return this.settings.createIssuer(user.tid, dto);
  }

  @Patch('settings/issuers/:issuerId')
  @RequirePermissions('official-documents:settings')
  updateIssuer(
    @CurrentUser() user: JwtUser,
    @Param('issuerId') id: string,
    @Body() dto: UpdateIssuerDto,
  ) {
    return this.settings.updateIssuer(user.tid, id, dto);
  }

  @Get('settings/templates')
  @RequireAnyPermission(
    'official-documents:read',
    'official-documents:settings',
  )
  listTemplates(
    @CurrentUser() user: JwtUser,
    @Query('documentType') documentType?: string,
  ) {
    return this.settings.listTemplates(user.tid, documentType);
  }

  @Post('settings/templates')
  @RequirePermissions('official-documents:settings')
  createTemplate(@CurrentUser() user: JwtUser, @Body() dto: CreateTemplateDto) {
    return this.settings.createTemplate(user.tid, dto);
  }

  @Patch('settings/templates/:templateId')
  @RequirePermissions('official-documents:settings')
  updateTemplate(
    @CurrentUser() user: JwtUser,
    @Param('templateId') id: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.settings.updateTemplate(user.tid, id, dto);
  }

  @Get()
  @RequireAnyPermission('official-documents:read', 'official-documents:manage')
  list(
    @CurrentUser() user: JwtUser,
    @Query() query: ListOfficialDocumentsQueryDto,
  ) {
    return this.documents.list(user.tid, query);
  }

  @Post()
  @RequirePermissions('official-documents:manage')
  create(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateOfficialDocumentDto,
    @Req() req: Request,
  ) {
    return this.documents.create(user, dto, req);
  }

  @Get(':id')
  @RequireAnyPermission('official-documents:read', 'official-documents:manage')
  get(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.documents.getById(user.tid, id);
  }

  @Patch(':id')
  @RequirePermissions('official-documents:manage')
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateOfficialDocumentDto,
    @Req() req: Request,
  ) {
    return this.documents.update(user, id, dto, req);
  }

  @Get(':id/versions')
  @RequireAnyPermission('official-documents:read', 'official-documents:manage')
  versions(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.documents.listVersions(user.tid, id);
  }

  @Get(':id/audit')
  @RequireAnyPermission('official-documents:read', 'official-documents:manage')
  auditLog(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.audit.list(user.tid, id);
  }

  @Post(':id/submit-for-approval')
  @RequirePermissions('official-documents:manage')
  submit(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.approval.submit(user, id, req);
  }

  @Post(':id/approve')
  @RequireAnyPermission(
    'official-documents:approve',
    'official-documents:publish',
  )
  async approve(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ApprovalNoteDto,
    @Req() req: Request,
  ) {
    await this.approval.verifyPublishPermission(user);
    return this.approval.approve(user, id, dto.note, req);
  }

  @Post(':id/reject')
  @RequireAnyPermission(
    'official-documents:approve',
    'official-documents:publish',
  )
  async reject(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: RejectDocumentDto,
    @Req() req: Request,
  ) {
    await this.approval.verifyPublishPermission(user);
    return this.approval.reject(user, id, dto.note, req);
  }

  @Post(':id/archive')
  @RequireAnyPermission(
    'official-documents:archive',
    'official-documents:manage',
  )
  archive(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.documents.archive(user, id, req);
  }

  @Post(':id/print')
  @RequireAnyPermission('official-documents:read', 'official-documents:manage')
  print(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.documents.recordPrint(user, id, req);
  }

  @Get(':id/pdf')
  @RequireAnyPermission('official-documents:read', 'official-documents:manage')
  async downloadPdf(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const { buffer, filename } = await this.documents.getPdf(user, id, req);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${filename}"`,
    });
  }
}
