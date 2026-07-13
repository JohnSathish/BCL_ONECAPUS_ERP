import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import {
  ApplyEnrollmentDto,
  AssignStaffDto,
  GradeAssessmentDto,
  MarkAttendanceDto,
  UpsertAssessmentDto,
  UpsertMaterialDto,
  UpsertSessionDto,
  UpsertShortTermBatchDto,
  UpsertShortTermCourseDto,
} from './dto/short-term-courses.dto';
import { ShortTermCoursesService } from './services/short-term-courses.service';

@Controller('short-term-courses')
export class ShortTermCoursesController {
  constructor(private readonly service: ShortTermCoursesService) {}

  @Get('dashboard')
  @RequireAnyPermission('short-term-courses:read', 'short-term-courses:manage')
  dashboard(@CurrentUser() user: JwtUser) {
    return this.service.dashboard(user.tid);
  }

  @Post('seed-demo')
  @RequirePermissions('short-term-courses:manage')
  seedDemo(@CurrentUser() user: JwtUser) {
    return this.service.seedDemoCourses(user);
  }

  @Post('enrollments/apply')
  @RequireAnyPermission(
    'short-term-courses:self',
    'short-term-courses:manage',
    'student:portal:self',
  )
  async apply(@CurrentUser() user: JwtUser, @Body() dto: ApplyEnrollmentDto) {
    const studentId = await this.service.resolveStudentIdForUser(user);
    return this.service.apply(user, studentId, dto);
  }

  @Post('enrollments/:id/pay')
  @RequireAnyPermission(
    'short-term-courses:self',
    'short-term-courses:manage',
    'student:portal:self',
  )
  pay(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.initiatePayment(user, id);
  }

  @Post('enrollments/:id/confirm-payment')
  @RequireAnyPermission(
    'short-term-courses:self',
    'short-term-courses:manage',
    'student:portal:self',
  )
  confirmPayment(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { paymentId?: string },
  ) {
    return this.service.confirmPayment(user, id, body?.paymentId);
  }

  @Get('catalogue')
  @RequireAnyPermission(
    'short-term-courses:self',
    'short-term-courses:read',
    'short-term-courses:manage',
    'student:portal:self',
  )
  catalogue(@CurrentUser() user: JwtUser) {
    return this.service.catalogue(user.tid);
  }

  @Get('courses')
  @RequireAnyPermission('short-term-courses:read', 'short-term-courses:manage')
  listCourses(@CurrentUser() user: JwtUser, @Query('status') status?: string) {
    return this.service.listCourses(user.tid, { status });
  }

  @Get('courses/:id')
  @RequireAnyPermission('short-term-courses:read', 'short-term-courses:manage')
  getCourse(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.getCourse(user.tid, id);
  }

  @Post('courses')
  @RequirePermissions('short-term-courses:manage')
  createCourse(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpsertShortTermCourseDto,
  ) {
    return this.service.upsertCourse(user, dto);
  }

  @Patch('courses/:id')
  @RequirePermissions('short-term-courses:manage')
  updateCourse(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpsertShortTermCourseDto,
  ) {
    return this.service.upsertCourse(user, dto, id);
  }

  @Post('courses/:id/publish')
  @RequirePermissions('short-term-courses:manage')
  publishCourse(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.publishCourse(user, id);
  }

  @Get('batches')
  @RequireAnyPermission('short-term-courses:read', 'short-term-courses:manage')
  listBatches(
    @CurrentUser() user: JwtUser,
    @Query('courseId') courseId?: string,
  ) {
    return this.service.listBatches(user.tid, courseId);
  }

  @Get('batches/:id')
  @RequireAnyPermission(
    'short-term-courses:read',
    'short-term-courses:manage',
    'short-term-courses:self',
  )
  getBatch(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.getBatch(user.tid, id);
  }

  @Post('batches')
  @RequirePermissions('short-term-courses:manage')
  createBatch(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpsertShortTermBatchDto,
  ) {
    return this.service.upsertBatch(user, dto);
  }

  @Patch('batches/:id')
  @RequirePermissions('short-term-courses:manage')
  updateBatch(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpsertShortTermBatchDto,
  ) {
    return this.service.upsertBatch(user, dto, id);
  }

  @Post('batches/:id/staff')
  @RequirePermissions('short-term-courses:manage')
  assignStaff(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: AssignStaffDto,
  ) {
    return this.service.assignStaff(user, id, dto);
  }

  @Delete('staff/:assignmentId')
  @RequirePermissions('short-term-courses:manage')
  removeStaff(
    @CurrentUser() user: JwtUser,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.service.removeStaff(user, assignmentId);
  }

  @Post('batches/:id/sessions')
  @RequirePermissions('short-term-courses:manage')
  createSession(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpsertSessionDto,
  ) {
    return this.service.upsertSession(user, id, dto);
  }

  @Post('batches/:id/materials')
  @RequirePermissions('short-term-courses:manage')
  createMaterial(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpsertMaterialDto,
  ) {
    return this.service.upsertMaterial(user, id, dto);
  }

  @Post('batches/:id/assessments')
  @RequirePermissions('short-term-courses:manage')
  createAssessment(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpsertAssessmentDto,
  ) {
    return this.service.upsertAssessment(user, id, dto);
  }

  @Post('assessments/:id/grade')
  @RequireAnyPermission(
    'short-term-courses:manage',
    'short-term-courses:mark-attendance',
  )
  grade(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: GradeAssessmentDto,
  ) {
    return this.service.gradeAssessment(user, id, dto);
  }

  @Post('sessions/:id/attendance')
  @RequireAnyPermission(
    'short-term-courses:manage',
    'short-term-courses:mark-attendance',
  )
  markAttendance(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: MarkAttendanceDto,
  ) {
    return this.service.markAttendance(user, id, dto);
  }

  @Get('enrollments')
  @RequireAnyPermission('short-term-courses:read', 'short-term-courses:manage')
  listEnrollments(
    @CurrentUser() user: JwtUser,
    @Query('batchId') batchId?: string,
    @Query('studentId') studentId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.listEnrollments(user.tid, {
      batchId,
      studentId,
      status,
    });
  }

  @Get('my-learning')
  @RequireAnyPermission('short-term-courses:self', 'student:portal:self')
  async myLearning(@CurrentUser() user: JwtUser) {
    const studentId = await this.service.resolveStudentIdForUser(user);
    return this.service.myLearning(user, studentId);
  }

  @Get('enrollments/:id/attendance')
  @RequireAnyPermission(
    'short-term-courses:self',
    'short-term-courses:read',
    'short-term-courses:manage',
    'student:portal:self',
  )
  attendanceSummary(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.studentAttendanceSummary(user.tid, id);
  }

  @Get('enrollments/:id/certificate-eligibility')
  @RequireAnyPermission(
    'short-term-courses:self',
    'short-term-courses:read',
    'short-term-courses:manage',
    'student:portal:self',
  )
  certEligibility(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.checkCertificateEligibility(user.tid, id);
  }

  @Post('enrollments/:id/issue-certificate')
  @RequirePermissions('short-term-courses:manage')
  issueCertificate(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.issueCompletionCertificate(user, id);
  }
}
