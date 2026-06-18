'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, DoorOpen, Users } from 'lucide-react';

import { LibraryCirculationDesk } from '@/components/library/library-circulation-desk';
import { LibraryDashboard } from '@/components/library/library-dashboard';
import { LibrarySettingsPanel } from '@/components/library/library-settings-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  createLibraryBook,
  downloadLibraryReportCsv,
  fetchLibraryBooks,
  fetchLibraryCategories,
  fetchLibraryReport,
  fetchLibraryReservations,
  fetchLibraryVisits,
  fetchLibraryVisitors,
  fetchOverdueLoans,
  registerLibraryVisitor,
} from '@/services/library';
import { apiErrorMessage } from '@/utils/api-error';
import { downloadBlob } from '@/utils/download-blob';

type Page =
  | 'dashboard'
  | 'visits'
  | 'catalogue'
  | 'circulation'
  | 'reservations'
  | 'visitors'
  | 'reports'
  | 'settings';

type Props = { page?: Page };

export function LibraryWorkspace({ page = 'dashboard' }: Props) {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const [bookForm, setBookForm] = useState({
    accessionNo: '',
    title: '',
    author: '',
    totalCopies: 1,
  });
  const [visitorForm, setVisitorForm] = useState({
    fullName: '',
    mobile: '',
    institution: '',
    purpose: '',
  });

  const visits = useQuery({
    queryKey: ['library', 'visits'],
    queryFn: () => fetchLibraryVisits({ limit: 50 }),
    enabled: enabled && page === 'visits',
  });
  const books = useQuery({
    queryKey: ['library', 'books'],
    queryFn: () => fetchLibraryBooks({ limit: 50 }),
    enabled: enabled && page === 'catalogue',
  });
  const categories = useQuery({
    queryKey: ['library', 'categories'],
    queryFn: fetchLibraryCategories,
    enabled: enabled && page === 'catalogue',
  });
  const overdue = useQuery({
    queryKey: ['library', 'overdue'],
    queryFn: fetchOverdueLoans,
    enabled: enabled && page === 'reports',
  });
  const reservations = useQuery({
    queryKey: ['library', 'reservations'],
    queryFn: fetchLibraryReservations,
    enabled: enabled && page === 'reservations',
  });
  const visitors = useQuery({
    queryKey: ['library', 'visitors-list'],
    queryFn: fetchLibraryVisitors,
    enabled: enabled && page === 'visitors',
  });

  const createBookMut = useMutation({
    mutationFn: () => createLibraryBook(bookForm),
    onSuccess: () => {
      setMessage('Book created');
      void qc.invalidateQueries({ queryKey: ['library', 'books'] });
      setBookForm({ accessionNo: '', title: '', author: '', totalCopies: 1 });
    },
    onError: (e) => setMessage(apiErrorMessage(e)),
  });

  const visitorMut = useMutation({
    mutationFn: () => registerLibraryVisitor(visitorForm),
    onSuccess: (v) => {
      setMessage(`Visitor registered — pass ${v.passNumber}`);
      setVisitorForm({ fullName: '', mobile: '', institution: '', purpose: '' });
      void qc.invalidateQueries({ queryKey: ['library', 'visitors-list'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e)),
  });

  const deptReport = useQuery({
    queryKey: ['library', 'report', 'dept'],
    queryFn: () => fetchLibraryReport('visitors/department'),
    enabled: enabled && page === 'reports',
  });

  const digitalReport = useQuery({
    queryKey: ['library', 'report', 'digital'],
    queryFn: () => fetchLibraryReport('digital/downloads'),
    enabled: enabled && page === 'reports',
  });

  const popularDigitalReport = useQuery({
    queryKey: ['library', 'report', 'digital-popular'],
    queryFn: () => fetchLibraryReport('digital/popular'),
    enabled: enabled && page === 'reports',
  });

  const researchReport = useQuery({
    queryKey: ['library', 'report', 'research'],
    queryFn: () => fetchLibraryReport('research/usage'),
    enabled: enabled && page === 'reports',
  });

  if (page === 'dashboard') return <LibraryDashboard />;
  if (page === 'circulation') return <LibraryCirculationDesk />;
  if (page === 'settings') return <LibrarySettingsPanel />;

  if (page === 'visits') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <DoorOpen className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Visit History</h1>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left">Member</th>
                <th className="p-2 text-left">Type</th>
                <th className="p-2 text-left">In</th>
                <th className="p-2 text-left">Out</th>
                <th className="p-2 text-left">Duration</th>
              </tr>
            </thead>
            <tbody>
              {visits.data?.items.map((v) => (
                <tr key={v.id} className="border-t">
                  <td className="p-2">{v.memberName}</td>
                  <td className="p-2">{v.memberType}</td>
                  <td className="p-2">{new Date(v.entryAt).toLocaleString()}</td>
                  <td className="p-2">
                    {v.exitAt ? new Date(v.exitAt).toLocaleString() : 'Inside'}
                  </td>
                  <td className="p-2">{v.durationMinutes ? `${v.durationMinutes} min` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (page === 'catalogue') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Catalogue</h1>
        </div>
        {message ? <p className="text-sm">{message}</p> : null}
        <div className="grid gap-2 rounded-lg border p-4 md:grid-cols-5">
          <Input
            placeholder="Accession No"
            value={bookForm.accessionNo}
            onChange={(e) => setBookForm({ ...bookForm, accessionNo: e.target.value })}
          />
          <Input
            placeholder="Title"
            value={bookForm.title}
            onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })}
          />
          <Input
            placeholder="Author"
            value={bookForm.author}
            onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })}
          />
          <Input
            type="number"
            placeholder="Copies"
            value={bookForm.totalCopies}
            onChange={(e) => setBookForm({ ...bookForm, totalCopies: Number(e.target.value) })}
          />
          <Button disabled={createBookMut.isPending} onClick={() => createBookMut.mutate()}>
            Add Book
          </Button>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left">Accession</th>
                <th className="p-2 text-left">Title</th>
                <th className="p-2 text-left">Author</th>
                <th className="p-2 text-left">Copies</th>
                <th className="p-2 text-left">Available</th>
              </tr>
            </thead>
            <tbody>
              {books.data?.items.map((b) => (
                <tr key={b.id} className="border-t">
                  <td className="p-2">{b.accessionNo}</td>
                  <td className="p-2">{b.title}</td>
                  <td className="p-2">{b.author ?? '—'}</td>
                  <td className="p-2">{b.totalCopies}</td>
                  <td className="p-2">
                    {b.copies?.filter((c) => c.status === 'AVAILABLE').length ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {categories.data?.length ? (
          <p className="text-xs text-muted-foreground">
            {categories.data.length} categories loaded
          </p>
        ) : null}
      </div>
    );
  }

  if (page === 'reservations') {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold">Reservations</h1>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left">Book</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Reserved</th>
              </tr>
            </thead>
            <tbody>
              {reservations.data?.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.book?.title ?? r.bookId}</td>
                  <td className="p-2">{r.status}</td>
                  <td className="p-2">{new Date(r.reservedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (page === 'visitors') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Visitors</h1>
        </div>
        {message ? <p className="text-sm">{message}</p> : null}
        <div className="grid gap-2 rounded-lg border p-4 md:grid-cols-5">
          <Input
            placeholder="Name"
            value={visitorForm.fullName}
            onChange={(e) => setVisitorForm({ ...visitorForm, fullName: e.target.value })}
          />
          <Input
            placeholder="Mobile"
            value={visitorForm.mobile}
            onChange={(e) => setVisitorForm({ ...visitorForm, mobile: e.target.value })}
          />
          <Input
            placeholder="Institution"
            value={visitorForm.institution}
            onChange={(e) => setVisitorForm({ ...visitorForm, institution: e.target.value })}
          />
          <Input
            placeholder="Purpose"
            value={visitorForm.purpose}
            onChange={(e) => setVisitorForm({ ...visitorForm, purpose: e.target.value })}
          />
          <Button disabled={visitorMut.isPending} onClick={() => visitorMut.mutate()}>
            Register
          </Button>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left">Pass</th>
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-left">Institution</th>
              </tr>
            </thead>
            <tbody>
              {visitors.data?.map((v) => (
                <tr key={v.id} className="border-t">
                  <td className="p-2 font-mono">{v.passNumber}</td>
                  <td className="p-2">{v.fullName}</td>
                  <td className="p-2">{v.institution ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (page === 'reports') {
    const deptRows =
      (deptReport.data as { rows?: { departmentName: string; count: number }[] })?.rows ?? [];
    type DigitalLog = { asset?: { title?: string }; createdAt?: string };
    type PopularRow = { title?: string; downloads?: number };
    type ResearchLog = { item?: { title?: string }; action?: string; createdAt?: string };

    const digitalLogs = Array.isArray(digitalReport.data)
      ? (digitalReport.data as DigitalLog[])
      : [];
    const popularRows = Array.isArray(popularDigitalReport.data)
      ? (popularDigitalReport.data as PopularRow[])
      : [];
    const researchLogs = Array.isArray(researchReport.data)
      ? (researchReport.data as ResearchLog[])
      : [];

    const exportCsv = async (path: string, filename: string) => {
      try {
        const csv = await downloadLibraryReportCsv(path);
        downloadBlob(new Blob([csv], { type: 'text/csv' }), filename);
        setMessage(`Exported ${filename}`);
      } catch (e) {
        setMessage(apiErrorMessage(e));
      }
    };

    return (
      <div className="space-y-6">
        <h1 className="text-lg font-semibold">Reports</h1>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void exportCsv('department-visitors.csv', 'department-visitors.csv')}
          >
            Export department visitors (CSV)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void exportCsv('accession.csv', 'accession-register.csv')}
          >
            Export accession register (CSV)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void exportCsv('overdue.csv', 'overdue-loans.csv')}
          >
            Export overdue loans (CSV)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void exportCsv('fines.csv', 'library-fines.csv')}
          >
            Export fines (CSV)
          </Button>
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="font-medium">Department-wise visitors (today)</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {deptRows.map((r) => (
              <li key={r.departmentName}>
                {r.departmentName}: {r.count}
              </li>
            ))}
            {!deptRows.length ? <li className="text-muted-foreground">No data yet</li> : null}
          </ul>
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="font-medium">Digital downloads</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {digitalLogs.map((r, i) => (
              <li key={i}>
                {r.asset?.title ?? 'Unknown'} —{' '}
                {r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}
              </li>
            ))}
            {!digitalLogs.length ? (
              <li className="text-muted-foreground">No digital download data yet</li>
            ) : null}
          </ul>
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="font-medium">Popular digital assets</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {popularRows.map((r, i) => (
              <li key={r.title ?? i}>
                {r.title}: {r.downloads ?? 0}
              </li>
            ))}
            {!popularRows.length ? (
              <li className="text-muted-foreground">No popular assets yet</li>
            ) : null}
          </ul>
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="font-medium">Research repository usage</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {researchLogs.map((r, i) => (
              <li key={i}>
                {r.item?.title ?? 'Unknown'} — {r.action ?? 'access'}{' '}
                {r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}
              </li>
            ))}
            {!researchLogs.length ? (
              <li className="text-muted-foreground">No research usage data yet</li>
            ) : null}
          </ul>
        </div>

        {overdue.data?.length ? (
          <p className="text-sm text-amber-700">{overdue.data.length} overdue loan(s)</p>
        ) : null}
      </div>
    );
  }

  return null;
}
