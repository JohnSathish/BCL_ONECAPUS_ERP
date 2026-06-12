'use client';

import { RefreshCw, RotateCcw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  fetchAcademicYears,
  fetchCampuses,
  fetchAcademicDepartments,
} from '@/services/organization';
import { fetchPrograms } from '@/services/programs';
import { fetchShifts } from '@/services/shifts';
import { useDashboardFilters, useDashboardFiltersStore } from '@/store/dashboard-filters-store';
import { cn } from '@/utils/cn';
import { formatDisplayDateTime } from '@/utils/format-date';

type Props = {
  lastUpdated?: string;
  onRefresh: () => void;
  isRefreshing?: boolean;
};

const selectClass =
  'h-9 min-w-0 rounded-lg border border-border/80 bg-background px-2 text-xs text-foreground';

export function DashboardFilterBar({ lastUpdated, onRefresh, isRefreshing }: Props) {
  const filters = useDashboardFilters();
  const autoRefresh = useDashboardFiltersStore((s) => s.autoRefresh);
  const setFilter = useDashboardFiltersStore((s) => s.setFilter);
  const setFilters = useDashboardFiltersStore((s) => s.setFilters);
  const resetFilters = useDashboardFiltersStore((s) => s.resetFilters);
  const setAutoRefresh = useDashboardFiltersStore((s) => s.setAutoRefresh);

  const campuses = useQuery({ queryKey: ['org', 'campuses'], queryFn: () => fetchCampuses() });
  const years = useQuery({ queryKey: ['org', 'years'], queryFn: fetchAcademicYears });
  const departments = useQuery({
    queryKey: ['org', 'departments', 'academic', filters.campusId],
    queryFn: () => fetchAcademicDepartments({ campusId: filters.campusId || undefined }),
  });
  const programs = useQuery({ queryKey: ['programs', 1], queryFn: () => fetchPrograms(1) });
  const shifts = useQuery({
    queryKey: ['shifts', filters.campusId],
    queryFn: () => fetchShifts({ campusId: filters.campusId }),
  });

  const semesters = useMemo(() => {
    const year = years.data?.find((y) => y.id === filters.academicYearId);
    return year?.semesters ?? [];
  }, [years.data, filters.academicYearId]);

  const programVersions = useMemo(
    () =>
      (programs.data?.data ?? []).flatMap((p) =>
        (p.versions ?? []).map((v) => ({
          id: v.id,
          label: `${p.code} v${v.version}`,
        })),
      ),
    [programs.data],
  );

  return (
    <div className="rounded-2xl border border-border/60 bg-card/95 p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Analytics filters</h2>
          <p className="text-xs text-muted-foreground">
            Scope all widgets ·{' '}
            {lastUpdated ? `Updated ${formatDisplayDateTime(lastUpdated)}` : '—'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-border"
            />
            Auto-refresh
          </label>
          <Button type="button" variant="outline" size="sm" onClick={() => resetFilters()}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            Reset
          </Button>
          <Button type="button" size="sm" onClick={onRefresh} disabled={isRefreshing}>
            <RefreshCw className={cn('mr-1 h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <select
          className={selectClass}
          value={filters.campusId ?? ''}
          onChange={(e) => setFilter('campusId', e.target.value || undefined)}
        >
          <option value="">All campuses</option>
          {(campuses.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          className={selectClass}
          value={filters.academicYearId ?? ''}
          onChange={(e) =>
            setFilters({
              academicYearId: e.target.value || undefined,
              semesterId: undefined,
            })
          }
        >
          <option value="">Academic year</option>
          {(years.data ?? []).map((y) => (
            <option key={y.id} value={y.id}>
              {y.name}
            </option>
          ))}
        </select>

        <select
          className={selectClass}
          value={filters.semesterId ?? ''}
          onChange={(e) => setFilter('semesterId', e.target.value || undefined)}
          disabled={!filters.academicYearId}
        >
          <option value="">Semester</option>
          {semesters.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          className={selectClass}
          value={filters.shiftId ?? ''}
          onChange={(e) => setFilter('shiftId', e.target.value || undefined)}
        >
          <option value="">All shifts</option>
          {(shifts.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.code}
            </option>
          ))}
        </select>

        <select
          className={selectClass}
          value={filters.departmentId ?? ''}
          onChange={(e) => setFilter('departmentId', e.target.value || undefined)}
        >
          <option value="">Department</option>
          {(departments.data ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.code}
            </option>
          ))}
        </select>

        <select
          className={selectClass}
          value={filters.programVersionId ?? ''}
          onChange={(e) => setFilter('programVersionId', e.target.value || undefined)}
        >
          <option value="">Programme</option>
          {programVersions.map((pv) => (
            <option key={pv.id} value={pv.id}>
              {pv.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
