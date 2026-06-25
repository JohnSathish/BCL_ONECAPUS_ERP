import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
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
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import { RequireStepUp } from '../../common/decorators/require-step-up.decorator';
import {
  AdmitStudentDto,
  AdmitFullStudentDto,
  AdmitWithRegistrationDto,
  BulkAbcUploadDto,
  BulkAssignRfidDto,
  BulkGenerateRollNumbersDto,
  CommitStudentImportDto,
  CreateLifecycleEventDto,
  CreateShiftTransferDto,
  CreateStudentDto,
  CreateStudentRemarkDto,
  EnrollFromApplicationDto,
  GenerateRollNumberDto,
  StudentExportQueryDto,
  StudentListQueryDto,
  toStudentListQuery,
  UpdateStudentDto,
  UpdateStudentProfileDto,
  UploadStudentDocumentDto,
  ValidateStudentImportDto,
} from './dto/students.dto';
import {
  BulkShiftTransferDto,
  ReserveRollNumberDto,
  UpsertRollShiftRangesDto,
} from './dto/roll-shift-range.dto';
import {
  UpsertProfileFieldConfigDto,
  VerifyDocumentDto,
} from './dto/profile-section.dto';
import { StudentImportService } from './import/student-import.service';
import { MigrationStatusService } from './migration/migration-status.service';
import { StudentAssetsService } from './services/student-assets.service';
import {
  StudentLifecycleService,
  type LifecycleEventType,
} from './services/student-lifecycle.service';
import { StudentProfileSectionsService } from './services/student-profile-sections.service';
import { StudentPortalProfileService } from './services/student-portal-profile.service';
import { StudentProfileService } from './services/student-profile.service';
import { IdCardsService } from '../id-cards/id-cards.service';
import { StudentsService } from './students.service';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

@ApiBearerAuth()
@ApiTags('students')
@Controller({ path: 'students', version: '1' })
export class StudentsController {
  constructor(
    private readonly students: StudentsService,
    private readonly profileService: StudentProfileService,
    private readonly portalProfile: StudentPortalProfileService,
    private readonly idCards: IdCardsService,
    private readonly sectionsService: StudentProfileSectionsService,
    private readonly lifecycleService: StudentLifecycleService,
    private readonly assetsService: StudentAssetsService,
    private readonly studentImport: StudentImportService,
    private readonly migrationStatusService: MigrationStatusService,
  ) {}

  @Get('summary')
  summary(@CurrentUser() user: JwtUser) {
    return this.students.getSummary(user.tid);
  }

  @Get('summary/enhanced')
  enhancedSummary(@CurrentUser() user: JwtUser) {
    return this.students.getEnhancedSummary(user.tid);
  }

  @Get('abc/coverage')
  @RequirePermissions('students:read')
  abcCoverage(@CurrentUser() user: JwtUser) {
    return this.students.getAbcCoverage(user.tid);
  }

  @Get('abc/upload-template')
  @RequirePermissions('students:manage')
  async downloadAbcUploadTemplate(@Res() res: Response) {
    const buffer = await this.students.buildAbcUploadTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="ABC_ID_Upload_Template.xlsx"',
    );
    res.send(buffer);
  }

  @Post('abc/bulk-upload')
  @RequirePermissions('students:manage')
  bulkUploadAbc(@CurrentUser() user: JwtUser, @Body() dto: BulkAbcUploadDto) {
    return this.students.bulkUploadAbcIds(user.tid, dto.rows);
  }

  @Get('export.csv')
  @RequirePermissions('students:export')
  async exportCsv(
    @CurrentUser() user: JwtUser,
    @Res() res: Response,
    @Query() query: StudentExportQueryDto,
  ) {
    const result = await this.students.exportCsv(
      user,
      toStudentListQuery(query),
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="students_export.csv"',
    );
    if (result.truncated) {
      res.setHeader('X-Export-Truncated', 'true');
      res.setHeader('X-Export-Total', String(result.total));
    }
    res.send(result.csv);
  }

  @Get('export/profile.xlsx')
  @RequirePermissions('students:export')
  async exportProfileXlsx(
    @CurrentUser() user: JwtUser,
    @Res() res: Response,
    @Query() query: StudentExportQueryDto,
  ) {
    const result = await this.students.exportProfileXlsx(
      user,
      toStudentListQuery(query),
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="students_profile_export.xlsx"',
    );
    if (result.truncated) {
      res.setHeader('X-Export-Truncated', 'true');
      res.setHeader('X-Export-Total', String(result.total));
    }
    res.send(result.buffer);
  }

  @Get('export/subject-allocations.xlsx')
  @RequirePermissions('students:export')
  async exportSubjectAllocationsXlsx(
    @CurrentUser() user: JwtUser,
    @Res() res: Response,
    @Query() query: StudentExportQueryDto,
  ) {
    const result = await this.students.exportSubjectAllocationsXlsx(
      user,
      toStudentListQuery(query),
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="subject_allocations_export.xlsx"',
    );
    if (result.truncated) {
      res.setHeader('X-Export-Truncated', 'true');
    }
    res.send(result.buffer);
  }

  @Get('import/template')
  @RequirePermissions('students:import')
  async downloadImportTemplate(
    @CurrentUser() user: JwtUser,
    @Res() res: Response,
    @Query('mode') mode: 'blank' | 'prefilled' = 'blank',
    @Query('variant')
    variant: 'default' | 'sem1-admission' | 'sem3-admission' = 'default',
    @Query('programme') programme?: string,
    @Query('programVersionId') programVersionId?: string,
    @Query('semesterSequence') semesterSequence?: string,
  ) {
    const buffer =
      variant === 'sem1-admission'
        ? await this.studentImport.buildSem1AdmissionTemplate()
        : variant === 'sem3-admission'
          ? await this.studentImport.buildSem3AdmissionTemplate({
              tenantId: user.tid,
              programme,
              programVersionId,
              semesterSequence: semesterSequence ? Number(semesterSequence) : 3,
            })
          : await this.studentImport.buildTemplate({
              mode,
              tenantId: user.tid,
            });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    const filename =
      variant === 'sem1-admission'
        ? 'Sem1_Admission_Import_Template.xlsx'
        : variant === 'sem3-admission'
          ? 'Sem3_Admission_Import_Template.xlsx'
          : 'Student_Import_Template.xlsx';
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get('import/sem3-curriculum/programmes')
  @RequirePermissions('students:import')
  listSem3ImportProgrammes(@CurrentUser() user: JwtUser) {
    return this.studentImport.listSem3ImportProgrammes(user.tid);
  }

  @Get('import/sem3-curriculum')
  @RequirePermissions('students:import')
  getSem3ImportCurriculum(
    @CurrentUser() user: JwtUser,
    @Query('programme') programme?: string,
    @Query('programVersionId') programVersionId?: string,
    @Query('semesterSequence') semesterSequence?: string,
  ) {
    return this.studentImport.getSem3ImportCurriculum(user.tid, {
      programme,
      programVersionId,
      semesterSequence: semesterSequence ? Number(semesterSequence) : 3,
    });
  }

  @Get('migration/status')
  @RequirePermissions('students:read')
  getMigrationStatus(
    @CurrentUser() user: JwtUser,
    @Query('batchCode') batchCode?: string,
    @Query('semesterSequence') semesterSequence?: string,
  ) {
    return this.migrationStatusService.getStatus(user.tid, {
      batchCode,
      semesterSequence: semesterSequence ? Number(semesterSequence) : undefined,
    });
  }

  @Post('import/validate')
  @RequirePermissions('students:import')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        importMode: { type: 'string', enum: ['CREATE', 'MERGE'] },
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
    @Body() dto: ValidateStudentImportDto,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('No file uploaded');
    }
    return this.studentImport.validateUpload(
      user.tid,
      user.sub,
      file.originalname ?? 'upload.xlsx',
      file.buffer,
      { importMode: dto.importMode ?? 'CREATE' },
    );
  }

  @Post('import/commit')
  @RequirePermissions('students:import')
  commitImport(
    @CurrentUser() user: JwtUser,
    @Body() dto: CommitStudentImportDto,
  ) {
    return this.studentImport.commit(
      user.tid,
      user.sub,
      dto.batchId,
      dto.mode,
      dto.importMode ?? 'CREATE',
    );
  }

  @Get('import/batches')
  @RequirePermissions('students:import')
  listImportBatches(
    @CurrentUser() user: JwtUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.studentImport.listBatches(user.tid, query);
  }

  @Get('import/batches/:id/preview')
  @RequirePermissions('students:import')
  previewImportBatch(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.studentImport.getBatchPreview(
      id,
      user.tid,
      query.page,
      query.limit ?? 200,
    );
  }

  @Get('import/batches/:id/error-report')
  @RequirePermissions('students:import')
  async downloadImportErrorReport(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const buffer = await this.studentImport.buildErrorReport(id, user.tid);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="Student_Import_Error_Report.xlsx"',
    );
    res.send(buffer);
  }

  @Post('admit')
  @RequirePermissions('students:manage')
  admit(@CurrentUser() user: JwtUser, @Body() dto: AdmitStudentDto) {
    return this.students.admit(user.tid, dto);
  }

  @Post('admit-full')
  @RequirePermissions('students:manage')
  admitFull(@CurrentUser() user: JwtUser, @Body() dto: AdmitFullStudentDto) {
    return this.students.admitFull(user.tid, user.sub, dto);
  }

  @Post('admit-with-registration')
  @RequirePermissions('students:manage')
  admitWithRegistration(
    @CurrentUser() user: JwtUser,
    @Body() dto: AdmitWithRegistrationDto,
  ) {
    return this.students.admitWithRegistration(user.tid, user.sub, dto);
  }

  @Post('generate-roll-number')
  @RequirePermissions('students:manage')
  generateRollNumber(
    @CurrentUser() user: JwtUser,
    @Body() dto: GenerateRollNumberDto,
  ) {
    return this.students.generateRollNumber(user.tid, dto, user.sub);
  }

  @Post('roll-numbers/bulk-generate')
  @RequirePermissions('students:manage')
  bulkGenerateRollNumbers(
    @CurrentUser() user: JwtUser,
    @Body() dto: BulkGenerateRollNumbersDto,
  ) {
    return this.students.bulkGenerateRollNumbers(user.tid, dto, user.sub);
  }

  @Get('roll-numbers/data-cleanup')
  @RequirePermissions('students:manage')
  scanRollNumberDataCleanup(@CurrentUser() user: JwtUser) {
    return this.students.scanRollNumberDataCleanup(user.tid);
  }

  @Get('roll-numbers/history')
  @RequirePermissions('students:manage')
  listRollNumberHistory(@CurrentUser() user: JwtUser) {
    return this.students.listRollNumberGenerationHistory(user.tid);
  }

  @Post('roll-numbers/sync-sequences')
  @RequirePermissions('students:manage')
  syncRollSequences(
    @CurrentUser() user: JwtUser,
    @Body() body: { institutionId?: string },
  ) {
    return this.students.syncRollNumberSequences(user.tid, body.institutionId);
  }

  @Get('roll-numbers/shift-ranges')
  @RequirePermissions('students:manage', 'lookups:read')
  listRollShiftRanges(
    @CurrentUser() user: JwtUser,
    @Query('institutionId') institutionId?: string,
    @Query('admissionYear') admissionYear?: string,
  ) {
    return this.students.listRollShiftRanges(
      user.tid,
      institutionId,
      admissionYear ? Number(admissionYear) : undefined,
    );
  }

  @Patch('roll-numbers/shift-ranges')
  @RequirePermissions('students:manage', 'lookups:manage')
  upsertRollShiftRanges(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpsertRollShiftRangesDto,
  ) {
    return this.students.upsertRollShiftRanges(
      user.tid,
      dto.institutionId,
      dto.ranges,
      user.sub,
    );
  }

  @Get('roll-numbers/shift-capacity')
  @RequirePermissions('students:manage', 'lookups:read')
  getRollShiftCapacity(
    @CurrentUser() user: JwtUser,
    @Query('institutionId') institutionId?: string,
    @Query('admissionYear') admissionYear?: string,
  ) {
    return this.students.getRollShiftCapacity(
      user.tid,
      institutionId,
      admissionYear ? Number(admissionYear) : undefined,
    );
  }

  @Post('roll-numbers/reserve')
  @RequirePermissions('students:manage')
  reserveRollNumber(
    @CurrentUser() user: JwtUser,
    @Body() dto: ReserveRollNumberDto,
  ) {
    return this.students.reserveRollNumber(user.tid, dto, user.sub);
  }

  @Post('shift-transfers/bulk')
  @RequirePermissions('shift:students:manage', 'students:manage')
  bulkShiftTransfer(
    @CurrentUser() user: JwtUser,
    @Body() dto: BulkShiftTransferDto,
  ) {
    return this.students.bulkShiftTransfer(user.tid, dto, user.sub);
  }

  @Get(':id/roll-number-history')
  @RequirePermissions('students:read', 'students:manage')
  getStudentRollHistory(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.students.getStudentRollShiftHistory(user.tid, id);
  }

  @Post(':id/roll-number/regenerate')
  @RequirePermissions('students:manage')
  regenerateRollNumber(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.students.regenerateStudentRollNumber(user.tid, id, user.sub);
  }

  @Get('lifecycle/events')
  @RequirePermissions('students:read')
  listLifecycleEvents(
    @CurrentUser() user: JwtUser,
    @Query('studentId') studentId?: string,
  ) {
    return this.lifecycleService.listEvents(user.tid, studentId);
  }

  @Post('lifecycle/events')
  @RequirePermissions('students:manage')
  createLifecycleEvent(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateLifecycleEventDto,
  ) {
    return this.lifecycleService.createEvent(
      user.tid,
      dto.studentId,
      user.sub,
      {
        eventType: dto.eventType as LifecycleEventType,
        effectiveDate: dto.effectiveDate,
        reason: dto.reason,
        metadata: dto.metadata,
      },
    );
  }

  @Get('audit-logs')
  @RequirePermissions('students:read')
  listAuditLogs(
    @CurrentUser() user: JwtUser,
    @Query('studentId') studentId?: string,
  ) {
    return this.lifecycleService.listAuditLogs(user.tid, studentId);
  }

  @Get('id-card/print-requests')
  @RequireAnyPermission('students:read', 'students:manage')
  listAllIdCardPrintRequests(
    @CurrentUser() user: JwtUser,
    @Query('status') status?: string,
  ) {
    return this.idCards.listPrintRequests(user.tid, status);
  }

  @Post('bulk-rfid')
  @RequirePermissions('students:manage')
  bulkAssignRfid(@CurrentUser() user: JwtUser, @Body() dto: BulkAssignRfidDto) {
    return this.students.bulkAssignRfid(user.tid, user.sub, dto.assignments);
  }

  @Get('profile-field-config')
  @RequirePermissions('students:read')
  getFieldConfig(
    @CurrentUser() user: JwtUser,
    @Query('institutionId') institutionId: string,
  ) {
    return this.sectionsService.getFieldConfig(user.tid, institutionId);
  }

  @Put('profile-field-config')
  @RequirePermissions('students:manage')
  upsertFieldConfig(
    @CurrentUser() user: JwtUser,
    @Query('institutionId') institutionId: string,
    @Body() dto: UpsertProfileFieldConfigDto,
  ) {
    return this.sectionsService.upsertFieldConfig(
      user.tid,
      institutionId,
      dto.fields,
    );
  }

  @Get()
  @RequireAnyPermission('students:read', 'students:manage')
  list(@CurrentUser() user: JwtUser, @Query() query: StudentListQueryDto) {
    return this.students.list(user, toStudentListQuery(query));
  }

  @Get('directory')
  @RequireAnyPermission('students:read', 'students:manage')
  directory(@CurrentUser() user: JwtUser, @Query() query: StudentListQueryDto) {
    return this.students.list(user, toStudentListQuery(query));
  }

  @Post('shift-transfers/:transferId/approve')
  @RequirePermissions('shift:students:manage')
  approveShiftTransfer(
    @CurrentUser() user: JwtUser,
    @Param('transferId') transferId: string,
  ) {
    return this.students.approveShiftTransfer(user.tid, transferId, user.sub);
  }

  @Post('from-application/:applicationId')
  enrollFromApplication(
    @CurrentUser() user: JwtUser,
    @Param('applicationId') applicationId: string,
    @Body() dto: EnrollFromApplicationDto,
  ) {
    return this.students.enrollFromApplication(user, applicationId, dto);
  }

  @Get(':id/remarks')
  @RequirePermissions('students:read')
  listRemarks(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.lifecycleService.listRemarks(user.tid, id);
  }

  @Post(':id/remarks')
  @RequirePermissions('students:manage')
  createRemark(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: CreateStudentRemarkDto,
  ) {
    return this.lifecycleService.createRemark(user.tid, id, user.sub, dto);
  }

  @Get(':id/profile/completion')
  @RequireAnyPermission('students:read', 'students:manage')
  getProfileCompletion(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.sectionsService.getCompletion(user.tid, id);
  }

  @Get(':id/profile/sections/:sectionKey')
  getProfileSection(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('sectionKey') sectionKey: string,
  ) {
    return this.sectionsService.getSection(user.tid, id, sectionKey);
  }

  @Patch(':id/profile/sections/:sectionKey')
  @RequirePermissions('students:manage')
  updateProfileSection(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('sectionKey') sectionKey: string,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.sectionsService.updateSection(
      user.tid,
      id,
      sectionKey,
      dto,
      user.sub,
    );
  }

  @Patch(':id/documents/:docId/verify')
  @RequireAnyPermission('students:verify-documents', 'students:manage')
  verifyDocument(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('docId') docId: string,
    @Body() dto: VerifyDocumentDto,
  ) {
    return this.sectionsService.verifyDocument(
      user.tid,
      id,
      docId,
      dto,
      user.sub,
    );
  }

  @Get(':id/health')
  @RequireAnyPermission('students:read', 'students:manage')
  getStudentHealth(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.students.getStudentHealth(user, id);
  }

  @Get(':id/profile')
  getProfile(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.profileService.getFullProfile(user.tid, id);
  }

  @Get(':id/id-card/print-requests')
  @RequireAnyPermission('students:read', 'students:manage')
  listIdCardPrintRequests(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.portalProfile.listIdCardPrintRequests(user.tid, id);
  }

  @Get(':id/semester-registrations')
  getSemesterRegistrations(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
  ) {
    return this.profileService.getSemesterRegistrations(user.tid, id);
  }

  @Patch(':id/profile')
  @RequirePermissions('students:manage')
  updateProfile(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateStudentProfileDto,
  ) {
    return this.profileService.updateProfile(user.tid, id, dto);
  }

  @Post(':id/photo')
  @RequireAnyPermission(
    'students:manage',
    'students:photos:upload',
    'students:photos:replace',
  )
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

  @Post(':id/documents')
  @RequirePermissions('students:manage')
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
    @Body() dto: UploadStudentDocumentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('No file uploaded');
    }
    return this.assetsService.uploadDocument(
      user.tid,
      id,
      dto.documentType,
      file,
      user.sub,
    );
  }

  @Delete(':id/documents/:docId')
  @RequirePermissions('students:manage')
  deleteDocument(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('docId') docId: string,
  ) {
    return this.assetsService.deleteDocument(user.tid, id, docId);
  }

  @Get(':id')
  getOne(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.students.getOne(user, id);
  }

  @Post()
  @RequirePermissions('students:manage')
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateStudentDto) {
    return this.students.create(user.tid, dto);
  }

  @Patch(':id')
  @RequirePermissions('students:manage')
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateStudentDto,
  ) {
    return this.students.update(user.tid, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('students:manage')
  @RequireStepUp()
  remove(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.students.remove(user.tid, id);
  }

  @Post(':id/shift-transfer')
  @RequirePermissions('shift:students:manage')
  requestShiftTransfer(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: CreateShiftTransferDto,
  ) {
    return this.students.requestShiftTransfer(user.tid, id, dto, user.sub);
  }
}
