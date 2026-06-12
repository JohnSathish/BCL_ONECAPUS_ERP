import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TimetableWorkloadService } from './timetable-workload.service';

type ConflictDraft = {
  entryId?: string;
  conflictType: string;
  severity?: string;
  message: string;
  affectedEntityType?: string;
  affectedEntityId?: string;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class TimetableConflictService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workload: TimetableWorkloadService,
  ) {}

  async validatePlan(tenantId: string, planId: string) {
    await this.prisma.timetableConflict.deleteMany({
      where: { tenantId, planId, status: 'OPEN' },
    });

    const plan = await this.prisma.timetablePlan.findFirst({
      where: { tenantId, id: planId, deletedAt: null },
    });
    const config = await this.prisma.institutionAcademicConfig.findFirst({
      where: {
        tenantId,
        ...(plan?.institutionId ? { institutionId: plan.institutionId } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    });
    const semesterMode = String(
      config?.currentCycle ?? (plan?.metadata as any)?.semesterMode ?? 'ODD',
    ).toUpperCase();
    const allowedSemesters = semesterMode === 'EVEN' ? [2, 4, 6] : [1, 3, 5];
    const entries = await this.prisma.timetablePlanEntry.findMany({
      where: {
        tenantId,
        planId,
        deletedAt: null,
        status: { not: 'CANCELLED' },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
    const slotTemplates = await this.prisma.timetableSlotTemplate.findMany({
      where: { tenantId, planId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
    const classrooms = await this.loadClassrooms(
      tenantId,
      entries.map((entry) => entry.classroomId).filter(Boolean) as string[],
    );
    const sections = await this.loadSections(
      tenantId,
      entries
        .map((entry) => entry.offeringSectionId)
        .filter(Boolean) as string[],
    );
    const reservations = await this.loadReservations(
      tenantId,
      entries.map((entry) => entry.classroomId).filter(Boolean) as string[],
    );

    const conflicts: ConflictDraft[] = [];
    for (let i = 0; i < entries.length; i += 1) {
      const current = entries[i];
      if (
        current.semesterSequence &&
        !allowedSemesters.includes(current.semesterSequence)
      ) {
        conflicts.push({
          entryId: current.id,
          conflictType: 'INACTIVE_SEMESTER',
          message: `Semester ${current.semesterSequence} is inactive in current ${semesterMode} academic cycle.`,
          severity: 'ERROR',
        });
      }
      for (let j = i + 1; j < entries.length; j += 1) {
        const other = entries[j];
        if (current.dayOfWeek !== other.dayOfWeek) continue;
        if (!this.overlaps(current, other)) continue;

        const currentStaff = this.entryStaffIds(current);
        const otherStaff = this.entryStaffIds(other);
        const clashingStaff = currentStaff.find((staffId) =>
          otherStaff.includes(staffId),
        );
        if (clashingStaff) {
          conflicts.push({
            entryId: current.id,
            conflictType: 'FACULTY_CLASH',
            message: 'Faculty is assigned to overlapping timetable slots.',
            affectedEntityType: 'STAFF',
            affectedEntityId: clashingStaff,
            metadata: { conflictingEntryId: other.id },
            severity: 'WARNING',
          });
        }

        if (
          current.classroomId &&
          current.classroomId === other.classroomId &&
          !this.isSharedRoom(classrooms.get(current.classroomId))
        ) {
          conflicts.push({
            entryId: current.id,
            conflictType: 'ROOM_CLASH',
            message: 'Room is assigned to overlapping timetable slots.',
            affectedEntityType: 'ROOM',
            affectedEntityId: current.classroomId,
            metadata: { conflictingEntryId: other.id },
            severity: 'WARNING',
          });
        }

        if (
          current.offeringSectionId &&
          current.offeringSectionId === other.offeringSectionId
        ) {
          conflicts.push({
            entryId: current.id,
            conflictType: 'SECTION_CLASH',
            message: 'Section has overlapping timetable slots.',
            affectedEntityType: 'OFFERING_SECTION',
            affectedEntityId: current.offeringSectionId,
            metadata: { conflictingEntryId: other.id },
            severity: 'WARNING',
          });
        }
      }

      const classroom = current.classroomId
        ? classrooms.get(current.classroomId)
        : undefined;
      if (classroom && classroom.status && classroom.status !== 'ACTIVE') {
        conflicts.push({
          entryId: current.id,
          conflictType: 'ROOM_UNAVAILABLE',
          message: `Room is ${String(classroom.status).toLowerCase()} and cannot be used for timetable slots.`,
          affectedEntityType: 'ROOM',
          affectedEntityId: current.classroomId ?? undefined,
          severity: 'ERROR',
        });
      }
      const roomReservations = current.classroomId
        ? (reservations.get(current.classroomId) ?? [])
        : [];
      const reservationClash = roomReservations.find((reservation: any) =>
        this.overlapsReservation(current, reservation),
      );
      if (reservationClash) {
        conflicts.push({
          entryId: current.id,
          conflictType: 'ROOM_RESERVED',
          message: `Room is reserved for ${reservationClash.title ?? 'another event'} during this slot.`,
          affectedEntityType: 'ROOM',
          affectedEntityId: current.classroomId ?? undefined,
          severity: 'ERROR',
          metadata: {
            reservationId: reservationClash.id,
            reservationStatus: reservationClash.status,
            startAt: reservationClash.startAt,
            endAt: reservationClash.endAt,
          },
        });
      }

      const section = current.offeringSectionId
        ? sections.get(current.offeringSectionId)
        : undefined;

      const matchingSlot = slotTemplates.find(
        (slot) =>
          slot.dayOfWeek === current.dayOfWeek &&
          slot.startTime.getTime() === current.startTime.getTime() &&
          slot.endTime.getTime() === current.endTime.getTime() &&
          !slot.isBreak &&
          !slot.isLunch,
      );
      const overlappingBreak = slotTemplates.find(
        (slot) =>
          slot.dayOfWeek === current.dayOfWeek &&
          (slot.isBreak || slot.isLunch) &&
          this.overlaps(current, slot),
      );
      if (overlappingBreak) {
        conflicts.push({
          entryId: current.id,
          conflictType: 'BREAK_SLOT_BLOCKED',
          message: 'Class is scheduled during the configured lunch/break slot.',
          severity: 'ERROR',
          metadata: {
            breakLabel: overlappingBreak.label,
            startTime: overlappingBreak.startTime,
            endTime: overlappingBreak.endTime,
          },
        });
      }
      if (!matchingSlot) {
        conflicts.push({
          entryId: current.id,
          conflictType: 'OUTSIDE_SHIFT_SLOT',
          message:
            'Class timing does not match an allowed configured shift slot. Saturday Day Shift allows only periods 1-4.',
          severity: 'ERROR',
        });
      }
      if (matchingSlot) {
        const allowedCategories = Array.isArray(matchingSlot.allowedCategories)
          ? matchingSlot.allowedCategories.map((value: unknown) =>
              String(value).trim().toUpperCase(),
            )
          : [];
        const category = String(current.fyugpCategory ?? current.slotType ?? '')
          .trim()
          .toUpperCase();
        if (
          allowedCategories.length &&
          category &&
          !allowedCategories.includes(category)
        ) {
          conflicts.push({
            entryId: current.id,
            conflictType: 'CATEGORY_SLOT_RULE_VIOLATION',
            message: `This slot is reserved for ${allowedCategories.join(
              ', ',
            )}; ${category} cannot be scheduled here.`,
            severity: 'ERROR',
            metadata: {
              allowedCategories,
              actualCategory: category,
              periodNo: matchingSlot.periodNo,
            },
          });
        }
      }

      if (
        classroom &&
        section?.capacity &&
        classroom.capacity < section.capacity
      ) {
        conflicts.push({
          entryId: current.id,
          conflictType: 'ROOM_CAPACITY',
          message: `Room capacity ${classroom.capacity} is below section capacity ${section.capacity}.`,
          affectedEntityType: 'ROOM',
          affectedEntityId: current.classroomId ?? undefined,
          severity: 'WARNING',
        });
      }

      if (
        (current.slotType === 'LAB' || current.slotType === 'PRACTICAL') &&
        classroom &&
        !this.isLabRoom(classroom)
      ) {
        conflicts.push({
          entryId: current.id,
          conflictType: 'LAB_ROOM_REQUIRED',
          message: 'Practical/lab slot is not assigned to a lab room.',
          affectedEntityType: 'ROOM',
          affectedEntityId: current.classroomId ?? undefined,
          severity: current.classroomId ? 'ERROR' : 'WARNING',
        });
      }
      const metadata = (current.metadata ?? {}) as any;
      if (
        current.isCombined &&
        !current.combinedGroupKey &&
        !metadata.combinedGroupId
      ) {
        conflicts.push({
          entryId: current.id,
          conflictType: 'COMBINED_GROUP_MISSING',
          message:
            'Combined class is enabled but no combined group ID is configured.',
          severity: 'ERROR',
        });
      }
      if (
        metadata.parallelGroupId &&
        !['MDC', 'AEC', 'SEC', 'VAC', 'VTC'].includes(
          String(current.fyugpCategory ?? '').toUpperCase(),
        )
      ) {
        conflicts.push({
          entryId: current.id,
          conflictType: 'INVALID_PARALLEL_ELECTIVE_CATEGORY',
          message:
            'Parallel elective grouping is allowed only for MDC/AEC/SEC/VAC/VTC papers.',
          severity: 'WARNING',
          metadata: { parallelGroupId: metadata.parallelGroupId },
        });
      }
    }

    const loads = await this.workload.facultyWeeklyLoads(tenantId, planId);
    for (const load of loads) {
      if (load.maxWeeklyHours && load.weeklyHours > load.maxWeeklyHours) {
        conflicts.push({
          conflictType: 'FACULTY_WORKLOAD_OVERLOAD',
          message: `Faculty weekly load ${load.weeklyHours.toFixed(
            1,
          )}h exceeds configured ${load.maxWeeklyHours.toFixed(1)}h.`,
          affectedEntityType: 'STAFF',
          affectedEntityId: load.staffProfileId,
          severity: 'WARNING',
        });
      }
    }

    if (conflicts.length) {
      await this.prisma.timetableConflict.createMany({
        data: conflicts.map((conflict) => ({
          tenantId,
          planId,
          entryId: conflict.entryId,
          conflictType: conflict.conflictType,
          severity: conflict.severity ?? 'ERROR',
          message: conflict.message,
          affectedEntityType: conflict.affectedEntityType,
          affectedEntityId: conflict.affectedEntityId,
          metadata: (conflict.metadata ?? {}) as any,
        })),
      });
    }

    return {
      planId,
      totalEntries: entries.length,
      totalConflicts: conflicts.length,
      blockingConflicts: conflicts.filter(
        (c) => (c.severity ?? 'ERROR') === 'ERROR',
      ).length,
      conflicts,
    };
  }

  private overlaps(
    left: { startTime: Date; endTime: Date },
    right: { startTime: Date; endTime: Date },
  ) {
    return left.startTime < right.endTime && left.endTime > right.startTime;
  }

  private entryStaffIds(entry: {
    staffProfileId: string | null;
    metadata: unknown;
  }) {
    const metadata = entry.metadata as {
      facultyTeam?: Array<{ staffProfileId?: string | null }>;
    } | null;
    const teamIds = Array.isArray(metadata?.facultyTeam)
      ? metadata.facultyTeam
          .map((member) => member.staffProfileId)
          .filter(Boolean)
      : [];
    return Array.from(
      new Set([entry.staffProfileId, ...teamIds].filter(Boolean)),
    ) as string[];
  }

  private async loadClassrooms(tenantId: string, ids: string[]) {
    if (!ids.length) return new Map<string, any>();
    const rows = await this.prisma.classroom.findMany({
      where: { tenantId, id: { in: Array.from(new Set(ids)) } },
      include: { roomType: true },
    });
    return new Map(rows.map((row) => [row.id, row]));
  }

  private async loadReservations(tenantId: string, classroomIds: string[]) {
    if (!classroomIds.length) return new Map<string, any[]>();
    const rows = await (this.prisma as any).infrastructureReservation.findMany({
      where: {
        tenantId,
        classroomId: { in: Array.from(new Set(classroomIds)) },
        deletedAt: null,
        status: { in: ['PENDING_APPROVAL', 'APPROVED', 'RESERVED'] },
      },
      orderBy: [{ startAt: 'asc' }],
    });
    const grouped = new Map<string, any[]>();
    rows.forEach((row: any) => {
      grouped.set(row.classroomId, [
        ...(grouped.get(row.classroomId) ?? []),
        row,
      ]);
    });
    return grouped;
  }

  private async loadSections(tenantId: string, ids: string[]) {
    if (!ids.length) return new Map<string, any>();
    const rows = await this.prisma.offeringSection.findMany({
      where: { tenantId, id: { in: Array.from(new Set(ids)) } },
    });
    return new Map(rows.map((row) => [row.id, row]));
  }

  private isSharedRoom(room?: any) {
    const text = `${room?.code ?? ''} ${room?.name ?? ''} ${
      room?.roomType?.code ?? ''
    } ${room?.roomType?.name ?? ''}`.toLowerCase();
    return (
      Boolean(room?.isSharedHall || room?.availableForCombined) ||
      text.includes('hall') ||
      text.includes('common') ||
      text.includes('shared')
    );
  }

  private isLabRoom(room?: any) {
    const text = `${room?.code ?? ''} ${room?.name ?? ''} ${
      room?.roomType?.code ?? ''
    } ${room?.roomType?.name ?? ''}`.toLowerCase();
    return (
      Boolean(room?.isPracticalLab) ||
      text.includes('lab') ||
      text.includes('laboratory')
    );
  }

  private overlapsReservation(
    entry: { dayOfWeek: number; startTime: Date; endTime: Date },
    reservation: { startAt: Date; endAt: Date },
  ) {
    const reservationDay = reservation.startAt.getDay();
    if (reservationDay !== entry.dayOfWeek) return false;
    const entryStart = this.minutes(entry.startTime);
    const entryEnd = this.minutes(entry.endTime);
    const reservationStart = this.minutes(reservation.startAt);
    const reservationEnd = this.minutes(reservation.endAt);
    return entryStart < reservationEnd && entryEnd > reservationStart;
  }

  private minutes(value: Date) {
    return value.getHours() * 60 + value.getMinutes();
  }
}
