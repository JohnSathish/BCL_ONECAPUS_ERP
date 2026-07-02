'use client';

import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRequireAuth } from '@/hooks/use-auth';
import { useBindWorkspaceShift } from '@/hooks/use-bind-workspace-shift';
import { useShiftScope } from '@/hooks/use-shift-scope';
import { toShiftOptions } from '@/lib/shift-options';
import {
  emptyReportFilters,
  toApiFilters,
  type StudentReportFilterState,
} from '@/components/student-reports/student-report-filters';
import { fetchAcademicStreams } from '@/services/academic-engine';
import { fetchAdmissionBatches } from '@/services/academic-lifecycle';
import { fetchDepartments, fetchInstitutions } from '@/services/organization';
import { fetchPrograms } from '@/services/programs';
import { fetchShifts } from '@/services/shifts';

export function useStudentReportFilterOptions() {
  const session = useRequireAuth();

  const institutions = useQuery({
    queryKey: ['org', 'institutions'],
    queryFn: fetchInstitutions,
    enabled: Boolean(session),
  });
  const institutionId = institutions.data?.[0]?.id ?? '';

  const programs = useQuery({
    queryKey: ['catalog', 'programs'],
    queryFn: () => fetchPrograms(1),
    enabled: Boolean(session),
  });
  const shifts = useQuery({
    queryKey: ['shifts', 'ACTIVE'],
    queryFn: () => fetchShifts({ status: 'ACTIVE' }),
    enabled: Boolean(session),
  });
  const streams = useQuery({
    queryKey: ['academic-engine', 'streams'],
    queryFn: fetchAcademicStreams,
    enabled: Boolean(session),
  });
  const batches = useQuery({
    queryKey: ['academic-lifecycle', 'batches', institutionId],
    queryFn: () => fetchAdmissionBatches(institutionId),
    enabled: Boolean(session) && Boolean(institutionId),
  });
  const departments = useQuery({
    queryKey: ['org', 'departments', institutionId],
    queryFn: () => fetchDepartments({ institutionId, scope: 'academic', status: 'ACTIVE' }),
    enabled: Boolean(session) && Boolean(institutionId),
  });

  const programVersions = useMemo(() => {
    const rows: { id: string; label: string }[] = [];
    for (const p of programs.data?.data ?? []) {
      for (const v of p.versions ?? []) {
        if (v.status === 'PUBLISHED') rows.push({ id: v.id, label: `${p.code} v${v.version}` });
      }
    }
    return rows;
  }, [programs.data]);

  return {
    programOptions: programVersions,
    shiftOptions: toShiftOptions(shifts.data ?? []),
    batchOptions: (batches.data ?? []).map((b) => ({ id: b.id, label: b.batchCode })),
    streamOptions: (streams.data ?? []).map((s) => ({ id: s.id, label: s.name })),
    departmentOptions: (departments.data ?? []).map((d) => ({ id: d.id, label: d.name })),
  };
}

export function useStudentReportFilterState(initial?: Partial<StudentReportFilterState>) {
  const [filters, setFilters] = useState<StudentReportFilterState>(() => ({
    ...emptyReportFilters,
    ...initial,
  }));
  const shiftScope = useShiftScope();

  const bindShift = useCallback((shiftId: string) => {
    setFilters((f) => (f.shiftId === shiftId ? f : { ...f, shiftId }));
  }, []);

  useBindWorkspaceShift(filters.shiftId, bindShift);

  const apiFilters = useMemo(() => {
    const base = toApiFilters(filters);
    if (shiftScope.hideShiftSelectors && shiftScope.activeShiftId) {
      return { ...base, shiftId: shiftScope.activeShiftId };
    }
    return base;
  }, [filters, shiftScope.activeShiftId, shiftScope.hideShiftSelectors]);

  const patchFilters = useCallback((patch: Partial<StudentReportFilterState>) => {
    setFilters((f) => ({ ...f, ...patch }));
  }, []);

  return {
    filters,
    setFilters,
    patchFilters,
    apiFilters,
    hideShiftFilter: shiftScope.hideShiftSelectors,
  };
}
