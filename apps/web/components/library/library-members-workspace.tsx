'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Ban,
  Download,
  GraduationCap,
  Printer,
  RefreshCw,
  Search,
  Star,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react';

import { QueryErrorPanel } from '@/components/erp/query-error-panel';
import { printLibraryMemberCards } from '@/components/library/library-member-cards';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  libraryFilterControlClass,
  libraryFilterLabelClass,
  librarySearchButtonClass,
  librarySearchInputClass,
  librarySearchPanelClass,
} from '@/components/library/library-search-panel';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useBranding } from '@/hooks/use-branding';
import { usePermissions } from '@/hooks/use-permissions';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import {
  blockLibraryMember,
  bulkLibraryMembers,
  downloadLibraryMemberRegister,
  fetchLibraryMemberDetail,
  fetchLibraryMemberSummaryCards,
  fetchLibraryMembers,
  syncLibraryMembers,
  unblockLibraryMember,
  updateLibraryMemberPrivileges,
} from '@/services/library';
import type { LibraryMemberListItem } from '@/types/library';
import { apiErrorMessage } from '@/utils/api-error';

const TABS = [
  ['ALL', 'All members', 'all'],
  ['STUDENT', 'Students', 'students'],
  ['FACULTY', 'Teaching staff', 'faculty'],
  ['STAFF', 'Non-teaching', 'staff'],
  ['RESEARCH_SCHOLAR', 'Research scholars', 'researchScholars'],
  ['INACTIVE', 'Inactive', 'inactive'],
  ['BLOCKED', 'Blocked', 'blocked'],
] as const;

const BLOCK_REASONS = [
  ['OVERDUE', 'Overdue books'],
  ['UNPAID_FINES', 'Unpaid fines'],
  ['LOST_BOOKS', 'Lost books'],
  ['DAMAGED_BOOKS', 'Damaged books'],
  ['DISCIPLINARY', 'Disciplinary reasons'],
  ['ADMINISTRATIVE', 'Administrative decision'],
  ['OTHER', 'Other'],
] as const;

type TabId = (typeof TABS)[number][0];
type SortKey = 'name' | 'department' | 'loans' | 'fines' | 'score';

type Filters = {
  tab: TabId;
  search: string;
  departmentId: string;
  academicYear: string;
  semester: string;
  status: string;
  hasOverdue: boolean;
  hasFine: boolean;
  hasActiveLoans: boolean;
  hasBorrowed: boolean;
  sort: SortKey;
  sortDir: 'asc' | 'desc';
  page: number;
  limit: number;
};

const initialFilters: Filters = {
  tab: 'ALL',
  search: '',
  departmentId: '',
  academicYear: '',
  semester: '',
  status: '',
  hasOverdue: false,
  hasFine: false,
  hasActiveLoans: false,
  hasBorrowed: false,
  sort: 'name',
  sortDir: 'asc',
  page: 1,
  limit: 10,
};

function paramsOf(filters: Filters, search: string) {
  return {
    tab: filters.tab,
    search: search || undefined,
    departmentId: filters.departmentId || undefined,
    academicYear: filters.academicYear || undefined,
    semester: filters.semester || undefined,
    status: filters.status || undefined,
    hasOverdue: filters.hasOverdue ? 'true' : undefined,
    hasFine: filters.hasFine ? 'true' : undefined,
    hasActiveLoans: filters.hasActiveLoans ? 'true' : undefined,
    hasBorrowed: filters.hasBorrowed ? 'true' : undefined,
    sort: filters.sort,
    sortDir: filters.sortDir,
    page: filters.page,
    limit: filters.limit,
  };
}

export function LibraryMembersWorkspace() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const { canAny } = usePermissions();
  const branding = useBranding();
  const canManage = canAny('library:manage');
  const [draftSearch, setDraftSearch] = useState('');
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selected, setSelected] = useState<LibraryMemberListItem | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [panel, setPanel] = useState<'overview' | 'loans' | 'fines' | 'activity' | 'settings'>(
    'overview',
  );
  const [fullLoans, setFullLoans] = useState(false);
  const [notice, setNotice] = useState('');
  const [syncOpen, setSyncOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockReason, setBlockReason] = useState('OVERDUE');
  const [blockNote, setBlockNote] = useState('');
  const [unblockReason, setUnblockReason] = useState('');
  const [bulkAction, setBulkAction] = useState<'ACTIVATE' | 'BLOCK' | 'EXPIRY' | null>(null);
  const [bulkReason, setBulkReason] = useState('ADMINISTRATIVE');
  const [bulkExpiry, setBulkExpiry] = useState('');

  const summary = useQuery({
    queryKey: ['library', 'members', 'summary'],
    queryFn: fetchLibraryMemberSummaryCards,
    enabled,
  });
  const listParams = paramsOf(filters, appliedSearch);
  const members = useQuery({
    queryKey: ['library', 'members', 'list', listParams],
    queryFn: () => fetchLibraryMembers(listParams),
    enabled,
  });
  const detail = useQuery({
    queryKey: ['library', 'members', 'detail', selected?.memberId, selected?.memberType, fullLoans],
    queryFn: () =>
      fetchLibraryMemberDetail(
        selected!.memberId,
        selected!.memberType,
        fullLoans ? 'all' : 'recent',
      ),
    enabled: enabled && Boolean(selected),
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['library', 'members'] });
  };

  const sync = useMutation({
    mutationFn: syncLibraryMembers,
    onSuccess: (result) => {
      setNotice(
        `Sync finished. ${result.createdCount} created, ${result.updatedCount} updated, ${result.skippedCount} unchanged${result.failedCount ? `, ${result.failedCount} failed` : ''}.`,
      );
      refresh();
    },
    onError: (error) => setNotice(apiErrorMessage(error)),
  });

  const block = useMutation({
    mutationFn: () =>
      blockLibraryMember(selected!.memberId, {
        memberType: selected!.memberType,
        reason: blockReason,
        note: blockNote || undefined,
      }),
    onSuccess: () => {
      setBlockOpen(false);
      setNotice('Borrowing is blocked. Existing loans and history stay on the record.');
      refresh();
    },
    onError: (error) => setNotice(apiErrorMessage(error)),
  });

  const unblock = useMutation({
    mutationFn: () =>
      unblockLibraryMember(selected!.memberId, {
        memberType: selected!.memberType,
        reason: unblockReason.trim(),
      }),
    onSuccess: () => {
      setUnblockReason('');
      setNotice('Block removed. The college record still decides active or inactive.');
      refresh();
    },
    onError: (error) => setNotice(apiErrorMessage(error)),
  });

  const privileges = useMutation({
    mutationFn: (payload: {
      loanLimit: number | null;
      loanDays: number | null;
      maxRenewals: number | null;
      fineExempt: boolean;
      expiresAt: string | null;
    }) =>
      updateLibraryMemberPrivileges(selected!.memberId, {
        memberType: selected!.memberType,
        ...payload,
      }),
    onSuccess: () => {
      setNotice('Individual borrowing limits saved. College circulation rules are unchanged.');
      refresh();
    },
    onError: (error) => setNotice(apiErrorMessage(error)),
  });

  const bulk = useMutation({
    mutationFn: bulkLibraryMembers,
    onSuccess: (result) => {
      if ('createdCount' in result) {
        setNotice(
          `Selected records synced. ${result.createdCount} created, ${result.updatedCount} updated, ${result.skippedCount} unchanged.`,
        );
      } else {
        setNotice(
          result.failed.length
            ? `${result.processed} updated. ${result.failed.length} could not be updated.`
            : `${result.processed} members updated.`,
        );
      }
      setChecked([]);
      setBulkAction(null);
      refresh();
    },
    onError: (error) => setNotice(apiErrorMessage(error)),
  });

  const rows = members.data?.items ?? [];
  const checkedRows = rows.filter((row) => checked.includes(keyOf(row)));
  const pageCount = Math.max(1, Math.ceil((members.data?.total ?? 0) / filters.limit));
  const cards = useMemo(() => summary.data, [summary.data]);

  function applySearch() {
    setAppliedSearch(draftSearch.trim());
    setFilters((current) => ({ ...current, page: 1 }));
    setChecked([]);
  }

  function setCard(next: Partial<Filters>) {
    setFilters({ ...initialFilters, limit: filters.limit, ...next, page: 1 });
    setDraftSearch('');
    setAppliedSearch('');
    setChecked([]);
  }

  function toggleSort(sort: SortKey) {
    setFilters((current) => ({
      ...current,
      sort,
      sortDir: current.sort === sort && current.sortDir === 'asc' ? 'desc' : 'asc',
      page: 1,
    }));
  }

  async function exportRegister(format: 'csv' | 'xlsx' | 'pdf') {
    try {
      const blob = await downloadLibraryMemberRegister(format, listParams);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `library-members.${format === 'xlsx' ? 'xlsx' : format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setNotice(apiErrorMessage(error));
    }
  }

  function printCards(people: LibraryMemberListItem[]) {
    printLibraryMemberCards({
      collegeName: branding.displayName || 'College',
      logoUrl: resolveUploadAssetUrl(branding.logo),
      cards: people.map((person) => ({
        fullName: person.fullName,
        code: person.libraryCardNumber || person.registrationNumber || person.memberId,
        department: person.department,
        memberType: person.memberType,
        photoUrl: resolveUploadAssetUrl(person.photoPath),
        expiresAt: person.expiresAt,
      })),
    });
  }

  function exportChecked() {
    const lines = [
      [
        'Name',
        'Member ID',
        'Type',
        'Department',
        'Active loans',
        'Overdue',
        'Fine',
        'Score',
        'Status',
      ],
      ...checkedRows.map((row) => [
        row.fullName,
        row.registrationNumber ?? '',
        row.memberType,
        row.department ?? '',
        String(row.activeLoans),
        String(row.overdueLoans ?? 0),
        String(row.outstandingFine),
        String(row.readingScore),
        row.status ?? '',
      ]),
    ];
    const blob = new Blob([lines.map((line) => line.map(csvCell).join(',')).join('\r\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'selected-library-members.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  const profile = detail.data?.profile;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Library Members</h1>
          <p className="text-sm text-slate-500">
            Students and staff from the college records, with library loans, fines, and borrowing
            limits.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setSyncOpen((open) => !open)}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Import from Students & Staff
          </Button>
          <Button variant="outline" onClick={() => void exportRegister('csv')}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {notice ? (
        <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          {notice}
        </p>
      ) : null}

      {syncOpen ? (
        <SyncPanel
          lastSync={cards?.lastSync ?? null}
          busy={sync.isPending}
          canManage={canManage}
          onSync={(scope) => sync.mutate(scope)}
        />
      ) : null}

      {summary.isError ? (
        <QueryErrorPanel
          title="Unable to load member totals"
          error={summary.error}
          onRetry={() => void summary.refetch()}
          isRetrying={summary.isFetching}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Users}
            label="Total members"
            value={cards?.total}
            hint="Students and staff on record"
            onClick={() => setCard({ tab: 'ALL' })}
          />
          <StatCard
            icon={GraduationCap}
            label="Active students"
            value={cards?.activeStudents}
            hint="Studying, not blocked"
            onClick={() => setCard({ tab: 'STUDENT', status: 'ACTIVE' })}
          />
          <StatCard
            icon={UserRound}
            label="Teaching staff"
            value={cards?.activeFaculty}
            hint="Active teaching staff"
            onClick={() => setCard({ tab: 'FACULTY', status: 'ACTIVE' })}
          />
          <StatCard
            icon={Users}
            label="Non-teaching"
            value={cards?.activeStaff}
            hint="Other active staff"
            onClick={() => setCard({ tab: 'STAFF', status: 'ACTIVE' })}
          />
          <StatCard
            icon={Ban}
            label="Blocked"
            value={cards?.blocked}
            hint="Borrowing stopped by the library"
            onClick={() => setCard({ tab: 'BLOCKED' })}
          />
          <StatCard
            icon={AlertTriangle}
            label="Overdue books"
            value={cards?.overdueMembers}
            hint="Members with a book past its due date"
            onClick={() => setCard({ hasOverdue: true })}
          />
          <StatCard
            icon={Wallet}
            label="Outstanding fines"
            value={cards?.fineMembers}
            hint="Unpaid library fines"
            onClick={() => setCard({ hasFine: true })}
          />
          <StatCard
            icon={Star}
            label="Readers"
            value={cards?.readers}
            hint="Borrowed at least one book"
            onClick={() => setCard({ hasBorrowed: true, sort: 'score', sortDir: 'desc' })}
          />
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto border-b pb-2">
        {TABS.map(([id, label, countKey]) => (
          <button
            key={id}
            type="button"
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${
              filters.tab === id ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
            onClick={() => setCard({ tab: id })}
          >
            {label}
            {cards ? ` (${cards.tabs[countKey]})` : ''}
          </button>
        ))}
      </div>

      <div className={librarySearchPanelClass}>
        <div className="flex flex-wrap items-end gap-4">
          <label className={`min-w-[240px] flex-1 ${libraryFilterLabelClass}`}>
            Search
            <div className="relative mt-1.5">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <Input
                className={librarySearchInputClass}
                placeholder="Name, enrolment, staff ID, email, phone, card"
                value={draftSearch}
                onChange={(event) => setDraftSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') applySearch();
                }}
              />
            </div>
          </label>
          <label className={`min-w-[160px] ${libraryFilterLabelClass}`}>
            Department
            <select
              className={`mt-1.5 ${libraryFilterControlClass}`}
              value={filters.departmentId}
              onChange={(event) =>
                setFilters((current) => ({ ...current, departmentId: event.target.value, page: 1 }))
              }
            >
              <option value="">All departments</option>
              {cards?.departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
          <label className={`min-w-[140px] ${libraryFilterLabelClass}`}>
            Status
            <select
              className={`mt-1.5 ${libraryFilterControlClass}`}
              value={filters.status}
              onChange={(event) =>
                setFilters((current) => ({ ...current, status: event.target.value, page: 1 }))
              }
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="BLOCKED">Blocked</option>
            </select>
          </label>
          <label className={`min-w-[140px] ${libraryFilterLabelClass}`}>
            Entry year
            <select
              className={`mt-1.5 ${libraryFilterControlClass}`}
              value={filters.academicYear}
              onChange={(event) =>
                setFilters((current) => ({ ...current, academicYear: event.target.value, page: 1 }))
              }
            >
              <option value="">All entry years</option>
              {cards?.academicYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
          <label className={`min-w-[140px] ${libraryFilterLabelClass}`}>
            Semester
            <select
              className={`mt-1.5 ${libraryFilterControlClass}`}
              value={filters.semester}
              onChange={(event) =>
                setFilters((current) => ({ ...current, semester: event.target.value, page: 1 }))
              }
            >
              <option value="">All semesters</option>
              {cards?.semesters.map((semester) => (
                <option key={semester} value={semester}>
                  Semester {semester}
                </option>
              ))}
            </select>
          </label>
          <Button className={librarySearchButtonClass} onClick={applySearch}>
            <Search className="mr-2 h-4 w-4" />
            Search
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setFilters(initialFilters);
              setDraftSearch('');
              setAppliedSearch('');
              setChecked([]);
            }}
          >
            Clear
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold text-[#0B1F44]">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filters.hasOverdue}
              onChange={(event) =>
                setFilters((current) => ({ ...current, hasOverdue: event.target.checked, page: 1 }))
              }
            />
            Overdue books
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filters.hasFine}
              onChange={(event) =>
                setFilters((current) => ({ ...current, hasFine: event.target.checked, page: 1 }))
              }
            />
            Outstanding fines
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filters.hasActiveLoans}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  hasActiveLoans: event.target.checked,
                  page: 1,
                }))
              }
            />
            Books currently issued
          </label>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={() => void exportRegister('xlsx')}>
              Excel
            </Button>
            <Button size="sm" variant="outline" onClick={() => void exportRegister('pdf')}>
              PDF
            </Button>
          </div>
        </div>
      </div>

      {checkedRows.length && canManage ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-slate-50 px-3 py-2 text-sm">
          <span>{checkedRows.length} selected on this page</span>
          <Button size="sm" variant="outline" onClick={() => setBulkAction('ACTIVATE')}>
            Clear block
          </Button>
          <Button size="sm" variant="outline" onClick={() => setBulkAction('BLOCK')}>
            Block
          </Button>
          <Button size="sm" variant="outline" onClick={() => setBulkAction('EXPIRY')}>
            Set expiry
          </Button>
          <Button size="sm" variant="outline" onClick={exportChecked}>
            Export selected
          </Button>
          <Button size="sm" variant="outline" onClick={() => printCards(checkedRows)}>
            <Printer className="mr-1 h-3.5 w-3.5" />
            Print cards
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={bulk.isPending}
            onClick={() =>
              bulk.mutate({
                action: 'SYNC',
                members: checkedRows.map((row) => ({
                  memberId: row.memberId,
                  memberType: row.memberType,
                })),
              })
            }
          >
            Sync selected
          </Button>
        </div>
      ) : null}

      {bulkAction ? (
        <div className="rounded-lg border p-3 text-sm">
          <p className="font-medium">
            {bulkAction === 'BLOCK'
              ? 'Block selected members'
              : bulkAction === 'EXPIRY'
                ? 'Set membership expiry'
                : 'Remove the library block'}
          </p>
          {bulkAction === 'BLOCK' ? (
            <select
              className="mt-2 h-9 rounded-md border px-2"
              value={bulkReason}
              onChange={(event) => setBulkReason(event.target.value)}
            >
              {BLOCK_REASONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          ) : null}
          {bulkAction === 'EXPIRY' ? (
            <Input
              className="mt-2 max-w-xs"
              type="date"
              value={bulkExpiry}
              onChange={(event) => setBulkExpiry(event.target.value)}
            />
          ) : null}
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              disabled={bulk.isPending}
              onClick={() =>
                bulk.mutate({
                  action: bulkAction,
                  reason: bulkAction === 'BLOCK' ? bulkReason : 'Bulk activate',
                  expiresAt: bulkAction === 'EXPIRY' ? bulkExpiry || null : undefined,
                  members: checkedRows.map((row) => ({
                    memberId: row.memberId,
                    memberType: row.memberType,
                  })),
                })
              }
            >
              Confirm
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBulkAction(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {members.isError ? (
        <QueryErrorPanel
          title="Unable to load library members"
          error={members.error}
          onRetry={() => void members.refetch()}
          isRetrying={members.isFetching}
        />
      ) : (
        <div className={`grid gap-4 ${selected ? 'xl:grid-cols-[minmax(0,1fr)_380px]' : ''}`}>
          <div className="overflow-hidden rounded-xl border bg-white">
            <div className="max-h-[36rem] overflow-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="p-2">
                      <input
                        type="checkbox"
                        checked={
                          rows.length > 0 && rows.every((row) => checked.includes(keyOf(row)))
                        }
                        onChange={(event) =>
                          setChecked(event.target.checked ? rows.map(keyOf) : [])
                        }
                      />
                    </th>
                    <th className="p-2">#</th>
                    <th className="p-2">
                      <SortButton label="Member" onClick={() => toggleSort('name')} />
                    </th>
                    <th className="p-2">Type</th>
                    <th className="p-2">
                      <SortButton label="Department" onClick={() => toggleSort('department')} />
                    </th>
                    <th className="p-2 text-right">
                      <SortButton label="Loans" onClick={() => toggleSort('loans')} />
                    </th>
                    <th className="p-2 text-right">Overdue</th>
                    <th className="p-2 text-right">
                      <SortButton label="Fine" onClick={() => toggleSort('fines')} />
                    </th>
                    <th className="p-2 text-right">
                      <SortButton label="Score" onClick={() => toggleSort('score')} />
                    </th>
                    <th className="p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {members.isLoading
                    ? Array.from({ length: 6 }, (_, index) => (
                        <tr key={index} className="border-t">
                          <td colSpan={10} className="p-3">
                            <div className="h-8 animate-pulse rounded bg-slate-100" />
                          </td>
                        </tr>
                      ))
                    : rows.map((row, index) => (
                        <tr
                          key={keyOf(row)}
                          className={`cursor-pointer border-t hover:bg-slate-50 ${
                            row.overdueLoans ? 'bg-rose-50/60' : ''
                          } ${selected?.memberId === row.memberId ? 'bg-sky-50' : ''}`}
                          onClick={() => {
                            setSelected(row);
                            setPanel('overview');
                            setFullLoans(false);
                            setBlockOpen(false);
                          }}
                        >
                          <td className="p-2" onClick={(event) => event.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={checked.includes(keyOf(row))}
                              onChange={(event) =>
                                setChecked((current) =>
                                  event.target.checked
                                    ? [...current, keyOf(row)]
                                    : current.filter((item) => item !== keyOf(row)),
                                )
                              }
                            />
                          </td>
                          <td className="p-2 text-slate-500">
                            {(filters.page - 1) * filters.limit + index + 1}
                          </td>
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              <Avatar name={row.fullName} photo={row.photoPath} />
                              <div>
                                <p className="font-medium text-slate-900">{row.fullName}</p>
                                <p className="text-xs text-slate-500">
                                  {row.registrationNumber || 'No ID'}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="p-2">
                            <TypeBadge type={row.memberType} />
                          </td>
                          <td className="p-2">{row.department || '—'}</td>
                          <td className="p-2 text-right">{row.activeLoans}</td>
                          <td
                            className={`p-2 text-right ${row.overdueLoans ? 'font-medium text-rose-600' : ''}`}
                          >
                            {row.overdueLoans ?? 0}
                          </td>
                          <td className="p-2 text-right">{money(row.outstandingFine)}</td>
                          <td className="p-2 text-right">{row.readingScore}</td>
                          <td className="p-2">
                            <StatusBadge status={row.status || 'ACTIVE'} />
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
              {!members.isLoading && !rows.length ? (
                <p className="p-8 text-center text-sm text-slate-500">
                  No members match these filters.
                </p>
              ) : null}
            </div>
            <div className="flex items-center justify-between border-t px-3 py-2 text-sm text-slate-500">
              <span>
                Showing {rows.length ? (filters.page - 1) * filters.limit + 1 : 0}–
                {(filters.page - 1) * filters.limit + rows.length} of {members.data?.total ?? 0}
              </span>
              <div className="flex items-center gap-2">
                <select
                  className="h-8 rounded border px-2"
                  value={filters.limit}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      limit: Number(event.target.value),
                      page: 1,
                    }))
                  }
                >
                  {[10, 20, 50].map((size) => (
                    <option key={size} value={size}>
                      {size} / page
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={filters.page <= 1}
                  onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}
                >
                  Previous
                </Button>
                <span>
                  {filters.page} / {pageCount}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={filters.page >= pageCount}
                  onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>

          {selected ? (
            <aside className="rounded-xl border bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <Avatar
                    name={profile?.fullName || selected.fullName}
                    photo={profile?.photoPath || selected.photoPath}
                    large
                  />
                  <div>
                    <p className="font-semibold">{profile?.fullName || selected.fullName}</p>
                    <p className="text-xs text-slate-500">
                      {profile?.registrationNumber || selected.registrationNumber}
                    </p>
                    <StatusBadge status={profile?.status || selected.status || 'ACTIVE'} />
                  </div>
                </div>
                <button
                  type="button"
                  className="text-sm text-slate-500"
                  onClick={() => setSelected(null)}
                >
                  Close
                </button>
              </div>
              {detail.isError ? (
                <QueryErrorPanel
                  title="Unable to load this member"
                  error={detail.error}
                  onRetry={() => void detail.refetch()}
                  isRetrying={detail.isFetching}
                />
              ) : detail.isLoading || !detail.data || !profile ? (
                <div className="mt-4 h-40 animate-pulse rounded bg-slate-100" />
              ) : (
                <>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {(['overview', 'loans', 'fines', 'activity', 'settings'] as const).map(
                      (item) => (
                        <button
                          key={item}
                          type="button"
                          className={`rounded-full px-2.5 py-1 text-xs capitalize ${panel === item ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}
                          onClick={() => setPanel(item)}
                        >
                          {item === 'loans' ? `Loans (${detail.data.stats.activeLoans})` : item}
                        </button>
                      ),
                    )}
                  </div>
                  {panel === 'overview' ? (
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <Field label="Type" value={profile.memberType.replaceAll('_', ' ')} />
                      <Field label="Department" value={profile.department || '—'} />
                      <Field
                        label="Course"
                        value={profile.programme || profile.designation || '—'}
                      />
                      <Field
                        label="Semester"
                        value={profile.semester ? String(profile.semester) : '—'}
                      />
                      <Field label="Entry year" value={profile.academicYear || '—'} />
                      <Field label="Email" value={profile.email || '—'} />
                      <Field label="Phone" value={profile.phone || '—'} />
                      <Field label="On record since" value={dateLabel(profile.recordCreatedAt)} />
                      <Field
                        label="Library record"
                        value={
                          profile.membershipSince
                            ? dateLabel(profile.membershipSince)
                            : 'Not synced yet'
                        }
                      />
                      <Field label="Active loans" value={`${detail.data.stats.activeLoans}`} />
                      <Field label="Overdue" value={`${detail.data.stats.overdueLoans}`} />
                      <Field label="Fine due" value={money(detail.data.stats.outstandingFine)} />
                    </dl>
                  ) : null}
                  {panel === 'loans' ? (
                    <div className="mt-3 space-y-2 text-sm">
                      {detail.data.recentLoans.map((loan) => (
                        <div key={loan.id} className="rounded border px-2 py-1.5">
                          <p className="font-medium">{loan.title}</p>
                          <p className="text-xs text-slate-500">
                            {loan.accessionNo} · issued {dateLabel(loan.issuedAt)} · due{' '}
                            {dateLabel(loan.dueAt)}
                            {loan.returnedAt ? ` · returned ${dateLabel(loan.returnedAt)}` : ''}
                            {loan.renewalCount ? ` · renewed ${loan.renewalCount}` : ''}
                            {loan.overdue ? ' · overdue' : ''}
                          </p>
                        </div>
                      ))}
                      {!detail.data.recentLoans.length ? (
                        <p className="text-slate-500">No loans on record.</p>
                      ) : null}
                      {detail.data.loansTruncated ? (
                        <Button size="sm" variant="outline" onClick={() => setFullLoans(true)}>
                          View borrowing history
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                  {panel === 'fines' ? (
                    <div className="mt-3 space-y-2 text-sm">
                      <p>
                        Pending {money(detail.data.stats.outstandingFine)} · Paid{' '}
                        {money(detail.data.stats.paidFine)} · Waived{' '}
                        {money(detail.data.stats.waivedFine)}
                      </p>
                      {detail.data.fines.map((fine) => (
                        <div key={fine.id} className="rounded border px-2 py-1.5">
                          <p className="font-medium">
                            {fine.title} · {money(fine.amount)} · {fine.status}
                          </p>
                          <p className="text-xs text-slate-500">
                            {fine.reason || 'Library fine'}
                            {fine.paidAt ? ` · paid ${dateLabel(fine.paidAt)}` : ''}
                            {fine.waiveReason ? ` · waived: ${fine.waiveReason}` : ''}
                          </p>
                        </div>
                      ))}
                      {!detail.data.fines.length ? (
                        <p className="text-slate-500">No fines on record.</p>
                      ) : null}
                    </div>
                  ) : null}
                  {panel === 'activity' ? (
                    <div className="mt-3 space-y-2 text-sm">
                      <p>
                        Borrowed {detail.data.stats.loanCount} · Visits{' '}
                        {detail.data.stats.visitCount} · Score {detail.data.stats.readingScore}
                      </p>
                      <p className="text-xs text-slate-500">
                        Score uses visits (up to 40), loans (up to 30), on-time returns (up to 20),
                        and 10 points while the membership is active.
                      </p>
                      {detail.data.subjects.map((subject) => (
                        <p key={subject.subject}>
                          {subject.subject}: {subject.count}
                        </p>
                      ))}
                      {detail.data.monthlyLoans.map((month) => (
                        <p key={month.month}>
                          {month.month}: {month.count} issued
                        </p>
                      ))}
                      {detail.data.events.map((event) => (
                        <p key={event.id} className="text-xs text-slate-600">
                          {dateLabel(event.createdAt)} · {event.action}
                          {event.reason ? ` · ${event.reason}` : ''}
                          {event.actor ? ` · ${event.actor}` : ''}
                        </p>
                      ))}
                    </div>
                  ) : null}
                  {panel === 'settings' ? (
                    <SettingsForm
                      key={profile.memberId}
                      profile={profile}
                      defaults={detail.data.roleDefaults}
                      canManage={canManage}
                      blockedBy={detail.data.blockedBy}
                      busy={privileges.isPending || block.isPending || unblock.isPending}
                      blockOpen={blockOpen}
                      blockReason={blockReason}
                      blockNote={blockNote}
                      unblockReason={unblockReason}
                      onBlockReason={setBlockReason}
                      onBlockNote={setBlockNote}
                      onUnblockReason={setUnblockReason}
                      onOpenBlock={() => setBlockOpen(true)}
                      onBlock={() => block.mutate()}
                      onUnblock={() => unblock.mutate()}
                      onSave={(payload) => privileges.mutate(payload)}
                      onPrint={() => printCards([profile])}
                    />
                  ) : null}
                </>
              )}
            </aside>
          ) : null}
        </div>
      )}
    </div>
  );
}

function SyncPanel({
  lastSync,
  busy,
  canManage,
  onSync,
}: {
  lastSync: {
    scope: string;
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
    failedCount: number;
    errors: unknown;
    completedAt: string | null;
  } | null;
  busy: boolean;
  canManage: boolean;
  onSync: (scope: 'ALL' | 'STUDENTS' | 'FACULTY' | 'STAFF') => void;
}) {
  const errors = Array.isArray(lastSync?.errors) ? lastSync.errors : [];
  return (
    <div className="rounded-xl border bg-white p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">Synchronise library membership</p>
          <p className="text-slate-500">
            {lastSync?.completedAt
              ? `Last sync ${new Date(lastSync.completedAt).toLocaleString()} · ${lastSync.createdCount} new, ${lastSync.updatedCount} updated, ${lastSync.skippedCount} unchanged, ${lastSync.failedCount} failed.`
              : 'No sync has been recorded yet. The list already shows current student and staff records.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['STUDENTS', 'Students'],
              ['FACULTY', 'Teaching staff'],
              ['STAFF', 'Non-teaching'],
              ['ALL', 'Sync all'],
            ] as const
          ).map(([scope, label]) => (
            <Button
              key={scope}
              size="sm"
              variant={scope === 'ALL' ? 'default' : 'outline'}
              disabled={!canManage || busy}
              onClick={() => onSync(scope)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        A daily job also refreshes membership status. Sync never copies a second student profile and
        does not remove a block or a personal loan limit. New students appear in this list as soon
        as they are on the college record.
      </p>
      {errors.length ? (
        <ul className="mt-2 list-disc pl-5 text-rose-700">
          {errors.slice(0, 5).map((error, index) => (
            <li key={index}>
              {typeof error === 'object' && error && 'message' in error
                ? String(error.message)
                : 'Sync error'}
            </li>
          ))}
        </ul>
      ) : null}
      {!canManage ? (
        <p className="mt-2 text-xs text-slate-500">
          Library manage permission is required to run a sync.
        </p>
      ) : null}
    </div>
  );
}

function SettingsForm({
  profile,
  defaults,
  canManage,
  blockedBy,
  busy,
  blockOpen,
  blockReason,
  blockNote,
  unblockReason,
  onBlockReason,
  onBlockNote,
  onUnblockReason,
  onOpenBlock,
  onBlock,
  onUnblock,
  onSave,
  onPrint,
}: {
  profile: LibraryMemberListItem;
  defaults: { loanDays: number; maxBooks: number; maxRenewals: number } | null;
  canManage: boolean;
  blockedBy: string | null;
  busy: boolean;
  blockOpen: boolean;
  blockReason: string;
  blockNote: string;
  unblockReason: string;
  onBlockReason: (value: string) => void;
  onBlockNote: (value: string) => void;
  onUnblockReason: (value: string) => void;
  onOpenBlock: () => void;
  onBlock: () => void;
  onUnblock: () => void;
  onSave: (payload: {
    loanLimit: number | null;
    loanDays: number | null;
    maxRenewals: number | null;
    fineExempt: boolean;
    expiresAt: string | null;
  }) => void;
  onPrint: () => void;
}) {
  const [loanLimit, setLoanLimit] = useState(profile.loanLimit?.toString() ?? '');
  const [loanDays, setLoanDays] = useState(profile.loanDays?.toString() ?? '');
  const [maxRenewals, setMaxRenewals] = useState(profile.maxRenewals?.toString() ?? '');
  const [fineExempt, setFineExempt] = useState(Boolean(profile.fineExempt));
  const [expiresAt, setExpiresAt] = useState(profile.expiresAt?.slice(0, 10) ?? '');
  return (
    <div className="mt-3 space-y-3 text-sm">
      <p className="text-xs text-slate-500">
        College default
        {defaults
          ? `: ${defaults.maxBooks} books, ${defaults.loanDays} working days, ${defaults.maxRenewals} renewals`
          : ''}
        . Empty fields follow that default. Reference and rare books still use their own rules.
      </p>
      <label className="block">
        Loan limit
        <input
          className="mt-1 h-9 w-full rounded border px-2"
          value={loanLimit}
          onChange={(event) => setLoanLimit(event.target.value)}
          disabled={!canManage}
        />
      </label>
      <label className="block">
        Working days
        <input
          className="mt-1 h-9 w-full rounded border px-2"
          value={loanDays}
          onChange={(event) => setLoanDays(event.target.value)}
          disabled={!canManage}
        />
      </label>
      <label className="block">
        Maximum renewals
        <input
          className="mt-1 h-9 w-full rounded border px-2"
          value={maxRenewals}
          onChange={(event) => setMaxRenewals(event.target.value)}
          disabled={!canManage}
        />
      </label>
      <label className="block">
        Expiry
        <input
          className="mt-1 h-9 w-full rounded border px-2"
          type="date"
          value={expiresAt}
          onChange={(event) => setExpiresAt(event.target.value)}
          disabled={!canManage}
        />
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={fineExempt}
          onChange={(event) => setFineExempt(event.target.checked)}
          disabled={!canManage}
        />
        Exempt unpaid fines from blocking issue
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={!canManage || busy}
          onClick={() =>
            onSave({
              loanLimit: loanLimit.trim() ? Number(loanLimit) : null,
              loanDays: loanDays.trim() ? Number(loanDays) : null,
              maxRenewals: maxRenewals.trim() ? Number(maxRenewals) : null,
              fineExempt,
              expiresAt: expiresAt || null,
            })
          }
        >
          Save limits
        </Button>
        <Button size="sm" variant="outline" onClick={onPrint}>
          Print card
        </Button>
      </div>
      {profile.status === 'BLOCKED' ? (
        <div className="rounded border border-rose-200 p-2">
          <p>
            Blocked {dateLabel(profile.blockedAt)}
            {profile.blockReason ? ` · ${profile.blockReason.replaceAll('_', ' ')}` : ''}
            {blockedBy ? ` · ${blockedBy}` : ''}
          </p>
          {profile.blockNote ? <p className="text-xs text-slate-500">{profile.blockNote}</p> : null}
          <Input
            className="mt-2"
            placeholder="Reason for removing the block"
            value={unblockReason}
            onChange={(event) => onUnblockReason(event.target.value)}
          />
          <Button
            className="mt-2"
            size="sm"
            variant="outline"
            disabled={!canManage || busy || !unblockReason.trim()}
            onClick={onUnblock}
          >
            Unblock
          </Button>
        </div>
      ) : (
        <div>
          {blockOpen ? (
            <div className="space-y-2 rounded border p-2">
              <select
                className="h-9 w-full rounded border px-2"
                value={blockReason}
                onChange={(event) => onBlockReason(event.target.value)}
              >
                {BLOCK_REASONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <Input
                placeholder="Internal note"
                value={blockNote}
                onChange={(event) => onBlockNote(event.target.value)}
              />
              <Button size="sm" disabled={!canManage || busy} onClick={onBlock}>
                Confirm block
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" disabled={!canManage} onClick={onOpenBlock}>
              Block borrowing
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  onClick,
}: {
  icon: typeof Users;
  label: string;
  value?: number;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border bg-white p-3 text-left shadow-sm hover:border-sky-300"
    >
      <div className="flex items-center gap-2 text-slate-500">
        <Icon className="h-4 w-4" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value ?? '—'}</p>
      <p className="text-xs text-slate-500">{hint}</p>
    </button>
  );
}

function Avatar({ name, photo, large }: { name: string; photo?: string | null; large?: boolean }) {
  const src = resolveUploadAssetUrl(photo);
  const size = large ? 'h-12 w-12' : 'h-8 w-8';
  if (src) return <img src={src} alt="" className={`${size} rounded-full object-cover`} />;
  return (
    <div
      className={`${size} flex items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700`}
    >
      {name.slice(0, 1)}
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const tone =
    type === 'FACULTY'
      ? 'bg-violet-100 text-violet-800'
      : type === 'STAFF'
        ? 'bg-amber-100 text-amber-800'
        : type === 'RESEARCH_SCHOLAR'
          ? 'bg-teal-100 text-teal-800'
          : 'bg-sky-100 text-sky-800';
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${tone}`}>{type.replaceAll('_', ' ')}</span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'BLOCKED'
      ? 'bg-rose-100 text-rose-700'
      : status === 'INACTIVE'
        ? 'bg-slate-200 text-slate-700'
        : 'bg-emerald-100 text-emerald-700';
  return <span className={`rounded-full px-2 py-0.5 text-xs ${tone}`}>{status}</span>;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="truncate">{value}</dd>
    </div>
  );
}

function SortButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="uppercase" onClick={onClick}>
      {label}
    </button>
  );
}

function money(amount: number) {
  return `₹${Math.round(amount)}`;
}

function dateLabel(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}

function keyOf(row: LibraryMemberListItem) {
  return `${row.memberType}:${row.memberId}`;
}

function csvCell(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
