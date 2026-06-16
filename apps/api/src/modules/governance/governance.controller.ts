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
  GOVERNANCE_COMMITTEE_CATEGORIES,
  GOVERNANCE_DOCUMENT_CATEGORIES,
  GOVERNANCE_MEETING_MODES,
  GOVERNANCE_MEMBER_ROLES,
  GOVERNANCE_NAAC_CRITERIA,
  DEFAULT_GOVERNANCE_PERFORMANCE_WEIGHTS,
} from './constants/governance.constants';
import {
  AnalyticsQueryDto,
  AtrStatusTransitionDto,
  BulkAssignMembersDto,
  CalendarQueryDto,
  CreateAtrDto,
  CreateCommitteeDto,
  CreateEventDto,
  CreateMeetingDto,
  CreateMemberDto,
  CreateCommitteeMemberBodyDto,
  CreateMomDto,
  CreateNaacTagDto,
  CreateNoticeDto,
  CreateTaskDto,
  DocumentListQueryDto,
  ListQueryDto,
  MarkAttendanceDto,
  OtpAttendanceDto,
  PerformanceComputeDto,
  ReportExportDto,
  ReviewImportDraftDto,
  ReplaceMemberDto,
  UpdateAtrDto,
  UpdateCommitteeDto,
  UpdateEventDto,
  UpdateMeetingDto,
  UpdateMemberDto,
  UpdateMomDto,
  UpdateNoticeDto,
  UpdateSettingsDto,
  UpdateTaskDto,
  UploadDocumentDto,
} from './dto/governance.dto';
import { GovernanceAnalyticsService } from './services/governance-analytics.service';
import { GovernanceAtrService } from './services/governance-atr.service';
import { GovernanceAttendanceService } from './services/governance-attendance.service';
import { GovernanceCommitteeService } from './services/governance-committee.service';
import { GovernanceDashboardService } from './services/governance-dashboard.service';
import { GovernanceDocumentService } from './services/governance-document.service';
import { GovernanceEventService } from './services/governance-event.service';
import { GovernanceImportService } from './services/governance-import.service';
import { GovernanceMeetingService } from './services/governance-meeting.service';
import { GovernanceMemberService } from './services/governance-member.service';
import { GovernanceMomService } from './services/governance-mom.service';
import { GovernanceNaacService } from './services/governance-naac.service';
import { GovernanceNoticeService } from './services/governance-notice.service';
import { GovernanceNotificationService } from './services/governance-notification.service';
import { GovernancePdfService } from './services/governance-pdf.service';
import { GovernancePerformanceService } from './services/governance-performance.service';
import { GovernanceReportService } from './services/governance-report.service';
import { GovernanceSettingsService } from './services/governance-settings.service';
import { GovernanceTaskService } from './services/governance-task.service';

const GOV_READ = [
  'governance:read',
  'governance:manage',
  'governance:publish',
  'governance:reports',
] as const;
const GOV_MANAGE = ['governance:manage'] as const;
const GOV_PUBLISH = ['governance:publish', 'governance:manage'] as const;
const GOV_REPORTS = ['governance:reports'] as const;
const GOV_IMPORT = ['governance:import', 'governance:manage'] as const;

@ApiBearerAuth()
@ApiTags('governance')
@Controller({ path: 'governance', version: '1' })
export class GovernanceController {
  constructor(
    private readonly dashboard: GovernanceDashboardService,
    private readonly committees: GovernanceCommitteeService,
    private readonly members: GovernanceMemberService,
    private readonly meetings: GovernanceMeetingService,
    private readonly attendance: GovernanceAttendanceService,
    private readonly mom: GovernanceMomService,
    private readonly atr: GovernanceAtrService,
    private readonly tasks: GovernanceTaskService,
    private readonly notices: GovernanceNoticeService,
    private readonly documents: GovernanceDocumentService,
    private readonly events: GovernanceEventService,
    private readonly naac: GovernanceNaacService,
    private readonly reports: GovernanceReportService,
    private readonly analytics: GovernanceAnalyticsService,
    private readonly performance: GovernancePerformanceService,
    private readonly imports: GovernanceImportService,
    private readonly notifications: GovernanceNotificationService,
    private readonly pdf: GovernancePdfService,
    private readonly settings: GovernanceSettingsService,
  ) {}

  @Get('dashboard')
  @RequireAnyPermission(...GOV_READ)
  getDashboard(@CurrentUser() user: JwtUser) {
    return this.dashboard.dashboard(user.tid);
  }

  @Get('constants')
  @RequireAnyPermission(...GOV_READ)
  getConstants() {
    return {
      committeeCategories: GOVERNANCE_COMMITTEE_CATEGORIES,
      memberRoles: GOVERNANCE_MEMBER_ROLES,
      meetingModes: GOVERNANCE_MEETING_MODES,
      documentCategories: GOVERNANCE_DOCUMENT_CATEGORIES,
      naacCriteria: GOVERNANCE_NAAC_CRITERIA,
      performanceWeights: DEFAULT_GOVERNANCE_PERFORMANCE_WEIGHTS,
    };
  }

  @Get('committees')
  @RequireAnyPermission(...GOV_READ)
  listCommittees(@CurrentUser() user: JwtUser, @Query() query: ListQueryDto) {
    return this.committees.list(user.tid, query);
  }

  @Get('committees/:id')
  @RequireAnyPermission(...GOV_READ)
  getCommittee(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.committees.getById(user.tid, id);
  }

  @Post('committees')
  @RequireAnyPermission(...GOV_MANAGE)
  createCommittee(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateCommitteeDto,
  ) {
    return this.committees.create(user, dto);
  }

  @Patch('committees/:id')
  @RequireAnyPermission(...GOV_MANAGE)
  updateCommittee(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateCommitteeDto,
  ) {
    return this.committees.update(user, id, dto);
  }

  @Post('committees/:id/deactivate')
  @RequireAnyPermission(...GOV_MANAGE)
  deactivateCommittee(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.committees.deactivate(user, id);
  }

  @Get('committees/:committeeId/members')
  @RequireAnyPermission(...GOV_READ)
  listCommitteeMembers(
    @CurrentUser() user: JwtUser,
    @Param('committeeId') committeeId: string,
  ) {
    return this.members.listByCommittee(user.tid, committeeId);
  }

  @Post('committees/:committeeId/members')
  @RequireAnyPermission(...GOV_MANAGE)
  createCommitteeMember(
    @CurrentUser() user: JwtUser,
    @Param('committeeId') committeeId: string,
    @Body() dto: CreateCommitteeMemberBodyDto,
  ) {
    return this.members.create(user, { ...dto, committeeId });
  }

  @Get('members/stats')
  @RequireAnyPermission(...GOV_READ)
  memberStats(@CurrentUser() user: JwtUser) {
    return this.members.memberStats(user.tid);
  }

  @Get('members')
  @RequireAnyPermission(...GOV_READ)
  listMembers(@CurrentUser() user: JwtUser, @Query() query: ListQueryDto) {
    return this.members.list(user.tid, query);
  }

  @Get('staff/:staffProfileId/memberships')
  @RequireAnyPermission(...GOV_READ)
  staffMemberships(
    @CurrentUser() user: JwtUser,
    @Param('staffProfileId') staffProfileId: string,
  ) {
    return this.members.listByStaff(user.tid, staffProfileId);
  }

  @Get('committees/:committeeId/members/history')
  @RequireAnyPermission(...GOV_READ)
  committeeMemberHistory(
    @CurrentUser() user: JwtUser,
    @Param('committeeId') committeeId: string,
  ) {
    return this.members.listHistory(user.tid, committeeId);
  }

  @Get('members/:id')
  @RequireAnyPermission(...GOV_READ)
  getMember(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.members.getById(user.tid, id);
  }

  @Post('members')
  @RequireAnyPermission(...GOV_MANAGE)
  createMember(@CurrentUser() user: JwtUser, @Body() dto: CreateMemberDto) {
    return this.members.create(user, dto);
  }

  @Post('members/bulk')
  @RequireAnyPermission(...GOV_MANAGE)
  bulkAssignMembers(
    @CurrentUser() user: JwtUser,
    @Body() dto: BulkAssignMembersDto,
  ) {
    return this.members.bulkAssign(user, dto);
  }

  @Patch('members/:id')
  @RequireAnyPermission(...GOV_MANAGE)
  updateMember(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.members.update(user, id, dto);
  }

  @Delete('members/:id')
  @RequireAnyPermission(...GOV_MANAGE)
  removeMember(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.members.remove(user, id);
  }

  @Post('members/:id/deactivate')
  @RequireAnyPermission(...GOV_MANAGE)
  deactivateMember(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.members.deactivate(user, id);
  }

  @Post('members/:id/replace')
  @RequireAnyPermission(...GOV_MANAGE)
  replaceMember(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ReplaceMemberDto,
  ) {
    return this.members.replaceMember(user, id, dto);
  }

  @Get('meetings')
  @RequireAnyPermission(...GOV_READ)
  listMeetings(@CurrentUser() user: JwtUser, @Query() query: ListQueryDto) {
    return this.meetings.list(user.tid, query);
  }

  @Get('meetings/calendar')
  @RequireAnyPermission(...GOV_READ)
  calendar(@CurrentUser() user: JwtUser, @Query() query: CalendarQueryDto) {
    return this.meetings.calendarFeed(user.tid, query);
  }

  @Get('meetings/:id')
  @RequireAnyPermission(...GOV_READ)
  getMeeting(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.meetings.getById(user.tid, id);
  }

  @Post('meetings')
  @RequireAnyPermission(...GOV_MANAGE)
  async createMeeting(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateMeetingDto,
  ) {
    const meeting = await this.meetings.create(user, dto);
    await this.notifications.notifyMeetingScheduled(user.tid, meeting.id);
    return meeting;
  }

  @Patch('meetings/:id')
  @RequireAnyPermission(...GOV_MANAGE)
  updateMeeting(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateMeetingDto,
  ) {
    return this.meetings.update(user, id, dto);
  }

  @Post('meetings/:id/regenerate-qr')
  @RequireAnyPermission(...GOV_MANAGE)
  regenerateQr(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.meetings.regenerateQrToken(user, id);
  }

  @Post('meetings/:id/generate-otp')
  @RequireAnyPermission(...GOV_MANAGE)
  generateOtp(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.attendance.generateOtp(user, id);
  }

  @Get('attendance')
  @RequireAnyPermission(...GOV_READ)
  listAttendance(@CurrentUser() user: JwtUser, @Query() query: ListQueryDto) {
    return this.attendance.list(user.tid, query);
  }

  @Get('meetings/:meetingId/attendance')
  @RequireAnyPermission(...GOV_READ)
  meetingAttendance(
    @CurrentUser() user: JwtUser,
    @Param('meetingId') meetingId: string,
  ) {
    return this.attendance.listForMeeting(user.tid, meetingId);
  }

  @Post('attendance/manual')
  @RequireAnyPermission(...GOV_MANAGE)
  markAttendanceManual(
    @CurrentUser() user: JwtUser,
    @Body() dto: MarkAttendanceDto,
  ) {
    return this.attendance.markManual(user, dto);
  }

  @Post('attendance/qr')
  @RequireAnyPermission(...GOV_READ, 'governance:portal')
  markAttendanceQr(
    @CurrentUser() user: JwtUser,
    @Body() dto: { token: string; memberId?: string },
  ) {
    return this.attendance.markByQr(user, dto);
  }

  @Post('attendance/otp')
  @RequireAnyPermission(...GOV_READ, 'governance:portal')
  markAttendanceOtp(
    @CurrentUser() user: JwtUser,
    @Body() dto: OtpAttendanceDto,
  ) {
    return this.attendance.markByOtp(user, dto);
  }

  @Get('meetings/:meetingId/minutes')
  @RequireAnyPermission(...GOV_READ)
  listMinutes(
    @CurrentUser() user: JwtUser,
    @Param('meetingId') meetingId: string,
  ) {
    return this.mom.getForMeeting(user.tid, meetingId);
  }

  @Get('minutes/:id')
  @RequireAnyPermission(...GOV_READ)
  getMinutes(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.mom.getById(user.tid, id);
  }

  @Post('minutes')
  @RequireAnyPermission(...GOV_MANAGE)
  createMinutes(@CurrentUser() user: JwtUser, @Body() dto: CreateMomDto) {
    return this.mom.create(user, dto);
  }

  @Patch('minutes/:id')
  @RequireAnyPermission(...GOV_MANAGE)
  updateMinutes(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateMomDto,
  ) {
    return this.mom.update(user, id, dto);
  }

  @Post('minutes/:id/publish')
  @RequireAnyPermission(...GOV_PUBLISH)
  publishMinutes(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.mom.publish(user, id);
  }

  @Get('minutes/:id/pdf')
  @RequireAnyPermission(...GOV_READ)
  async downloadMomPdf(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    const buffer = await this.pdf.getMomPdfBuffer(user.tid, id);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `inline; filename="mom-${id}.pdf"`,
    });
  }

  @Get('atr')
  @RequireAnyPermission(...GOV_READ)
  listAtr(@CurrentUser() user: JwtUser, @Query() query: ListQueryDto) {
    return this.atr.list(user.tid, query);
  }

  @Get('atr/:id')
  @RequireAnyPermission(...GOV_READ)
  getAtr(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.atr.getById(user.tid, id);
  }

  @Post('atr')
  @RequireAnyPermission(...GOV_MANAGE)
  async createAtr(@CurrentUser() user: JwtUser, @Body() dto: CreateAtrDto) {
    const item = await this.atr.create(user, dto);
    if (dto.assignedToId)
      await this.notifications.notifyAtrAssigned(user.tid, item.id);
    return item;
  }

  @Patch('atr/:id')
  @RequireAnyPermission(...GOV_MANAGE)
  updateAtr(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateAtrDto,
  ) {
    return this.atr.update(user, id, dto);
  }

  @Post('atr/:id/transition')
  @RequireAnyPermission(...GOV_MANAGE)
  transitionAtr(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: AtrStatusTransitionDto,
  ) {
    return this.atr.transition(user, id, dto);
  }

  @Post('atr/mark-overdue')
  @RequireAnyPermission(...GOV_MANAGE)
  markOverdueAtr(@CurrentUser() user: JwtUser) {
    return this.atr.markOverdue(user.tid);
  }

  @Get('tasks')
  @RequireAnyPermission(...GOV_READ)
  listTasks(@CurrentUser() user: JwtUser, @Query() query: ListQueryDto) {
    return this.tasks.list(user.tid, query);
  }

  @Get('tasks/:id')
  @RequireAnyPermission(...GOV_READ)
  getTask(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.tasks.getById(user.tid, id);
  }

  @Post('tasks')
  @RequireAnyPermission(...GOV_MANAGE)
  createTask(@CurrentUser() user: JwtUser, @Body() dto: CreateTaskDto) {
    return this.tasks.create(user, dto);
  }

  @Patch('tasks/:id')
  @RequireAnyPermission(...GOV_MANAGE)
  updateTask(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasks.update(user, id, dto);
  }

  @Get('notices')
  @RequireAnyPermission(...GOV_READ)
  listNotices(@CurrentUser() user: JwtUser, @Query() query: ListQueryDto) {
    return this.notices.list(user.tid, query);
  }

  @Get('notices/:id')
  @RequireAnyPermission(...GOV_READ)
  getNotice(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.notices.getById(user.tid, id);
  }

  @Post('notices')
  @RequireAnyPermission(...GOV_MANAGE)
  createNotice(@CurrentUser() user: JwtUser, @Body() dto: CreateNoticeDto) {
    return this.notices.create(user, dto);
  }

  @Patch('notices/:id')
  @RequireAnyPermission(...GOV_MANAGE)
  updateNotice(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateNoticeDto,
  ) {
    return this.notices.update(user, id, dto);
  }

  @Post('notices/:id/publish')
  @RequireAnyPermission(...GOV_PUBLISH)
  publishNotice(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.notices.publish(user, id);
  }

  @Get('documents')
  @RequireAnyPermission(...GOV_READ)
  listDocuments(
    @CurrentUser() user: JwtUser,
    @Query() query: DocumentListQueryDto,
  ) {
    return this.documents.list(user.tid, query);
  }

  @Get('documents/:id')
  @RequireAnyPermission(...GOV_READ)
  getDocument(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.documents.getById(user.tid, id);
  }

  @Post('documents')
  @RequireAnyPermission(...GOV_MANAGE)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  uploadDocument(
    @CurrentUser() user: JwtUser,
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.documents.upload(user, dto, file);
  }

  @Get('documents/:id/download')
  @RequireAnyPermission(...GOV_READ)
  async downloadDocument(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
  ) {
    const { buffer, fileName, mimeType } = await this.documents.download(
      user.tid,
      id,
    );
    return new StreamableFile(buffer, {
      type: mimeType,
      disposition: `attachment; filename="${fileName}"`,
    });
  }

  @Delete('documents/:id')
  @RequireAnyPermission(...GOV_MANAGE)
  deleteDocument(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.documents.remove(user, id);
  }

  @Get('events')
  @RequireAnyPermission(...GOV_READ)
  listEvents(@CurrentUser() user: JwtUser, @Query() query: ListQueryDto) {
    return this.events.list(user.tid, query);
  }

  @Get('events/:id')
  @RequireAnyPermission(...GOV_READ)
  getEvent(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.events.getById(user.tid, id);
  }

  @Post('events')
  @RequireAnyPermission(...GOV_MANAGE)
  createEvent(@CurrentUser() user: JwtUser, @Body() dto: CreateEventDto) {
    return this.events.create(user, dto);
  }

  @Patch('events/:id')
  @RequireAnyPermission(...GOV_MANAGE)
  updateEvent(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
  ) {
    return this.events.update(user, id, dto);
  }

  @Get('naac/criteria')
  @RequireAnyPermission(...GOV_READ)
  naacCriteria() {
    return this.naac.criteria();
  }

  @Get('naac/tags')
  @RequireAnyPermission(...GOV_READ)
  listNaacTags(@CurrentUser() user: JwtUser, @Query() query: ListQueryDto) {
    return this.naac.list(user.tid, query);
  }

  @Get('naac/evidence')
  @RequireAnyPermission(...GOV_READ)
  listNaacEvidence(@CurrentUser() user: JwtUser, @Query() query: ListQueryDto) {
    return this.naac.list(user.tid, query);
  }

  @Get('naac/summary')
  @RequireAnyPermission(...GOV_REPORTS)
  naacSummary(@CurrentUser() user: JwtUser) {
    return this.naac.evidenceSummary(user.tid);
  }

  @Post('naac/tags')
  @RequireAnyPermission(...GOV_MANAGE)
  createNaacTag(@CurrentUser() user: JwtUser, @Body() dto: CreateNaacTagDto) {
    return this.naac.create(user, dto);
  }

  @Delete('naac/tags/:id')
  @RequireAnyPermission(...GOV_MANAGE)
  deleteNaacTag(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.naac.remove(user, id);
  }

  @Post('reports/export')
  @RequireAnyPermission(...GOV_REPORTS)
  async exportReport(
    @CurrentUser() user: JwtUser,
    @Body() dto: ReportExportDto,
  ) {
    const result = await this.reports.export(user.tid, dto);
    return new StreamableFile(result.buffer, {
      type: result.mimeType,
      disposition: `attachment; filename="${result.fileName}"`,
    });
  }

  @Get('analytics/overview')
  @RequireAnyPermission(...GOV_READ)
  analyticsOverview(
    @CurrentUser() user: JwtUser,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analytics.overview(user.tid, query);
  }

  @Get('analytics/comparison')
  @RequireAnyPermission(...GOV_READ)
  analyticsComparison(
    @CurrentUser() user: JwtUser,
    @Query('academicYear') academicYear?: string,
  ) {
    return this.analytics.committeeComparison(user.tid, academicYear);
  }

  @Post('performance/compute')
  @RequireAnyPermission(...GOV_MANAGE)
  computePerformance(
    @CurrentUser() user: JwtUser,
    @Body() dto: PerformanceComputeDto,
  ) {
    return this.performance.computeAll(user.tid, dto);
  }

  @Get('performance/leaderboard')
  @RequireAnyPermission(...GOV_READ)
  performanceLeaderboard(
    @CurrentUser() user: JwtUser,
    @Query('academicYear') academicYear?: string,
  ) {
    return this.performance.leaderboard(user.tid, academicYear);
  }

  @Get('imports')
  @RequireAnyPermission(...GOV_IMPORT)
  listImports(@CurrentUser() user: JwtUser) {
    return this.imports.listBatches(user.tid);
  }

  @Get('imports/template')
  @RequireAnyPermission(...GOV_IMPORT)
  async downloadImportTemplate() {
    const buffer = await this.imports.downloadTemplate();
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition:
        'attachment; filename="governance-committee-import-template.xlsx"',
    });
  }

  @Get('imports/:id')
  @RequireAnyPermission(...GOV_IMPORT)
  getImport(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.imports.getBatch(user.tid, id);
  }

  @Post('imports/pdf')
  @RequireAnyPermission(...GOV_IMPORT)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  uploadImportPdf(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.imports.uploadPdf(user, file);
  }

  @Post('imports/excel')
  @RequireAnyPermission(...GOV_IMPORT)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  uploadImportExcel(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.imports.uploadExcel(user, file);
  }

  @Patch('imports/drafts/:id')
  @RequireAnyPermission(...GOV_IMPORT)
  reviewImportDraft(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ReviewImportDraftDto,
  ) {
    return this.imports.reviewDraft(user, id, dto);
  }

  @Post('imports/drafts/:id/commit')
  @RequireAnyPermission(...GOV_IMPORT)
  commitImportDraft(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.imports.commitDraft(user, id);
  }

  @Get('settings')
  @RequireAnyPermission(...GOV_READ)
  getSettings(@CurrentUser() user: JwtUser) {
    return this.settings.get(user.tid);
  }

  @Patch('settings')
  @RequireAnyPermission(...GOV_MANAGE)
  updateSettings(@CurrentUser() user: JwtUser, @Body() dto: UpdateSettingsDto) {
    return this.settings.update(user.tid, dto);
  }
}
