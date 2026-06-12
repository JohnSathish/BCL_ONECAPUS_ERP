import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import {
  CreateLmsAnnouncementDto,
  CreateLmsAssignmentDto,
  CreateLmsDiscussionDto,
  CreateLmsDiscussionReplyDto,
  CreateLmsQuizDto,
  CreateLmsQuizQuestionDto,
  CreateLmsLessonPlanDto,
  CreateLmsMaterialDto,
  EvaluateLmsSubmissionDto,
  LmsMaterialListQueryDto,
  LmsSearchQueryDto,
  LmsWorkspaceListQueryDto,
  ReturnLmsSubmissionDto,
  SubmitLmsAssignmentDto,
  SubmitLmsQuizAttemptDto,
  UpdateLmsAssignmentDto,
  UpdateLmsQuizDto,
  UpdateLmsLessonPlanDto,
  UpdateLmsMaterialDto,
  UpdateLmsSettingsDto,
} from './dto/lms.dto';
import { LmsAnnouncementsService } from './services/lms-announcements.service';
import { LmsAssignmentsService } from './services/lms-assignments.service';
import { LmsDiscussionsService } from './services/lms-discussions.service';
import { LmsQuizzesService } from './services/lms-quizzes.service';
import { LmsAttendanceBridgeService } from './services/lms-attendance-bridge.service';
import { LmsDashboardService } from './services/lms-dashboard.service';
import { LmsLessonPlansService } from './services/lms-lesson-plans.service';
import { LmsMaterialsService } from './services/lms-materials.service';
import { LmsSettingsService } from './services/lms-settings.service';
import { LmsWorkspaceService } from './services/lms-workspace.service';
import { LmsAccessService } from './services/lms-access.service';

@ApiBearerAuth()
@ApiTags('lms')
@Controller({ path: 'lms', version: '1' })
export class LmsController {
  constructor(
    private readonly workspaces: LmsWorkspaceService,
    private readonly materials: LmsMaterialsService,
    private readonly announcements: LmsAnnouncementsService,
    private readonly lessonPlans: LmsLessonPlansService,
    private readonly assignments: LmsAssignmentsService,
    private readonly quizzes: LmsQuizzesService,
    private readonly discussions: LmsDiscussionsService,
    private readonly dashboard: LmsDashboardService,
    private readonly settings: LmsSettingsService,
    private readonly attendance: LmsAttendanceBridgeService,
    private readonly access: LmsAccessService,
  ) {}

  @Get('dashboard/admin')
  @RequirePermissions('lms:analytics:read')
  adminDashboard(@CurrentUser() user: JwtUser) {
    return this.dashboard.adminDashboard(user.tid);
  }

  @Get('settings')
  @RequirePermissions('lms:settings:manage')
  getSettings(@CurrentUser() user: JwtUser) {
    return this.settings.getOrCreate(user.tid);
  }

  @Patch('settings')
  @RequirePermissions('lms:settings:manage')
  updateSettings(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateLmsSettingsDto,
  ) {
    return this.settings.update(user.tid, dto);
  }

  @Post('workspaces/provision')
  @RequirePermissions('lms:workspace:manage')
  provision(@CurrentUser() user: JwtUser) {
    return this.workspaces.provisionAllForTenant(user.tid);
  }

  @Get('workspaces')
  @RequirePermissions('lms:read')
  listWorkspaces(
    @CurrentUser() user: JwtUser,
    @Query() query: LmsWorkspaceListQueryDto,
  ) {
    return this.workspaces.listWorkspaces(user.tid, query);
  }

  @Get('workspaces/:id')
  @RequirePermissions('lms:read')
  async getWorkspace(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    await this.access.assertWorkspaceAccess(user, id, 'read');
    return this.workspaces.getOverview(user.tid, id);
  }

  @Get('workspaces/:id/attendance')
  @RequirePermissions('lms:read')
  async workspaceAttendance(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
  ) {
    await this.access.assertWorkspaceAccess(user, id, 'read');
    const studentId = await this.access.getStudentId(user);
    return this.attendance.getWorkspaceSummary(user.tid, id, studentId);
  }

  @Get('workspaces/:id/materials')
  @RequirePermissions('lms:read')
  listMaterials(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Query() query: LmsMaterialListQueryDto,
  ) {
    const studentView = user.roles.includes('student');
    return this.materials.list(user, id, query, studentView);
  }

  @Post('workspaces/:id/materials')
  @RequirePermissions('lms:materials:upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 100 * 1024 * 1024 },
    }),
  )
  createMaterial(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: CreateLmsMaterialDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.materials.create(user, id, dto, file);
  }

  @Patch('materials/:id')
  @RequirePermissions('lms:materials:upload')
  updateMaterial(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateLmsMaterialDto,
  ) {
    return this.materials.update(user, id, dto);
  }

  @Post('materials/:id/publish')
  @RequirePermissions('lms:materials:publish')
  publishMaterial(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.materials.publish(user, id);
  }

  @Post('materials/:id/archive')
  @RequirePermissions('lms:materials:publish')
  archiveMaterial(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.materials.archive(user, id);
  }

  @Post('materials/:id/bookmark')
  @RequirePermissions('lms:read')
  bookmarkMaterial(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.materials.toggleBookmark(user, id);
  }

  @Post('materials/:id/download')
  @RequirePermissions('lms:read')
  downloadMaterial(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.materials.recordDownload(user, id);
  }

  @Get('search')
  @RequirePermissions('lms:read')
  search(@CurrentUser() user: JwtUser, @Query() query: LmsSearchQueryDto) {
    return this.materials.search(user, query.q, query.limit);
  }

  @Get('announcements')
  @RequirePermissions('lms:read')
  listAnnouncements(
    @CurrentUser() user: JwtUser,
    @Query('workspaceId') workspaceId?: string,
  ) {
    return this.announcements.list(user, workspaceId);
  }

  @Post('announcements')
  @RequirePermissions('lms:announcements:publish')
  createInstitutionAnnouncement(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateLmsAnnouncementDto,
  ) {
    return this.announcements.createInstitution(user, dto);
  }

  @Post('workspaces/:id/announcements')
  @RequirePermissions('lms:announcements:publish')
  createWorkspaceAnnouncement(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: CreateLmsAnnouncementDto,
  ) {
    return this.announcements.createForWorkspace(user, id, dto);
  }

  @Delete('announcements/:id')
  @RequirePermissions('lms:announcements:publish')
  deleteAnnouncement(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.announcements.remove(user, id);
  }

  @Get('workspaces/:id/lesson-plans')
  @RequirePermissions('lms:read')
  listLessonPlans(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.lessonPlans.list(user, id);
  }

  @Post('workspaces/:id/lesson-plans')
  @RequirePermissions('lms:lesson-plans:manage')
  createLessonPlan(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: CreateLmsLessonPlanDto,
  ) {
    return this.lessonPlans.create(user, id, dto);
  }

  @Patch('lesson-plans/:id')
  @RequirePermissions('lms:lesson-plans:manage')
  updateLessonPlan(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateLmsLessonPlanDto,
  ) {
    return this.lessonPlans.update(user, id, dto);
  }

  @Delete('lesson-plans/:id')
  @RequirePermissions('lms:lesson-plans:manage')
  deleteLessonPlan(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.lessonPlans.remove(user, id);
  }

  @Get('workspaces/:id/assignments')
  @RequirePermissions('lms:read')
  listAssignments(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.assignments.list(user, id);
  }

  @Post('workspaces/:id/assignments')
  @RequirePermissions('lms:assignments:manage')
  createAssignment(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: CreateLmsAssignmentDto,
  ) {
    return this.assignments.create(user, id, dto);
  }

  @Patch('assignments/:id')
  @RequirePermissions('lms:assignments:manage')
  updateAssignment(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateLmsAssignmentDto,
  ) {
    return this.assignments.update(user, id, dto);
  }

  @Post('assignments/:id/publish')
  @RequirePermissions('lms:assignments:manage')
  publishAssignment(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.assignments.publish(user, id);
  }

  @Post('assignments/:id/close')
  @RequirePermissions('lms:assignments:manage')
  closeAssignment(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.assignments.close(user, id);
  }

  @Get('assignments/:id/submissions')
  @RequirePermissions('lms:assignments:manage')
  listSubmissions(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.assignments.listSubmissions(user, id);
  }

  @Get('assignments/:id/my-submission')
  @RequirePermissions('lms:read')
  mySubmission(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.assignments.getMySubmission(user, id);
  }

  @Post('assignments/:id/submit')
  @RequirePermissions('lms:read')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 100 * 1024 * 1024 },
    }),
  )
  submitAssignment(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SubmitLmsAssignmentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.assignments.submit(user, id, dto, file);
  }

  @Post('submissions/:id/evaluate')
  @RequirePermissions('lms:assignments:manage')
  evaluateSubmission(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: EvaluateLmsSubmissionDto,
  ) {
    return this.assignments.evaluate(user, id, dto);
  }

  @Post('submissions/:id/return')
  @RequirePermissions('lms:assignments:manage')
  returnSubmission(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ReturnLmsSubmissionDto,
  ) {
    return this.assignments.returnForRevision(user, id, dto);
  }

  @Get('workspaces/:id/quizzes')
  @RequirePermissions('lms:read')
  listQuizzes(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.quizzes.list(user, id);
  }

  @Post('workspaces/:id/quizzes')
  @RequirePermissions('lms:assignments:manage')
  createQuiz(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: CreateLmsQuizDto,
  ) {
    return this.quizzes.create(user, id, dto);
  }

  @Patch('quizzes/:id')
  @RequirePermissions('lms:assignments:manage')
  updateQuiz(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateLmsQuizDto,
  ) {
    return this.quizzes.update(user, id, dto);
  }

  @Post('quizzes/:id/questions')
  @RequirePermissions('lms:assignments:manage')
  addQuizQuestion(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: CreateLmsQuizQuestionDto,
  ) {
    return this.quizzes.addQuestion(user, id, dto);
  }

  @Get('quizzes/:id/questions')
  @RequirePermissions('lms:read')
  listQuizQuestions(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.quizzes.listQuestions(
      user,
      id,
      user.permissions.includes('lms:assignments:manage'),
    );
  }

  @Post('quizzes/:id/publish')
  @RequirePermissions('lms:assignments:manage')
  publishQuiz(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.quizzes.publish(user, id);
  }

  @Post('quizzes/:id/close')
  @RequirePermissions('lms:assignments:manage')
  closeQuiz(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.quizzes.close(user, id);
  }

  @Post('quizzes/:id/start')
  @RequirePermissions('lms:read')
  startQuiz(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.quizzes.startAttempt(user, id);
  }

  @Post('quiz-attempts/:id/submit')
  @RequirePermissions('lms:read')
  submitQuizAttempt(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SubmitLmsQuizAttemptDto,
  ) {
    return this.quizzes.submitAttempt(user, id, dto);
  }

  @Get('quizzes/:id/attempts')
  @RequirePermissions('lms:assignments:manage')
  listQuizAttempts(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.quizzes.listAttempts(user, id);
  }

  @Get('workspaces/:id/discussions')
  @RequirePermissions('lms:read')
  listDiscussions(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.discussions.list(user, id);
  }

  @Post('workspaces/:id/discussions')
  @RequirePermissions('lms:read')
  createDiscussion(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: CreateLmsDiscussionDto,
  ) {
    return this.discussions.create(user, id, dto);
  }

  @Get('discussions/:id/replies')
  @RequirePermissions('lms:read')
  listDiscussionReplies(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.discussions.listReplies(user, id);
  }

  @Post('discussions/:id/replies')
  @RequirePermissions('lms:read')
  replyToDiscussion(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: CreateLmsDiscussionReplyDto,
  ) {
    return this.discussions.reply(user, id, dto.body);
  }
}
