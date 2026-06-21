import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  CurrentUser,
  type JwtUser,
} from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { RequireAnyPermission } from '../../../common/decorators/require-permissions.decorator';
import {
  IaApprovalActionDto,
  IaConsolidationGenerateDto,
  IaPaperDto,
  IaQueryDto,
  IaSchemeDto,
  IaSessionDto,
  IaSettingsDto,
  SaveIaMarksDto,
} from './dto/ia.dto';
import { IaComponentDto } from './dto/ia.dto';
import {
  CreateIaExamDto,
  GenerateIaTimetableDto,
} from './dto/create-ia-exam.dto';
import { IaAdmitCardService } from './ia-admit-card.service';
import { IaConsolidationService } from './ia-consolidation.service';
import { IaDashboardService } from './ia-dashboard.service';
import { IaDefaulterService } from './ia-defaulter.service';
import { IaExamProvisioningService } from './ia-exam-provisioning.service';
import { IaMarkEntryService } from './ia-mark-entry.service';
import { IaNehuExportService } from './ia-nehu-export.service';
import { IaPortalService } from './ia-portal.service';
import { IaSchemeService } from './ia-scheme.service';
import { IaSessionService } from './ia-session.service';
import { IaSettingsService } from './ia-settings.service';
import { IaWorkflowService } from './ia-workflow.service';

@ApiBearerAuth()
@ApiTags('examinations-ia')
@Controller({ path: 'examinations/ia', version: '1' })
export class IaController {
  constructor(
    private readonly settings: IaSettingsService,
    private readonly schemes: IaSchemeService,
    private readonly sessions: IaSessionService,
    private readonly exams: IaExamProvisioningService,
    private readonly marks: IaMarkEntryService,
    private readonly workflow: IaWorkflowService,
    private readonly consolidation: IaConsolidationService,
    private readonly nehuExport: IaNehuExportService,
    private readonly dashboard: IaDashboardService,
    private readonly defaulters: IaDefaulterService,
    private readonly portal: IaPortalService,
    private readonly admitCards: IaAdmitCardService,
  ) {}

  @Get('settings')
  @RequireAnyPermission('ia:view', 'ia:manage', 'exam:admin', 'exam:view')
  getSettings(@CurrentUser() user: JwtUser) {
    return this.settings.getOrCreate(user.tid);
  }

  @Patch('settings')
  @RequireAnyPermission('ia:manage', 'exam:admin')
  updateSettings(@CurrentUser() user: JwtUser, @Body() dto: IaSettingsDto) {
    return this.settings.update(user.tid, dto);
  }

  @Get('dashboard/admin')
  @RequireAnyPermission('ia:view', 'exam:view', 'exam:admin', 'academic:read')
  adminDashboard(@CurrentUser() user: JwtUser) {
    return this.dashboard.adminDashboard(user.tid);
  }

  @Get('dashboard/principal')
  @RequireAnyPermission('ia:view', 'principal-desk:access', 'exam:admin')
  principalDashboard(@CurrentUser() user: JwtUser) {
    return this.dashboard.principalDashboard(user.tid);
  }

  @Get('schemes')
  @RequireAnyPermission('ia:view', 'exam:view', 'exam:admin')
  listSchemes(@CurrentUser() user: JwtUser, @Query() query: IaQueryDto) {
    return this.schemes.list(user.tid, query);
  }

  @Post('schemes')
  @RequireAnyPermission('ia:manage', 'exam:admin', 'exam:create')
  createScheme(@CurrentUser() user: JwtUser, @Body() dto: IaSchemeDto) {
    return this.schemes.create(user, dto);
  }

  @Get('schemes/:id')
  @RequireAnyPermission('ia:view', 'exam:view', 'exam:admin')
  getScheme(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.schemes.get(user.tid, id);
  }

  @Patch('schemes/:id/components')
  @RequireAnyPermission('ia:manage', 'exam:admin')
  updateSchemeComponents(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { components: IaComponentDto[] },
  ) {
    return this.schemes.updateComponents(user, id, body.components);
  }

  @Get('sessions')
  @RequireAnyPermission('ia:view', 'exam:view', 'exam:admin')
  listSessions(@CurrentUser() user: JwtUser, @Query() query: IaQueryDto) {
    return this.sessions.listSessions(user.tid, query);
  }

  @Post('sessions')
  @RequireAnyPermission('ia:manage', 'exam:create', 'exam:admin')
  createSession(@CurrentUser() user: JwtUser, @Body() dto: IaSessionDto) {
    return this.sessions.createSession(user, dto);
  }

  @Get('exams')
  @RequireAnyPermission('ia:view', 'exam:view', 'exam:admin', 'academic:read')
  listExams(@CurrentUser() user: JwtUser) {
    return this.exams.listExamsWithSummary(user.tid);
  }

  @Post('exams')
  @RequireAnyPermission('ia:manage', 'exam:admin', 'exam:create')
  createExam(@CurrentUser() user: JwtUser, @Body() dto: CreateIaExamDto) {
    return this.exams.createExam(user, dto);
  }

  @Post('exams/generate-timetable')
  @RequireAnyPermission('ia:manage', 'exam:admin', 'exam:create')
  generateTimetable(
    @CurrentUser() user: JwtUser,
    @Body() dto: GenerateIaTimetableDto,
  ) {
    return this.exams.generateTimetable(user, dto);
  }

  @Get('papers')
  @RequireAnyPermission('ia:view', 'exam:view', 'exam:admin')
  listPapers(@CurrentUser() user: JwtUser, @Query() query: IaQueryDto) {
    return this.sessions.listPapers(user.tid, query);
  }

  @Post('papers')
  @RequireAnyPermission('ia:manage', 'exam:create', 'exam:admin')
  createPaper(@CurrentUser() user: JwtUser, @Body() dto: IaPaperDto) {
    return this.sessions.createPaper(user, dto);
  }

  @Get('faculty/my-subjects')
  @RequireAnyPermission(
    'ia:marks:enter',
    'exam:marks',
    'exam:admin',
    'staff:portal',
  )
  facultyMySubjects(@CurrentUser() user: JwtUser) {
    return this.marks.facultyMySubjects(user);
  }

  @Get('papers/:paperId/roster')
  @RequireAnyPermission('ia:marks:enter', 'exam:marks', 'exam:admin', 'ia:view')
  getRoster(
    @CurrentUser() user: JwtUser,
    @Param('paperId') paperId: string,
    @Query('schemeId') schemeId?: string,
  ) {
    return this.marks.getRoster(user, paperId, schemeId);
  }

  @Post('papers/:paperId/marks')
  @RequireAnyPermission('ia:marks:enter', 'exam:marks', 'exam:admin')
  saveMarks(
    @CurrentUser() user: JwtUser,
    @Param('paperId') paperId: string,
    @Body() dto: SaveIaMarksDto,
  ) {
    return this.marks.saveMarks(user, paperId, dto);
  }

  @Post('papers/:paperId/marks/import')
  @RequireAnyPermission('ia:marks:enter', 'exam:marks', 'exam:admin')
  importMarks(
    @CurrentUser() user: JwtUser,
    @Param('paperId') paperId: string,
    @Body()
    body: {
      schemeId: string;
      rows: Array<{ rollNumber: string; componentCode: string; marks: number }>;
    },
  ) {
    return this.marks.importMarksFromRows(
      user,
      paperId,
      body.schemeId,
      body.rows,
    );
  }

  @Get('consolidation')
  @RequireAnyPermission('ia:view', 'exam:view', 'exam:admin')
  listConsolidation(@CurrentUser() user: JwtUser) {
    return this.consolidation.list(user.tid);
  }

  @Post('consolidation/generate')
  @RequireAnyPermission('ia:manage', 'exam:admin')
  generateConsolidation(
    @CurrentUser() user: JwtUser,
    @Body() dto: IaConsolidationGenerateDto,
  ) {
    return this.consolidation.generate(user, dto);
  }

  @Get('consolidation/:id')
  @RequireAnyPermission('ia:view', 'exam:view', 'exam:admin')
  getConsolidation(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.consolidation.get(user.tid, id);
  }

  @Post('sheets/:id/submit')
  @RequireAnyPermission('ia:marks:enter', 'ia:manage', 'exam:admin')
  submitSheet(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.workflow.submitSheet(user, id);
  }

  @Post('approvals/:id/action')
  @RequireAnyPermission(
    'ia:marks:approve:hod',
    'ia:marks:approve:controller',
    'ia:marks:approve:principal',
    'ia:manage',
    'exam:admin',
  )
  approvalAction(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: IaApprovalActionDto,
  ) {
    return this.workflow.actOnApproval(user, id, dto.action, dto.remarks);
  }

  @Get('approvals/pending')
  @RequireAnyPermission(
    'ia:marks:approve:hod',
    'ia:marks:approve:controller',
    'ia:marks:approve:principal',
    'ia:manage',
  )
  pendingApprovals(@CurrentUser() user: JwtUser) {
    return this.workflow.pendingApprovals(user);
  }

  @Get('nehu-export/:sheetId')
  @RequireAnyPermission(
    'ia:export:nehu',
    'ia:manage',
    'exam:admin',
    'exam:reports',
  )
  exportNehu(
    @CurrentUser() user: JwtUser,
    @Param('sheetId') sheetId: string,
    @Query('format') format: 'xlsx' | 'csv' | 'pdf' = 'xlsx',
    @Res() res: Response,
  ) {
    return this.nehuExport.exportSheet(user.tid, sheetId, format, res);
  }

  @Get('defaulters')
  @RequireAnyPermission('ia:view', 'exam:view', 'exam:admin')
  listDefaulters(@CurrentUser() user: JwtUser) {
    return this.defaulters.list(user.tid);
  }

  @Get('admit-cards/sessions')
  @RequireAnyPermission('ia:manage', 'exam:admin', 'exam:view', 'ia:view')
  listAdmitSessions(@CurrentUser() user: JwtUser) {
    return this.admitCards.listSessions(user.tid);
  }

  @Get('admit-cards/sessions/:sessionId/dashboard')
  @RequireAnyPermission('ia:manage', 'exam:admin', 'exam:view', 'ia:view')
  admitDashboard(
    @CurrentUser() user: JwtUser,
    @Param('sessionId') sessionId: string,
    @Query('programmeCode') programmeCode?: string,
    @Query('departmentId') departmentId?: string,
    @Query('semesterNo') semesterNo?: string,
  ) {
    return this.admitCards.dashboard(user.tid, sessionId, {
      programmeCode,
      departmentId,
      semesterNo: semesterNo ? Number(semesterNo) : undefined,
    });
  }

  @Get('admit-cards/sessions/:sessionId/students')
  @RequireAnyPermission('ia:manage', 'exam:admin', 'exam:view', 'ia:view')
  listAdmitStudents(
    @CurrentUser() user: JwtUser,
    @Param('sessionId') sessionId: string,
    @Query('programmeCode') programmeCode?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.admitCards.listStudents(user.tid, sessionId, {
      programmeCode,
      departmentId,
    });
  }

  @Get('admit-cards/sessions/:sessionId/ineligible')
  @RequireAnyPermission('ia:manage', 'exam:admin', 'exam:view', 'ia:view')
  ineligibleReport(
    @CurrentUser() user: JwtUser,
    @Param('sessionId') sessionId: string,
  ) {
    return this.admitCards.ineligibleReport(user.tid, sessionId);
  }

  @Get('admit-cards/sessions/:sessionId/audit')
  @RequireAnyPermission('ia:manage', 'exam:admin', 'ia:view')
  admitAudit(
    @CurrentUser() user: JwtUser,
    @Param('sessionId') sessionId: string,
  ) {
    return this.admitCards.auditTrail(user.tid, sessionId);
  }

  @Get('admit-cards/sessions/:sessionId/students/:studentId')
  @RequireAnyPermission('ia:manage', 'exam:admin', 'exam:view', 'ia:view')
  getAdmitCard(
    @CurrentUser() user: JwtUser,
    @Param('sessionId') sessionId: string,
    @Param('studentId') studentId: string,
    @Query('preview') preview?: string,
  ) {
    if (preview === '1') {
      return this.admitCards.generateCard(
        user.tid,
        sessionId,
        studentId,
        user,
        {
          persist: false,
        },
      );
    }
    return this.admitCards.generateCard(user.tid, sessionId, studentId, user);
  }

  @Post('admit-cards/bulk')
  @RequireAnyPermission('ia:manage', 'exam:admin')
  bulkAdmitCards(
    @CurrentUser() user: JwtUser,
    @Body() body: { sessionId: string; studentIds: string[] },
  ) {
    return this.admitCards.bulkGenerate(user, body.sessionId, body.studentIds);
  }

  @Post('admit-cards/export/pdf')
  @RequireAnyPermission('ia:manage', 'exam:admin', 'ia:view')
  async exportAdmitPdf(
    @CurrentUser() user: JwtUser,
    @Body() body: { sessionId: string; studentIds: string[] },
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.admitCards.exportPdf(
      user.tid,
      body.sessionId,
      body.studentIds,
      user,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Post('admit-cards/export/zip')
  @RequireAnyPermission('ia:manage', 'exam:admin')
  async exportAdmitZip(
    @CurrentUser() user: JwtUser,
    @Body() body: { sessionId: string; studentIds: string[] },
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.admitCards.exportZip(
      user.tid,
      body.sessionId,
      body.studentIds,
      user,
    );
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Post('admit-cards/:issueId/download')
  @RequireAnyPermission(
    'ia:manage',
    'exam:admin',
    'ia:view',
    'student:portal:self',
  )
  recordDownload(
    @CurrentUser() user: JwtUser,
    @Param('issueId') issueId: string,
  ) {
    return this.admitCards.recordDownload(user, issueId);
  }

  @Post('admit-cards/:issueId/print')
  @RequireAnyPermission('ia:manage', 'exam:admin', 'ia:view')
  recordPrint(@CurrentUser() user: JwtUser, @Param('issueId') issueId: string) {
    return this.admitCards.recordPrint(user, issueId);
  }

  @Get('portal/schedule')
  @RequireAnyPermission('student:portal:self', 'ia:view')
  studentSchedule(@CurrentUser() user: JwtUser) {
    return this.portal.studentSchedule(user);
  }

  @Get('portal/marks')
  @RequireAnyPermission('student:portal:self', 'ia:view')
  studentMarks(@CurrentUser() user: JwtUser) {
    return this.portal.studentMarks(user);
  }

  @Get('portal/performance')
  @RequireAnyPermission('student:portal:self', 'ia:view')
  studentPerformance(@CurrentUser() user: JwtUser) {
    return this.portal.studentPerformance(user);
  }

  @Get('portal/admit-card')
  @RequireAnyPermission('student:portal:self', 'ia:view')
  studentAdmitCard(
    @CurrentUser() user: JwtUser,
    @Query('sessionId') sessionId?: string,
  ) {
    return this.portal.studentAdmitCard(user, sessionId);
  }

  @Get('admit-card/verify/:token')
  @Public()
  verifyAdmit(@Param('token') token: string) {
    return this.admitCards.verifyToken(token);
  }
}
