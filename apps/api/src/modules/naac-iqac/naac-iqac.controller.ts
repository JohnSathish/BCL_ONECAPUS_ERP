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
  CreateMetricDto,
  CreateMouActivityDto,
  CreateMouDto,
  CreateStudentAchievementDto,
  EvidenceSearchDto,
  ListQueryDto,
  ReportExportDto,
  ReviewDepartmentSubmissionDto,
  SyncAqarSectionDto,
  UpdateAqarDto,
  UpdateMetricDto,
  UpdateSettingsDto,
  VaultUploadDto,
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
  ) {
    return this.achievements.listFaculty(user.tid, query.page, query.limit);
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

  @Get('student-achievements')
  @RequireAnyPermission(...NIQ_READ)
  listStudentAchievements(
    @CurrentUser() user: JwtUser,
    @Query() query: ListQueryDto,
  ) {
    return this.achievements.listStudent(user.tid, query.page, query.limit);
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
    return this.department.dashboard(user.tid, departmentId);
  }

  @Post('department/submissions')
  @RequireAnyPermission(...NIQ_COLLECT)
  createDepartmentSubmission(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateDepartmentSubmissionDto,
  ) {
    return this.department.createSubmission(user, dto);
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
  @RequireAnyPermission(...NIQ_REPORTS)
  dvvReadiness(
    @CurrentUser() user: JwtUser,
    @Query('academicYear') academicYear?: string,
  ) {
    return this.dvv.readiness(user.tid, academicYear);
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

  @Get('aggregates')
  @RequireAnyPermission(...NIQ_READ)
  getAggregates(@CurrentUser() user: JwtUser) {
    return this.aggregator.summary(user.tid);
  }
}
