'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Settings2 } from 'lucide-react';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { DirectoryAdvancedFiltersDrawer } from '@/components/students-module/directory/directory-advanced-filters-drawer';
import { DirectoryCompactToolbar } from '@/components/students-module/directory/directory-compact-toolbar';
import { DirectoryFloatingBulkBar } from '@/components/students-module/directory/directory-floating-bulk-bar';
import { DirectoryKpiStrip } from '@/components/students-module/directory/directory-kpi-strip';
import { DirectoryMobileList } from '@/components/students-module/directory/directory-mobile-list';
import { DirectoryPagination } from '@/components/students-module/directory/directory-pagination';
import {
  DirectoryTable,
  shouldVirtualizeDirectory,
} from '@/components/students-module/directory/directory-table';
import { QuickAddDrawer } from '@/components/students-module/directory/quick-add-drawer';
import { StudentQuickProfileDrawer } from '@/components/students-module/directory/student-quick-profile-drawer';
import { DirectoryShell } from '@/components/students-module/directory/ui/directory-shell';
import {
  DirectoryKpiSkeleton,
  DirectoryTableSkeleton,
} from '@/components/students-module/directory/ui/directory-skeleton';
import type { DirectoryFilters } from '@/components/students-module/directory/directory-filter-bar';
import { Button } from '@/components/ui/button';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useRequireAuth, useAuthQueryEnabled } from '@/hooks/use-auth';
import { useStudentPermissions } from '@/hooks/use-student-permissions';
import { toShiftOptions } from '@/lib/shift-options';
import { fetchAcademicStreams } from '@/services/academic-engine';
import { fetchAdmissionBatches, listAcademicSessions } from '@/services/academic-lifecycle';
import {
  fetchAcademicDepartments,
  fetchCampuses,
  fetchInstitutions,
} from '@/services/organization';
import { fetchPrograms } from '@/services/programs';
import { fetchShifts } from '@/services/shifts';
import {
  admitStudent,
  exportStudentsCsv,
  fetchEnhancedStudentsSummary,
  fetchMasterLookups,
  fetchStudents,
} from '@/services/students';
import type { AdmitStudentPayload, StudentDirectoryRow, StudentProfile } from '@/types/students';
import { apiErrorMessage } from '@/utils/api-error';
import { isRetryableQueryError } from '@/lib/http/api-error-types';

export { DirectoryCommandBar } from '@/components/students-module/directory/directory-command-bar';
export {
  DirectoryFilterBar,
  type DirectoryFilters,
} from '@/components/students-module/directory/directory-filter-bar';
export { DirectoryPagination } from '@/components/students-module/directory/directory-pagination';
export { DirectoryTable } from '@/components/students-module/directory/directory-table';
export { QuickAddDrawer } from '@/components/students-module/directory/quick-add-drawer';

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
  uiNoPhoto: '',
  uiNoMobile: '',
  uiAbcStatus: '',
};

const DEFAULT_LIMIT = 25;

function filtersToParams(filters: DirectoryFilters, page: number, limit: number) {
  const opt = (v: string) => v || undefined;
  return {
    page,
    limit,
    search: opt(filters.search),
    programVersionId: opt(filters.programVersionId),
    shiftId: opt(filters.shiftId),
    batchId: opt(filters.batchId),
    semester: opt(filters.semester),
    streamId: opt(filters.streamId),
    departmentId: opt(filters.departmentId),
    sessionId: opt(filters.sessionId),
    categoryLookupId: opt(filters.categoryLookupId),
    religionLookupId: opt(filters.religionLookupId),
    differentlyAbled: opt(filters.differentlyAbled),
    studentStatus: opt(filters.studentStatus),
    admissionType: opt(filters.admissionType),
    admissionStatus: opt(filters.admissionStatus),
    academicStatus: opt(filters.academicStatus),
    feeDue: filters.uiFeeDue === 'true' ? 'true' : undefined,
    hostel: filters.uiHostel === 'true' ? 'true' : undefined,
    attendanceShortage: filters.uiAttendanceShortage === 'true' ? 'true' : undefined,
    subjectPending: filters.uiSubjectPending === 'true' ? 'true' : undefined,
    rfidAssigned: filters.uiRfidAssigned || undefined,
    noPhoto: filters.uiNoPhoto === 'true' ? 'true' : undefined,
    noMobile: filters.uiNoMobile === 'true' ? 'true' : undefined,
    recentlyAdded: filters.uiRecentlyAdded === 'true' ? 'true' : undefined,
    abcStatus: filters.uiAbcStatus || undefined,
  };
}

function clearAdvancedFilters(filters: DirectoryFilters): DirectoryFilters {
  return {
    ...filters,
    streamId: '',
    departmentId: '',
    sessionId: '',
    categoryLookupId: '',
    religionLookupId: '',
    differentlyAbled: '',
    admissionType: '',
    academicStatus: '',
    admissionStatus: '',
    uiSubjectPending: '',
    uiFeeDue: '',
    uiHostel: '',
    uiRfidAssigned: '',
    uiAttendanceShortage: '',
    uiRecentlyAdded: '',
    uiNoPhoto: '',
    uiNoMobile: '',
    uiAbcStatus: '',
  };
}

export function StudentDirectoryPage() {
  const session = useRequireAuth();
  const authReady = useAuthQueryEnabled();
  const perms = useStudentPermissions();
  const qc = useQueryClient();
  const [filters, setFilters] = useState<DirectoryFilters>(emptyFilters);
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [admittedProfile, setAdmittedProfile] = useState<StudentProfile | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [profileRow, setProfileRow] = useState<StudentDirectoryRow | null>(null);
  const [message, setMessage] = useState('');

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
    queryKey: ['students', 'summary', 'enhanced'],
    queryFn: fetchEnhancedStudentsSummary,
    enabled: authReady && perms.canRead,
  });

  const listParams = useMemo(() => filtersToParams(filters, page, limit), [filters, page, limit]);

  const students = useQuery({
    queryKey: ['students', 'list', listParams],
    queryFn: () => fetchStudents(listParams),
    enabled: authReady && perms.canRead && institutions.isSuccess,
    retry: (count, error) => count < 1 && isRetryableQueryError(error),
  });

  const filtersReady = authReady && students.isSuccess;

  const programs = useQuery({
    queryKey: ['catalog', 'programs'],
    queryFn: () => fetchPrograms(1),
    enabled: filtersReady,
  });

  const shifts = useQuery({
    queryKey: ['shifts', campusId, 'ACTIVE'],
    queryFn: () => fetchShifts({ campusId, status: 'ACTIVE' }),
    enabled: filtersReady && Boolean(campusId),
  });

  const streams = useQuery({
    queryKey: ['academic-engine', 'streams'],
    queryFn: fetchAcademicStreams,
    enabled: filtersReady,
  });

  const batches = useQuery({
    queryKey: ['academic-lifecycle', 'batches', institutionId],
    queryFn: () => fetchAdmissionBatches(institutionId),
    enabled: filtersReady && Boolean(institutionId),
  });

  const sessions = useQuery({
    queryKey: ['academic-lifecycle', 'sessions', institutionId],
    queryFn: () => listAcademicSessions(institutionId),
    enabled: filtersReady && Boolean(institutionId),
  });

  const departments = useQuery({
    queryKey: ['org', 'departments', 'academic'],
    queryFn: () => fetchAcademicDepartments(),
    enabled: filtersReady,
  });

  const categories = useQuery({
    queryKey: ['master-lookups', 'CATEGORY'],
    queryFn: () => fetchMasterLookups('CATEGORY'),
    enabled: filtersReady,
  });

  const religions = useQuery({
    queryKey: ['master-lookups', 'RELIGION'],
    queryFn: () => fetchMasterLookups('RELIGION'),
    enabled: filtersReady,
  });

  const programVersions = useMemo(() => {
    const rows: { id: string; label: string }[] = [];
    for (const p of programs.data?.data ?? []) {
      for (const v of p.versions ?? []) {
        if (v.status === 'PUBLISHED') {
          rows.push({ id: v.id, label: `${p.code} v${v.version}` });
        }
      }
    }
    return rows;
  }, [programs.data]);

  const shiftOptions = useMemo(() => toShiftOptions(shifts.data ?? []), [shifts.data]);

  const batchOptions = useMemo(
    () =>
      (batches.data ?? []).map((b) => ({
        id: b.id,
        label: b.batchCode,
      })),
    [batches.data],
  );

  const streamOptions = useMemo(
    () =>
      (streams.data ?? []).map((s) => ({
        id: s.id,
        label: s.name,
      })),
    [streams.data],
  );

  const departmentOptions = useMemo(
    () =>
      (departments.data ?? []).map((d) => ({
        id: d.id,
        label: d.name,
      })),
    [departments.data],
  );

  const quickAddBatchOptions = useMemo(
    () =>
      (batches.data ?? []).map((b) => ({
        id: b.id,
        label: `${b.batchCode} (Sem ${b.currentSemester})`,
      })),
    [batches.data],
  );

  const sessionOptions = useMemo(
    () =>
      ((sessions.data as { id: string; name: string }[] | undefined) ?? []).map((s) => ({
        id: s.id,
        label: s.name,
      })),
    [sessions.data],
  );

  const categoryOptions = useMemo(
    () =>
      (categories.data ?? []).map((c) => ({
        id: c.id,
        label: c.label,
      })),
    [categories.data],
  );

  const religionOptions = useMemo(
    () =>
      (religions.data ?? []).map((c) => ({
        id: c.id,
        label: c.label,
      })),
    [religions.data],
  );

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['students'] });
  };

  const downloadCsv = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const admitMut = useMutation({
    mutationFn: (payload: AdmitStudentPayload) => admitStudent(payload),
    onSuccess: (profile) => {
      setAdmittedProfile(profile);
      setMessage('');
      invalidate();
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Admission failed')),
  });

  const exportMut = useMutation({
    mutationFn: async (ids?: string[]) => {
      const { page: _p, limit: _l, ...exportParams } = filtersToParams(filters, 1, 10_000);
      const blob = await exportStudentsCsv({
        ...exportParams,
        ...(ids?.length ? { ids: ids.join(',') } : {}),
      });
      downloadCsv(blob, ids?.length ? 'students_selected_export.csv' : 'students_export.csv');
    },
  });

  const handleFilterChange = (patch: Partial<DirectoryFilters>) => {
    if ('search' in patch && patch.search !== undefined) {
      setSearchInput(patch.search);
    }
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
    setSelectedIds(new Set());
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setFilters(emptyFilters);
    setPage(1);
    setSelectedIds(new Set());
  };

  const handleApplySavedView = (viewFilters: DirectoryFilters) => {
    setSearchInput(viewFilters.search ?? '');
    setFilters(viewFilters);
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

  const rawRows = students.data?.data ?? [];
  const displayRows = rawRows;

  const toggleAll = (checked: boolean) => {
    if (!checked) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(displayRows.map((r) => r.id)));
  };

  if (!session) return null;

  const meta = students.data?.meta ?? { page: 1, limit, total: 0, totalPages: 0 };
  const useVirtual = shouldVirtualizeDirectory(displayRows.length, limit);

  const openProfile = (row: StudentDirectoryRow) => setProfileRow(row);

  return (
    <DashboardShell role="admin" title="Student Records Management">
      <DirectoryShell className="flex h-[calc(100dvh-6.5rem)] flex-col gap-2 pb-2">
        <div className="shrink-0">
          <h1 className="text-lg font-bold tracking-tight">Student Records Management</h1>
          <p className="text-[11px] text-muted-foreground">
            Manage, search, track and update student records · {meta.total.toLocaleString()}{' '}
            students
          </p>
        </div>

        <div className="shrink-0">
          {summary.isLoading ? (
            <DirectoryKpiSkeleton />
          ) : (
            <DirectoryKpiStrip
              summary={summary.data}
              filters={filters}
              onFilterChange={handleFilterChange}
            />
          )}
        </div>

        <div className="shrink-0">
          <DirectoryCompactToolbar
            filters={filters}
            totalCount={meta.total}
            search={searchInput}
            onSearchChange={setSearchInput}
            searchLoading={students.isFetching && Boolean(debouncedSearch)}
            onFilterChange={handleFilterChange}
            onOpenAdvanced={() => setAdvancedOpen(true)}
            onResetFilters={handleResetFilters}
            onApplySavedView={handleApplySavedView}
            programOptions={programVersions}
            batchOptions={batchOptions}
            shiftOptions={shiftOptions}
            streamOptions={streamOptions}
            departmentOptions={departmentOptions}
            sessionOptions={sessionOptions}
            categoryOptions={categoryOptions}
            religionOptions={religionOptions}
            canManage={perms.canManage}
            canBulkUpdate={perms.canBulkUpdate}
            canManagePhotos={perms.canManagePhotos}
            canExport={perms.canExport}
            canImport={perms.canImport}
            selectedIds={selectedIds}
            onQuickAdd={() => {
              setAdmittedProfile(null);
              setQuickAddOpen(true);
            }}
            onExport={() => exportMut.mutate(undefined)}
            onExportSelected={
              selectedIds.size > 0 ? () => exportMut.mutate([...selectedIds]) : undefined
            }
            exportPending={exportMut.isPending}
          />
        </div>

        {message ? (
          <p className="glass-card shrink-0 rounded-lg px-2.5 py-1.5 text-xs">{message}</p>
        ) : null}

        <DirectoryAdvancedFiltersDrawer
          open={advancedOpen}
          onOpenChange={setAdvancedOpen}
          filters={filters}
          onChange={handleFilterChange}
          onResetAdvanced={() => handleFilterChange(clearAdvancedFilters(filters))}
          streamOptions={streamOptions}
          departmentOptions={departmentOptions}
          sessionOptions={sessionOptions}
          categoryOptions={categoryOptions}
          religionOptions={religionOptions}
        />

        <div className="flex min-h-0 flex-1 flex-col">
          {students.isLoading ? (
            <DirectoryTableSkeleton rows={10} className="min-h-0 flex-1" />
          ) : students.isError ? (
            <p className="py-8 text-center text-sm text-danger">
              {apiErrorMessage(students.error, 'Failed to load students')}
            </p>
          ) : (
            <>
              <DirectoryTable
                rows={displayRows}
                selectedIds={selectedIds}
                onToggleRow={toggleRow}
                onToggleAll={toggleAll}
                virtualize={useVirtual}
                onOpenProfile={openProfile}
                className="min-h-0 flex-1"
              />
              <DirectoryMobileList
                rows={displayRows}
                selectedIds={selectedIds}
                onToggleRow={toggleRow}
                onOpenProfile={openProfile}
              />
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
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="glass-card fixed bottom-6 right-4 z-30 rounded-full shadow-lg md:hidden"
          onClick={() => setAdvancedOpen(true)}
        >
          <Settings2 className="mr-1.5 h-4 w-4" />
          Filters
        </Button>

        <DirectoryFloatingBulkBar
          selectedIds={selectedIds}
          filters={filters}
          canManage={perms.canManage}
          canExport={perms.canExport}
          onExportSelected={
            selectedIds.size > 0 ? () => exportMut.mutate([...selectedIds]) : undefined
          }
          exportPending={exportMut.isPending}
          onClearSelection={() => setSelectedIds(new Set())}
        />

        <QuickAddDrawer
          open={quickAddOpen}
          onOpenChange={(open) => {
            setQuickAddOpen(open);
            if (!open) setAdmittedProfile(null);
          }}
          pending={admitMut.isPending}
          admittedProfile={admittedProfile}
          programOptions={programVersions}
          batchOptions={quickAddBatchOptions}
          streamOptions={streamOptions}
          shiftOptions={shiftOptions}
          onSubmit={(payload) => admitMut.mutate(payload)}
          onAdmitDone={() => setAdmittedProfile(null)}
        />

        <StudentQuickProfileDrawer
          row={profileRow}
          open={Boolean(profileRow)}
          onOpenChange={(open) => {
            if (!open) setProfileRow(null);
          }}
        />
      </DirectoryShell>
    </DashboardShell>
  );
}
