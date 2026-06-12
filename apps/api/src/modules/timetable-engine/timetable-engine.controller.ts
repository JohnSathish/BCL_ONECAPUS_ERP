import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import { TimetableEngineService } from './timetable-engine.service';

@ApiBearerAuth()
@ApiTags('timetable')
@Controller({ path: 'timetable', version: '1' })
export class TimetableEngineController {
  constructor(private readonly timetable: TimetableEngineService) {}

  @Get('plans')
  @RequireAnyPermission('shift:timetable:manage', 'academic:timetable:manage')
  listPlans(
    @CurrentUser() user: JwtUser,
    @Query('shiftId') shiftId?: string,
    @Query('streamId') streamId?: string,
    @Query('semesterMode') semesterMode?: string,
    @Query('status') status?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('programVersionId') programVersionId?: string,
    @Query('semesterSequence') semesterSequence?: string,
  ) {
    return this.timetable.listPlans(user, {
      shiftId,
      streamId,
      semesterMode,
      status,
      academicYearId,
      programVersionId,
      semesterSequence: semesterSequence ? Number(semesterSequence) : undefined,
    });
  }

  @Get('context')
  @RequireAnyPermission('shift:timetable:manage', 'academic:timetable:manage')
  context(@CurrentUser() user: JwtUser) {
    return this.timetable.context(user);
  }

  @Get('dashboard')
  @RequireAnyPermission('shift:timetable:manage', 'academic:timetable:manage')
  dashboard(@CurrentUser() user: JwtUser) {
    return this.timetable.dashboard(user);
  }

  @Get('readiness')
  @RequireAnyPermission(
    'shift:timetable:manage',
    'academic:timetable:manage',
    'staff:assign-subjects',
  )
  readiness(
    @CurrentUser() user: JwtUser,
    @Query('academicYearId') academicYearId?: string,
    @Query('streamId') streamId?: string,
    @Query('shiftId') shiftId?: string,
    @Query('semesterMode') semesterMode?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.timetable.allocationReadiness(user, {
      academicYearId,
      streamId,
      shiftId,
      semesterMode,
      departmentId,
    });
  }

  @Get('teaching-allocations')
  @RequireAnyPermission(
    'shift:timetable:manage',
    'academic:timetable:manage',
    'staff:assign-subjects',
  )
  teachingAllocations(
    @CurrentUser() user: JwtUser,
    @Query('academicYearId') academicYearId?: string,
    @Query('streamId') streamId?: string,
    @Query('shiftId') shiftId?: string,
    @Query('semesterMode') semesterMode?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.timetable.teachingAllocations(user, {
      academicYearId,
      streamId,
      shiftId,
      semesterMode,
      departmentId,
    });
  }

  @Post('teaching-allocations')
  @RequireAnyPermission(
    'shift:timetable:manage',
    'academic:timetable:manage',
    'staff:assign-subjects',
  )
  saveTeachingAllocation(@CurrentUser() user: JwtUser, @Body() dto: any) {
    return this.timetable.saveTeachingAllocation(user, dto);
  }

  @Post('teaching-allocations/submit')
  @RequireAnyPermission('shift:timetable:manage', 'academic:timetable:manage')
  submitTeachingAllocations(@CurrentUser() user: JwtUser, @Body() dto: any) {
    return this.timetable.submitTeachingAllocations(user, dto);
  }

  @Post('teaching-allocations/auto-assign')
  @RequireAnyPermission('shift:timetable:manage', 'academic:timetable:manage')
  autoAssignTeachingAllocations(
    @CurrentUser() user: JwtUser,
    @Body() dto: any,
  ) {
    return this.timetable.autoAssignTeachingAllocations(user, dto);
  }

  @Get('teaching-allocations/template')
  @RequireAnyPermission(
    'shift:timetable:manage',
    'academic:timetable:manage',
    'staff:assign-subjects',
  )
  async teachingAllocationTemplate(
    @CurrentUser() user: JwtUser,
    @Res() res: Response,
    @Query('academicYearId') academicYearId?: string,
    @Query('streamId') streamId?: string,
    @Query('shiftId') shiftId?: string,
    @Query('semesterMode') semesterMode?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    const buffer = await this.timetable.teachingAllocationTemplate(user, {
      academicYearId,
      streamId,
      shiftId,
      semesterMode,
      departmentId,
    });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="fyugp-teaching-allocation-template.xlsx"',
    );
    res.send(buffer);
  }

  @Post('teaching-allocations/validate-upload')
  @RequireAnyPermission(
    'shift:timetable:manage',
    'academic:timetable:manage',
    'staff:assign-subjects',
  )
  @UseInterceptors(FileInterceptor('file'))
  validateTeachingAllocationUpload(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file?.buffer) throw new Error('File is required');
    return this.timetable.validateTeachingAllocationWorkbook(user, file.buffer);
  }

  @Post('teaching-allocations/commit-upload')
  @RequireAnyPermission(
    'shift:timetable:manage',
    'academic:timetable:manage',
    'staff:assign-subjects',
  )
  @UseInterceptors(FileInterceptor('file'))
  commitTeachingAllocationUpload(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file?.buffer) throw new Error('File is required');
    return this.timetable.commitTeachingAllocationWorkbook(user, file.buffer);
  }

  @Post('clone-previous')
  @RequirePermissions('shift:timetable:manage')
  clonePrevious(@CurrentUser() user: JwtUser, @Body() dto: any) {
    return this.timetable.clonePreviousRoutine(user, dto);
  }

  @Get('plans/:id/category-slot-rules')
  @RequireAnyPermission('shift:timetable:manage', 'academic:timetable:manage')
  slotCategoryRules(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.timetable.slotCategoryRules(user, id);
  }

  @Post('plans/:id/category-slot-rules')
  @RequirePermissions('shift:timetable:manage')
  saveSlotCategoryRules(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.timetable.saveSlotCategoryRules(user, id, dto);
  }

  @Post('plans/manual')
  @RequirePermissions('shift:timetable:manage')
  createManualPlan(@CurrentUser() user: JwtUser, @Body() dto: any) {
    return this.timetable.createManualPlan(user, dto);
  }

  @Post('plans')
  @RequirePermissions('shift:timetable:manage')
  createPlan(@CurrentUser() user: JwtUser, @Body() dto: any) {
    return this.timetable.createPlan(user, dto);
  }

  @Post('plans/:id/generate')
  @RequirePermissions('shift:timetable:manage')
  generate(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.timetable.generatePlan(user, id);
  }

  @Patch('plans/:id/delete')
  @RequirePermissions('shift:timetable:manage')
  deletePlan(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.timetable.deletePlan(user, id);
  }

  @Post('plans/:id/delete')
  @RequirePermissions('shift:timetable:manage')
  deletePlanPost(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.timetable.deletePlan(user, id);
  }

  @Get('plans/:id/matrix')
  @RequireAnyPermission(
    'shift:timetable:manage',
    'academic:timetable:manage',
    'staff:portal:self',
  )
  matrix(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Query('staffProfileId') staffProfileId?: string,
    @Query('classroomId') classroomId?: string,
    @Query('offeringSectionId') offeringSectionId?: string,
    @Query('semesterSequence') semesterSequence?: string,
    @Query('sectionCode') sectionCode?: string,
  ) {
    return this.timetable.matrix(user, id, {
      staffProfileId,
      classroomId,
      offeringSectionId,
      semesterSequence: semesterSequence ? Number(semesterSequence) : undefined,
      sectionCode,
    });
  }

  @Post('plans/:id/validate')
  @RequirePermissions('shift:timetable:manage')
  validate(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.timetable.validatePlan(user, id);
  }

  @Get('plans/:id/validation-center')
  @RequireAnyPermission('shift:timetable:manage', 'academic:timetable:manage')
  validationCenter(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.timetable.validationCenter(user, id);
  }

  @Post('plans/:id/submit-review')
  @RequirePermissions('shift:timetable:manage')
  submitReview(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.timetable.submitReview(user, id);
  }

  @Post('plans/:id/approve')
  @RequirePermissions('shift:timetable:manage')
  approve(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto?: { acknowledgeWarnings?: boolean; overrideReason?: string },
  ) {
    return this.timetable.approve(user, id, dto);
  }

  @Post('plans/:id/publish')
  @RequirePermissions('shift:timetable:manage')
  publish(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto?: { acknowledgeWarnings?: boolean; overrideReason?: string },
  ) {
    return this.timetable.publish(user, id, dto);
  }

  @Get('plans/:id/print')
  @RequireAnyPermission('shift:timetable:manage', 'academic:timetable:manage')
  print(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.timetable.printPayload(user, id);
  }

  @Get('plans/:id/stream-master')
  @RequireAnyPermission(
    'shift:timetable:manage',
    'academic:timetable:manage',
    'staff:portal:self',
  )
  streamMaster(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.timetable.streamMasterRoutine(user, id);
  }

  @Patch('entries/:id')
  @RequirePermissions('shift:timetable:manage')
  updateEntry(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.timetable.updateEntry(user, id, dto);
  }

  @Post('entries/manual')
  @RequirePermissions('shift:timetable:manage')
  createManualEntry(@CurrentUser() user: JwtUser, @Body() dto: any) {
    return this.timetable.createManualEntry(user, dto);
  }

  @Patch('entries/:id/delete')
  @RequirePermissions('shift:timetable:manage')
  deleteEntry(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.timetable.deleteEntry(user, id);
  }

  @Post('entries/:id/duplicate')
  @RequirePermissions('shift:timetable:manage')
  duplicateEntry(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: { targetDay: number; targetPeriodNo?: number },
  ) {
    return this.timetable.duplicateEntry(
      user,
      id,
      dto.targetDay,
      dto.targetPeriodNo,
    );
  }

  @Post('plans/:id/bulk/copy-day')
  @RequirePermissions('shift:timetable:manage')
  copyDaySchedule(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: { sourceDay: number; targetDay: number },
  ) {
    return this.timetable.copyDaySchedule(
      user,
      id,
      dto.sourceDay,
      dto.targetDay,
    );
  }

  @Post('plans/:id/bulk/copy-semester')
  @RequirePermissions('shift:timetable:manage')
  copySemesterSchedule(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: { sourceSemester: number; targetSemester: number },
  ) {
    return this.timetable.copySemesterSchedule(
      user,
      id,
      dto.sourceSemester,
      dto.targetSemester,
    );
  }

  @Post('plans/:id/bulk/move-periods')
  @RequirePermissions('shift:timetable:manage')
  bulkMovePeriods(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: { fromPeriod: number; toPeriod: number; dayOfWeek?: number },
  ) {
    return this.timetable.bulkMovePeriods(
      user,
      id,
      dto.fromPeriod,
      dto.toPeriod,
      dto.dayOfWeek,
    );
  }

  @Post('plans/:id/bulk/replace-faculty')
  @RequirePermissions('shift:timetable:manage')
  bulkReplaceFaculty(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: { fromStaffProfileId: string; toStaffProfileId: string },
  ) {
    return this.timetable.bulkReplaceFaculty(
      user,
      id,
      dto.fromStaffProfileId,
      dto.toStaffProfileId,
    );
  }

  @Post('plans/:id/bulk/replace-rooms')
  @RequirePermissions('shift:timetable:manage')
  bulkReplaceRooms(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: { fromClassroomId: string; toClassroomId: string },
  ) {
    return this.timetable.bulkReplaceRooms(
      user,
      id,
      dto.fromClassroomId,
      dto.toClassroomId,
    );
  }

  @Get('plans/:id/routine/template')
  @RequireAnyPermission('shift:timetable:manage', 'academic:timetable:manage')
  async routineTemplate(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const buffer = await this.timetable.routineTemplate(user, id);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="timetable-routine-template.xlsx"',
    );
    res.send(buffer);
  }

  @Get('plans/:id/export')
  @RequireAnyPermission('shift:timetable:manage', 'academic:timetable:manage')
  async exportRoutine(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Res() res: Response,
    @Query('scope') scope?: string,
  ) {
    const buffer = await this.timetable.exportRoutine(user, id, scope);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="timetable-${scope ?? 'draft'}.xlsx"`,
    );
    res.send(buffer);
  }

  @Post('plans/:id/routine/validate-upload')
  @RequirePermissions('shift:timetable:manage')
  @UseInterceptors(FileInterceptor('file'))
  validateRoutineUpload(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file?.buffer) throw new Error('File is required');
    return this.timetable.validateRoutineUpload(user, id, file.buffer);
  }

  @Post('plans/:id/routine/commit-upload')
  @RequirePermissions('shift:timetable:manage')
  @UseInterceptors(FileInterceptor('file'))
  commitRoutineUpload(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { overrideConflicts?: string },
  ) {
    if (!file?.buffer) throw new Error('File is required');
    return this.timetable.commitRoutineUpload(user, id, file.buffer, {
      overrideConflicts: body.overrideConflicts === 'true',
    });
  }

  @Get('plans/:id/substitutions')
  @RequirePermissions('shift:timetable:manage')
  substitutions(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.timetable.substitutions(user, id);
  }

  @Post('substitutions')
  @RequirePermissions('shift:timetable:manage')
  createSubstitution(@CurrentUser() user: JwtUser, @Body() dto: any) {
    return this.timetable.createSubstitution(user, dto);
  }

  @Get('views/faculty/week')
  @RequireAnyPermission('staff:portal:self', 'shift:timetable:manage')
  facultyWeek(
    @CurrentUser() user: JwtUser,
    @Query('staffProfileId') staffProfileId?: string,
    @Query('shiftId') shiftId?: string,
    @Query('streamId') streamId?: string,
  ) {
    return this.timetable.facultyWeek(user, staffProfileId, {
      shiftId,
      streamId,
    });
  }

  @Get('views/student/week')
  @RequireAnyPermission('student:portal:self', 'shift:timetable:manage')
  studentWeek(@CurrentUser() user: JwtUser) {
    return this.timetable.studentWeek(user);
  }

  @Get('views/rooms/:classroomId/week')
  @RequireAnyPermission('shift:timetable:manage', 'academic:timetable:manage')
  roomWeek(
    @CurrentUser() user: JwtUser,
    @Param('classroomId') classroomId: string,
    @Query('shiftId') shiftId?: string,
    @Query('streamId') streamId?: string,
  ) {
    return this.timetable.roomWeek(user, classroomId, { shiftId, streamId });
  }

  @Get('attendance/today-sessions')
  @RequireAnyPermission(
    'shift:timetable:manage',
    'staff:portal:self',
    'student:portal:self',
  )
  todaySessions(
    @CurrentUser() user: JwtUser,
    @Query('date') date?: string,
    @Query('shiftId') shiftId?: string,
    @Query('streamId') streamId?: string,
    @Query('staffProfileId') staffProfileId?: string,
  ) {
    return this.timetable.todayLectureSessions(
      user,
      date ? new Date(date) : new Date(),
      { shiftId, streamId, staffProfileId },
    );
  }
}
