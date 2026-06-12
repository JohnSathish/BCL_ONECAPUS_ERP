import type { DashboardFiltersDto } from './dto/dashboard-filters.dto';

export type DashboardFilters = DashboardFiltersDto;

export function studentWhere(tenantId: string, filters: DashboardFilters) {
  return {
    tenantId,
    deletedAt: null,
    ...(filters.campusId ? { campusId: filters.campusId } : {}),
    ...(filters.shiftId ? { primaryShiftId: filters.shiftId } : {}),
    ...(filters.programVersionId
      ? { programVersionId: filters.programVersionId }
      : {}),
    ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
  };
}

export function registrationWhere(tenantId: string, filters: DashboardFilters) {
  return {
    tenantId,
    ...(filters.semesterId ? { semesterId: filters.semesterId } : {}),
    ...(filters.shiftId ? { shiftId: filters.shiftId } : {}),
    ...(filters.campusId
      ? { student: { campusId: filters.campusId, deletedAt: null } }
      : {}),
    ...(filters.programVersionId
      ? {
          student: {
            programVersionId: filters.programVersionId,
            deletedAt: null,
          },
        }
      : {}),
    ...(filters.departmentId
      ? { student: { departmentId: filters.departmentId, deletedAt: null } }
      : {}),
  };
}

export function applicationWhere(tenantId: string, filters: DashboardFilters) {
  return {
    tenantId,
    deletedAt: null,
    ...(filters.shiftId ? { preferredShiftId: filters.shiftId } : {}),
    ...(filters.academicYearId
      ? { intake: { academicYearId: filters.academicYearId } }
      : {}),
    ...(filters.departmentId
      ? { intake: { program: { departmentId: filters.departmentId } } }
      : {}),
    ...(filters.programVersionId
      ? {
          intake: {
            program: {
              versions: { some: { id: filters.programVersionId } },
            },
          },
        }
      : {}),
  };
}

export function shiftWhere(tenantId: string, filters: DashboardFilters) {
  return {
    tenantId,
    deletedAt: null,
    status: 'ACTIVE',
    ...(filters.campusId ? { campusId: filters.campusId } : {}),
    ...(filters.institutionId ? { institutionId: filters.institutionId } : {}),
    ...(filters.shiftId ? { id: filters.shiftId } : {}),
  };
}

/** Last N month bucket labels (oldest → newest). */
export function monthBuckets(count = 7): { start: Date; label: string }[] {
  const buckets: { start: Date; label: string }[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      start: d,
      label: d.toLocaleString('en', { month: 'short' }),
    });
  }
  return buckets;
}

export function sparklineFromMonthlyCounts(
  buckets: { start: Date; label: string }[],
  rows: { createdAt: Date }[],
): number[] {
  return buckets.map((b, idx) => {
    const end =
      idx < buckets.length - 1
        ? buckets[idx + 1]!.start
        : new Date(b.start.getFullYear(), b.start.getMonth() + 1, 1);
    return rows.filter((r) => r.createdAt >= b.start && r.createdAt < end)
      .length;
  });
}

export function trendFromSparkline(sparkline: number[]): {
  changePct: number;
  trend: 'up' | 'down';
} {
  if (sparkline.length < 2) return { changePct: 0, trend: 'up' };
  const first = sparkline[0] ?? 0;
  const last = sparkline[sparkline.length - 1] ?? 0;
  if (first === 0) {
    return {
      changePct: last > 0 ? 100 : 0,
      trend: last >= first ? 'up' : 'down',
    };
  }
  const changePct = Math.round(((last - first) / first) * 1000) / 10;
  return { changePct, trend: changePct >= 0 ? 'up' : 'down' };
}
