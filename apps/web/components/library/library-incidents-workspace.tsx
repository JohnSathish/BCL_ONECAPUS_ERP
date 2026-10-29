'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Download,
  FileWarning,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import {
  fetchLibraryIncidentList,
  fetchLibraryIncidentSummary,
  notifyLibraryDueTomorrow,
  previewLibraryIncidentCopy,
  replaceLibraryCopyIncident,
  replaceLibraryIncidentByBarcode,
  reportLibraryCopyIncident,
  resolveLibraryCopyIncident,
} from '@/services/library';
import type { LibraryCopyIncident, LibraryIncidentCopyPreview } from '@/types/library';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import { downloadBlob } from '@/utils/download-blob';

type Bucket = 'ALL' | 'LOST' | 'DAMAGED' | 'REPLACED' | 'RESOLVED' | 'CLOSED';
type Mode = 'LOST' | 'DAMAGED' | 'REPLACEMENT';

const EMPTY_FILTERS = {
  search: '',
  incidentType: '',
  status: '',
  reportedById: '',
  from: '',
  to: '',
  bucket: 'ALL' as Bucket,
};

export function LibraryIncidentsWorkspace() {
  const enabled = useAuthQueryEnabled();
  const { canAny } = usePermissions();
  const canReport = canAny('library:circulate', 'library:manage');
  const canManage = canAny('library:manage');
  const qc = useQueryClient();
  const barcodeRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sort, setSort] = useState<'newest' | 'oldest' | 'title'>('newest');
  const [grid, setGrid] = useState(false);
  const [mode, setMode] = useState<Mode>('LOST');
  const [barcode, setBarcode] = useState('');
  const [notes, setNotes] = useState('');
  const [preview, setPreview] = useState<LibraryIncidentCopyPreview | null>(null);
  const [message, setMessage] = useState('');

  const summary = useQuery({
    queryKey: ['library', 'incidents', 'summary'],
    queryFn: fetchLibraryIncidentSummary,
    enabled,
  });

  const list = useQuery({
    queryKey: ['library', 'incidents', 'list', applied, page, pageSize, sort],
    queryFn: () =>
      fetchLibraryIncidentList({
        page,
        limit: pageSize,
        search: applied.search || undefined,
        bucket: applied.bucket,
        incidentType: applied.incidentType || undefined,
        status: applied.status || undefined,
        reportedById: applied.reportedById || undefined,
        from: applied.from || undefined,
        to: applied.to || undefined,
        sort,
      }),
    enabled,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['library', 'incidents'] });
  };

  const reportMut = useMutation({
    mutationFn: () => {
      if (mode === 'REPLACEMENT') {
        return replaceLibraryIncidentByBarcode({
          copyBarcode: barcode.trim(),
          notes: notes.trim() || undefined,
        });
      }
      return reportLibraryCopyIncident({
        copyBarcode: barcode.trim(),
        incidentType: mode,
        notes: notes.trim() || undefined,
      });
    },
    onSuccess: () => {
      setMessage(mode === 'REPLACEMENT' ? 'Replacement recorded' : 'Incident recorded');
      setBarcode('');
      setNotes('');
      setPreview(null);
      invalidate();
    },
    onError: (error) => setMessage(apiErrorMessage(error)),
  });

  const replaceMut = useMutation({
    mutationFn: (id: string) => replaceLibraryCopyIncident(id),
    onSuccess: () => {
      setMessage('Copy replaced');
      invalidate();
    },
    onError: (error) => setMessage(apiErrorMessage(error)),
  });

  const closeMut = useMutation({
    mutationFn: (id: string) => resolveLibraryCopyIncident(id, 'Closed without replacement'),
    onSuccess: () => {
      setMessage('Incident closed');
      invalidate();
    },
    onError: (error) => setMessage(apiErrorMessage(error)),
  });

  const reminderMut = useMutation({
    mutationFn: () => notifyLibraryDueTomorrow(),
    onSuccess: (result) => {
      setMessage(
        result.skipped
          ? 'Due-date reminders are turned off in library settings'
          : `Due-date reminders sent: ${result.sent} of ${result.checked} loans`,
      );
    },
    onError: (error) => setMessage(apiErrorMessage(error)),
  });

  const lookupMut = useMutation({
    mutationFn: () => previewLibraryIncidentCopy(barcode.trim()),
    onSuccess: (row) => {
      setPreview(row);
      setMessage('');
    },
    onError: (error) => {
      setPreview(null);
      setMessage(apiErrorMessage(error));
    },
  });

  function applyBucket(bucket: Bucket) {
    setDraft((current) => ({ ...current, bucket, incidentType: '', status: '' }));
    setApplied((current) => ({ ...current, bucket, incidentType: '', status: '' }));
    setPage(1);
  }

  const stats = summary.data;
  const items = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const submitAllowed = mode === 'REPLACEMENT' ? canManage : canReport;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">Library / Incidents</p>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
            <AlertTriangle className="h-5 w-5 text-rose-600" />
            Library Incidents
          </h1>
          <p className="text-sm text-slate-500">
            Report and manage lost, damaged or replaced book copies
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/library/settings">
            <Button variant="outline">
              <Settings className="mr-2 h-4 w-4" />
              Incident Settings
            </Button>
          </Link>
          <Button variant="outline" onClick={() => void exportRows(applied, sort, setMessage)}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={() => barcodeRef.current?.focus()}>
            <Plus className="mr-2 h-4 w-4" />
            Report Incident
          </Button>
        </div>
      </div>

      {message ? (
        <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">{message}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          icon={BookOpen}
          label="Total Incidents"
          value={stats ? stats.total : '—'}
          hint="All reported cases"
          tone="bg-rose-50 text-rose-700"
        />
        <Stat
          icon={ShieldAlert}
          label="Lost Books"
          value={stats ? stats.lost : '—'}
          hint="Open, not recovered"
          tone="bg-red-50 text-red-700"
        />
        <Stat
          icon={AlertTriangle}
          label="Damaged Books"
          value={stats ? stats.damaged : '—'}
          hint="Open, under assessment"
          tone="bg-amber-50 text-amber-700"
        />
        <Stat
          icon={RefreshCw}
          label="Replaced Books"
          value={stats ? stats.replaced : '—'}
          hint="Replacement recorded"
          tone="bg-violet-50 text-violet-700"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_260px]">
        <form
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            if (!barcode.trim() || !submitAllowed || reportMut.isPending) return;
            reportMut.mutate();
          }}
        >
          <h2 className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Report a New Incident
          </h2>
          <p className="mb-3 text-sm text-slate-500">
            Scan the barcode or enter details to report a lost, damaged or replacement case
          </p>
          <div className="mb-3 flex gap-2">
            {(['LOST', 'DAMAGED', 'REPLACEMENT'] as Mode[]).map((item) => (
              <button
                key={item}
                type="button"
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm',
                  mode === item ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600',
                )}
                onClick={() => setMode(item)}
              >
                {item === 'REPLACEMENT' ? 'Replacement' : item === 'LOST' ? 'Lost' : 'Damaged'}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              ref={barcodeRef}
              id="incident-barcode"
              placeholder="Scan barcode or enter accession number"
              value={barcode}
              onChange={(event) => {
                setBarcode(event.target.value);
                setPreview(null);
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={!barcode.trim() || lookupMut.isPending}
              onClick={() => lookupMut.mutate()}
            >
              <Search className="mr-2 h-4 w-4" />
              Search Book
            </Button>
          </div>
          {preview ? (
            <p className="mt-2 text-sm text-slate-600">
              {preview.title} · {preview.accessionNo} · copy {preview.status}
              {preview.openIncidentType
                ? ` · open ${preview.openIncidentType.toLowerCase()} incident`
                : ''}
            </p>
          ) : null}
          <Input
            className="mt-2"
            placeholder="Additional notes (optional)"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
          {mode === 'REPLACEMENT' ? (
            <p className="mt-2 text-xs text-slate-500">
              Replacement closes the open incident for this copy and adds a replacement copy when
              one is not scanned.
            </p>
          ) : null}
          <Button
            className="mt-3 w-full"
            type="submit"
            disabled={!barcode.trim() || !submitAllowed || reportMut.isPending}
          >
            {reportMut.isPending
              ? 'Saving…'
              : mode === 'REPLACEMENT'
                ? 'Record Replacement'
                : 'Report Incident'}
          </Button>
        </form>
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-semibold">Quick Actions</h2>
          <button
            type="button"
            className="block w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50"
            onClick={() => barcodeRef.current?.focus()}
          >
            Scan barcode
            <span className="block text-xs text-slate-500">
              Find a copy by barcode or accession number
            </span>
          </button>
          <button
            type="button"
            className="block w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50"
            onClick={() => {
              applyBucket('ALL');
              document.getElementById('incident-list')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            View incident history
            <span className="block text-xs text-slate-500">All reported incidents</span>
          </button>
          <button
            type="button"
            className="block w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50"
            onClick={() => void exportRows(applied, sort, setMessage)}
          >
            Generate incident report
            <span className="block text-xs text-slate-500">
              Export the filtered incidents as CSV
            </span>
          </button>
          <button
            type="button"
            className="block w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50"
            disabled={!canReport || reminderMut.isPending}
            onClick={() => reminderMut.mutate()}
          >
            <Bell className="mr-1 inline h-3.5 w-3.5" />
            Set due date reminders
            <span className="block text-xs text-slate-500">
              Send the existing due-tomorrow loan reminders
            </span>
          </button>
        </aside>
      </div>

      <section
        id="incident-list"
        className="rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="flex flex-wrap gap-2 border-b px-4 py-3">
          {(
            [
              ['ALL', 'All Incidents', stats?.total],
              ['LOST', 'Lost', stats?.lost],
              ['DAMAGED', 'Damaged', stats?.damaged],
              ['REPLACED', 'Replaced', stats?.replaced],
              ['RESOLVED', 'Resolved', stats?.resolved],
              ['CLOSED', 'Closed', stats?.closed],
            ] as const
          ).map(([bucket, label, count]) => (
            <button
              key={bucket}
              type="button"
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm',
                applied.bucket === bucket
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600',
              )}
              onClick={() => applyBucket(bucket)}
            >
              {label} ({stats ? count : '—'})
            </button>
          ))}
        </div>
        <div className="grid gap-2 border-b px-4 py-3 md:grid-cols-6">
          <Input
            className="md:col-span-2"
            placeholder="Search by book title, accession no., member name..."
            value={draft.search}
            onChange={(event) => setDraft({ ...draft, search: event.target.value })}
          />
          <select
            className="h-10 rounded-md border px-2 text-sm"
            value={draft.incidentType}
            onChange={(event) => setDraft({ ...draft, incidentType: event.target.value })}
          >
            <option value="">All Types</option>
            <option value="LOST">Lost</option>
            <option value="DAMAGED">Damaged</option>
            <option value="REPLACED">Replaced</option>
          </select>
          <select
            className="h-10 rounded-md border px-2 text-sm"
            value={draft.status}
            onChange={(event) => setDraft({ ...draft, status: event.target.value })}
          >
            <option value="">All Status</option>
            <option value="OPEN">Open</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>
          <select
            className="h-10 rounded-md border px-2 text-sm"
            value={draft.reportedById}
            onChange={(event) => setDraft({ ...draft, reportedById: event.target.value })}
          >
            <option value="">All Staff</option>
            {(stats?.reporters ?? []).map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-1">
            <Input
              type="date"
              aria-label="Reported from"
              value={draft.from}
              onChange={(event) => setDraft({ ...draft, from: event.target.value })}
            />
            <Input
              type="date"
              aria-label="Reported to"
              value={draft.to}
              onChange={(event) => setDraft({ ...draft, to: event.target.value })}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3">
          <Button
            type="button"
            onClick={() => {
              setApplied(draft);
              setPage(1);
            }}
          >
            <Search className="mr-2 h-4 w-4" />
            Search
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDraft(EMPTY_FILTERS);
              setApplied(EMPTY_FILTERS);
              setPage(1);
            }}
          >
            Reset
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-3">
          <p className="text-sm text-slate-500">
            {list.isLoading
              ? 'Loading incidents…'
              : `Showing ${total} incident${total === 1 ? '' : 's'}`}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>Show</span>
            <select
              className="h-9 rounded-md border px-2"
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
            >
              {[20, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span>per page</span>
            <Button type="button" size="sm" variant="outline" onClick={() => setGrid(false)}>
              Table
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setGrid(true)}>
              Grid
            </Button>
            <select
              className="h-9 rounded-md border px-2"
              value={sort}
              onChange={(event) => setSort(event.target.value as 'newest' | 'oldest' | 'title')}
            >
              <option value="newest">Reported Date (Newest)</option>
              <option value="oldest">Reported Date (Oldest)</option>
              <option value="title">Book Title</option>
            </select>
          </div>
        </div>
        {items.length === 0 && !list.isLoading ? (
          <div className="px-6 py-16 text-center">
            <FileWarning className="mx-auto mb-3 h-10 w-10 text-blue-500" />
            <h3 className="text-lg font-semibold">No incidents found</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              {emptyCopy(applied.bucket)}
            </p>
            <Button className="mt-4" onClick={() => barcodeRef.current?.focus()}>
              Report First Incident
            </Button>
          </div>
        ) : grid ? (
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((row) => (
              <article key={row.id} className="rounded-xl border p-3 text-sm">
                <p className="text-xs uppercase text-slate-500">{row.incidentType}</p>
                <h3 className="font-medium">{row.title || row.copy?.book?.title || '—'}</h3>
                <p className="text-slate-500">
                  {row.accessionNo || '—'} · {row.status}
                </p>
                <p>{row.memberName || 'No borrower on the loan'}</p>
                <p className="text-slate-500">
                  {row.reportedByName || '—'} · {formatWhen(row.createdAt)}
                </p>
                <p>{formatCharge(row.chargeAmount)}</p>
                <IncidentActions
                  row={row}
                  canManage={canManage}
                  pending={replaceMut.isPending || closeMut.isPending}
                  onReplace={(id) => replaceMut.mutate(id)}
                  onClose={(id) => closeMut.mutate(id)}
                />
              </article>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Book Details</th>
                  <th className="px-3 py-2">Accession No.</th>
                  <th className="px-3 py-2">Reported By</th>
                  <th className="px-3 py-2">Reported On</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Charge / Fine</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row, index) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-3 py-2 text-slate-500">
                      {(page - 1) * pageSize + index + 1}
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs text-rose-700">
                        {row.incidentType}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-medium">{row.title || row.copy?.book?.title || '—'}</p>
                      <p className="text-xs text-slate-500">
                        {row.author || row.copy?.book?.author || '—'}
                        {row.memberName ? ` · ${row.memberName}` : ''}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      {row.accessionNo ||
                        row.copy?.accessionNumber ||
                        row.copy?.book?.accessionNo ||
                        '—'}
                    </td>
                    <td className="px-3 py-2">{row.reportedByName || '—'}</td>
                    <td className="px-3 py-2">{formatWhen(row.createdAt)}</td>
                    <td className="px-3 py-2">
                      <span
                        className={cn('rounded-full px-2 py-0.5 text-xs', statusTone(row.status))}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">{formatCharge(row.chargeAmount)}</td>
                    <td className="px-3 py-2">
                      <IncidentActions
                        row={row}
                        canManage={canManage}
                        pending={replaceMut.isPending || closeMut.isPending}
                        onReplace={(id) => replaceMut.mutate(id)}
                        onClose={(id) => closeMut.mutate(id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex justify-end gap-2 border-t px-4 py-3 text-sm">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
          >
            Previous
          </Button>
          <span className="self-center">
            {page} / {pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </Button>
        </div>
      </section>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof BookOpen;
  label: string;
  value: number | string;
  hint: string;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function IncidentActions({
  row,
  canManage,
  pending,
  onReplace,
  onClose,
}: {
  row: LibraryCopyIncident;
  canManage: boolean;
  pending: boolean;
  onReplace: (id: string) => void;
  onClose: (id: string) => void;
}) {
  if (row.status !== 'OPEN' || !canManage) return <span className="text-slate-400">—</span>;
  return (
    <div className="flex gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => onReplace(row.id)}
      >
        Replace
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => {
          if (window.confirm('Close this incident without a replacement?')) onClose(row.id);
        }}
      >
        Close
      </Button>
    </div>
  );
}

function emptyCopy(bucket: Bucket) {
  if (bucket === 'ALL') return 'There are no lost, damaged or replaced books reported yet.';
  if (bucket === 'LOST') return 'No open lost-copy incidents.';
  if (bucket === 'DAMAGED') return 'No open damaged-copy incidents.';
  if (bucket === 'REPLACED') return 'No replacement has been recorded yet.';
  if (bucket === 'RESOLVED') return 'No incidents are marked resolved.';
  return 'No incidents have been closed without a replacement.';
}

function statusTone(status: string) {
  if (status === 'RESOLVED') return 'bg-emerald-50 text-emerald-700';
  if (status === 'CLOSED') return 'bg-slate-100 text-slate-600';
  return 'bg-amber-50 text-amber-700';
}

function formatWhen(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}

function formatCharge(amount?: number | null) {
  return amount == null ? '—' : `₹${amount.toFixed(2)}`;
}

async function exportRows(
  applied: typeof EMPTY_FILTERS,
  sort: 'newest' | 'oldest' | 'title',
  setMessage: (value: string) => void,
) {
  try {
    const result = await fetchLibraryIncidentList({
      page: 1,
      limit: 500,
      search: applied.search || undefined,
      bucket: applied.bucket,
      incidentType: applied.incidentType || undefined,
      status: applied.status || undefined,
      reportedById: applied.reportedById || undefined,
      from: applied.from || undefined,
      to: applied.to || undefined,
      sort,
    });
    const header = [
      'Type',
      'Title',
      'Author',
      'Accession',
      'Member',
      'Reported by',
      'Reported on',
      'Status',
      'Charge',
    ];
    const lines = result.items.map((row) => [
      row.incidentType,
      row.title || row.copy?.book?.title || '',
      row.author || '',
      row.accessionNo || '',
      row.memberName || '',
      row.reportedByName || '',
      row.createdAt,
      row.status,
      row.chargeAmount ?? '',
    ]);
    const csv = [header, ...lines]
      .map((cols) => cols.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    downloadBlob(new Blob([csv], { type: 'text/csv' }), 'library-incidents.csv');
    if (result.total > result.items.length) {
      setMessage(`Exported the first ${result.items.length} of ${result.total} incidents`);
    }
  } catch (error) {
    setMessage(apiErrorMessage(error));
  }
}
