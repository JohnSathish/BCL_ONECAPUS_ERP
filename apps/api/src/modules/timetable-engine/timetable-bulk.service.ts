import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { parseTimeToDate } from '../../common/utils/shift-scope.util';

@Injectable()
export class TimetableBulkService {
  constructor(private readonly prisma: PrismaService) {}

  async copyDaySchedule(
    tenantId: string,
    planId: string,
    sourceDay: number,
    targetDay: number,
  ) {
    if (sourceDay === targetDay) {
      throw new BadRequestException('Source and target day must be different.');
    }
    const entries = await this.prisma.timetablePlanEntry.findMany({
      where: { tenantId, planId, dayOfWeek: sourceDay, deletedAt: null },
    });
    if (!entries.length) return { copied: 0 };
    await this.prisma.timetablePlanEntry.updateMany({
      where: { tenantId, planId, dayOfWeek: targetDay, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    const created = await this.prisma.timetablePlanEntry.createMany({
      data: entries.map((entry) => ({
        tenantId,
        planId,
        shiftId: entry.shiftId,
        slotTemplateId: entry.slotTemplateId,
        dayOfWeek: targetDay,
        periodNo: entry.periodNo,
        startTime: entry.startTime,
        endTime: entry.endTime,
        offeringSectionId: entry.offeringSectionId,
        courseOfferingId: entry.courseOfferingId,
        courseId: entry.courseId,
        staffProfileId: entry.staffProfileId,
        classroomId: entry.classroomId,
        semesterSequence: entry.semesterSequence,
        sectionCode: entry.sectionCode,
        slotType: entry.slotType,
        fyugpCategory: entry.fyugpCategory,
        combinedGroupKey: entry.combinedGroupKey,
        isCombined: entry.isCombined,
        isLocked: true,
        source: 'MANUAL',
        notes: entry.notes,
        metadata: entry.metadata as any,
      })),
    });
    return { copied: created.count };
  }

  async copySemesterSchedule(
    tenantId: string,
    planId: string,
    sourceSemester: number,
    targetSemester: number,
  ) {
    if (sourceSemester === targetSemester) {
      throw new BadRequestException(
        'Source and target semester must be different.',
      );
    }
    const entries = await this.prisma.timetablePlanEntry.findMany({
      where: {
        tenantId,
        planId,
        semesterSequence: sourceSemester,
        deletedAt: null,
      },
    });
    if (!entries.length) return { copied: 0 };
    await this.prisma.timetablePlanEntry.updateMany({
      where: {
        tenantId,
        planId,
        semesterSequence: targetSemester,
        deletedAt: null,
      },
      data: { deletedAt: new Date() },
    });
    const created = await this.prisma.timetablePlanEntry.createMany({
      data: entries.map((entry) => ({
        tenantId,
        planId,
        shiftId: entry.shiftId,
        slotTemplateId: entry.slotTemplateId,
        dayOfWeek: entry.dayOfWeek,
        periodNo: entry.periodNo,
        startTime: entry.startTime,
        endTime: entry.endTime,
        offeringSectionId: entry.offeringSectionId,
        courseOfferingId: entry.courseOfferingId,
        courseId: entry.courseId,
        staffProfileId: entry.staffProfileId,
        classroomId: entry.classroomId,
        semesterSequence: targetSemester,
        sectionCode: entry.sectionCode,
        slotType: entry.slotType,
        fyugpCategory: entry.fyugpCategory,
        combinedGroupKey: entry.combinedGroupKey,
        isCombined: entry.isCombined,
        isLocked: true,
        source: 'MANUAL',
        notes: entry.notes,
        metadata: entry.metadata as any,
      })),
    });
    return { copied: created.count };
  }

  async duplicateEntry(
    tenantId: string,
    entryId: string,
    targetDay: number,
    targetPeriodNo?: number,
  ) {
    const entry = await this.prisma.timetablePlanEntry.findFirst({
      where: { id: entryId, tenantId, deletedAt: null },
    });
    if (!entry) throw new NotFoundException('Timetable entry not found');
    const clone = await this.prisma.timetablePlanEntry.create({
      data: {
        tenantId,
        planId: entry.planId,
        shiftId: entry.shiftId,
        slotTemplateId: entry.slotTemplateId,
        dayOfWeek: targetDay,
        periodNo: targetPeriodNo ?? entry.periodNo,
        startTime: entry.startTime,
        endTime: entry.endTime,
        offeringSectionId: entry.offeringSectionId,
        courseOfferingId: entry.courseOfferingId,
        courseId: entry.courseId,
        staffProfileId: entry.staffProfileId,
        classroomId: entry.classroomId,
        semesterSequence: entry.semesterSequence,
        sectionCode: entry.sectionCode,
        slotType: entry.slotType,
        fyugpCategory: entry.fyugpCategory,
        combinedGroupKey: entry.combinedGroupKey,
        isCombined: entry.isCombined,
        isLocked: true,
        source: 'MANUAL',
        notes: entry.notes,
        metadata: entry.metadata as any,
      },
    });
    return clone;
  }

  async bulkMovePeriods(
    tenantId: string,
    planId: string,
    fromPeriod: number,
    toPeriod: number,
    dayOfWeek?: number,
  ) {
    const entries = await this.prisma.timetablePlanEntry.findMany({
      where: {
        tenantId,
        planId,
        periodNo: fromPeriod,
        deletedAt: null,
        ...(dayOfWeek ? { dayOfWeek } : {}),
      },
    });
    let updated = 0;
    for (const entry of entries) {
      const template = await this.prisma.timetableSlotTemplate.findFirst({
        where: {
          tenantId,
          planId,
          dayOfWeek: entry.dayOfWeek,
          periodNo: toPeriod,
          isBreak: false,
          isLunch: false,
        },
      });
      await this.prisma.timetablePlanEntry.update({
        where: { id: entry.id },
        data: {
          periodNo: toPeriod,
          ...(template
            ? {
                startTime: template.startTime,
                endTime: template.endTime,
                slotTemplateId: template.id,
              }
            : {}),
          source: 'MANUAL',
        },
      });
      updated += 1;
    }
    return { updated };
  }

  async bulkReplaceFaculty(
    tenantId: string,
    planId: string,
    fromStaffProfileId: string,
    toStaffProfileId: string,
  ) {
    const entries = await this.prisma.timetablePlanEntry.findMany({
      where: { tenantId, planId, deletedAt: null },
    });
    let updated = 0;
    for (const entry of entries) {
      const metadata = (entry.metadata ?? {}) as any;
      const team = Array.isArray(metadata.facultyTeam)
        ? metadata.facultyTeam
        : [];
      let changed = false;
      if (entry.staffProfileId === fromStaffProfileId) {
        await this.prisma.timetablePlanEntry.update({
          where: { id: entry.id },
          data: { staffProfileId: toStaffProfileId, source: 'MANUAL' },
        });
        changed = true;
      } else if (
        team.some((m: any) => m.staffProfileId === fromStaffProfileId)
      ) {
        await this.prisma.timetablePlanEntry.update({
          where: { id: entry.id },
          data: {
            metadata: {
              ...metadata,
              facultyTeam: team.map((m: any) =>
                m.staffProfileId === fromStaffProfileId
                  ? { ...m, staffProfileId: toStaffProfileId }
                  : m,
              ),
            },
            source: 'MANUAL',
          },
        });
        changed = true;
      }
      if (changed) updated += 1;
    }
    return { updated };
  }

  async bulkReplaceRooms(
    tenantId: string,
    planId: string,
    fromClassroomId: string,
    toClassroomId: string,
  ) {
    const result = await this.prisma.timetablePlanEntry.updateMany({
      where: {
        tenantId,
        planId,
        classroomId: fromClassroomId,
        deletedAt: null,
      },
      data: { classroomId: toClassroomId, source: 'MANUAL' },
    });
    return { updated: result.count };
  }
}
