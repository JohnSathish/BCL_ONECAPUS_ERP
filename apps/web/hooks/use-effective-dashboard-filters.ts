'use client';

import { useEffect, useMemo } from 'react';
import { useShiftScope } from '@/hooks/use-shift-scope';
import { useDashboardFilters, useDashboardFiltersStore } from '@/store/dashboard-filters-store';
import type { DashboardFilters } from '@/types/dashboard-analytics';

/** Dashboard filter slice with workspace shift applied for API queries. */
export function useEffectiveDashboardFilters(): DashboardFilters {
  const filters = useDashboardFilters();
  const { hideShiftSelectors, activeShiftId } = useShiftScope();

  return useMemo(() => {
    if (hideShiftSelectors && activeShiftId) {
      return { ...filters, shiftId: activeShiftId };
    }
    return filters;
  }, [activeShiftId, filters, hideShiftSelectors]);
}

/** Keep persisted dashboard filters aligned with the active workspace shift. */
export function useSyncWorkspaceDashboardShift() {
  const shiftId = useDashboardFiltersStore((s) => s.shiftId);
  const setFilter = useDashboardFiltersStore((s) => s.setFilter);
  const { hideShiftSelectors, activeShiftId } = useShiftScope();

  useEffect(() => {
    if (hideShiftSelectors && activeShiftId && shiftId !== activeShiftId) {
      setFilter('shiftId', activeShiftId);
    }
  }, [activeShiftId, hideShiftSelectors, setFilter, shiftId]);
}
