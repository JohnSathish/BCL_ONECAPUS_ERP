import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { ShiftScoped } from '../../common/decorators/shift-scoped.decorator';
import { ShiftOperationsService } from './shift-operations.service';

@ApiBearerAuth()
@ApiTags('shift-operations')
@ShiftScoped()
@Controller({ path: 'shift-operations', version: '1' })
export class ShiftOperationsController {
  constructor(private readonly ops: ShiftOperationsService) {}

  @Get('timetable')
  @RequirePermissions('shift:timetable:manage')
  listTimetable(
    @CurrentUser() user: JwtUser,
    @Query('shiftId') shiftId?: string,
  ) {
    return this.ops.listTimetable(user, shiftId);
  }

  @Post('timetable')
  @RequirePermissions('shift:timetable:manage')
  createTimetable(
    @CurrentUser() user: JwtUser,
    @Body()
    dto: {
      shiftId: string;
      offeringSectionId?: string;
      facultyId?: string;
      classroomId?: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
    },
  ) {
    return this.ops.createTimetable(user, dto);
  }

  @Get('attendance')
  @RequirePermissions('shift:attendance:manage')
  listAttendance(
    @CurrentUser() user: JwtUser,
    @Query('shiftId') shiftId?: string,
  ) {
    return this.ops.listAttendance(user, shiftId);
  }

  @Post('attendance')
  @RequirePermissions('shift:attendance:manage')
  createAttendance(
    @CurrentUser() user: JwtUser,
    @Body()
    dto: {
      shiftId: string;
      offeringSectionId?: string;
      sessionDate: string;
      startTime: string;
      endTime: string;
    },
  ) {
    return this.ops.createAttendance(user, dto);
  }

  @Get('examinations')
  @RequirePermissions('shift:exams:manage')
  listExaminations(
    @CurrentUser() user: JwtUser,
    @Query('shiftId') shiftId?: string,
  ) {
    return this.ops.listExaminations(user, shiftId);
  }

  @Post('examinations')
  @RequirePermissions('shift:exams:manage')
  createExamination(
    @CurrentUser() user: JwtUser,
    @Body()
    dto: {
      shiftId: string;
      name: string;
      examDate: string;
      startTime: string;
      endTime: string;
    },
  ) {
    return this.ops.createExamination(user, dto);
  }
}
