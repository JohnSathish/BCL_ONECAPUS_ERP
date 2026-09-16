import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import { SCHOOL_SIS_PERMISSION_MANAGE } from './school-sis.constants';
import {
  SIS_ATTENDANCE_APPROVE,
  SIS_ATTENDANCE_MARK,
  SIS_ATTENDANCE_PARENT,
  SIS_ATTENDANCE_SETTINGS,
  SIS_ATTENDANCE_VIEW,
} from './school-sis-iam.perms';
import { SchoolSisAccessService } from './school-sis-access.service';
import {
  SchoolSisAttendanceService,
  type AttendanceActor,
} from './school-sis-attendance.service';
import {
  AttendanceCorrectionDto,
  AttendanceSyncDto,
  BulkNotifyDto,
  CreateLeaveDto,
  QrScanDto,
  ReviewCorrectionDto,
  ReviewLeaveDto,
  SaveAttendanceSettingsDto,
  SaveAttendanceStatusDto,
  SaveLeaveTypeDto,
  SubmitAttendanceDto,
  SubstituteDto,
  UnlockAttendanceDto,
} from './dto/school-attendance.dto';

function actor(
  user: JwtUser,
  req?: { ip?: string; headers?: Record<string, unknown> },
): AttendanceActor {
  const perms = user.permissions ?? [];
  const manage =
    perms.includes(SCHOOL_SIS_PERMISSION_MANAGE) || perms.includes('*');
  return {
    userId: user.sub,
    email: user.email,
    manage,
    canApprove:
      manage ||
      perms.includes('attendance.approve') ||
      perms.includes('attendance.leave.approve'),
    canLock: manage || perms.includes('attendance.lock'),
    ip: typeof req?.ip === 'string' ? req.ip : undefined,
  };
}

@ApiBearerAuth()
@ApiTags('school-sis-attendance')
@Controller({ path: 'school-sis/attendance', version: '1' })
export class SchoolSisAttendanceController {
  constructor(
    private readonly attendance: SchoolSisAttendanceService,
    private readonly access: SchoolSisAccessService,
  ) {}

  private async scopedSections(user: JwtUser) {
    if (
      this.access.has(user, SCHOOL_SIS_PERMISSION_MANAGE) ||
      this.access.isSuper(user)
    ) {
      return null;
    }
    return this.access.sectionIdsForUser(user.tid, user.sub);
  }

  @Get('settings')
  @RequireAnyPermission(...SIS_ATTENDANCE_VIEW)
  settings(
    @CurrentUser() user: JwtUser,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.attendance.getSettings(user.tid, academicYearId);
  }

  @Patch('settings')
  @RequireAnyPermission(...SIS_ATTENDANCE_SETTINGS)
  saveSettings(
    @CurrentUser() user: JwtUser,
    @Body() dto: SaveAttendanceSettingsDto,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.attendance.saveSettings(user.tid, dto, academicYearId);
  }

  @Post('statuses')
  @RequireAnyPermission(...SIS_ATTENDANCE_SETTINGS)
  saveStatus(
    @CurrentUser() user: JwtUser,
    @Body() dto: SaveAttendanceStatusDto,
  ) {
    return this.attendance.saveStatus(user.tid, dto);
  }

  @Post('leave-types')
  @RequireAnyPermission(...SIS_ATTENDANCE_SETTINGS)
  saveLeaveType(@CurrentUser() user: JwtUser, @Body() dto: SaveLeaveTypeDto) {
    return this.attendance.saveLeaveType(user.tid, dto);
  }

  @Get('dashboard')
  @RequireAnyPermission(...SIS_ATTENDANCE_VIEW)
  async dashboard(
    @CurrentUser() user: JwtUser,
    @Query('academicYearId') academicYearId?: string,
    @Query('date') date?: string,
    @Query('gradeId') gradeId?: string,
  ) {
    const sectionIds = await this.scopedSections(user);
    return this.attendance.dashboard(user.tid, {
      academicYearId,
      date,
      gradeId,
      sectionIds,
    });
  }

  @Get('roster')
  @RequireAnyPermission(...SIS_ATTENDANCE_VIEW)
  async roster(
    @CurrentUser() user: JwtUser,
    @Query('date') date: string,
    @Query('sectionId') sectionId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('mode') mode?: string,
    @Query('periodKey') periodKey?: string,
  ) {
    await this.access.assertSectionAccess(user.tid, user, sectionId);
    return this.attendance.roster(
      user.tid,
      { date, sectionId, academicYearId, mode, periodKey },
      actor(user),
    );
  }

  @Post('draft')
  @RequireAnyPermission(...SIS_ATTENDANCE_MARK)
  async draft(
    @CurrentUser() user: JwtUser,
    @Body() dto: SubmitAttendanceDto,
    @Req() req: { ip?: string },
  ) {
    await this.access.assertSectionAccess(user.tid, user, dto.sectionId);
    return this.attendance.saveRoster(user.tid, dto, actor(user, req), true);
  }

  @Post('submit')
  @RequireAnyPermission(...SIS_ATTENDANCE_MARK)
  async submit(
    @CurrentUser() user: JwtUser,
    @Body() dto: SubmitAttendanceDto,
    @Req() req: { ip?: string },
  ) {
    await this.access.assertSectionAccess(user.tid, user, dto.sectionId);
    return this.attendance.saveRoster(
      user.tid,
      dto,
      actor(user, req),
      dto.asDraft ?? false,
    );
  }

  @Post('sessions/:id/submit')
  @RequireAnyPermission(...SIS_ATTENDANCE_MARK)
  submitExisting(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Req() req: { ip?: string },
  ) {
    return this.attendance.submitExisting(user.tid, id, actor(user, req));
  }

  @Post('sessions/:id/lock')
  @RequireAnyPermission(...SIS_ATTENDANCE_APPROVE)
  lock(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Req() req: { ip?: string },
  ) {
    return this.attendance.lock(user.tid, id, actor(user, req));
  }

  @Post('sessions/:id/unlock')
  @RequireAnyPermission(...SIS_ATTENDANCE_APPROVE)
  unlock(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UnlockAttendanceDto,
    @Req() req: { ip?: string },
  ) {
    return this.attendance.lock(user.tid, id, actor(user, req), {
      ...dto,
      sessionId: id,
    });
  }

  @Get('sessions/:id/audit')
  @RequireAnyPermission(...SIS_ATTENDANCE_VIEW)
  audit(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.attendance.history(user.tid, id);
  }

  @Post('corrections')
  @RequireAnyPermission(...SIS_ATTENDANCE_MARK)
  correction(
    @CurrentUser() user: JwtUser,
    @Body() dto: AttendanceCorrectionDto,
    @Req() req: { ip?: string },
  ) {
    return this.attendance.requestCorrection(user.tid, dto, actor(user, req));
  }

  @Get('corrections')
  @RequireAnyPermission(...SIS_ATTENDANCE_VIEW)
  async corrections(
    @CurrentUser() user: JwtUser,
    @Query('status') status?: string,
  ) {
    const sectionIds = await this.scopedSections(user);
    return this.attendance.listCorrections(user.tid, status, sectionIds);
  }

  @Post('corrections/:id/approve')
  @RequireAnyPermission(...SIS_ATTENDANCE_APPROVE)
  approveCorrection(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ReviewCorrectionDto,
    @Req() req: { ip?: string },
  ) {
    return this.attendance.reviewCorrection(
      user.tid,
      id,
      actor(user, req),
      true,
      dto.note,
    );
  }

  @Post('corrections/:id/reject')
  @RequireAnyPermission(...SIS_ATTENDANCE_APPROVE)
  rejectCorrection(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ReviewCorrectionDto,
    @Req() req: { ip?: string },
  ) {
    return this.attendance.reviewCorrection(
      user.tid,
      id,
      actor(user, req),
      false,
      dto.note,
    );
  }

  @Get('leave')
  @RequireAnyPermission(...SIS_ATTENDANCE_VIEW, ...SIS_ATTENDANCE_PARENT)
  async leaves(
    @CurrentUser() user: JwtUser,
    @Query('status') status?: string,
    @Query('studentId') studentId?: string,
  ) {
    if (
      !this.access.has(user, 'attendance.view', SCHOOL_SIS_PERMISSION_MANAGE) &&
      (user.permissions ?? []).some(
        (p) => p === 'school-mobile:parent' || p === 'school-mobile:student',
      )
    ) {
      const kids = await this.attendance.parentChildren(user.tid, user.sub);
      const allowed = new Set(kids.map((k) => k.student.id));
      if (studentId && !allowed.has(studentId)) {
        return [];
      }
      if (studentId)
        return this.attendance.listLeaves(user.tid, status, studentId);
      const all = [];
      for (const id of allowed) {
        all.push(...(await this.attendance.listLeaves(user.tid, status, id)));
      }
      return all;
    }
    return this.attendance.listLeaves(user.tid, status, studentId);
  }

  @Post('leave')
  @RequireAnyPermission(
    ...SIS_ATTENDANCE_MARK,
    'attendance.leave.create',
    ...SIS_ATTENDANCE_PARENT,
  )
  async createLeave(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateLeaveDto,
    @Req() req: { ip?: string },
  ) {
    if (
      !this.access.has(
        user,
        'attendance.create',
        'attendance.leave.create',
        SCHOOL_SIS_PERMISSION_MANAGE,
      )
    ) {
      await this.access.assertStudentAttendanceAccess(
        user.tid,
        user,
        dto.studentId,
      );
    }
    return this.attendance.createLeave(user.tid, dto, actor(user, req));
  }

  @Post('leave/:id/approve')
  @RequireAnyPermission(...SIS_ATTENDANCE_APPROVE, 'attendance.leave.approve')
  approveLeave(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ReviewLeaveDto,
    @Req() req: { ip?: string },
  ) {
    return this.attendance.reviewLeave(
      user.tid,
      id,
      actor(user, req),
      true,
      dto.note,
    );
  }

  @Post('leave/:id/reject')
  @RequireAnyPermission(...SIS_ATTENDANCE_APPROVE, 'attendance.leave.approve')
  rejectLeave(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ReviewLeaveDto,
    @Req() req: { ip?: string },
  ) {
    return this.attendance.reviewLeave(
      user.tid,
      id,
      actor(user, req),
      false,
      dto.note,
    );
  }

  @Get('absentees')
  @RequireAnyPermission(...SIS_ATTENDANCE_VIEW)
  async absentees(
    @CurrentUser() user: JwtUser,
    @Query('date') date?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('status') status?: string,
  ) {
    const sectionIds = await this.scopedSections(user);
    return this.attendance.absentees(user.tid, {
      date,
      academicYearId,
      status,
      sectionIds,
    });
  }

  @Get('low')
  @RequireAnyPermission(...SIS_ATTENDANCE_VIEW)
  async low(
    @CurrentUser() user: JwtUser,
    @Query('academicYearId') academicYearId?: string,
    @Query('below') below?: string,
  ) {
    const sectionIds = await this.scopedSections(user);
    return this.attendance.lowAttendance(user.tid, {
      academicYearId,
      sectionIds,
      below: below ? Number(below) : undefined,
    });
  }

  @Get('monthly')
  @RequireAnyPermission(...SIS_ATTENDANCE_VIEW)
  async monthly(
    @CurrentUser() user: JwtUser,
    @Query('sectionId') sectionId: string,
    @Query('month') month: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    await this.access.assertSectionAccess(user.tid, user, sectionId);
    return this.attendance.monthly(user.tid, {
      academicYearId,
      sectionId,
      month,
    });
  }

  @Get('students/:studentId')
  @RequireAnyPermission(...SIS_ATTENDANCE_VIEW, ...SIS_ATTENDANCE_PARENT)
  async student(
    @CurrentUser() user: JwtUser,
    @Param('studentId') studentId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    await this.access.assertStudentAttendanceAccess(user.tid, user, studentId);
    return this.attendance.studentProfile(user.tid, studentId, academicYearId);
  }

  @Get('search')
  @RequireAnyPermission(...SIS_ATTENDANCE_VIEW)
  async search(
    @CurrentUser() user: JwtUser,
    @Query('q') q: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    const sectionIds = await this.scopedSections(user);
    return this.attendance.searchStudents(
      user.tid,
      q ?? '',
      academicYearId,
      sectionIds,
    );
  }

  @Get('teacher/today')
  @RequireAnyPermission(...SIS_ATTENDANCE_VIEW)
  teacherToday(@CurrentUser() user: JwtUser, @Query('date') date?: string) {
    return this.attendance.teacherToday(user.tid, user.sub, date);
  }

  @Get('parent/children')
  @RequireAnyPermission(...SIS_ATTENDANCE_PARENT)
  parentChildren(@CurrentUser() user: JwtUser) {
    return this.attendance.parentChildren(user.tid, user.sub);
  }

  @Post('substitutes')
  @RequireAnyPermission(SCHOOL_SIS_PERMISSION_MANAGE)
  substitute(
    @CurrentUser() user: JwtUser,
    @Body() dto: SubstituteDto,
    @Req() req: { ip?: string },
  ) {
    return this.attendance.assignSubstitute(user.tid, dto, actor(user, req));
  }

  @Post('sessions/:id/qr')
  @RequireAnyPermission(...SIS_ATTENDANCE_MARK)
  qr(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.attendance.generateQr(user.tid, id);
  }

  @Post('qr/scan')
  @RequireAnyPermission(...SIS_ATTENDANCE_MARK, 'school-mobile:student')
  scan(
    @CurrentUser() user: JwtUser,
    @Body() dto: QrScanDto,
    @Req() req: { ip?: string },
  ) {
    return this.attendance.scanQr(user.tid, dto, actor(user, req));
  }

  @Post('sync')
  @RequireAnyPermission(...SIS_ATTENDANCE_MARK)
  async sync(
    @CurrentUser() user: JwtUser,
    @Body() dto: AttendanceSyncDto,
    @Req() req: { ip?: string },
  ) {
    for (const s of dto.sessions) {
      await this.access.assertSectionAccess(user.tid, user, s.sectionId);
    }
    return this.attendance.syncOffline(user.tid, dto, actor(user, req));
  }

  @Post('notify')
  @RequireAnyPermission(...SIS_ATTENDANCE_MARK)
  notify(@CurrentUser() user: JwtUser, @Body() dto: BulkNotifyDto) {
    return this.attendance.bulkNotify(user.tid, dto);
  }
}
