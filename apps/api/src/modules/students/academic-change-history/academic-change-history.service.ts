import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import {
  ACADEMIC_CHANGE_TYPES,
  CATEGORY_TO_CHANGE_TYPE,
  type AcademicChangeAuditContext,
  type AcademicChangeInput,
  type AcademicChangeType,
} from './academic-change-history.types';

type LineSnapshot = {
  category: string;
  label: string;
};

@Injectable()
export class AcademicChangeHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    tenantId: string,
    studentId: string,
    query: {
      page?: number;
      limit?: number;
      semesterId?: string;
      academicYearId?: string;
      changeType?: string;
      changedById?: string;
      from?: string;
      to?: string;
    },
  ) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 10));
    const where: Prisma.AcademicChangeHistoryWhereInput = {
      tenantId,
      studentId,
      ...(query.semesterId ? { semesterId: query.semesterId } : {}),
      ...(query.academicYearId ? { academicYearId: query.academicYearId } : {}),
      ...(query.changeType ? { changeType: query.changeType } : {}),
      ...(query.changedById ? { changedById: query.changedById } : {}),
      ...(query.from || query.to
        ? {
            changedOn: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.academicChangeHistory.findMany({
        where,
        orderBy: { changedOn: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.academicChangeHistory.count({ where }),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async recordChanges(
    tenantId: string,
    studentId: string,
    changes: AcademicChangeInput[],
    ctx: AcademicChangeAuditContext = {},
  ) {
    const meaningful = changes.filter(
      (c) =>
        (c.oldValue ?? '').trim() !== (c.newValue ?? '').trim() &&
        ((c.oldValue ?? '').trim() || (c.newValue ?? '').trim()),
    );
    if (!meaningful.length) return { recorded: 0 };

    const actorRole = ctx.actorRoles?.[0] ?? null;
    const browser = this.parseBrowser(ctx.userAgent);
    const deviceInfo = ctx.userAgent?.slice(0, 240) ?? null;

    await this.prisma.academicChangeHistory.createMany({
      data: meaningful.map((change) => ({
        tenantId,
        studentId,
        semesterId: ctx.semesterId ?? null,
        academicYearId: ctx.academicYearId ?? null,
        changeType: change.changeType,
        fieldName: change.fieldName ?? null,
        oldValue: change.oldValue ?? null,
        newValue: change.newValue ?? null,
        changedById: ctx.actorId ?? null,
        changedByName: ctx.actorName ?? null,
        changedByRole: actorRole,
        reason: ctx.reason?.trim() || null,
        ipAddress: ctx.ipAddress ?? null,
        deviceInfo,
        browser,
      })),
    });

    return { recorded: meaningful.length };
  }

  async logRegistrationLineChanges(
    tenantId: string,
    studentId: string,
    registration: {
      id: string;
      semesterId: string;
      semesterSequence: number;
    },
    before: LineSnapshot[],
    after: LineSnapshot[],
    ctx: AcademicChangeAuditContext,
  ) {
    const oldMap = new Map(
      before.map((l) => [l.category.toUpperCase(), l.label]),
    );
    const newMap = new Map(
      after.map((l) => [l.category.toUpperCase(), l.label]),
    );
    const categories = new Set([...oldMap.keys(), ...newMap.keys()]);
    const changes: AcademicChangeInput[] = [];

    for (const category of categories) {
      const oldLabel = oldMap.get(category) ?? null;
      const newLabel = newMap.get(category) ?? null;
      if (oldLabel === newLabel) continue;

      const fieldName = category;
      const changeType = this.resolveSubjectChangeType(
        category,
        oldLabel,
        newLabel,
      );

      changes.push({
        changeType,
        fieldName,
        oldValue: oldLabel,
        newValue: newLabel,
      });
    }

    return this.recordChanges(tenantId, studentId, changes, {
      ...ctx,
      semesterId: registration.semesterId,
    });
  }

  async logBasicAcademicChanges(
    tenantId: string,
    studentId: string,
    before: {
      programmeLabel?: string | null;
      departmentLabel?: string | null;
      shiftLabel?: string | null;
    },
    after: {
      programmeLabel?: string | null;
      departmentLabel?: string | null;
      shiftLabel?: string | null;
    },
    ctx: AcademicChangeAuditContext,
  ) {
    const changes: AcademicChangeInput[] = [];

    if (
      (before.programmeLabel ?? '') !== (after.programmeLabel ?? '') &&
      ((before.programmeLabel ?? '') || (after.programmeLabel ?? ''))
    ) {
      changes.push({
        changeType: ACADEMIC_CHANGE_TYPES.PROGRAMME_CHANGED,
        fieldName: 'programme',
        oldValue: before.programmeLabel ?? null,
        newValue: after.programmeLabel ?? null,
      });
    }
    if (
      (before.departmentLabel ?? '') !== (after.departmentLabel ?? '') &&
      ((before.departmentLabel ?? '') || (after.departmentLabel ?? ''))
    ) {
      changes.push({
        changeType: ACADEMIC_CHANGE_TYPES.DEPARTMENT_CHANGED,
        fieldName: 'department',
        oldValue: before.departmentLabel ?? null,
        newValue: after.departmentLabel ?? null,
      });
    }
    if (
      (before.shiftLabel ?? '') !== (after.shiftLabel ?? '') &&
      ((before.shiftLabel ?? '') || (after.shiftLabel ?? ''))
    ) {
      changes.push({
        changeType: ACADEMIC_CHANGE_TYPES.SHIFT_CHANGED,
        fieldName: 'shift',
        oldValue: before.shiftLabel ?? null,
        newValue: after.shiftLabel ?? null,
      });
    }

    return this.recordChanges(tenantId, studentId, changes, ctx);
  }

  async logShiftTransferChanges(
    tenantId: string,
    studentId: string,
    before: {
      shiftLabel?: string | null;
      rollNumber?: string | null;
    },
    after: {
      shiftLabel?: string | null;
      rollNumber?: string | null;
    },
    ctx: AcademicChangeAuditContext,
  ) {
    const changes: AcademicChangeInput[] = [];

    if (
      (before.shiftLabel ?? '') !== (after.shiftLabel ?? '') &&
      ((before.shiftLabel ?? '') || (after.shiftLabel ?? ''))
    ) {
      changes.push({
        changeType: ACADEMIC_CHANGE_TYPES.SHIFT_CHANGED,
        fieldName: 'shift',
        oldValue: before.shiftLabel ?? null,
        newValue: after.shiftLabel ?? null,
      });
    }
    if (
      (before.rollNumber ?? '') !== (after.rollNumber ?? '') &&
      ((before.rollNumber ?? '') || (after.rollNumber ?? ''))
    ) {
      changes.push({
        changeType: ACADEMIC_CHANGE_TYPES.ROLL_NUMBER_CHANGED,
        fieldName: 'rollNumber',
        oldValue: before.rollNumber ?? null,
        newValue: after.rollNumber ?? null,
      });
    }

    return this.recordChanges(tenantId, studentId, changes, ctx);
  }

  formatRegistrationLineSnapshots(
    lines: Array<{
      category: string | null;
      offering?: { course?: { code?: string; title?: string } | null } | null;
    }>,
  ): LineSnapshot[] {
    return lines.map((line) => ({
      category: String(line.category ?? '').toUpperCase(),
      label: this.formatCourseLabel(line.offering?.course),
    }));
  }

  formatCourseLabel(course?: { code?: string; title?: string } | null) {
    if (!course?.code && !course?.title) return '—';
    if (course.code && course.title) return `${course.code} — ${course.title}`;
    return course.code ?? course.title ?? '—';
  }

  async resolveActorContext(
    tenantId: string,
    actorId?: string,
    actorRoles?: string[],
  ): Promise<
    Pick<AcademicChangeAuditContext, 'actorId' | 'actorName' | 'actorRoles'>
  > {
    if (!actorId) return { actorRoles };
    const user = await this.prisma.user.findFirst({
      where: { id: actorId, tenantId },
      select: { id: true, displayName: true, email: true },
    });
    return {
      actorId,
      actorName: user?.displayName?.trim() || user?.email || 'Staff',
      actorRoles,
    };
  }

  async exportCsv(
    tenantId: string,
    studentId: string,
    query: Record<string, string | undefined>,
  ) {
    const { items } = await this.list(tenantId, studentId, {
      ...query,
      page: 1,
      limit: 5000,
    });
    const header = [
      'Changed On',
      'Changed By',
      'Role',
      'Change Type',
      'Field',
      'Old Value',
      'New Value',
      'Reason',
      'IP Address',
      'Browser',
    ];
    const rows = items.map((row) => [
      row.changedOn.toISOString(),
      row.changedByName ?? '',
      row.changedByRole ?? '',
      row.changeType,
      row.fieldName ?? '',
      row.oldValue ?? '',
      row.newValue ?? '',
      row.reason ?? '',
      row.ipAddress ?? '',
      row.browser ?? '',
    ]);
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    return [header, ...rows].map((r) => r.map(escape).join(',')).join('\n');
  }

  private resolveSubjectChangeType(
    category: string,
    oldLabel: string | null,
    newLabel: string | null,
  ): AcademicChangeType {
    if (!oldLabel && newLabel) {
      return category === 'MAJOR' || category === 'MINOR'
        ? (CATEGORY_TO_CHANGE_TYPE[category] ??
            ACADEMIC_CHANGE_TYPES.SUBJECT_ADDED)
        : ACADEMIC_CHANGE_TYPES.SUBJECT_ADDED;
    }
    if (oldLabel && !newLabel) return ACADEMIC_CHANGE_TYPES.SUBJECT_REMOVED;
    return (
      CATEGORY_TO_CHANGE_TYPE[category] ??
      ACADEMIC_CHANGE_TYPES.SUBJECT_REPLACED
    );
  }

  private parseBrowser(userAgent?: string) {
    if (!userAgent) return null;
    if (userAgent.includes('Edg/')) return 'Microsoft Edge';
    if (userAgent.includes('Chrome/')) return 'Chrome';
    if (userAgent.includes('Firefox/')) return 'Firefox';
    if (userAgent.includes('Safari/') && !userAgent.includes('Chrome/')) {
      return 'Safari';
    }
    return userAgent.slice(0, 80);
  }
}
