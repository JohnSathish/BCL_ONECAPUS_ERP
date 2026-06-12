'use client';

import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import type { DirectoryFilters } from '@/components/students-module/directory/directory-filter-bar';
import { buildBulkUpdateScope } from '@/services/student-bulk-update';

export const BULK_UPDATE_STEPS = [
  'Scope',
  'Select',
  'Fields',
  'Values',
  'Preview',
  'Result',
] as const;

export type BulkUpdateStep = (typeof BULK_UPDATE_STEPS)[number];

const emptyFilters: DirectoryFilters = {
  search: '',
  programVersionId: '',
  shiftId: '',
  batchId: '',
  semester: '',
  streamId: '',
  admissionStatus: '',
  academicStatus: '',
  departmentId: '',
  sessionId: '',
  categoryLookupId: '',
  religionLookupId: '',
  differentlyAbled: '',
  studentStatus: '',
  admissionType: '',
  uiSubjectPending: '',
  uiFeeDue: '',
  uiHostel: '',
  uiRfidAssigned: '',
  uiAttendanceShortage: '',
  uiRecentlyAdded: '',
};

export function useBulkUpdateWizard() {
  const searchParams = useSearchParams();
  const [stepIndex, setStepIndex] = useState(0);
  const [scopeMode, setScopeMode] = useState<'selection' | 'filters'>('selection');
  const [filters, setFilters] = useState<DirectoryFilters>(() => ({
    ...emptyFilters,
    programVersionId: searchParams.get('programVersionId') ?? '',
    batchId: searchParams.get('batchId') ?? '',
    shiftId: searchParams.get('shiftId') ?? '',
    semester: searchParams.get('semester') ?? '',
  }));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    const raw = searchParams.get('studentIds');
    return new Set(raw ? raw.split(',').filter(Boolean) : []);
  });
  const [fieldKeys, setFieldKeys] = useState<string[]>([]);
  const [updateMode, setUpdateMode] = useState<'REPLACE' | 'APPEND' | 'CSV'>('REPLACE');
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [allowVtcOverride, setAllowVtcOverride] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<{
    async?: boolean;
    applied?: number;
    errors?: number;
    total?: number;
    message?: string;
  } | null>(null);

  const step = BULK_UPDATE_STEPS[stepIndex] ?? 'Scope';

  const scope = useMemo(
    () => buildBulkUpdateScope(selectedIds, filters, scopeMode === 'filters'),
    [selectedIds, filters, scopeMode],
  );

  const patchFilters = useCallback((patch: Partial<DirectoryFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
  }, []);

  const toggleStudent = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setPageSelection = useCallback((ids: string[], selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (selected) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const next = useCallback(() => {
    setStepIndex((i) => Math.min(i + 1, BULK_UPDATE_STEPS.length - 1));
  }, []);

  const back = useCallback(() => {
    setStepIndex((i) => Math.max(i - 1, 0));
  }, []);

  const goTo = useCallback((index: number) => {
    setStepIndex(Math.max(0, Math.min(index, BULK_UPDATE_STEPS.length - 1)));
  }, []);

  return {
    step,
    stepIndex,
    scopeMode,
    setScopeMode,
    filters,
    patchFilters,
    selectedIds,
    toggleStudent,
    setPageSelection,
    clearSelection,
    fieldKeys,
    setFieldKeys,
    updateMode,
    setUpdateMode,
    values,
    setValues,
    csvRows,
    setCsvRows,
    allowVtcOverride,
    setAllowVtcOverride,
    scope,
    batchId,
    setBatchId,
    applyResult,
    setApplyResult,
    next,
    back,
    goTo,
  };
}

export type BulkUpdateWizardState = ReturnType<typeof useBulkUpdateWizard>;
