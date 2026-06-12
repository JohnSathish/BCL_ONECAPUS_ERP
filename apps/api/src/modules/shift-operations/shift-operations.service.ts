import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { ShiftScopeService } from '../../common/services/shift-scope.service';
import { parseTimeToDate } from '../../common/utils/shift-scope.util';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ShiftOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shiftScope: ShiftScopeService,
  ) {}

  private scopedShiftId(user: JwtUser, shiftId?: string) {
    return this.shiftScope.assertCanUseShiftId(user, shiftId);
  }

  async listTimetable(user: JwtUser, shiftId?: string) {
    const sid = this.scopedShiftId(user, shiftId);
    let where = { tenantId: user.tid, ...(sid ? { shiftId: sid } : {}) };
    where = this.shiftScope.applyToWhere(
      where,
      this.shiftScope.resolveScope(user, sid),
    );
    return this.prisma.timetableEntry.findMany({
      where,
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async createTimetable(
    user: JwtUser,
    dto: {
      shiftId: string;
      offeringSectionId?: string;
      facultyId?: string;
      staffProfileId?: string;
      classroomId?: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
    },
  ) {
    const shiftId = this.scopedShiftId(user, dto.shiftId) ?? dto.shiftId;
    const staffProfileId = dto.staffProfileId ?? dto.facultyId;
    this.shiftScope.assertShiftAccess(
      this.shiftScope.resolveScope(user),
      shiftId,
    );
    await this.assertNoTimetableConflict(user.tid, {
      shiftId,
      staffProfileId,
      classroomId: dto.classroomId,
      dayOfWeek: dto.dayOfWeek,
      startTime: parseTimeToDate(dto.startTime),
      endTime: parseTimeToDate(dto.endTime),
    });

    return this.prisma.timetableEntry.create({
      data: {
        tenantId: user.tid,
        shiftId,
        offeringSectionId: dto.offeringSectionId,
        staffProfileId,
        classroomId: dto.classroomId,
        dayOfWeek: dto.dayOfWeek,
        startTime: parseTimeToDate(dto.startTime),
        endTime: parseTimeToDate(dto.endTime),
      },
    });
  }

  async listAttendance(user: JwtUser, shiftId?: string) {
    const sid = this.scopedShiftId(user, shiftId);
    let where = { tenantId: user.tid, ...(sid ? { shiftId: sid } : {}) };
    where = this.shiftScope.applyToWhere(
      where,
      this.shiftScope.resolveScope(user, sid),
    );
    return this.prisma.attendanceSession.findMany({
      where,
      orderBy: { sessionDate: 'desc' },
    });
  }

  async createAttendance(
    user: JwtUser,
    dto: {
      shiftId: string;
      offeringSectionId?: string;
      sessionDate: string;
      startTime: string;
      endTime: string;
    },
  ) {
    const shiftId = this.scopedShiftId(user, dto.shiftId) ?? dto.shiftId;
    this.shiftScope.assertShiftAccess(
      this.shiftScope.resolveScope(user),
      shiftId,
    );
    return this.prisma.attendanceSession.create({
      data: {
        tenantId: user.tid,
        shiftId,
        offeringSectionId: dto.offeringSectionId,
        sessionDate: new Date(dto.sessionDate),
        startTime: parseTimeToDate(dto.startTime),
        endTime: parseTimeToDate(dto.endTime),
      },
    });
  }

  async listExaminations(user: JwtUser, shiftId?: string) {
    const sid = this.scopedShiftId(user, shiftId);
    let where = { tenantId: user.tid, ...(sid ? { shiftId: sid } : {}) };
    where = this.shiftScope.applyToWhere(
      where,
      this.shiftScope.resolveScope(user, sid),
    );
    return this.prisma.examinationSchedule.findMany({
      where,
      orderBy: { examDate: 'asc' },
    });
  }

  async createExamination(
    user: JwtUser,
    dto: {
      shiftId: string;
      name: string;
      examDate: string;
      startTime: string;
      endTime: string;
    },
  ) {
    const shiftId = this.scopedShiftId(user, dto.shiftId) ?? dto.shiftId;
    this.shiftScope.assertShiftAccess(
      this.shiftScope.resolveScope(user),
      shiftId,
    );
    return this.prisma.examinationSchedule.create({
      data: {
        tenantId: user.tid,
        shiftId,
        name: dto.name,
        examDate: new Date(dto.examDate),
        startTime: parseTimeToDate(dto.startTime),
        endTime: parseTimeToDate(dto.endTime),
      },
    });
  }

  private async assertNoTimetableConflict(
    tenantId: string,
    params: {
      shiftId: string;
      staffProfileId?: string;
      classroomId?: string;
      dayOfWeek: number;
      startTime: Date;
      endTime: Date;
    },
  ) {
    const base = {
      tenantId,
      shiftId: params.shiftId,
      dayOfWeek: params.dayOfWeek,
    };
    const entries = await this.prisma.timetableEntry.findMany({ where: base });
    for (const e of entries) {
      const overlap =
        params.startTime < e.endTime && params.endTime > e.startTime;
      if (!overlap) continue;
      if (params.staffProfileId && e.staffProfileId === params.staffProfileId) {
        throw new BadRequestException(
          'Faculty timetable conflict in this shift',
        );
      }
      if (params.classroomId && e.classroomId === params.classroomId) {
        throw new BadRequestException(
          'Classroom timetable conflict in this shift',
        );
      }
    }
  }
}
