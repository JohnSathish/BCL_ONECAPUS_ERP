'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, ClipboardList, DoorOpen, Settings, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  addLibraryCopy,
  createLibraryBook,
  downloadLibraryReportCsv,
  fetchActiveLoans,
  fetchLibraryBooks,
  fetchLibraryCategories,
  fetchLibraryDashboard,
  fetchLibraryFines,
  fetchLibraryFootfall,
  fetchLibraryReport,
  fetchLibraryReservations,
  fetchLibrarySettings,
  fetchLibraryVisits,
  fetchLibraryVisitors,
  fetchLibraryZoneOccupancy,
  fetchOverdueLoans,
  issueLibraryBook,
  notifyLibraryOverdue,
  payLibraryFine,
  registerLibraryVisitor,
  renewLibraryLoan,
  returnLibraryBook,
  updateLibrarySettings,
  waiveLibraryFine,
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

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

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
  const [issueForm, setIssueForm] = useState({ memberScan: '', copyBarcode: '' });
  const [returnBarcode, setReturnBarcode] = useState('');
  const [renewBarcode, setRenewBarcode] = useState('');
  const [visitorForm, setVisitorForm] = useState({
    fullName: '',
    mobile: '',
    institution: '',
    purpose: '',
  });
  const [settingsForm, setSettingsForm] = useState<{
    totalSeats?: number;
    finePerDay?: number;
    defaultLoanDays?: number;
    qrEntryEnabled?: boolean;
    selfCheckInEnabled?: boolean;
    zonesEnabled?: boolean;
    blockIssueOnUnpaidFines?: boolean;
    overdueNotifyEnabled?: boolean;
    maxRenewals?: number;
  }>({});

  const dashboard = useQuery({
    queryKey: ['library', 'dashboard'],
    queryFn: fetchLibraryDashboard,
    enabled,
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
    enabled,
  });
  const activeLoans = useQuery({
    queryKey: ['library', 'active-loans'],
    queryFn: fetchActiveLoans,
    enabled: enabled && page === 'circulation',
  });
  const overdue = useQuery({
    queryKey: ['library', 'overdue'],
    queryFn: fetchOverdueLoans,
    enabled: enabled && (page === 'circulation' || page === 'reports'),
  });
  const fines = useQuery({
    queryKey: ['library', 'fines'],
    queryFn: () => fetchLibraryFines('UNPAID'),
    enabled: enabled && page === 'circulation',
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
  const settings = useQuery({
    queryKey: ['library', 'settings'],
    queryFn: fetchLibrarySettings,
    enabled: enabled && page === 'settings',
  });

  const zoneOccupancy = useQuery({
    queryKey: ['library', 'zones', 'occupancy'],
    queryFn: fetchLibraryZoneOccupancy,
    enabled: enabled && page === 'settings',
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

  const issueMut = useMutation({
    mutationFn: () => issueLibraryBook(issueForm.memberScan, issueForm.copyBarcode),
    onSuccess: () => {
      setMessage('Book issued');
      setIssueForm({ memberScan: '', copyBarcode: '' });
      void qc.invalidateQueries({ queryKey: ['library'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e)),
  });

  const returnMut = useMutation({
    mutationFn: () => returnLibraryBook(returnBarcode),
    onSuccess: () => {
      setMessage('Book returned');
      setReturnBarcode('');
      void qc.invalidateQueries({ queryKey: ['library'] });
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

  const settingsMut = useMutation({
    mutationFn: () => updateLibrarySettings(settingsForm),
    onSuccess: () => {
      setMessage('Settings saved');
      void qc.invalidateQueries({ queryKey: ['library', 'settings'] });
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

  const footfall = useQuery({
    queryKey: ['library', 'footfall'],
    queryFn: fetchLibraryFootfall,
    enabled: enabled && page === 'dashboard',
  });

  if (page === 'dashboard') {
    const d = dashboard.data;
    const f = footfall.data ?? d?.footfallTrends;
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6" />
          <h1 className="text-xl font-semibold">Library Dashboard</h1>
        </div>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Today's Visitors" value={d?.todayVisitors ?? '—'} />
          <Kpi label="Current Occupancy" value={d?.occupancy.totalInside ?? '—'} />
          <Kpi label="Active Loans" value={d?.activeLoans ?? '—'} />
          <Kpi label="Overdue" value={d?.overdueLoans ?? '—'} />
          <Kpi label="Total Books" value={d?.totalBooks ?? '—'} />
          <Kpi label="Available Copies" value={d?.availableCopies ?? '—'} />
          <Kpi label="Digital Assets" value={d?.digitalAssets ?? '—'} />
          <Kpi label="Research Items" value={d?.researchItems ?? '—'} />
          <Kpi label="Week Footfall" value={d?.weekVisitors ?? '—'} />
          <Kpi label="Occupancy %" value={d ? `${d.occupancy.occupancyPercent}%` : '—'} />
          <Kpi label="Unpaid Fines" value={d?.unpaidFinesCount ?? '—'} />
          <Kpi
            label="Fine Outstanding"
            value={d ? `₹${(d.unpaidFinesTotal ?? 0).toFixed(0)}` : '—'}
          />
        </div>
        {f ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border p-4">
              <h2 className="mb-2 text-sm font-medium">Weekly footfall (last 7 days)</h2>
              <ul className="space-y-1 text-sm">
                {f.weekly.map((row) => (
                  <li key={row.date} className="flex justify-between">
                    <span>{row.date}</span>
                    <span>{row.count}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border p-4">
              <h2 className="mb-2 text-sm font-medium">Student vs staff (week)</h2>
              <p className="text-sm">Students: {f.studentVsStaff.students}</p>
              <p className="text-sm">Staff / faculty: {f.studentVsStaff.staff}</p>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

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

  if (page === 'circulation') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Circulation Desk</h1>
        </div>
        {message ? <p className="text-sm">{message}</p> : null}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border p-4">
            <h2 className="font-medium">Issue Book</h2>
            <div className="mt-3 space-y-2">
              <Input
                placeholder="Member card scan"
                value={issueForm.memberScan}
                onChange={(e) => setIssueForm({ ...issueForm, memberScan: e.target.value })}
              />
              <Input
                placeholder="Book barcode"
                value={issueForm.copyBarcode}
                onChange={(e) => setIssueForm({ ...issueForm, copyBarcode: e.target.value })}
              />
              <Button disabled={issueMut.isPending} onClick={() => issueMut.mutate()}>
                Issue
              </Button>
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <h2 className="font-medium">Return Book</h2>
            <div className="mt-3 space-y-2">
              <Input
                placeholder="Book barcode"
                value={returnBarcode}
                onChange={(e) => setReturnBarcode(e.target.value)}
              />
              <Button disabled={returnMut.isPending} onClick={() => returnMut.mutate()}>
                Return
              </Button>
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <h2 className="font-medium">Renew Loan</h2>
            <div className="mt-3 space-y-2">
              <Input
                placeholder="Book barcode"
                value={renewBarcode}
                onChange={(e) => setRenewBarcode(e.target.value)}
              />
              <Button
                variant="outline"
                disabled={!renewBarcode.trim()}
                onClick={async () => {
                  try {
                    await renewLibraryLoan(renewBarcode.trim());
                    setMessage('Loan renewed');
                    setRenewBarcode('');
                    void qc.invalidateQueries({ queryKey: ['library'] });
                  } catch (e) {
                    setMessage(apiErrorMessage(e));
                  }
                }}
              >
                Renew
              </Button>
            </div>
          </div>
        </div>
        <div>
          <h2 className="mb-2 font-medium">Active Loans ({activeLoans.data?.length ?? 0})</h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-2 text-left">Book</th>
                  <th className="p-2 text-left">Barcode</th>
                  <th className="p-2 text-left">Due</th>
                </tr>
              </thead>
              <tbody>
                {activeLoans.data?.map((l) => (
                  <tr key={l.id} className="border-t">
                    <td className="p-2">{l.copy.book.title}</td>
                    <td className="p-2">{l.copy.barcode}</td>
                    <td className="p-2">{new Date(l.dueAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {overdue.data?.length ? (
          <div>
            <h2 className="mb-2 font-medium">Overdue ({overdue.data.length})</h2>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-2 text-left">Book</th>
                    <th className="p-2 text-left">Due</th>
                    <th className="p-2 text-left">Days</th>
                    <th className="p-2 text-left">Projected fine</th>
                  </tr>
                </thead>
                <tbody>
                  {overdue.data.map((l) => (
                    <tr key={l.id} className="border-t">
                      <td className="p-2">{l.copy.book.title}</td>
                      <td className="p-2">{new Date(l.dueAt).toLocaleDateString()}</td>
                      <td className="p-2">{l.daysOverdue ?? '—'}</td>
                      <td className="p-2">₹{(l.projectedFine ?? 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    const r = await notifyLibraryOverdue();
                    setMessage(`Sent ${r.sent} overdue reminder(s)`);
                  } catch (e) {
                    setMessage(apiErrorMessage(e));
                  }
                }}
              >
                Send overdue reminders
              </Button>
            </div>
          </div>
        ) : null}

        {fines.data?.length ? (
          <div>
            <h2 className="mb-2 font-medium">Unpaid fines ({fines.data.length})</h2>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-2 text-left">Book</th>
                    <th className="p-2 text-left">Amount</th>
                    <th className="p-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {fines.data.map((fine) => (
                    <tr key={fine.id} className="border-t">
                      <td className="p-2">{fine.loan?.copy.book.title ?? '—'}</td>
                      <td className="p-2">₹{Number(fine.amount).toFixed(2)}</td>
                      <td className="p-2">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={async () => {
                              try {
                                await payLibraryFine(fine.id);
                                setMessage('Fine marked paid');
                                void qc.invalidateQueries({ queryKey: ['library'] });
                              } catch (e) {
                                setMessage(apiErrorMessage(e));
                              }
                            }}
                          >
                            Pay
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              try {
                                await waiveLibraryFine(fine.id, 'Waived at desk');
                                setMessage('Fine waived');
                                void qc.invalidateQueries({ queryKey: ['library'] });
                              } catch (e) {
                                setMessage(apiErrorMessage(e));
                              }
                            }}
                          >
                            Waive
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
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

  if (page === 'settings') {
    const s = settings.data;
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Library Settings</h1>
        </div>
        {message ? <p className="text-sm">{message}</p> : null}
        {s ? (
          <div className="grid max-w-md gap-3">
            <label className="text-sm">
              Total seats
              <input
                type="number"
                className="mt-1 w-full rounded border px-2 py-1"
                defaultValue={s.totalSeats}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, totalSeats: Number(e.target.value) })
                }
              />
            </label>
            <label className="text-sm">
              Fine per day
              <input
                type="number"
                className="mt-1 w-full rounded border px-2 py-1"
                defaultValue={Number(s.finePerDay)}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, finePerDay: Number(e.target.value) })
                }
              />
            </label>
            <label className="text-sm">
              Default loan days
              <input
                type="number"
                className="mt-1 w-full rounded border px-2 py-1"
                defaultValue={s.defaultLoanDays}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, defaultLoanDays: Number(e.target.value) })
                }
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                defaultChecked={s.qrEntryEnabled ?? true}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, qrEntryEnabled: e.target.checked })
                }
              />
              QR entry enabled
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                defaultChecked={s.selfCheckInEnabled ?? true}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, selfCheckInEnabled: e.target.checked })
                }
              />
              Self check-in (student portal)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                defaultChecked={s.zonesEnabled ?? true}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, zonesEnabled: e.target.checked })
                }
              />
              Smart seat zones
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                defaultChecked={s.blockIssueOnUnpaidFines ?? true}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, blockIssueOnUnpaidFines: e.target.checked })
                }
              />
              Block issue when unpaid fines exist
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                defaultChecked={s.overdueNotifyEnabled ?? true}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, overdueNotifyEnabled: e.target.checked })
                }
              />
              Daily overdue email reminders
            </label>
            <label className="text-sm">
              Max renewals per loan
              <input
                type="number"
                className="mt-1 w-full rounded border px-2 py-1"
                defaultValue={s.maxRenewals ?? 1}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, maxRenewals: Number(e.target.value) })
                }
              />
            </label>
            <Button disabled={settingsMut.isPending} onClick={() => settingsMut.mutate()}>
              Save
            </Button>
          </div>
        ) : null}
        {zoneOccupancy.data?.length ? (
          <div>
            <h2 className="mb-2 text-sm font-medium">Reading zones</h2>
            <ul className="space-y-1 text-sm">
              {zoneOccupancy.data.map((z) => (
                <li key={z.id} className="flex justify-between rounded border px-3 py-2">
                  <span>{z.name}</span>
                  <span>
                    {z.occupied ?? 0}/{z.totalSeats} ({z.occupancyPercent ?? 0}%)
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  return null;
}
