'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  GraduationCap,
  MoreVertical,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Users,
} from 'lucide-react';

import { QueryErrorPanel } from '@/components/erp/query-error-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import {
  downloadEntryExitExport,
  fetchEntryExitFilters,
  fetchLibraryVisits,
  recordLibraryVisitExit,
  registerLibraryWalkIn,
} from '@/services/library';
import type { LibraryVisit } from '@/types/library';
import { apiErrorMessage } from '@/utils/api-error';
import { downloadBlob } from '@/utils/download-blob';
import { cn } from '@/utils/cn';

type Period = 'today' | 'week' | 'month' | 'custom';
type MemberFilter = 'ALL' | 'STUDENT' | 'FACULTY' | 'NON_TEACHING' | 'VISITOR';

type Filters = {
  period: Period;
  from: string;
  to: string;
  memberType: MemberFilter;
  departmentId: string;
  search: string;
  page: number;
  limit: number;
};

const EMPTY: Filters = {
  period: 'today',
  from: '',
  to: '',
  memberType: 'ALL',
  departmentId: '',
  search: '',
  page: 1,
  limit: 20,
};

function stamp(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function durationText(visit: LibraryVisit) {
  if (visit.status === 'REVIEW' || visit.durationMinutes == null) return '—';
  const minutes = visit.durationMinutes;
  const body = minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return visit.ongoing ? `${body} · ongoing` : body;
}

function typeLabel(memberType: string) {
  if (memberType === 'STUDENT') return 'Student';
  if (memberType === 'FACULTY') return 'Faculty';
  if (memberType === 'STAFF') return 'Non-Teaching Staff';
  if (memberType === 'VISITOR') return 'External Visitor';
  return memberType;
}

function initials(name?: string) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '•';
}

function delta(value: number | null) {
  if (value == null) return null;
  const sign = value > 0 ? '+' : '';
  return `${sign}${value}%`;
}

export function LibraryVisitsWorkspace() {
  const enabled = useAuthQueryEnabled();
  const { canAny } = usePermissions();
  const qc = useQueryClient();
  const [draft, setDraft] = useState(EMPTY);
  const [filters, setFilters] = useState(EMPTY);
  const [notice, setNotice] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [detail, setDetail] = useState<LibraryVisit | null>(null);
  const [walkIn, setWalkIn] = useState(false);
  const [form, setForm] = useState({ fullName: '', institution: '', mobile: '', purpose: '' });
  const [exporting, setExporting] = useState<'xlsx' | 'pdf' | null>(null);
  const canDesk = canAny('library:access-desk', 'library:manage', 'library:circulate');
  const canExport = canAny(
    'library:reports',
    'library:manage',
    'library:access-desk',
    'library:circulate',
  );
  const canSettings = canAny('library:settings', 'library:manage');

  const departments = useQuery({
    queryKey: ['library', 'entry-exit', 'filters'],
    queryFn: fetchEntryExitFilters,
    enabled,
  });
  const visits = useQuery({
    queryKey: ['library', 'visits', filters],
    queryFn: () =>
      fetchLibraryVisits({
        period: filters.period,
        from: filters.period === 'custom' ? filters.from : undefined,
        to: filters.period === 'custom' ? filters.to : undefined,
        memberType: filters.memberType,
        departmentId: filters.departmentId || undefined,
        search: filters.search || undefined,
        page: filters.page,
        limit: filters.limit,
      }),
    enabled,
  });

  const exitMut = useMutation({
    mutationFn: (id: string) => recordLibraryVisitExit(id),
    onSuccess: () => {
      setNotice('Exit time recorded.');
      setDetail(null);
      void qc.invalidateQueries({ queryKey: ['library', 'visits'] });
    },
    onError: (error) => setNotice(apiErrorMessage(error)),
  });
  const walkInMut = useMutation({
    mutationFn: () => registerLibraryWalkIn(form),
    onSuccess: (result) => {
      setNotice(`Walk-in visit started. Pass ${result.visitor.passNumber}.`);
      setWalkIn(false);
      setForm({ fullName: '', institution: '', mobile: '', purpose: '' });
      void qc.invalidateQueries({ queryKey: ['library', 'visits'] });
    },
    onError: (error) => setNotice(apiErrorMessage(error)),
  });

  const stats = visits.data?.stats;
  const total = visits.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / filters.limit));

  function apply(next: Partial<Filters>) {
    const merged = { ...draft, ...next, page: next.page ?? 1 };
    if (merged.period === 'custom' && merged.from && merged.to && merged.to < merged.from) {
      setNotice('The end date cannot be earlier than the start date.');
      return;
    }
    setNotice('');
    setDraft(merged);
    setFilters(merged);
  }

  async function exportVisits(format: 'xlsx' | 'pdf') {
    setExporting(format);
    try {
      const blob = await downloadEntryExitExport(format, {
        period: filters.period,
        from: filters.period === 'custom' ? filters.from : undefined,
        to: filters.period === 'custom' ? filters.to : undefined,
        departmentId: filters.departmentId || undefined,
        memberType: filters.memberType,
        search: filters.search || undefined,
      });
      downloadBlob(blob, `library-visits.${format === 'xlsx' ? 'xlsx' : 'pdf'}`);
    } catch (error) {
      setNotice(apiErrorMessage(error));
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
            <BookOpen className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Library Visits</h1>
            <p className="text-sm text-slate-500">
              Track and manage library entry and exit records.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canSettings ? (
            <Button variant="outline" asChild>
              <Link href="/admin/library/settings">
                <Settings className="mr-2 h-4 w-4" />
                Manage Visit Settings
              </Link>
            </Button>
          ) : null}
          {canExport ? (
            <div className="flex gap-1">
              <Button
                variant="outline"
                disabled={exporting !== null}
                onClick={() => void exportVisits('xlsx')}
              >
                <Download className="mr-2 h-4 w-4" />
                {exporting === 'xlsx' ? 'Exporting…' : 'Excel'}
              </Button>
              <Button
                variant="outline"
                disabled={exporting !== null}
                onClick={() => void exportVisits('pdf')}
              >
                {exporting === 'pdf' ? 'Exporting…' : 'PDF'}
              </Button>
            </div>
          ) : null}
          {canDesk ? (
            <Button onClick={() => setWalkIn(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Walk-in Visit
            </Button>
          ) : null}
        </div>
      </div>

      {notice ? (
        <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
          {notice}
        </p>
      ) : null}
      {visits.isError ? (
        <QueryErrorPanel
          title="Unable to load visits"
          error={visits.error}
          onRetry={() => void visits.refetch()}
          isRetrying={visits.isFetching}
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Summary
          icon={Users}
          label="Total Visits Today"
          value={stats?.totalToday}
          hint={delta(stats?.totalDeltaPct ?? null)}
          hintLabel="Compared to yesterday"
          tone="bg-blue-50 text-blue-700"
        />
        <Summary
          icon={GraduationCap}
          label="Student Visits"
          value={stats?.students}
          hint={stats?.studentSharePct != null ? `${stats.studentSharePct}% of total` : undefined}
          tone="bg-emerald-50 text-emerald-700"
        />
        <Summary
          icon={Users}
          label="Staff Visits"
          value={stats?.staff}
          hint={
            stats?.staffSharePct != null
              ? `${stats.staffSharePct}% of total`
              : 'Faculty and non-teaching'
          }
          tone="bg-sky-50 text-sky-700"
        />
        <Summary
          icon={Users}
          label="Other Visitors"
          value={stats?.visitors}
          hint={stats?.visitorSharePct != null ? `${stats.visitorSharePct}% of total` : undefined}
          tone="bg-violet-50 text-violet-700"
        />
        <Summary
          icon={Clock}
          label="Average Visit Duration"
          value={
            stats?.averageDurationMinutes != null
              ? `${stats.averageDurationMinutes} min`
              : visits.isLoading
                ? undefined
                : '—'
          }
          hint={
            stats?.completedVisits
              ? (delta(stats.averageDeltaPct) ?? `${stats.completedVisits} completed visits`)
              : visits.isLoading
                ? undefined
                : 'No completed visits in this period'
          }
          hintLabel={
            stats?.averageDeltaPct != null ? 'Compared with the previous period' : undefined
          }
          tone="bg-amber-50 text-amber-700"
        />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-900">Filters</h2>
          <div className="flex gap-1">
            {(['today', 'week', 'month', 'custom'] as Period[]).map((period) => (
              <button
                key={period}
                type="button"
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm',
                  draft.period === period
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600',
                )}
                onClick={() => setDraft({ ...draft, period })}
              >
                {period === 'today'
                  ? 'Today'
                  : period === 'week'
                    ? 'This Week'
                    : period === 'month'
                      ? 'This Month'
                      : 'Custom Range'}
              </button>
            ))}
          </div>
        </div>
        <form
          className="grid gap-3 md:grid-cols-6"
          onSubmit={(event) => {
            event.preventDefault();
            apply({ page: 1 });
          }}
        >
          <Input
            type="date"
            value={draft.from}
            onChange={(event) => setDraft({ ...draft, period: 'custom', from: event.target.value })}
          />
          <Input
            type="date"
            value={draft.to}
            onChange={(event) => setDraft({ ...draft, period: 'custom', to: event.target.value })}
          />
          <select
            className="h-10 rounded-md border px-3 text-sm"
            value={draft.memberType}
            onChange={(event) =>
              setDraft({ ...draft, memberType: event.target.value as MemberFilter })
            }
          >
            <option value="ALL">All</option>
            <option value="STUDENT">Student</option>
            <option value="FACULTY">Faculty</option>
            <option value="NON_TEACHING">Non-Teaching Staff</option>
            <option value="VISITOR">External Visitor</option>
          </select>
          <select
            className="h-10 rounded-md border px-3 text-sm"
            value={draft.departmentId}
            onChange={(event) => setDraft({ ...draft, departmentId: event.target.value })}
          >
            <option value="">All Departments</option>
            {(departments.data?.departments ?? []).map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
          <Input
            placeholder="Search by name or ID"
            value={draft.search}
            onChange={(event) => setDraft({ ...draft, search: event.target.value })}
          />
          <div className="flex gap-2">
            <Button type="submit">
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
            <Button type="button" variant="outline" onClick={() => apply(EMPTY)}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <div>
            <h2 className="font-semibold text-slate-900">Visit History</h2>
            <p className="text-sm text-slate-500">
              {total
                ? `Showing ${visits.data?.from ?? 0}–${visits.data?.to ?? 0} of ${total} visits`
                : visits.isLoading
                  ? 'Loading visits…'
                  : 'No visits match these filters.'}
            </p>
          </div>
          <label className="text-sm text-slate-500">
            <select
              className="mr-2 rounded-md border px-2 py-1"
              value={filters.limit}
              onChange={(event) => apply({ limit: Number(event.target.value), page: 1 })}
            >
              {[10, 20, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            per page
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Member</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Department / Course</th>
                <th className="px-3 py-2">In Time</th>
                <th className="px-3 py-2">Out Time</th>
                <th className="px-3 py-2">Duration</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {(visits.data?.items ?? []).map((visit, index) => (
                <tr key={visit.id} className="border-t">
                  <td className="px-3 py-3 text-slate-500">
                    {(filters.page - 1) * filters.limit + index + 1}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      {visit.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={visit.photoUrl}
                          alt=""
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-medium">
                          {initials(visit.memberName)}
                        </span>
                      )}
                      <span>
                        <span className="block font-medium text-slate-900">
                          {visit.memberName || 'Unknown'}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {visit.registrationNumber || '—'}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <Chip>{typeLabel(visit.memberType)}</Chip>
                  </td>
                  <td className="px-3 py-3">
                    <span className="block">{visit.department || '—'}</span>
                    {visit.programme ? (
                      <span className="block text-xs text-slate-500">{visit.programme}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">{stamp(visit.entryAt)}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {visit.exitAt ? stamp(visit.exitAt) : <Chip tone="blue">Inside</Chip>}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">{durationText(visit)}</td>
                  <td className="px-3 py-3">
                    <Chip
                      tone={
                        visit.status === 'COMPLETED'
                          ? 'green'
                          : visit.status === 'REVIEW'
                            ? 'amber'
                            : 'blue'
                      }
                    >
                      {visit.status === 'COMPLETED'
                        ? 'Completed'
                        : visit.status === 'REVIEW'
                          ? 'Requires Review'
                          : 'Inside'}
                    </Chip>
                  </td>
                  <td className="relative px-3 py-3">
                    <button
                      type="button"
                      aria-label="Visit actions"
                      className="rounded p-1 hover:bg-slate-100"
                      onClick={() => setMenuId(menuId === visit.id ? null : visit.id)}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {menuId === visit.id ? (
                      <div className="absolute right-3 z-10 w-44 rounded-lg border bg-white p-1 shadow-lg">
                        <button
                          type="button"
                          className="block w-full rounded px-2 py-1.5 text-left hover:bg-slate-50"
                          onClick={() => {
                            setDetail(visit);
                            setMenuId(null);
                          }}
                        >
                          View Details
                        </button>
                        {canDesk && !visit.exitAt ? (
                          <button
                            type="button"
                            className="block w-full rounded px-2 py-1.5 text-left hover:bg-slate-50"
                            onClick={() => {
                              setDetail(visit);
                              setMenuId(null);
                            }}
                          >
                            Record Exit
                          </button>
                        ) : null}
                        {visit.studentId ? (
                          <Link
                            className="block rounded px-2 py-1.5 hover:bg-slate-50"
                            href={`/admin/students/${visit.studentId}`}
                            onClick={() => setMenuId(null)}
                          >
                            View Member History
                          </Link>
                        ) : visit.staffProfileId ? (
                          <Link
                            className="block rounded px-2 py-1.5 hover:bg-slate-50"
                            href={`/admin/staff/${visit.staffProfileId}`}
                            onClick={() => setMenuId(null)}
                          >
                            View Member History
                          </Link>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
          <Button
            variant="outline"
            size="sm"
            disabled={filters.page <= 1}
            onClick={() => apply({ page: filters.page - 1 })}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-slate-600">
            {filters.page} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={filters.page >= pageCount}
            onClick={() => apply({ page: filters.page + 1 })}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </section>

      {detail ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold">{detail.memberName}</h3>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <Item label="Type" value={typeLabel(detail.memberType)} />
              <Item label="ID" value={detail.registrationNumber || '—'} />
              <Item label="Department" value={detail.department || '—'} />
              <Item label="Course" value={detail.programme || '—'} />
              <Item label="In" value={stamp(detail.entryAt)} />
              <Item label="Out" value={detail.exitAt ? stamp(detail.exitAt) : 'Inside'} />
              <Item label="Duration" value={durationText(detail)} />
              <Item label="Source" value={detail.entryMethod || 'Not recorded'} />
              <Item label="Purpose" value={detail.purpose || '—'} />
              <Item label="Organisation" value={detail.institution || '—'} />
            </dl>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDetail(null)}>
                Close
              </Button>
              {canDesk && !detail.exitAt ? (
                <Button disabled={exitMut.isPending} onClick={() => exitMut.mutate(detail.id)}>
                  {exitMut.isPending ? 'Saving…' : 'Record Exit'}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {walkIn ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <form
            className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-xl"
            onSubmit={(event) => {
              event.preventDefault();
              if (!form.fullName.trim() || walkInMut.isPending) return;
              walkInMut.mutate();
            }}
          >
            <h3 className="text-lg font-semibold">Add Walk-in Visit</h3>
            <p className="text-sm text-slate-500">
              Entry time is set to now. This does not create a student or staff record.
            </p>
            <Input
              required
              placeholder="Visitor name"
              value={form.fullName}
              onChange={(event) => setForm({ ...form, fullName: event.target.value })}
            />
            <Input
              placeholder="Organisation"
              value={form.institution}
              onChange={(event) => setForm({ ...form, institution: event.target.value })}
            />
            <Input
              placeholder="Mobile, if needed"
              value={form.mobile}
              onChange={(event) => setForm({ ...form, mobile: event.target.value })}
            />
            <Input
              placeholder="Purpose of visit"
              value={form.purpose}
              onChange={(event) => setForm({ ...form, purpose: event.target.value })}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setWalkIn(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={walkInMut.isPending}>
                {walkInMut.isPending ? 'Saving…' : 'Start Visit'}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function Summary({
  icon: Icon,
  label,
  value,
  hint,
  hintLabel,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value?: number | string;
  hint?: string | null;
  hintLabel?: string;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', tone)}>
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="text-2xl font-semibold text-slate-900">
            {value == null
              ? '—'
              : typeof value === 'number'
                ? value.toLocaleString('en-IN')
                : value}
          </p>
        </div>
      </div>
      {hint ? <p className="mt-2 text-xs text-emerald-700">{hint}</p> : null}
      {hintLabel ? <p className="text-xs text-slate-400">{hintLabel}</p> : null}
    </div>
  );
}

function Chip({
  children,
  tone = 'slate',
}: {
  children: string;
  tone?: 'slate' | 'blue' | 'green' | 'amber';
}) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
        tone === 'blue' && 'bg-blue-50 text-blue-700',
        tone === 'green' && 'bg-emerald-50 text-emerald-700',
        tone === 'amber' && 'bg-amber-50 text-amber-800',
        tone === 'slate' && 'bg-slate-100 text-slate-700',
      )}
    >
      {children}
    </span>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-800">{value}</dd>
    </div>
  );
}
