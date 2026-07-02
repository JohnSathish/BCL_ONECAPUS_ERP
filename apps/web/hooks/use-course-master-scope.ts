'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { canManageAcademic } from '@/lib/can-manage-academic';
import { useShiftScope } from '@/hooks/use-shift-scope';
import { useAuthStore } from '@/store/auth-store';
import { fetchShiftDepartments, fetchShiftProgrammes } from '@/services/academic-engine';
import { fetchInstitutions } from '@/services/organization';
import type { Department } from '@/types/organization';
import type { ProgramVersion } from '@/types/programs';

type ProgramVersionOption = ProgramVersion & {
  program: { code: string; name: string };
};

export function useCourseMasterScope(programVersions: ProgramVersionOption[]) {
  const session = useAuthStore((s) => s.session);
  const shiftScope = useShiftScope();

  const institutionScoped = shiftScope.allShifts && shiftScope.workspaceKind === 'institution';

  const canEditCourseMaster = useMemo(
    () => canManageAcademic(session) && institutionScoped,
    [institutionScoped, session],
  );

  const isShiftFiltered = !institutionScoped && Boolean(shiftScope.activeShiftId);
  const shiftId = isShiftFiltered ? shiftScope.activeShiftId : undefined;

  const institutions = useQuery({
    queryKey: ['organization', 'institutions'],
    queryFn: fetchInstitutions,
    enabled: Boolean(isShiftFiltered && shiftId),
    staleTime: 5 * 60_000,
  });

  const institutionId = institutions.data?.[0]?.id;

  const shiftProgrammes = useQuery({
    queryKey: ['course-master', 'shift-programmes', shiftId, institutionId],
    queryFn: () => fetchShiftProgrammes(shiftId!, institutionId),
    enabled: Boolean(isShiftFiltered && shiftId),
    staleTime: 5 * 60_000,
  });

  const shiftDepartments = useQuery({
    queryKey: ['course-master', 'shift-departments', shiftId, institutionId],
    queryFn: () => fetchShiftDepartments(shiftId!, institutionId),
    enabled: Boolean(isShiftFiltered && shiftId),
    staleTime: 5 * 60_000,
  });

  const allowedVersionIds = useMemo(() => {
    if (!isShiftFiltered) return null;
    const ids = new Set<string>();
    for (const row of shiftProgrammes.data ?? []) {
      if (!row.enabled) continue;
      for (const versionId of row.publishedVersionIds) ids.add(versionId);
    }
    return ids;
  }, [isShiftFiltered, shiftProgrammes.data]);

  const scopedProgramVersions = useMemo(() => {
    if (!allowedVersionIds) return programVersions;
    return programVersions.filter((pv) => allowedVersionIds.has(pv.id));
  }, [allowedVersionIds, programVersions]);

  const allowedDepartmentIds = useMemo(() => {
    if (!isShiftFiltered) return null;
    return new Set(
      (shiftDepartments.data ?? []).filter((row) => row.enabled).map((row) => row.departmentId),
    );
  }, [isShiftFiltered, shiftDepartments.data]);

  const filterDepartments = (departments: Department[]) => {
    if (!allowedDepartmentIds) return departments;
    return departments.filter((d) => allowedDepartmentIds.has(d.id));
  };

  const scopeLabel = useMemo(() => {
    if (!isShiftFiltered) return null;
    const shiftName = shiftScope.activeShiftName ?? shiftScope.activeShiftCode ?? 'Shift';
    const programmeCodes = (shiftProgrammes.data ?? [])
      .filter((p) => p.enabled)
      .map((p) => p.code)
      .join(', ');
    return programmeCodes
      ? `${shiftName} workspace — programmes: ${programmeCodes}. Course Master is read-only; global edits require Institution workspace.`
      : `${shiftName} workspace — Course Master is read-only; global edits require Institution workspace.`;
  }, [
    isShiftFiltered,
    shiftProgrammes.data,
    shiftScope.activeShiftCode,
    shiftScope.activeShiftName,
  ]);

  return {
    canEditCourseMaster,
    isShiftFiltered,
    shiftId,
    institutionScoped,
    scopedProgramVersions,
    filterDepartments,
    allowAllProgrammes: !isShiftFiltered,
    scopeLabel,
    shiftScopeLoading: shiftProgrammes.isLoading || shiftDepartments.isLoading,
  };
}
