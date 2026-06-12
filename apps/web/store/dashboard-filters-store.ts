'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type { DashboardFilters } from '@/types/dashboard-analytics';

type DashboardFiltersState = DashboardFilters & {
  autoRefresh: boolean;
  setFilter: <K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K]) => void;
  setFilters: (partial: Partial<DashboardFilters>) => void;
  resetFilters: () => void;
  setAutoRefresh: (enabled: boolean) => void;
};

const defaults: DashboardFilters = {
  campusId: undefined,
  institutionId: undefined,
  academicYearId: undefined,
  semesterId: undefined,
  shiftId: undefined,
  departmentId: undefined,
  programVersionId: undefined,
};

export const useDashboardFiltersStore = create<DashboardFiltersState>()(
  persist(
    (set) => ({
      ...defaults,
      autoRefresh: true,
      setFilter: (key, value) => set({ [key]: value || undefined }),
      setFilters: (partial) => set((s) => ({ ...s, ...partial })),
      resetFilters: () => set({ ...defaults }),
      setAutoRefresh: (autoRefresh) => set({ autoRefresh }),
    }),
    { name: 'onecampus-dashboard-filters' },
  ),
);

export function selectDashboardFilters(state: DashboardFiltersState): DashboardFilters {
  return {
    academicYearId: state.academicYearId,
    semesterId: state.semesterId,
    shiftId: state.shiftId,
    departmentId: state.departmentId,
    programVersionId: state.programVersionId,
    campusId: state.campusId,
    institutionId: state.institutionId,
  };
}

/** Stable filter slice for React Query keys (avoids infinite re-render loop). */
export function useDashboardFilters(): DashboardFilters {
  return useDashboardFiltersStore(useShallow(selectDashboardFilters));
}
