import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import {
  NAAC_AQAR_SECTIONS,
  NAAC_CALENDAR_EVENT_TYPES,
  NAAC_CRITERIA,
  NAAC_FACULTY_ACHIEVEMENT_TYPES,
  NAAC_MOU_PARTNER_TYPES,
  NAAC_STUDENT_ACHIEVEMENT_TYPES,
  NAAC_SUBMISSION_TYPES,
} from './constants/naac.constants';
import {
  CreateAqarDto,
  CreateCalendarEventDto,
  CreateDepartmentSubmissionDto,
  CreateEvidenceTagDto,
  CreateFacultyAchievementDto,
  CreateAssignmentDto,
  CreateEvidenceVersionDto,
  CreateMetricDto,
  CreateMouActivityDto,
  CreateMouDto,
  CreateStudentAchievementDto,
  CreateWorkspaceCommentDto,
  CreateWorkspaceEvidenceDto,
  CriteriaTreeQueryDto,
  EvidenceSearchDto,
  ListQueryDto,
  ReportExportDto,
  ReviewAchievementDto,
  ReviewDepartmentSubmissionDto,
  SyncAqarSectionDto,
  UpdateAqarDto,
  UpdateMetricDto,
  UpdateSettingsDto,
  UpdateWorkspaceDto,
  UpsertTableRowsDto,
  VaultUploadDto,
  VerifyEvidenceDto,
  WorkflowActionDto,
} from './dto/naac-iqac.dto';
import {
  NaacAchievementService,
  NaacMouService,
} from './services/naac-achievement.service';
import { NaacAggregatorService } from './services/naac-aggregator.service';
import { NaacAqarService } from './services/naac-aqar.service';
import {
  NaacCalendarService,
  NaacSettingsService,
} from './services/naac-calendar.service';
import { NaacCriteriaService } from './services/naac-criteria.service';
import { NaacDashboardService } from './services/naac-dashboard.service';
import { NaacDepartmentService } from './services/naac-department.service';
import { NaacDvvService } from './services/naac-dvv.service';
import { NaacEvidenceService } from './services/naac-evidence.service';
import { NaacIntegrationService } from './services/naac-integration.service';
import { NaacMetricWorkspaceService } from './services/naac-metric-workspace.service';
import { NaacExtendedProfileService } from './services/naac-extended-profile.service';
import { NaacMetricTableService } from './services/naac-metric-table.service';
import { NaacReportService } from './services/naac-report.service';
import { NaacVaultService } from './services/naac-vault.service';

const NIQ_READ = [
  'naac-iqac:read',
  'naac-iqac:manage',
  'naac-iqac:publish',
  'naac-iqac:reports',
  'naac-iqac:collect',
] as const;
const NIQ_MANAGE = ['naac-iqac:manage'] as const;
const NIQ_COLLECT = ['naac-iqac:collect', 'naac-iqac:manage'] as const;
const NIQ_REPORTS = ['naac-iqac:reports', 'naac-iqac:manage'] as const;

@ApiBearerAuth()
@ApiTags('naac-iqac')
@Controller({ path: 'naac-iqac', version: '1' })
export class NaacIqacController {
  constructor(
    private readonly dashboard: NaacDashboardService,
    private readonly criteria: NaacCriteriaService,
    private readonly evidence: NaacEvidenceService,
    private readonly vault: NaacVaultService,
    private readonly aqar: NaacAqarService,
    private readonly achievements: NaacAchievementService,
    private readonly mous: NaacMouService,
    private readonly department: NaacDepartmentService,
    private readonly integration: NaacIntegrationService,
    private readonly calendar: NaacCalendarService,
    private readonly settings: NaacSettingsService,
    private readonly dvv: NaacDvvService,
    private readonly reports: NaacReportService,
    private readonly aggregator: NaacAggregatorService,
    private readonly workspaces: NaacMetricWorkspaceService,
    private readonly extendedProfile: NaacExtendedProfileService,
    private readonly metricTables: NaacMetricTableService,
  ) {}

  @Get('constants')
  @RequireAnyPermission(...NIQ_READ)
  getConstants() {
    return {
      criteria: NAAC_CRITERIA,
      aqarSections: NAAC_AQAR_SECTIONS,
      facultyAchievementTypes: NAAC_FACULTY_ACHIEVEMENT_TYPES,
      studentAchievementTypes: NAAC_STUDENT_ACHIEVEMENT_TYPES,
      mouPartnerTypes: NAAC_MOU_PARTNER_TYPES,
      calendarEventTypes: NAAC_CALENDAR_EVENT_TYPES,
      submissionTypes: NAAC_SUBMISSION_TYPES,
    };
  }

  @Get('dashboard')
  @RequireAnyPermission(...NIQ_READ)
  getDashboard(@CurrentUser() user: JwtUser) {
    return this.dashboard.dashboard(user.tid);
  }

  @Get('dashboard/criteria')
  @RequireAnyPermission(...NIQ_READ)
  getCriterionSummary(@CurrentUser() user: JwtUser) {
    return this.evidence.summary(user.tid);
  }

  @Get('criteria')
  @RequireAnyPermission(...NIQ_READ)
  listCriteria(@CurrentUser() user: JwtUser) {
    return this.criteria.listCriteria(user.tid);
  }

  @Get('metrics')
  @RequireAnyPermission(...NIQ_READ)
  listMetrics(
    @CurrentUser() user: JwtUser,
    @Query('criterion') criterion?: string,
  ) {
    return this.criteria.listMetrics(
      user.tid,
      criterion ? parseInt(criterion, 10) : undefined,
    );
  }

  @Post('metrics')
  @RequireAnyPermission(...NIQ_MANAGE)
  createMetric(@CurrentUser() user: JwtUser, @Body() dto: CreateMetricDto) {
    return this.criteria.createMetric(user.tid, dto);
  }

  @Patch('metrics/:id')
  @RequireAnyPermission(...NIQ_MANAGE)
  updateMetric(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateMetricDto,
  ) {
    return this.criteria.updateMetric(user.tid, id, dto);
  }

  @Get('evidence')
  @RequireAnyPermission(...NIQ_READ)
  searchEvidence(
    @CurrentUser() user: JwtUser,
    @Query() query: EvidenceSearchDto,
  ) {
    return this.evidence.search(user.tid, query);
  }

  @Get('evidence/by-source')
  @RequireAnyPermission(...NIQ_READ, ...NIQ_COLLECT)
  evidenceBySource(
    @CurrentUser() user: JwtUser,
    @Query('sourceType') sourceType: string,
    @Query('sourceId') sourceId: string,
  ) {
    return this.evidence.findBySource(user.tid, sourceType, sourceId);
  }

  @Post('evidence/tags')
  @RequireAnyPermission(...NIQ_MANAGE, ...NIQ_COLLECT)
  createEvidenceTag(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateEvidenceTagDto,
  ) {
    return this.evidence.create(user, dto);
  }

  @Delete('evidence/tags/:id')
  @RequireAnyPermission(...NIQ_MANAGE)
  deleteEvidenceTag(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.evidence.remove(user, id);
  }

  @Get('vault')
  @RequireAnyPermission(...NIQ_READ)
  listVault(@CurrentUser() user: JwtUser, @Query() query: ListQueryDto) {
    return this.vault.list(user.tid, query.page, query.limit);
  }

  @Post('vault/upload')
  @RequireAnyPermission(...NIQ_MANAGE, ...NIQ_COLLECT)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  uploadVault(
    @CurrentUser() user: JwtUser,
    @Body() dto: VaultUploadDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.vault.upload(user, dto, file);
  }

  @Get('vault/:id/download')
  @RequireAnyPermission(...NIQ_READ)
  async downloadVault(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.vault.download(user.tid, id);
  }

  @Get('aqar')
  @RequireAnyPermission(...NIQ_READ)
  listAqar(@CurrentUser() user: JwtUser) {
    return this.aqar.list(user.tid);
  }

  @Post('aqar')
  @RequireAnyPermission(...NIQ_MANAGE)
  createAqar(@CurrentUser() user: JwtUser, @Body() dto: CreateAqarDto) {
    return this.aqar.create(user.tid, dto);
  }

  @Get('aqar/:id')
  @RequireAnyPermission(...NIQ_READ)
  getAqar(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.aqar.getById(user.tid, id);
  }

  @Patch('aqar/:id')
  @RequireAnyPermission(...NIQ_MANAGE)
  updateAqar(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateAqarDto,
  ) {
    return this.aqar.update(user.tid, id, dto);
  }

  @Post('aqar/:id/sync')
  @RequireAnyPermission(...NIQ_MANAGE)
  syncAqarSection(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SyncAqarSectionDto,
  ) {
    return this.aqar.syncSection(user.tid, id, dto);
  }

  @Get('faculty-achievements')
  @RequireAnyPermission(...NIQ_READ)
  listFacultyAchievements(
    @CurrentUser() user: JwtUser,
    @Query() query: ListQueryDto,
    @Query('status') status?: string,
    @Query('staffProfileId') staffProfileId?: string,
  ) {
    return this.achievements.listFaculty(user.tid, query.page, query.limit, {
      status,
      staffProfileId,
    });
  }

  @Post('faculty-achievements')
  @RequireAnyPermission(...NIQ_COLLECT)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  createFacultyAchievement(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateFacultyAchievementDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.achievements.createFaculty(user, dto, file);
  }

  @Patch('faculty-achievements/:id')
  @RequireAnyPermission(...NIQ_MANAGE)
  reviewFacultyAchievement(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ReviewAchievementDto,
  ) {
    return this.achievements.reviewFaculty(user, id, dto);
  }

  @Post('faculty-achievements/bulk-review')
  @RequireAnyPermission(...NIQ_MANAGE)
  bulkReviewFacultyAchievements(
    @CurrentUser() user: JwtUser,
    @Body() dto: ReviewAchievementDto & { ids: string[] },
  ) {
    return this.achievements.bulkReviewFaculty(user, dto);
  }

  @Get('student-achievements')
  @RequireAnyPermission(...NIQ_READ)
  listStudentAchievements(
    @CurrentUser() user: JwtUser,
    @Query() query: ListQueryDto,
    @Query('status') status?: string,
  ) {
    return this.achievements.listStudent(user.tid, query.page, query.limit, {
      status,
    });
  }

  @Post('student-achievements')
  @RequireAnyPermission(...NIQ_COLLECT)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  createStudentAchievement(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateStudentAchievementDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.achievements.createStudent(user, dto, file);
  }

  @Patch('student-achievements/:id')
  @RequireAnyPermission(...NIQ_MANAGE)
  reviewStudentAchievement(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ReviewAchievementDto,
  ) {
    return this.achievements.reviewStudent(user, id, dto);
  }

  @Get('mous')
  @RequireAnyPermission(...NIQ_READ)
  listMous(@CurrentUser() user: JwtUser) {
    return this.mous.list(user.tid);
  }

  @Post('mous')
  @RequireAnyPermission(...NIQ_MANAGE)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  createMou(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateMouDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.mous.create(user, dto, file);
  }

  @Get('mous/:id')
  @RequireAnyPermission(...NIQ_READ)
  getMou(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.mous.getById(user.tid, id);
  }

  @Post('mous/:id/activities')
  @RequireAnyPermission(...NIQ_MANAGE)
  addMouActivity(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: CreateMouActivityDto,
  ) {
    return this.mous.addActivity(user.tid, id, dto);
  }

  @Get('department/dashboard')
  @RequireAnyPermission(...NIQ_READ, ...NIQ_COLLECT)
  departmentDashboard(
    @CurrentUser() user: JwtUser,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.department.dashboard(user, departmentId);
  }

  @Get('department/submissions')
  @RequireAnyPermission(...NIQ_READ, ...NIQ_COLLECT)
  listDepartmentSubmissions(
    @CurrentUser() user: JwtUser,
    @Query('status') status?: string,
    @Query('academicYear') academicYear?: string,
  ) {
    return this.department.listSubmissions(user, { status, academicYear });
  }

  @Post('department/submissions')
  @RequireAnyPermission(...NIQ_COLLECT)
  createDepartmentSubmission(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateDepartmentSubmissionDto,
  ) {
    return this.department.createSubmission(user, dto);
  }

  @Post('department/submissions/:id/submit')
  @RequireAnyPermission(...NIQ_COLLECT)
  submitDepartmentDraft(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.department.submitDraft(user, id);
  }

  @Patch('department/submissions/:id')
  @RequireAnyPermission(...NIQ_MANAGE)
  reviewDepartmentSubmission(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ReviewDepartmentSubmissionDto,
  ) {
    return this.department.reviewSubmission(user, id, dto);
  }

  @Get('iqac/summary')
  @RequireAnyPermission(...NIQ_READ)
  iqacSummary(@CurrentUser() user: JwtUser) {
    return this.integration.iqacSummary(user.tid);
  }

  @Get('iqac/meetings')
  @RequireAnyPermission(...NIQ_READ)
  iqacMeetings(@CurrentUser() user: JwtUser) {
    return this.integration.listMeetings(user.tid);
  }

  @Get('iqac/atr')
  @RequireAnyPermission(...NIQ_READ)
  iqacAtr(@CurrentUser() user: JwtUser) {
    return this.integration.listAtr(user.tid);
  }

  @Get('dvv/readiness')
  @RequireAnyPermission(...NIQ_REPORTS, ...NIQ_READ)
  dvvReadiness(
    @CurrentUser() user: JwtUser,
    @Query('academicYear') academicYear?: string,
  ) {
    return this.dvv.readiness(user.tid, academicYear);
  }

  @Get('dvv/clarifications')
  @RequireAnyPermission(...NIQ_READ)
  listDvvClarifications(
    @CurrentUser() user: JwtUser,
    @Query('academicYear') academicYear?: string,
    @Query('status') status?: string,
    @Query('metricCode') metricCode?: string,
    @Query('assignedToMe') assignedToMe?: string,
  ) {
    return this.dvv.listClarifications(user, {
      academicYear,
      status,
      metricCode,
      assignedToMe,
    });
  }

  @Post('dvv/clarifications')
  @RequireAnyPermission(...NIQ_COLLECT)
  createDvvClarification(
    @CurrentUser() user: JwtUser,
    @Body()
    body: {
      metricCode: string;
      academicYear?: string;
      queryCode: string;
      title: string;
      naacQueryText: string;
      dueDate?: string;
      assignedFacultyId?: string;
    },
  ) {
    return this.dvv.createClarification(user, body);
  }

  @Get('dvv/clarifications/:id')
  @RequireAnyPermission(...NIQ_READ)
  getDvvClarification(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.dvv.getClarification(user, id);
  }

  @Patch('dvv/clarifications/:id')
  @RequireAnyPermission(...NIQ_COLLECT)
  updateDvvClarification(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      naacQueryText?: string;
      status?: string;
      assignedFacultyId?: string | null;
      dueDate?: string | null;
    },
  ) {
    return this.dvv.updateClarification(user, id, body);
  }

  @Post('dvv/clarifications/:id/evidence-links')
  @RequireAnyPermission(...NIQ_COLLECT)
  addDvvEvidenceLink(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body()
    body: {
      evidenceItemId?: string;
      vaultDocumentId?: string;
      note?: string;
    },
  ) {
    return this.dvv.addEvidenceLink(user, id, body);
  }

  @Post('dvv/clarifications/:id/responses')
  @RequireAnyPermission(...NIQ_COLLECT)
  upsertDvvResponse(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { body: string },
  ) {
    return this.dvv.upsertResponse(user, id, body.body);
  }

  @Post('dvv/clarifications/:id/comments')
  @RequireAnyPermission(...NIQ_COLLECT)
  addDvvComment(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { body: string },
  ) {
    return this.dvv.addComment(user, id, body.body);
  }

  @Post('dvv/clarifications/:id/submit-for-review')
  @RequireAnyPermission(...NIQ_COLLECT)
  submitDvvForReview(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body?: { remark?: string },
  ) {
    return this.dvv.submitForReview(user, id, body?.remark);
  }

  @Post('dvv/clarifications/:id/approval/:action')
  @RequireAnyPermission(...NIQ_COLLECT)
  dvvApprovalAct(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('action') action: string,
    @Body() body?: { note?: string },
  ) {
    const allowed = [
      'APPROVE',
      'REQUEST_CHANGES',
      'REJECT',
      'REOPEN',
      'COMMENT',
    ] as const;
    const act = action.toUpperCase() as (typeof allowed)[number];
    if (!allowed.includes(act)) {
      return { error: 'Invalid action' };
    }
    return this.dvv.approvalAct(user, id, act, body?.note);
  }

  @Get('calendar')
  @RequireAnyPermission(...NIQ_READ)
  listCalendar(@CurrentUser() user: JwtUser) {
    return this.calendar.list(user.tid);
  }

  @Post('calendar')
  @RequireAnyPermission(...NIQ_MANAGE)
  createCalendar(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateCalendarEventDto,
  ) {
    return this.calendar.create(user, dto);
  }

  @Delete('calendar/:id')
  @RequireAnyPermission(...NIQ_MANAGE)
  deleteCalendar(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.calendar.remove(user, id);
  }

  @Get('settings')
  @RequireAnyPermission(...NIQ_READ)
  getSettings(@CurrentUser() user: JwtUser) {
    return this.settings.get(user.tid);
  }

  @Patch('settings')
  @RequireAnyPermission(...NIQ_MANAGE)
  updateSettings(@CurrentUser() user: JwtUser, @Body() dto: UpdateSettingsDto) {
    return this.settings.update(user.tid, dto);
  }

  @Post('reports/export')
  @RequireAnyPermission(...NIQ_REPORTS)
  exportReport(@CurrentUser() user: JwtUser, @Body() dto: ReportExportDto) {
    return this.reports.export(user.tid, dto);
  }

  @Get('reports/evidence-pack')
  @RequireAnyPermission(...NIQ_REPORTS)
  async evidencePack(
    @CurrentUser() user: JwtUser,
    @Query('criterion') criterion?: string,
    @Query('academicYear') academicYear?: string,
  ) {
    const buffer = await this.reports.exportEvidencePack(user.tid, {
      reportType: 'evidence-pack',
      criterion: criterion ? parseInt(criterion, 10) : undefined,
      academicYear,
    });
    const year = academicYear ?? 'all';
    const crit = criterion ?? 'all';
    return new StreamableFile(buffer, {
      type: 'application/zip',
      disposition: `attachment; filename="naac-evidence-pack-c${crit}-${year}.zip"`,
    });
  }

  @Get('aggregates')
  @RequireAnyPermission(...NIQ_READ)
  getAggregates(@CurrentUser() user: JwtUser) {
    return this.aggregator.summary(user.tid);
  }

  // ── Metric Workspace ──────────────────────────────────────────────

  @Get('criteria/tree')
  @RequireAnyPermission(...NIQ_READ)
  criteriaTree(
    @CurrentUser() user: JwtUser,
    @Query() query: CriteriaTreeQueryDto,
  ) {
    return this.workspaces.getCriteriaTree(user, query);
  }

  @Get('my/workspaces')
  @RequireAnyPermission(...NIQ_READ)
  myWorkspaces(
    @CurrentUser() user: JwtUser,
    @Query('academicYear') academicYear?: string,
  ) {
    return this.workspaces.myWorkspaces(user, academicYear);
  }

  @Get('metrics/:code/workspace')
  @RequireAnyPermission(...NIQ_READ)
  metricWorkspace(
    @CurrentUser() user: JwtUser,
    @Param('code') code: string,
    @Query('academicYear') academicYear?: string,
  ) {
    return this.workspaces.getWorkspaceByMetricCode(user, code, academicYear);
  }

  @Patch('workspaces/:id')
  @RequireAnyPermission(...NIQ_COLLECT)
  patchWorkspace(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.workspaces.patchWorkspace(user, id, dto);
  }

  @Post('workspaces/:id/assignments')
  @RequireAnyPermission(...NIQ_MANAGE)
  addAssignment(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: CreateAssignmentDto,
  ) {
    return this.workspaces.addAssignment(user, id, dto);
  }

  @Delete('workspaces/:id/assignments/:assignmentId')
  @RequireAnyPermission(...NIQ_MANAGE)
  removeAssignment(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.workspaces.removeAssignment(user, id, assignmentId);
  }

  @Post('workspaces/:id/evidence')
  @RequireAnyPermission(...NIQ_COLLECT)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  addWorkspaceEvidence(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: CreateWorkspaceEvidenceDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.workspaces.addEvidence(user, id, dto, file);
  }

  @Post('evidence-items/:id/versions')
  @RequireAnyPermission(...NIQ_COLLECT)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  addEvidenceVersion(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: CreateEvidenceVersionDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.workspaces.addEvidenceVersion(user, id, dto, file);
  }

  @Patch('evidence-items/:id/verify')
  @RequireAnyPermission(...NIQ_COLLECT)
  verifyEvidenceItem(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: VerifyEvidenceDto,
  ) {
    return this.workspaces.verifyEvidence(user, id, dto);
  }

  @Post('workspaces/:id/submit')
  @RequireAnyPermission(...NIQ_COLLECT)
  submitWorkspace(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: WorkflowActionDto,
  ) {
    return this.workspaces.submit(user, id, dto.remark);
  }

  @Post('workspaces/:id/verify')
  @RequireAnyPermission(...NIQ_COLLECT)
  verifyWorkspace(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: WorkflowActionDto,
  ) {
    return this.workspaces.verify(user, id, dto.remark);
  }

  @Post('workspaces/:id/approve')
  @RequireAnyPermission(...NIQ_COLLECT)
  approveWorkspace(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: WorkflowActionDto,
  ) {
    return this.workspaces.approve(user, id, dto.remark);
  }

  @Post('workspaces/:id/reject')
  @RequireAnyPermission(...NIQ_COLLECT)
  rejectWorkspace(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: WorkflowActionDto,
  ) {
    return this.workspaces.reject(user, id, dto.remark);
  }

  @Post('workspaces/:id/reopen')
  @RequireAnyPermission(...NIQ_MANAGE)
  reopenWorkspace(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: WorkflowActionDto,
  ) {
    return this.workspaces.reopen(user, id, dto.remark);
  }

  @Get('workspaces/:id/comments')
  @RequireAnyPermission(...NIQ_READ)
  listWorkspaceComments(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.workspaces.listComments(user, id);
  }

  @Post('workspaces/:id/comments')
  @RequireAnyPermission(...NIQ_COLLECT)
  addWorkspaceComment(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: CreateWorkspaceCommentDto,
  ) {
    return this.workspaces.addComment(user, id, dto.body);
  }

  // ── Extended Profile + ERP pull ───────────────────────────────────

  @Get('extended-profile')
  @RequireAnyPermission(...NIQ_READ)
  getExtendedProfile(
    @CurrentUser() user: JwtUser,
    @Query('academicYear') academicYear?: string,
  ) {
    return this.extendedProfile.get(user.tid, academicYear);
  }

  @Post('extended-profile/pull')
  @RequireAnyPermission(...NIQ_COLLECT)
  pullExtendedProfile(
    @CurrentUser() user: JwtUser,
    @Body() body?: { academicYear?: string },
  ) {
    return this.extendedProfile.pull(user, body?.academicYear);
  }

  @Post('workspaces/:id/pull-erp')
  @RequireAnyPermission(...NIQ_COLLECT)
  pullWorkspaceErp(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.extendedProfile.pullWorkspaceErp(user, id);
  }

  @Post('workspaces/pull-erp-bulk')
  @RequireAnyPermission(...NIQ_MANAGE)
  pullErpBulk(
    @CurrentUser() user: JwtUser,
    @Query('criterion') criterion?: string,
    @Query('academicYear') academicYear?: string,
  ) {
    return this.extendedProfile.pullErpBulk(user, {
      criterion: criterion ? parseInt(criterion, 10) : undefined,
      academicYear,
    });
  }

  // ── Official NAAC Excel data tables ───────────────────────────────

  @Get('metrics/:code/tables')
  @RequireAnyPermission(...NIQ_READ)
  listMetricTables(
    @CurrentUser() user: JwtUser,
    @Param('code') code: string,
    @Query('academicYear') academicYear?: string,
  ) {
    return this.metricTables.listTablesForMetric(user, code, academicYear);
  }

  @Get('datasets/:id')
  @RequireAnyPermission(...NIQ_READ)
  getDataset(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.metricTables.getDataset(user, id);
  }

  @Get('datasets/:id/rows')
  @RequireAnyPermission(...NIQ_READ)
  getDatasetRows(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.metricTables.getDataset(user, id);
  }

  @Patch('datasets/:id/rows')
  @RequireAnyPermission(...NIQ_COLLECT)
  upsertDatasetRows(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpsertTableRowsDto,
  ) {
    return this.metricTables.upsertRows(user, id, dto.rows ?? []);
  }

  @Post('datasets/:id/pull-erp')
  @RequireAnyPermission(...NIQ_COLLECT)
  pullDatasetErp(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.metricTables.pullErp(user, id);
  }

  @Post('datasets/:id/import-xlsx')
  @RequireAnyPermission(...NIQ_COLLECT)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  importDatasetXlsx(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.metricTables.importXlsx(user, id, file);
  }

  @Get('datasets/:id/export-xlsx')
  @RequireAnyPermission(...NIQ_READ)
  exportDatasetXlsx(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.metricTables.exportXlsx(user, id);
  }

  @Get('reports/naac-qnms-workbook')
  @RequireAnyPermission('naac-iqac:reports', 'naac-iqac:manage')
  exportQnmsWorkbook(
    @CurrentUser() user: JwtUser,
    @Query('academicYear') academicYear?: string,
  ) {
    return this.metricTables.exportWorkbook(user, academicYear);
  }
}
