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
    const minutes = (value: Date) =>
      value.getUTCHours() * 60 + value.getUTCMinutes();
    const overlaps = (start: Date, end: Date, eStart: Date, eEnd: Date) => {
      const ls = minutes(start);
      const le = minutes(end);
      const rs = minutes(eStart);
      const re = minutes(eEnd);
      return ls < re && le > rs;
    };

    // Same-shift classroom/faculty clashes (legacy TimetableEntry)
    const sameShift = await this.prisma.timetableEntry.findMany({
      where: {
        tenantId,
        shiftId: params.shiftId,
        dayOfWeek: params.dayOfWeek,
      },
    });
    for (const e of sameShift) {
      if (!overlaps(params.startTime, params.endTime, e.startTime, e.endTime)) {
        continue;
      }
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

    // Cross-shift faculty wall-clock overlap (published + draft plan entries)
    if (params.staffProfileId) {
      const otherPlanEntries = await this.prisma.timetablePlanEntry.findMany({
        where: {
          tenantId,
          staffProfileId: params.staffProfileId,
          dayOfWeek: params.dayOfWeek,
          deletedAt: null,
          status: { not: 'CANCELLED' },
          plan: {
            tenantId,
            deletedAt: null,
            status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED', 'PUBLISHED'] },
          },
        },
        include: {
          plan: { select: { shiftId: true, name: true } },
        },
      });
      for (const e of otherPlanEntries) {
        const entryShiftId = e.shiftId ?? e.plan.shiftId;
        if (!entryShiftId || entryShiftId === params.shiftId) continue;
        if (
          !overlaps(params.startTime, params.endTime, e.startTime, e.endTime)
        ) {
          continue;
        }
        const shift = await this.prisma.shift.findFirst({
          where: { id: entryShiftId },
          select: { name: true, code: true },
        });
        throw new BadRequestException(
          `Scheduling Conflict Detected: faculty is already assigned in ${
            shift?.name ?? shift?.code ?? 'another shift'
          } during this time.`,
        );
      }
    }
  }
}
