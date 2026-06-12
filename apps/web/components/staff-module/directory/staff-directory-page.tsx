'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { DirectoryPagination } from '@/components/students-module/directory/directory-pagination';
import { DirectoryShell } from '@/components/students-module/directory/ui/directory-shell';
import {
  DirectoryKpiSkeleton,
  DirectoryTableSkeleton,
} from '@/components/students-module/directory/ui/directory-skeleton';
import { StaffCompactToolbar } from '@/components/staff-module/directory/staff-compact-toolbar';
import { StaffDirectoryTable } from '@/components/staff-module/directory/staff-directory-table';
import { StaffKpiStrip } from '@/components/staff-module/directory/staff-kpi-strip';
import {
  applyClientSideStaffFilters,
  emptyStaffFilters,
  staffFiltersToParams,
  type StaffDirectoryFilters,
} from '@/components/staff-module/directory/staff-filter-utils';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useRequireAuth } from '@/hooks/use-auth';
import { useStaffPermissions } from '@/hooks/use-staff-permissions';
import { toShiftOptions } from '@/lib/shift-options';
import { fetchDepartments, fetchCampuses, fetchInstitutions } from '@/services/organization';
import {
  downloadStaffImportTemplate,
  exportStaffCsv,
  fetchAcademicRoles,
  fetchDesignations,
  fetchEnhancedStaffSummary,
  fetchStaff,
} from '@/services/staff';
import { fetchShifts } from '@/services/shifts';
import { apiErrorMessage } from '@/utils/api-error';

const DEFAULT_LIMIT = 50;

export function StaffDirectoryPage() {
  const session = useRequireAuth();
  const perms = useStaffPermissions();
  const [filters, setFilters] = useState<StaffDirectoryFilters>(emptyStaffFilters());
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');

  useEffect(() => {
    setFilters((f) => (f.search === debouncedSearch ? f : { ...f, search: debouncedSearch }));
    setPage(1);
    setSelectedIds(new Set());
  }, [debouncedSearch]);

  const institutions = useQuery({
    queryKey: ['org', 'institutions'],
    queryFn: fetchInstitutions,
    enabled: Boolean(session),
  });
  const institutionId = institutions.data?.[0]?.id ?? '';

  const campuses = useQuery({
    queryKey: ['org', 'campuses', institutionId],
    queryFn: () => fetchCampuses(institutionId || undefined),
    enabled: Boolean(session) && Boolean(institutionId),
  });
  const campusId = campuses.data?.[0]?.id ?? '';

  const summary = useQuery({
    queryKey: ['staff', 'summary', 'enhanced'],
    queryFn: fetchEnhancedStaffSummary,
    enabled: Boolean(session) && perms.canRead,
  });

  const listParams = useMemo(
    () => staffFiltersToParams(filters, page, limit),
    [filters, page, limit],
  );

  const staffList = useQuery({
    queryKey: ['staff', 'list', listParams],
    queryFn: () => fetchStaff(listParams),
    enabled: Boolean(session) && perms.canRead,
  });

  const shifts = useQuery({
    queryKey: ['shifts', campusId, 'ACTIVE'],
    queryFn: () => fetchShifts({ campusId, status: 'ACTIVE' }),
    enabled: Boolean(session) && Boolean(campusId),
  });

  const departments = useQuery({
    queryKey: ['org', 'departments'],
    queryFn: () => fetchDepartments(),
    enabled: Boolean(session),
  });

  const designations = useQuery({
    queryKey: ['staff', 'designations'],
    queryFn: () => fetchDesignations(),
    enabled: Boolean(session),
  });

  const academicRoles = useQuery({
    queryKey: ['staff', 'academic-roles'],
    queryFn: fetchAcademicRoles,
    enabled: Boolean(session),
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
        <p className="text-sm text-muted-foreground">
          You do not have permission to view staff records.
        </p>
      </DashboardShell>
    );
  }

  const meta = staffList.data?.meta ?? { page: 1, limit, total: 0, totalPages: 0 };
  const hasUiOnlyFilter = Boolean(
    filters.uiPortalPending || filters.uiNoSubjects || filters.uiOnLeave,
  );

  return (
    <DashboardShell role="admin" title="Staff Directory">
      <DirectoryShell className="space-y-2 pb-12">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold tracking-tight">Staff Directory</h1>
            <p className="text-[11px] text-muted-foreground">
              Compact admin workspace · {meta.total.toLocaleString()} staff
            </p>
          </div>
          <Link href="/admin/staff/new" className="text-[11px] text-primary hover:underline">
            Add staff
          </Link>
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
          <p className="py-8 text-center text-sm text-danger">
            {apiErrorMessage(staffList.error, 'Failed to load staff')}
          </p>
        ) : (
          <>
            <StaffDirectoryTable
              rows={displayRows}
              selectedIds={selectedIds}
              onToggleRow={toggleRow}
              onToggleAll={toggleAll}
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
