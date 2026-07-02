'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useBindWorkspaceShift, useEffectiveShiftId } from '@/hooks/use-bind-workspace-shift';
import { useShiftScope } from '@/hooks/use-shift-scope';
import { fetchTimetableContext, fetchTimetablePlans } from '@/services/timetable';

type Options = {
  /** Load timetable context (streams, shifts, academic years). Default true. */
  loadContext?: boolean;
};

export function useTimetableWorkspaceFilters(options?: Options) {
  const loadContext = options?.loadContext ?? true;
  const authReady = useAuthQueryEnabled();
  const shiftScope = useShiftScope();

  const [shiftId, setShiftId] = useState('');
  const [streamId, setStreamId] = useState('');
  const [semesterMode, setSemesterMode] = useState<'ODD' | 'EVEN'>('ODD');
  const [academicYearId, setAcademicYearId] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');

  const bindShift = useCallback((id: string) => {
    setShiftId((current) => (current === id ? current : id));
  }, []);
  useBindWorkspaceShift(shiftId || undefined, bindShift);

  const effectiveShiftId = useEffectiveShiftId(shiftId || undefined);

  const contextQ = useQuery({
    queryKey: ['timetable', 'context'],
    queryFn: fetchTimetableContext,
    enabled: loadContext && authReady,
  });

  useEffect(() => {
    if (contextQ.data?.currentAcademicMode) {
      setSemesterMode(contextQ.data.currentAcademicMode);
    }
  }, [contextQ.data?.currentAcademicMode]);

  const plansQ = useQuery({
    queryKey: ['timetable', 'plans', effectiveShiftId, streamId, semesterMode],
    queryFn: () =>
      fetchTimetablePlans({
        shiftId: effectiveShiftId,
        streamId: streamId || undefined,
        semesterMode,
      }),
    enabled: authReady,
  });

  const plans = useMemo(() => plansQ.data ?? [], [plansQ.data]);

  useEffect(() => {
    if (!selectedPlanId) return;
    if (!plans.some((plan) => plan.id === selectedPlanId)) {
      setSelectedPlanId('');
    }
  }, [plans, selectedPlanId]);

  return {
    shiftId,
    setShiftId,
    effectiveShiftId,
    hideShiftFilter: shiftScope.hideShiftSelectors,
    workspaceShiftLabel: shiftScope.activeShiftName ?? shiftScope.activeShiftCode,
    streamId,
    setStreamId,
    semesterMode,
    setSemesterMode,
    academicYearId,
    setAcademicYearId,
    selectedPlanId,
    setSelectedPlanId,
    plans,
    plansQ,
    context: contextQ.data,
    contextQ,
  };
}
