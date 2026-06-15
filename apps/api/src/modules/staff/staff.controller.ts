import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { StaffImportService } from './import/staff-import.service';
import { StaffAdditionalRoleService } from './services/staff-additional-role.service';
import { StaffAssetsService } from './services/staff-assets.service';
import { StaffDocumentsService } from './services/staff-documents.service';
import { StaffAwardService } from './services/staff-award.service';
import { StaffEmploymentService } from './services/staff-employment.service';
import { StaffProfileService } from './services/staff-profile.service';
import { StaffPublicationService } from './services/staff-publication.service';
import { StaffSubjectAssignmentService } from './services/staff-subject-assignment.service';
import { StaffSummaryService } from './services/staff-summary.service';
import { StaffProvisioningService } from './services/staff-provisioning.service';
import { StaffService } from './staff.service';
import {
  AssignSubjectDto,
  CommitStaffImportDto,
  CreateStaffAdditionalRoleDto,
  CreateStaffAwardDto,
  CreateStaffDto,
  CreateStaffPublicationDto,
  GenerateEmployeeCodeDto,
  ListDesignationsQueryDto,
  ProvisionStaffPortalDto,
  StaffDirectoryQueryDto,
  TeachingAssignmentContextQueryDto,
  UpdateStaffAdditionalRoleDto,
  UpdateStaffAwardDto,
  UpdateStaffDto,
  UpdateStaffPublicationDto,
  UpdateStaffSectionDto,
  UpdateStaffShiftsDto,
  UploadStaffDocumentDto,
  UpdateStaffDocumentMetaDto,
  VerifyStaffDocumentDto,
  ValidateStaffImportDto,
} from './dto/staff.dto';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

@ApiBearerAuth()
@ApiTags('staff')
@Controller({ path: 'staff', version: '1' })
export class StaffController {
  constructor(
    private readonly staff: StaffService,
    private readonly summary: StaffSummaryService,
    private readonly profileService: StaffProfileService,
    private readonly subjectAssignments: StaffSubjectAssignmentService,
    private readonly assetsService: StaffAssetsService,
    private readonly documentsService: StaffDocumentsService,
    private readonly provisioning: StaffProvisioningService,
    private readonly staffImport: StaffImportService,
    private readonly additionalRoles: StaffAdditionalRoleService,
    private readonly employment: StaffEmploymentService,
    private readonly publications: StaffPublicationService,
    private readonly awards: StaffAwardService,
  ) {}

  @Get('summary/enhanced')
  @RequirePermissions('staff:read')
  enhancedSummary(@CurrentUser() user: JwtUser) {
    return this.summary.getEnhancedSummary(user.tid);
  }

  @Get('export.csv')
  @RequirePermissions('staff:export')
  async exportCsv(
    @CurrentUser() user: JwtUser,
    @Res() res: Response,
    @Query() query: StaffDirectoryQueryDto,
  ) {
    const result = await this.staff.exportCsv(user, query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="staff_export.csv"',
    );
    if (result.truncated) {
      res.setHeader('X-Export-Truncated', 'true');
      res.setHeader('X-Export-Total', String(result.total));
    }
    res.send(result.csv);
  }

  @Get('designations')
  @RequirePermissions('staff:read')
  listDesignations(
    @CurrentUser() user: JwtUser,
    @Query() query: ListDesignationsQueryDto,
  ) {
    return this.staff.listDesignations(user.tid, query.staffType);
  }

  @Get('academic-roles')
  @RequirePermissions('staff:read')
  listAcademicRoles(@CurrentUser() user: JwtUser) {
    return this.staff.listAcademicRoles(user.tid);
  }

  @Get('directory')
  @RequirePermissions('staff:read')
  directory(
    @CurrentUser() user: JwtUser,
    @Query() query: StaffDirectoryQueryDto,
  ) {
    return this.staff.listDirectory(user, query);
  }

  @Get('subject-assignment-contexts')
  @RequireAnyPermission('staff:read', 'staff:assign-subjects')
  listTeachingAssignmentContexts(
    @CurrentUser() user: JwtUser,
    @Query() query: TeachingAssignmentContextQueryDto,
  ) {
    return this.subjectAssignments.listAssignableContexts(
      user.tid,
      null,
      query,
    );
  }

  @Get('reports/subject-teaching-matrix')
  @RequireAnyPermission('staff:read', 'staff:assign-subjects')
  subjectTeachingMatrix(@CurrentUser() user: JwtUser) {
    return this.subjectAssignments.teachingMatrix(user.tid);
  }

  @Get('documents/reports/missing')
  @RequirePermissions('staff:read')
  documentsMissingReport(@CurrentUser() user: JwtUser) {
    return this.documentsService.reportMissing(user.tid);
  }

  @Get('documents/reports/expiring')
  @RequirePermissions('staff:read')
  documentsExpiringReport(@CurrentUser() user: JwtUser) {
    return this.documentsService.reportExpiring(user.tid);
  }

  @Get('documents/reports/pending-verification')
  @RequirePermissions('staff:read')
  documentsPendingReport(@CurrentUser() user: JwtUser) {
    return this.documentsService.reportPendingVerification(user.tid);
  }

  @Get()
  @RequirePermissions('staff:read')
  list(@CurrentUser() user: JwtUser, @Query() query: StaffDirectoryQueryDto) {
    return this.staff.listDirectory(user, query);
  }

  @Post('generate-employee-code')
  @RequirePermissions('staff:manage')
  generateEmployeeCode(
    @CurrentUser() user: JwtUser,
    @Body() dto: GenerateEmployeeCodeDto,
  ) {
    return this.staff.generateEmployeeCode(user.tid, dto, user.sub);
  }

  @Post()
  @RequirePermissions('staff:manage')
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateStaffDto) {
    return this.staff.create(user, dto);
  }

  @Get('import/template')
  @RequirePermissions('staff:import')
  async downloadImportTemplate(@Res() res: Response) {
    const buffer = await this.staffImport.buildTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="Staff_Import_Template.xlsx"',
    );
    res.send(buffer);
  }

  @Post('import/validate')
  @RequirePermissions('staff:import')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        importMode: { type: 'string', enum: ['CREATE', 'MERGE', 'REPLACE'] },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_BYTES },
    }),
  )
  validateImport(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: ValidateStaffImportDto,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('No file uploaded');
    }
    return this.staffImport.validateUpload(
      user.tid,
      user.sub,
      file.originalname ?? 'upload.xlsx',
      file.buffer,
      { importMode: dto.importMode ?? 'MERGE' },
    );
  }

  @Post('import/commit')
  @RequirePermissions('staff:import')
  commitImport(
    @CurrentUser() user: JwtUser,
    @Body() dto: CommitStaffImportDto,
  ) {
    return this.staffImport.commit(
      user.tid,
      user.sub,
      dto.batchId,
      dto.mode ?? 'VALID_ONLY',
      dto.importMode ?? 'MERGE',
    );
  }

  @Get('import/batches')
  @RequirePermissions('staff:import')
  listImportBatches(
    @CurrentUser() user: JwtUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.staffImport.listBatches(user.tid, query);
  }

  @Get('import/batches/:id/preview')
  @RequirePermissions('staff:import')
  previewImportBatch(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.staffImport.getBatchPreview(
      id,
      user.tid,
      query.page,
      query.limit ?? 200,
    );
  }

  @Get('import/batches/:id/error-report')
  @RequirePermissions('staff:import')
  async downloadImportErrorReport(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const buffer = await this.staffImport.buildErrorReport(id, user.tid);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="Staff_Import_Error_Report.xlsx"',
    );
    res.send(buffer);
  }

  @Get(':id/additional-roles')
  @RequirePermissions('staff:read')
  listAdditionalRoles(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.additionalRoles.list(user.tid, id);
  }

  @Post(':id/additional-roles')
  @RequirePermissions('staff:manage')
  createAdditionalRole(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: CreateStaffAdditionalRoleDto,
  ) {
    return this.additionalRoles.create(user.tid, id, dto);
  }

  @Patch(':id/additional-roles/:roleId')
  @RequirePermissions('staff:manage')
  updateAdditionalRole(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('roleId') roleId: string,
    @Body() dto: UpdateStaffAdditionalRoleDto,
  ) {
    return this.additionalRoles.update(user.tid, id, roleId, dto);
  }

  @Delete(':id/additional-roles/:roleId')
  @RequirePermissions('staff:manage')
  removeAdditionalRole(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('roleId') roleId: string,
  ) {
    return this.additionalRoles.remove(user.tid, id, roleId);
  }

  @Put(':id/shifts')
  @RequirePermissions('staff:manage')
  updateShifts(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateStaffShiftsDto,
  ) {
    return this.employment.applyEmploymentUpdate(user.tid, id, {
      primaryShiftId: dto.primaryShiftId,
      additionalShiftIds: dto.additionalShiftIds,
    });
  }

  @Get(':id/publications')
  @RequirePermissions('staff:read')
  listPublications(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.publications.list(user.tid, id);
  }

  @Post(':id/publications')
  @RequirePermissions('staff:manage')
  createPublication(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: CreateStaffPublicationDto,
  ) {
    return this.publications.create(user.tid, id, dto);
  }

  @Patch(':id/publications/:pubId')
  @RequirePermissions('staff:manage')
  updatePublication(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('pubId') pubId: string,
    @Body() dto: UpdateStaffPublicationDto,
  ) {
    return this.publications.update(user.tid, id, pubId, dto);
  }

  @Delete(':id/publications/:pubId')
  @RequirePermissions('staff:manage')
  removePublication(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('pubId') pubId: string,
  ) {
    return this.publications.remove(user.tid, id, pubId);
  }

  @Get(':id/awards')
  @RequirePermissions('staff:read')
  listAwards(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.awards.list(user.tid, id);
  }

  @Post(':id/awards')
  @RequirePermissions('staff:manage')
  createAward(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: CreateStaffAwardDto,
  ) {
    return this.awards.create(user.tid, id, dto);
  }

  @Patch(':id/awards/:awardId')
  @RequirePermissions('staff:manage')
  updateAward(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('awardId') awardId: string,
    @Body() dto: UpdateStaffAwardDto,
  ) {
    return this.awards.update(user.tid, id, awardId, dto);
  }

  @Delete(':id/awards/:awardId')
  @RequirePermissions('staff:manage')
  removeAward(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('awardId') awardId: string,
  ) {
    return this.awards.remove(user.tid, id, awardId);
  }

  @Get(':id/profile')
  @RequirePermissions('staff:read')
  getProfile(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.profileService.getProfile(user.tid, id);
  }

  @Patch(':id/profile/sections/:sectionKey')
  @RequirePermissions('staff:manage')
  updateProfileSection(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('sectionKey') sectionKey: string,
    @Body() dto: UpdateStaffSectionDto,
  ) {
    return this.profileService.updateSection(
      user.tid,
      id,
      sectionKey,
      dto.data,
    );
  }

  @Get(':id/subject-assignments')
  @RequireAnyPermission('staff:read', 'staff:assign-subjects')
  listSubjectAssignments(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
  ) {
    return this.subjectAssignments.list(user.tid, id);
  }

  @Get(':id/subject-assignments/contexts')
  @RequireAnyPermission('staff:read', 'staff:assign-subjects')
  listAssignableTeachingContexts(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Query() query: TeachingAssignmentContextQueryDto,
  ) {
    return this.subjectAssignments.listAssignableContexts(user.tid, id, query);
  }

  @Post(':id/subject-assignments')
  @RequirePermissions('staff:assign-subjects')
  assignSubject(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: AssignSubjectDto,
  ) {
    return this.subjectAssignments.assign(user.tid, id, dto);
  }

  @Delete(':id/subject-assignments/:assignmentId')
  @RequirePermissions('staff:assign-subjects')
  removeSubjectAssignment(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.subjectAssignments.remove(user.tid, id, assignmentId);
  }

  @Post(':id/portal')
  @RequirePermissions('staff:portal')
  provisionPortal(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ProvisionStaffPortalDto,
  ) {
    return this.provisioning.provisionPortal(user.tid, id, dto, user.sub);
  }

  @Post(':id/portal/deactivate')
  @RequirePermissions('staff:portal')
  deactivatePortal(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.provisioning.deactivate(user.tid, id);
  }

  @Post(':id/photo')
  @RequirePermissions('staff:manage')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_BYTES },
    }),
  )
  uploadPhoto(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('No file uploaded');
    }
    return this.assetsService.uploadPhoto(user.tid, id, file, user.sub);
  }

  @Get(':id/documents/compliance')
  @RequirePermissions('staff:read')
  documentCompliance(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.documentsService.getCompliance(user.tid, id);
  }

  @Get(':id/documents/audit')
  @RequirePermissions('staff:read')
  documentAudit(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.documentsService.getAuditTrail(user.tid, id);
  }

  @Get(':id/documents/download-zip')
  @RequirePermissions('staff:read')
  async documentZip(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Query('verifiedOnly') verifiedOnly: string | undefined,
    @Res() res: Response,
  ) {
    const buf = await this.documentsService.downloadZip(
      user.tid,
      id,
      verifiedOnly === 'true',
    );
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="staff-${id}-documents.zip"`,
    );
    return res.send(buf);
  }

  @Post(':id/documents')
  @RequirePermissions('staff:manage')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_BYTES },
    }),
  )
  uploadDocument(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UploadStaffDocumentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('No file uploaded');
    }
    return this.documentsService.uploadDocument(
      user.tid,
      id,
      dto.documentType,
      file,
      user.sub,
    );
  }

  @Patch(':id/documents/:docId/verify')
  @RequirePermissions('staff:manage')
  verifyDocument(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('docId') docId: string,
    @Body() dto: VerifyStaffDocumentDto,
  ) {
    return this.documentsService.verifyDocument(
      user.tid,
      id,
      docId,
      dto,
      user.sub,
    );
  }

  @Patch(':id/documents/:docId/meta')
  @RequirePermissions('staff:manage')
  updateDocumentMeta(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('docId') docId: string,
    @Body() dto: UpdateStaffDocumentMetaDto,
  ) {
    return this.documentsService.updateDocumentMeta(
      user.tid,
      id,
      docId,
      dto,
      user.sub,
    );
  }

  @Delete(':id/documents/:docId')
  @RequirePermissions('staff:manage')
  deleteDocument(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('docId') docId: string,
  ) {
    return this.documentsService.deleteDocument(user.tid, id, docId, user.sub);
  }

  @Get(':id')
  @RequirePermissions('staff:read')
  getOne(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.staff.getOne(user, id);
  }

  @Patch(':id')
  @RequirePermissions('staff:manage')
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.staff.update(user.tid, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('staff:manage')
  remove(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.staff.deactivate(user.tid, id);
  }
}
