'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bookmark,
  BookOpen,
  CheckCircle2,
  Clock,
  Download,
  Plus,
  Search,
  Settings,
  Users,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  cancelLibraryReservation,
  fetchLibraryBooks,
  fetchLibraryReservationList,
  fetchLibraryReservationSummary,
  reserveLibraryBook,
  searchLibraryReservationStudents,
} from '@/services/library';
import type { LibraryReservation } from '@/types/library';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import { downloadBlob } from '@/utils/download-blob';

type Status = 'ALL' | 'ACTIVE' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED';
type MemberType = 'ALL' | 'STUDENT' | 'STAFF' | 'FACULTY';

const EMPTY_FILTERS = {
  search: '',
  memberType: 'ALL' as MemberType,
  departmentId: '',
  status: 'ACTIVE' as Status,
  from: '',
  to: '',
};

export function LibraryReservationsWorkspace() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [draft, setDraft] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sort, setSort] = useState<'newest' | 'oldest' | 'title'>('newest');
  const [grid, setGrid] = useState(false);
  const [creating, setCreating] = useState(false);
  const [bookQuery, setBookQuery] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [bookId, setBookId] = useState('');
  const [bookLabel, setBookLabel] = useState('');
  const [availableCopies, setAvailableCopies] = useState<number | null>(null);
  const [studentId, setStudentId] = useState('');
  const [studentLabel, setStudentLabel] = useState('');
  const [message, setMessage] = useState('');

  const summary = useQuery({
    queryKey: ['library', 'reservations', 'summary'],
    queryFn: fetchLibraryReservationSummary,
    enabled,
  });

  const list = useQuery({
    queryKey: ['library', 'reservations', 'list', applied, page, pageSize, sort],
    queryFn: () =>
      fetchLibraryReservationList({
        page,
        limit: pageSize,
        search: applied.search || undefined,
        status: applied.status,
        memberType: applied.memberType,
        departmentId: applied.departmentId || undefined,
        from: applied.from || undefined,
        to: applied.to || undefined,
        sort,
      }),
    enabled,
  });

  const books = useQuery({
    queryKey: ['library', 'reservations', 'books', bookQuery],
    queryFn: () => fetchLibraryBooks({ search: bookQuery, limit: 6 }),
    enabled: enabled && creating && bookQuery.trim().length > 1 && !bookId,
  });

  const students = useQuery({
    queryKey: ['library', 'reservations', 'students', studentQuery],
    queryFn: () => searchLibraryReservationStudents(studentQuery.trim()),
    enabled: enabled && creating && studentQuery.trim().length > 1 && !studentId,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['library', 'reservations'] });
  };

  const createMut = useMutation({
    mutationFn: () => reserveLibraryBook(bookId, studentId),
    onSuccess: () => {
      setMessage('Reservation created');
      setCreating(false);
      setBookId('');
      setBookLabel('');
      setStudentId('');
      setStudentLabel('');
      setBookQuery('');
      setStudentQuery('');
      setAvailableCopies(null);
      applyStatus('ACTIVE');
      invalidate();
    },
    onError: (error) => setMessage(apiErrorMessage(error)),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => cancelLibraryReservation(id),
    onSuccess: () => {
      setMessage('Reservation cancelled');
      invalidate();
    },
    onError: (error) => setMessage(apiErrorMessage(error)),
  });

  function applyStatus(status: Status) {
    setDraft((current) => ({ ...current, status }));
    setApplied((current) => ({ ...current, status }));
    setPage(1);
  }

  function applySearch() {
    setApplied(draft);
    setPage(1);
  }

  const stats = summary.data;
  const items = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const emptyCopy = emptyMessage(applied.status, applied.memberType);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">Library / Reservations</p>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
            <Bookmark className="h-5 w-5 text-blue-600" />
            Library Reservations
          </h1>
          <p className="text-sm text-slate-500">Manage book reservations and hold requests</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/library/settings">
            <Button variant="outline">
              <Settings className="mr-2 h-4 w-4" />
              Reservation Settings
            </Button>
          </Link>
          <Button
            variant="outline"
            onClick={() => {
              void fetchLibraryReservationList({
                page: 1,
                limit: 500,
                search: applied.search || undefined,
                status: applied.status,
                memberType: applied.memberType,
                departmentId: applied.departmentId || undefined,
                from: applied.from || undefined,
                to: applied.to || undefined,
                sort,
              })
                .then((result) => {
                  downloadBlob(
                    new Blob([toCsv(result.items)], { type: 'text/csv' }),
                    'library-reservations.csv',
                  );
                  if (result.total > result.items.length) {
                    setMessage(
                      `Exported the first ${result.items.length} of ${result.total} reservations`,
                    );
                  }
                })
                .catch((error) => setMessage(apiErrorMessage(error)));
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={() => setCreating((open) => !open)}>
            <Plus className="mr-2 h-4 w-4" />
            New Reservation
          </Button>
        </div>
      </div>

      {message ? (
        <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">{message}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          icon={Users}
          label="Active Holds"
          value={stats ? stats.active : '—'}
          hint="Students waiting for books"
          tone="bg-blue-50 text-blue-700"
        />
        <Stat
          icon={BookOpen}
          label="Titles Queued"
          value={stats ? stats.titles : '—'}
          hint="Unique book titles"
          tone="bg-emerald-50 text-emerald-700"
        />
        <Stat
          icon={Clock}
          label="Longest Queue"
          value={stats ? `${stats.longestDays} days` : '—'}
          hint="Maximum waiting time"
          tone="bg-amber-50 text-amber-700"
        />
        <Stat
          icon={CheckCircle2}
          label="Fulfilled Today"
          value={stats ? stats.fulfilledToday : '—'}
          hint="Reservations honoured"
          tone="bg-violet-50 text-violet-700"
        />
      </div>

      {creating ? (
        <form
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            if (!bookId || !studentId || createMut.isPending) return;
            createMut.mutate();
          }}
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">New Reservation</h2>
            <button
              type="button"
              className="text-slate-500"
              onClick={() => setCreating(false)}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Input
                placeholder="Search book title or accession"
                value={bookId ? bookLabel : bookQuery}
                onChange={(event) => {
                  setBookId('');
                  setBookLabel('');
                  setAvailableCopies(null);
                  setBookQuery(event.target.value);
                }}
              />
              {books.data?.items.length ? (
                <ul className="mt-1 rounded-lg border bg-white text-sm">
                  {books.data.items.map((book) => (
                    <li key={book.id}>
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left hover:bg-slate-50"
                        onClick={() => {
                          setBookId(book.id);
                          setBookLabel(`${book.title} · ${book.accessionNo}`);
                          setAvailableCopies(book.availableCopies ?? null);
                          setBookQuery('');
                        }}
                      >
                        {book.title}
                        <span className="ml-2 text-slate-500">{book.accessionNo}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div>
              <Input
                placeholder="Search student name or enrollment"
                value={studentId ? studentLabel : studentQuery}
                onChange={(event) => {
                  setStudentId('');
                  setStudentLabel('');
                  setStudentQuery(event.target.value);
                }}
              />
              {students.data?.length ? (
                <ul className="mt-1 rounded-lg border bg-white text-sm">
                  {students.data.map((student) => (
                    <li key={student.id}>
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left hover:bg-slate-50"
                        onClick={() => {
                          setStudentId(student.id);
                          setStudentLabel(`${student.fullName} · ${student.enrollmentNumber}`);
                          setStudentQuery('');
                        }}
                      >
                        {student.fullName}
                        <span className="ml-2 text-slate-500">{student.enrollmentNumber}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
          {availableCopies != null && availableCopies > 0 ? (
            <p className="mt-2 text-sm text-amber-700">
              Copies are available. Issue the book instead of placing a hold.
            </p>
          ) : null}
          <div className="mt-3 flex gap-2">
            <Button
              type="submit"
              disabled={
                !bookId ||
                !studentId ||
                createMut.isPending ||
                (availableCopies != null && availableCopies > 0)
              }
            >
              {createMut.isPending ? 'Saving…' : 'Create reservation'}
            </Button>
          </div>
        </form>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Filters</h2>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-500">Quick Filters:</span>
            {(['ALL', 'ACTIVE', 'FULFILLED', 'CANCELLED', 'EXPIRED'] as Status[]).map((status) => (
              <button
                key={status}
                type="button"
                className={cn(
                  'rounded-full px-3 py-1',
                  applied.status === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600',
                )}
                onClick={() => applyStatus(status)}
              >
                {statusLabel(status)}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-6">
          <Input
            className="md:col-span-2"
            placeholder="Search by book title, member name or accession no."
            value={draft.search}
            onChange={(event) => setDraft({ ...draft, search: event.target.value })}
          />
          <select
            className="h-10 rounded-md border px-2 text-sm"
            value={draft.memberType}
            onChange={(event) =>
              setDraft({ ...draft, memberType: event.target.value as MemberType })
            }
          >
            <option value="ALL">All</option>
            <option value="STUDENT">Student</option>
            <option value="FACULTY">Faculty</option>
            <option value="STAFF">Staff</option>
          </select>
          <select
            className="h-10 rounded-md border px-2 text-sm"
            value={draft.departmentId}
            onChange={(event) => setDraft({ ...draft, departmentId: event.target.value })}
          >
            <option value="">All Departments</option>
            {(stats?.departments ?? []).map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-md border px-2 text-sm"
            value={draft.status}
            onChange={(event) => setDraft({ ...draft, status: event.target.value as Status })}
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active Holds</option>
            <option value="FULFILLED">Fulfilled</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="EXPIRED">Expired</option>
          </select>
          <div className="grid grid-cols-2 gap-1">
            <Input
              type="date"
              aria-label="Reserved from"
              value={draft.from}
              onChange={(event) => setDraft({ ...draft, from: event.target.value })}
            />
            <Input
              type="date"
              aria-label="Reserved to"
              value={draft.to}
              onChange={(event) => setDraft({ ...draft, to: event.target.value })}
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Button type="button" onClick={applySearch}>
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
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap gap-2 border-b px-4 py-3">
          {(
            [
              ['ACTIVE', 'Active Reservations', stats?.active],
              ['FULFILLED', 'Fulfilled', stats?.fulfilled],
              ['CANCELLED', 'Cancelled', stats?.cancelled],
              ['EXPIRED', 'Expired', stats?.expired],
            ] as const
          ).map(([status, label, count]) => (
            <button
              key={status}
              type="button"
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm',
                applied.status === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600',
              )}
              onClick={() => applyStatus(status)}
            >
              {label} ({stats ? count : '—'})
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div>
            <h2 className="font-semibold">{heading(applied.status)}</h2>
            <p className="text-sm text-slate-500">
              {list.isLoading
                ? 'Loading reservations…'
                : `Showing ${total} reservation${total === 1 ? '' : 's'}`}
            </p>
          </div>
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
            <Button type="button" variant="outline" size="sm" onClick={() => setGrid(false)}>
              Table
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setGrid(true)}>
              Grid
            </Button>
            <select
              className="h-9 rounded-md border px-2"
              value={sort}
              onChange={(event) => setSort(event.target.value as 'newest' | 'oldest' | 'title')}
            >
              <option value="newest">Reservation Date (Newest)</option>
              <option value="oldest">Reservation Date (Oldest)</option>
              <option value="title">Book Title</option>
            </select>
          </div>
        </div>
        {items.length === 0 && !list.isLoading ? (
          <div className="px-6 py-16 text-center">
            <BookOpen className="mx-auto mb-3 h-10 w-10 text-blue-500" />
            <h3 className="text-lg font-semibold">
              {applied.status === 'ALL'
                ? 'No reservations'
                : `No ${heading(applied.status).toLowerCase()}`}
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{emptyCopy}</p>
            <Link href="/admin/library/catalogue" className="mt-4 inline-flex">
              <Button>
                <BookOpen className="mr-2 h-4 w-4" />
                Browse Catalogue
              </Button>
            </Link>
          </div>
        ) : grid ? (
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((row) => (
              <article key={row.id} className="rounded-xl border p-3 text-sm">
                <h3 className="font-medium">{row.book?.title ?? row.bookId}</h3>
                <p className="text-slate-500">
                  {row.author || '—'} · {row.accessionNo || '—'}
                </p>
                <p>
                  {row.studentName} · {row.department || '—'}
                </p>
                <p className="text-slate-500">
                  Reserved {formatWhen(row.reservedAt)} · Queue {row.queuePosition ?? '—'}
                </p>
                <RowActions
                  row={row}
                  pending={cancelMut.isPending}
                  onCancel={(id) => cancelMut.mutate(id)}
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
                  <th className="px-3 py-2">Book Title</th>
                  <th className="px-3 py-2">Author</th>
                  <th className="px-3 py-2">Accession No.</th>
                  <th className="px-3 py-2">Requester</th>
                  <th className="px-3 py-2">Member Type</th>
                  <th className="px-3 py-2">Department</th>
                  <th className="px-3 py-2">Reserved On</th>
                  <th className="px-3 py-2" title="Hold expiry is not recorded">
                    Expires On
                  </th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Queue Position</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row, index) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-3 py-2 text-slate-500">
                      {(page - 1) * pageSize + index + 1}
                    </td>
                    <td className="px-3 py-2 font-medium">{row.book?.title ?? '—'}</td>
                    <td className="px-3 py-2">{row.author || '—'}</td>
                    <td className="px-3 py-2">{row.accessionNo || row.book?.accessionNo || '—'}</td>
                    <td className="px-3 py-2">{row.studentName || '—'}</td>
                    <td className="px-3 py-2">Student</td>
                    <td className="px-3 py-2">{row.department || '—'}</td>
                    <td className="px-3 py-2">{formatWhen(row.reservedAt)}</td>
                    <td className="px-3 py-2">—</td>
                    <td className="px-3 py-2">
                      <span
                        className={cn('rounded-full px-2 py-0.5 text-xs', statusTone(row.status))}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">{row.queuePosition ?? '—'}</td>
                    <td className="px-3 py-2">
                      <RowActions
                        row={row}
                        pending={cancelMut.isPending}
                        onCancel={(id) => cancelMut.mutate(id)}
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
  icon: typeof Users;
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

function RowActions({
  row,
  pending,
  onCancel,
}: {
  row: LibraryReservation;
  pending: boolean;
  onCancel: (id: string) => void;
}) {
  if (row.status !== 'ACTIVE') return <span className="text-slate-400">—</span>;
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => {
        if (window.confirm('Cancel this reservation?')) onCancel(row.id);
      }}
    >
      Cancel
    </Button>
  );
}

function heading(status: Status) {
  if (status === 'ACTIVE') return 'Active Reservations';
  if (status === 'ALL') return 'All Reservations';
  return `${statusLabel(status)} Reservations`;
}

function statusLabel(status: Status) {
  if (status === 'ACTIVE') return 'Active Holds';
  if (status === 'FULFILLED') return 'Fulfilled';
  if (status === 'CANCELLED') return 'Cancelled';
  if (status === 'EXPIRED') return 'Expired';
  return 'All';
}

function statusTone(status: string) {
  if (status === 'FULFILLED') return 'bg-emerald-50 text-emerald-700';
  if (status === 'CANCELLED') return 'bg-rose-50 text-rose-700';
  if (status === 'ACTIVE') return 'bg-blue-50 text-blue-700';
  return 'bg-slate-100 text-slate-600';
}

function emptyMessage(status: Status, memberType: MemberType) {
  if (memberType === 'STAFF' || memberType === 'FACULTY') {
    return 'Reservations are recorded for students.';
  }
  if (status === 'EXPIRED') {
    return 'Hold expiry is not recorded, so none of these requests are marked expired.';
  }
  if (status === 'ACTIVE') {
    return 'Students can reserve books when all copies are issued. Reservations will appear here, ordered by queue position and reservation date.';
  }
  return 'Nothing in this view matches the current filters.';
}

function formatWhen(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
}

function toCsv(rows: LibraryReservation[]) {
  const header = [
    'Title',
    'Author',
    'Accession',
    'Requester',
    'Enrollment',
    'Department',
    'Reserved',
    'Status',
    'Queue',
  ];
  const lines = rows.map((row) => [
    row.book?.title ?? '',
    row.author ?? '',
    row.accessionNo ?? row.book?.accessionNo ?? '',
    row.studentName ?? '',
    row.enrollmentNumber ?? '',
    row.department ?? '',
    row.reservedAt,
    row.status,
    row.queuePosition ?? '',
  ]);
  return [header, ...lines].map((cols) => cols.map(csvCell).join(',')).join('\n');
}

function csvCell(value: string | number) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}
