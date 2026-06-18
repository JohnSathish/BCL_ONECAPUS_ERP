import { Injectable } from '@nestjs/common';
import { formatShiftTime } from '../../common/utils/shift-scope.util';
import { PrismaService } from '../../database/prisma.service';
import { ReplacementTimetableOverlayService } from '../hr/services/replacement-timetable-overlay.service';

const dayLabels = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

@Injectable()
export class TimetablePrintService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly replacementOverlay: ReplacementTimetableOverlayService,
  ) {}

  async noticeBoardPayload(
    tenantId: string,
    planId: string,
    filters?: {
      semesterSequence?: number;
      sectionCode?: string;
    },
  ) {
    const plan = await this.prisma.timetablePlan.findFirst({
      where: { tenantId, id: planId, deletedAt: null },
    });
    const matrix = await this.matrix(tenantId, planId, filters);
    return {
      plan,
      title: this.printTitle(plan),
      generatedAt: new Date().toISOString(),
      days: matrix.days,
      slots: matrix.slots,
      rows: matrix.rows,
      summary: matrix.summary,
    };
  }

  async matrix(
    tenantId: string,
    planId: string,
    filters?: {
      staffProfileId?: string;
      classroomId?: string;
      offeringSectionId?: string;
      semesterSequence?: number;
      sectionCode?: string;
    },
  ) {
    const plan = await this.prisma.timetablePlan.findFirst({
      where: { tenantId, id: planId, deletedAt: null },
    });
    const slots = await this.prisma.timetableSlotTemplate.findMany({
      where: { tenantId, planId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
    const entries = await this.prisma.timetablePlanEntry.findMany({
      where: {
        tenantId,
        planId,
        deletedAt: null,
        ...(filters?.staffProfileId
          ? { staffProfileId: filters.staffProfileId }
          : {}),
        ...(filters?.classroomId ? { classroomId: filters.classroomId } : {}),
        ...(filters?.offeringSectionId
          ? { offeringSectionId: filters.offeringSectionId }
          : {}),
        ...(filters?.semesterSequence
          ? { semesterSequence: filters.semesterSequence }
          : {}),
        ...(filters?.sectionCode ? { sectionCode: filters.sectionCode } : {}),
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    const courseIds = Array.from(
      new Set(entries.map((entry) => entry.courseId).filter(Boolean)),
    ) as string[];
    const staffIds = Array.from(
      new Set(entries.map((entry) => entry.staffProfileId).filter(Boolean)),
    ) as string[];
    const roomIds = Array.from(
      new Set(entries.map((entry) => entry.classroomId).filter(Boolean)),
    ) as string[];
    const groupIds = Array.from(
      new Set(
        entries.map((entry) => entry.teachingSubjectGroupId).filter(Boolean),
      ),
    ) as string[];
    const courses = courseIds.length
      ? await this.prisma.course.findMany({
          where: { tenantId, id: { in: courseIds } },
        })
      : [];
    const staff = staffIds.length
      ? await this.prisma.staffProfile.findMany({
          where: { tenantId, id: { in: staffIds } },
        })
      : [];
    const rooms = roomIds.length
      ? await this.prisma.classroom.findMany({
          where: { tenantId, id: { in: roomIds } },
        })
      : [];
    const subjectGroups = groupIds.length
      ? await (this.prisma as any).teachingSubjectGroup.findMany({
          where: { tenantId, id: { in: groupIds }, deletedAt: null },
          select: { id: true, code: true, title: true },
        })
      : [];
    const courseById = new Map(courses.map((row) => [row.id, row]));
    const staffById = new Map(staff.map((row) => [row.id, row]));
    const roomById = new Map(rooms.map((row) => [row.id, row]));
    const subjectGroupById = new Map(
      subjectGroups.map((row: { id: string }) => [row.id, row]),
    );
    const asOf = plan?.effectiveFrom
      ? new Date(plan.effectiveFrom)
      : new Date();
    const overlayMap = await this.replacementOverlay.loadOverlayMap(
      tenantId,
      staffIds,
      asOf,
    );

    const fallbackSlots = this.uniqueSlotsFromEntries(entries);
    const effectiveSlots = slots.length ? slots : fallbackSlots;
    const slotRows = effectiveSlots.map((slot) => ({
      id: slot.id,
      dayOfWeek: slot.dayOfWeek,
      periodNo: slot.periodNo,
      label: slot.label,
      startTime: formatShiftTime(slot.startTime),
      endTime: formatShiftTime(slot.endTime),
      isBreak: slot.isBreak,
      isLunch: slot.isLunch,
      isSaturdayHalfDay: slot.isSaturdayHalfDay,
      durationMinutes: slot.durationMinutes,
    }));

    const grouped = new Map<string, any[]>();
    for (const entry of entries) {
      const key = `${entry.dayOfWeek}:${formatShiftTime(entry.startTime)}:${formatShiftTime(entry.endTime)}`;
      grouped.set(key, [
        ...(grouped.get(key) ?? []),
        {
          ...entry,
          startTime: formatShiftTime(entry.startTime),
          endTime: formatShiftTime(entry.endTime),
          course: entry.courseId
            ? (courseById.get(entry.courseId) ?? null)
            : null,
          staffProfile: entry.staffProfileId
            ? (staffById.get(entry.staffProfileId) ?? null)
            : null,
          classroom: entry.classroomId
            ? (roomById.get(entry.classroomId) ?? null)
            : null,
          teachingSubjectGroup: entry.teachingSubjectGroupId
            ? (subjectGroupById.get(entry.teachingSubjectGroupId) ?? null)
            : null,
          replacementOverlay: entry.staffProfileId
            ? (overlayMap.get(entry.staffProfileId) ?? null)
            : null,
        },
      ]);
    }

    return {
      summary: {
        title: this.printTitle(plan),
        streamName: (plan?.metadata as any)?.streamName ?? 'All Streams',
        shiftId: plan?.shiftId ?? null,
        semesterMode: (plan?.metadata as any)?.semesterMode ?? null,
        academicYearId: plan?.academicYearId ?? null,
        effectiveFrom: plan?.effectiveFrom ?? null,
      },
      days: [1, 2, 3, 4, 5, 6].map((value) => ({
        value,
        label:
          value === 6 &&
          slotRows.some(
            (slot) => slot.dayOfWeek === 6 && slot.isSaturdayHalfDay,
          )
            ? `${dayLabels[value]} (Half Day)`
            : dayLabels[value],
      })),
      slots: slotRows,
      rows: slotRows.map((slot) => ({
        ...slot,
        entries:
          grouped.get(`${slot.dayOfWeek}:${slot.startTime}:${slot.endTime}`) ??
          [],
      })),
    };
  }

  private uniqueSlotsFromEntries(entries: any[]) {
    const seen = new Set<string>();
    return entries
      .filter((entry) => {
        const key = `${entry.dayOfWeek}:${entry.startTime.toISOString()}:${entry.endTime.toISOString()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((entry) => ({
        id: `entry-${entry.id}`,
        dayOfWeek: entry.dayOfWeek,
        periodNo: entry.periodNo ?? 0,
        label: entry.periodNo ? `P${entry.periodNo}` : 'Slot',
        startTime: entry.startTime,
        endTime: entry.endTime,
        isBreak: false,
        isLunch: false,
        isSaturdayHalfDay: entry.dayOfWeek === 6,
        durationMinutes: 0,
      }));
  }

  private printTitle(plan?: any) {
    const metadata = (plan?.metadata ?? {}) as any;
    const stream = metadata.streamName ?? metadata.streamCode ?? 'FYUGP';
    const mode = metadata.semesterMode
      ? `${metadata.semesterMode} SEMESTER`
      : '';
    return (
      plan?.name ?? `DBC FYUGP ${String(stream).toUpperCase()} ${mode} ROUTINE`
    );
  }
}
