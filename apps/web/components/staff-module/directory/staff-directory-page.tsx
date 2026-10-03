'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ChevronRight, RefreshCw } from 'lucide-react';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { DirectoryPagination } from '@/components/students-module/directory/directory-pagination';
import { DirectoryShell } from '@/components/students-module/directory/ui/directory-shell';
import {
  DirectoryKpiSkeleton,
  DirectoryTableSkeleton,
} from '@/components/students-module/directory/ui/directory-skeleton';
import {
  DEFAULT_STAFF_COLUMNS,
  STAFF_COLUMNS,
  readStoredStaffColumns,
  writeStoredStaffColumns,
  type StaffColumnId,
} from '@/components/staff-module/directory/staff-columns';
import { StaffCompactToolbar } from '@/components/staff-module/directory/staff-compact-toolbar';
import { StaffDirectoryTable } from '@/components/staff-module/directory/staff-directory-table';
import { StaffInsights } from '@/components/staff-module/directory/staff-insights';
import { StaffKpiStrip } from '@/components/staff-module/directory/staff-kpi-strip';
import {
  applyClientSideStaffFilters,
  emptyStaffFilters,
  staffFiltersToParams,
  type StaffDirectoryFilters,
} from '@/components/staff-module/directory/staff-filter-utils';
import { QueryErrorPanel } from '@/components/erp/query-error-panel';
import { Button } from '@/components/ui/button';
import { useInstitutionBranding } from '@/hooks/use-institution-branding';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useRequireAuth, useAuthQueryEnabled } from '@/hooks/use-auth';
import { useStaffPermissions } from '@/hooks/use-staff-permissions';
import { toShiftOptions } from '@/lib/shift-options';
import { fetchCycleDashboard } from '@/services/academic-lifecycle';
import { fetchDepartments, fetchCampuses, fetchInstitutions } from '@/services/organization';
import {
  downloadStaffImportTemplate,
  exportStaffCsv,
  fetchAcademicRoles,
  fetchAllStaff,
  fetchDesignations,
  fetchEnhancedStaffSummary,
  fetchStaff,
} from '@/services/staff';
import { fetchShifts } from '@/services/shifts';
import { apiErrorMessage } from '@/utils/api-error';

const PAGE_SIZE_KEY = 'staff-directory-page-size';
const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];
const DEFAULT_LIMIT = 50;

function readStoredPageSize() {
  if (typeof window === 'undefined') return DEFAULT_LIMIT;
  const raw = Number(localStorage.getItem(PAGE_SIZE_KEY));
  return PAGE_SIZE_OPTIONS.includes(raw) ? raw : DEFAULT_LIMIT;
}

function formatSynced(updatedAt: number) {
  if (!updatedAt) return 'Not synced yet';
  const minutes = Math.max(0, Math.round((Date.now() - updatedAt) / 60000));
  if (minutes < 1) return 'Last synced: just now';
  if (minutes === 1) return 'Last synced: 1 min ago';
  return `Last synced: ${minutes} min ago`;
}

export function StaffDirectoryPage() {
  const session = useRequireAuth();
  const authReady = useAuthQueryEnabled();
  const perms = useStaffPermissions();
  const [filters, setFilters] = useState<StaffDirectoryFilters>(emptyStaffFilters());
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [visibleColumns, setVisibleColumns] = useState<StaffColumnId[]>(DEFAULT_STAFF_COLUMNS);
  const { branding } = useInstitutionBranding();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');

  useEffect(() => {
    setLimit(readStoredPageSize());
    setVisibleColumns(readStoredStaffColumns());
  }, []);

  const toggleColumn = (id: StaffColumnId) => {
    setVisibleColumns((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      const ordered = STAFF_COLUMNS.map((column) => column.id).filter(
        (item) => next.includes(item) || item === 'staff' || item === 'actions',
      );
      writeStoredStaffColumns(ordered);
      return ordered;
    });
  };

  useEffect(() => {
    setFilters((f) => (f.search === debouncedSearch ? f : { ...f, search: debouncedSearch }));
    setPage(1);
    setSelectedIds(new Set());
  }, [debouncedSearch]);

  const institutions = useQuery({
    queryKey: ['org', 'institutions'],
    queryFn: fetchInstitutions,
    enabled: authReady,
  });
  const institutionId = institutions.data?.[0]?.id ?? '';

  const campuses = useQuery({
    queryKey: ['org', 'campuses', institutionId],
    queryFn: () => fetchCampuses(institutionId || undefined),
    enabled: authReady && Boolean(institutionId),
  });
  const campusId = campuses.data?.[0]?.id ?? '';

  const summary = useQuery({
    queryKey: ['staff', 'summary', 'enhanced'],
    queryFn: fetchEnhancedStaffSummary,
    enabled: authReady && perms.canRead,
  });

  const cycle = useQuery({
    queryKey: ['academic-lifecycle', 'dashboard', institutionId, 'staff-directory'],
    queryFn: () => fetchCycleDashboard(institutionId),
    enabled: authReady && Boolean(institutionId),
    staleTime: 60_000,
  });

  const insights = useQuery({
    queryKey: ['staff', 'directory-insights'],
    queryFn: () => fetchAllStaff(),
    enabled:
      authReady &&
      perms.canRead &&
      (summary.data?.total ?? 0) > 0 &&
      (summary.data?.total ?? 0) <= 1500,
    staleTime: 5 * 60_000,
  });

  const listParams = useMemo(
    () => staffFiltersToParams(filters, page, limit),
    [filters, page, limit],
  );

  const staffList = useQuery({
    queryKey: ['staff', 'list', listParams],
    queryFn: () => fetchStaff(listParams),
    enabled: authReady && perms.canRead,
  });

  const shifts = useQuery({
    queryKey: ['shifts', campusId, 'ACTIVE'],
    queryFn: () => fetchShifts({ campusId, status: 'ACTIVE' }),
    enabled: authReady && Boolean(campusId),
  });

  const departments = useQuery({
    queryKey: ['org', 'departments'],
    queryFn: () => fetchDepartments(),
    enabled: authReady,
  });

  const designations = useQuery({
    queryKey: ['staff', 'designations'],
    queryFn: () => fetchDesignations(),
    enabled: authReady,
  });

  const academicRoles = useQuery({
    queryKey: ['staff', 'academic-roles'],
    queryFn: fetchAcademicRoles,
    enabled: authReady,
  });

  const shiftOptions = useMemo(() => toShiftOptions(shifts.data ?? []), [shifts.data]);

  const departmentOptions = useMemo(
    () =>
      (departments.data ?? []).map((d) => ({
        id: d.id,
        label: d.name,
      })),
    [departments.data],
  );

  const designationOptions = useMemo(
    () =>
      (designations.data ?? []).map((d) => ({
        id: d.id,
        label: d.label,
      })),
    [designations.data],
  );

  const academicRoleOptions = useMemo(
    () =>
      (academicRoles.data ?? []).map((r) => ({
        id: r.code,
        label: r.label,
      })),
    [academicRoles.data],
  );

  const exportMut = useMutation({
    mutationFn: async (ids?: string[]) => {
      const { page: _p, limit: _l, ...exportParams } = staffFiltersToParams(filters, 1, 10_000);
      const blob = await exportStaffCsv({
        ...exportParams,
        ...(ids?.length ? { ids: ids.join(',') } : {}),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = ids?.length ? 'staff_selected_export.csv' : 'staff_export.csv';
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Export failed')),
  });

  const handleFilterChange = (patch: Partial<StaffDirectoryFilters>) => {
    if ('search' in patch && patch.search !== undefined) {
      setSearchInput(patch.search);
    }
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
    setSelectedIds(new Set());
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setFilters(emptyStaffFilters());
    setPage(1);
    setSelectedIds(new Set());
  };

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const rawRows = staffList.data?.data ?? [];
  const displayRows = useMemo(
    () => applyClientSideStaffFilters(rawRows, filters),
    [rawRows, filters],
  );

  const toggleAll = (checked: boolean) => {
    if (!checked) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(displayRows.map((r) => r.id)));
  };

  if (!session) return null;

  if (!perms.canRead) {
    return (
      <DashboardShell role="admin" title="Staff Directory">
        <QueryErrorPanel
          title="Access denied"
          message="You do not have permission to view staff records."
        />
      </DashboardShell>
    );
  }

  const meta = staffList.data?.meta ?? { page: 1, limit, total: 0, totalPages: 0 };
  const hasUiOnlyFilter = Boolean(
    filters.uiPortalPending ||
    filters.uiNoSubjects ||
    filters.uiOnLeave ||
    filters.uiNoRfid ||
    filters.uiNoDepartment,
  );
  const collegeTotal = summary.data?.total ?? meta.total;

  return (
    <DashboardShell role="admin" title="Staff Management" pageHeader={false}>
      <DirectoryShell className="space-y-3 pb-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {institutions.data?.[0]?.name ?? branding?.displayName ?? 'College'}
              </span>
              {cycle.data?.primarySession?.name ? (
                <>
                  <ChevronRight className="h-3.5 w-3.5" />
                  <span>{cycle.data.primarySession.name}</span>
                </>
              ) : null}
              {cycle.data?.currentCycle ? (
                <>
                  <ChevronRight className="h-3.5 w-3.5" />
                  <span>
                    {cycle.data.currentCycle === 'EVEN' ? 'Even Semester' : 'Odd Semester'}
                  </span>
                </>
              ) : null}
              {cycle.data?.primarySession?.status === 'ACTIVE' ? (
                <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  Active
                </span>
              ) : null}
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Staff Management</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage teaching, non-teaching, administrative and visiting staff •{' '}
              {collegeTotal.toLocaleString('en-IN')} staff members
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{formatSynced(staffList.dataUpdatedAt || summary.dataUpdatedAt)}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={staffList.isFetching}
              onClick={() => {
                void staffList.refetch();
                void summary.refetch();
                void insights.refetch();
              }}
            >
              <RefreshCw
                className={`mr-1.5 h-3.5 w-3.5 ${staffList.isFetching ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
          </div>
        </div>

        {summary.isLoading ? (
          <DirectoryKpiSkeleton />
        ) : (
          <StaffKpiStrip
            summary={summary.data}
            filters={filters}
            onFilterChange={handleFilterChange}
          />
        )}

        <StaffInsights
          summary={summary.data}
          rows={insights.data?.data ?? []}
          loading={insights.isFetching && !insights.data}
          filters={filters}
          onFilterChange={handleFilterChange}
        />

        <StaffCompactToolbar
          filters={filters}
          totalCount={hasUiOnlyFilter ? displayRows.length : meta.total}
          search={searchInput}
          onSearchChange={setSearchInput}
          searchLoading={staffList.isFetching && Boolean(debouncedSearch)}
          onFilterChange={handleFilterChange}
          onResetFilters={handleResetFilters}
          departmentOptions={departmentOptions}
          designationOptions={designationOptions}
          academicRoleOptions={academicRoleOptions}
          shiftOptions={shiftOptions}
          canManage={perms.canManage}
          canExport={perms.canExport}
          canImport={perms.canImport}
          canBulkUpdate={perms.canBulkUpdate}
          onDownloadTemplate={() => {
            void downloadStaffImportTemplate().then((blob) => {
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'Staff_Import_Template.xlsx';
              a.click();
              URL.revokeObjectURL(url);
            });
          }}
          selectedIds={selectedIds}
          onExport={() => exportMut.mutate(undefined)}
          onExportSelected={
            selectedIds.size > 0 ? () => exportMut.mutate([...selectedIds]) : undefined
          }
          exportPending={exportMut.isPending}
          visibleColumns={visibleColumns}
          onToggleColumn={toggleColumn}
        />

        {message ? <p className="glass-card rounded-lg px-2.5 py-1.5 text-xs">{message}</p> : null}

        {hasUiOnlyFilter ? (
          <p className="text-[11px] text-muted-foreground">
            Client-side filter active on current page — refine server filters where available.
          </p>
        ) : null}

        {staffList.isLoading ? (
          <DirectoryTableSkeleton rows={10} />
        ) : staffList.isError ? (
          <QueryErrorPanel
            title="Unable to load staff directory"
            error={staffList.error}
            onRetry={() => void staffList.refetch()}
            isRetrying={staffList.isFetching}
          />
        ) : (
          <>
            <StaffDirectoryTable
              rows={displayRows}
              selectedIds={selectedIds}
              onToggleRow={toggleRow}
              onToggleAll={toggleAll}
              visibleColumns={visibleColumns}
              canManage={perms.canManage}
            />
            <div className="md:hidden space-y-2">
              {displayRows.map((row) => (
                <Link
                  key={row.id}
                  href={`/admin/staff/${row.id}`}
                  className="glass-card block rounded-xl border border-border/50 p-3 text-xs"
                >
                  <p className="font-medium">{row.fullName}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {row.employeeCode} · {row.department ?? 'No department'}
                  </p>
                </Link>
              ))}
            </div>
            <DirectoryPagination
              meta={meta}
              onPageChange={(p) => {
                setPage(p);
                setSelectedIds(new Set());
              }}
              onLimitChange={(l) => {
                setLimit(l);
                localStorage.setItem(PAGE_SIZE_KEY, String(l));
                setPage(1);
                setSelectedIds(new Set());
              }}
            />
          </>
        )}
      </DirectoryShell>
    </DashboardShell>
  );
}
