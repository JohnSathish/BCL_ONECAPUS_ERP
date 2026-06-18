'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  ClipboardList,
  RefreshCw,
  RotateCw,
  Search,
  User,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useLibraryRealtime } from '@/hooks/use-library-realtime';
import {
  fetchLibraryBookPreview,
  fetchLibraryBooks,
  fetchLibraryDashboardActivity,
  fetchLibraryDeskContext,
  fetchLibraryFines,
  fetchLibraryIssuePreview,
  fetchLibraryMemberSummary,
  fetchLibraryRenewPreview,
  fetchLibraryReservationQueue,
  fetchLibraryReturnPreview,
  issueLibraryBook,
  payLibraryFine,
  renewLibraryLoan,
  returnLibraryBook,
  waiveLibraryFine,
} from '@/services/library';
import type {
  LibraryActivityItem,
  LibraryBookPreview,
  LibraryCirculationDeskContext,
  LibraryIssuePreview,
  LibraryMemberSummary,
  LibraryRenewPreview,
  LibraryReturnPreview,
} from '@/types/library';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

type DeskMode = 'issue' | 'return' | 'renew';

function playBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.value = 0.06;
    osc.start();
    setTimeout(() => {
      osc.stop();
      void ctx.close();
    }, 120);
  } catch {
    /* ignore */
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function daysLeft(dueAt: string) {
  const diff = Math.ceil((new Date(dueAt).getTime() - Date.now()) / 86_400_000);
  return diff;
}

function loanStatusLabel(dueAt: string) {
  const left = daysLeft(dueAt);
  if (left < 0) return { label: 'Overdue', tone: 'text-red-600 bg-red-50' };
  if (left <= 3) return { label: `${left}d left`, tone: 'text-amber-700 bg-amber-50' };
  return { label: 'Active', tone: 'text-emerald-700 bg-emerald-50' };
}

function BookCover({ title }: { title: string }) {
  return (
    <div className="flex h-32 w-24 shrink-0 flex-col items-center justify-center rounded-lg border bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 shadow-sm dark:from-amber-950/40 dark:via-orange-950/30 dark:to-amber-900/20">
      <BookOpen className="mb-2 h-8 w-8 text-amber-700/70" />
      <span className="px-1 text-center text-[10px] font-bold leading-tight text-amber-900/80">
        {title.slice(0, 24)}
      </span>
    </div>
  );
}

function MemberPhoto({
  name,
  photoUrl,
  size = 'lg',
}: {
  name: string;
  photoUrl?: string | null;
  size?: 'lg' | 'md';
}) {
  const dim = size === 'lg' ? 'h-24 w-24' : 'h-16 w-16';
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={name}
        className={`${dim} rounded-xl border object-cover shadow-sm`}
      />
    );
  }
  return (
    <div className={`${dim} flex items-center justify-center rounded-xl border bg-muted shadow-sm`}>
      <User className="h-10 w-10 text-muted-foreground" />
    </div>
  );
}

function StatPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border bg-card px-4 py-2.5 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cn('text-xl font-bold tabular-nums', accent)}>{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-dashed py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export function LibraryCirculationDesk() {
  const qc = useQueryClient();
  const enabled = useAuthQueryEnabled();
  const scanRef = useRef<HTMLInputElement>(null);
  const [scanBuffer, setScanBuffer] = useState('');
  const [mode, setMode] = useState<DeskMode>('issue');
  const [message, setMessage] = useState('');
  const [memberScan, setMemberScan] = useState('');
  const [copyBarcode, setCopyBarcode] = useState('');
  const [member, setMember] = useState<LibraryMemberSummary | null>(null);
  const [book, setBook] = useState<LibraryBookPreview | null>(null);
  const [issuePreview, setIssuePreview] = useState<LibraryIssuePreview | null>(null);
  const [issueBlock, setIssueBlock] = useState<string | null>(null);
  const [returnPreview, setReturnPreview] = useState<LibraryReturnPreview | null>(null);
  const [renewPreview, setRenewPreview] = useState<LibraryRenewPreview | null>(null);
  const [quickSearch, setQuickSearch] = useState('');
  const [searchKind, setSearchKind] = useState<'book' | 'member' | 'accession' | 'barcode'>('book');
  const [recentTx, setRecentTx] = useState<LibraryActivityItem[]>([]);

  const deskContext = useQuery({
    queryKey: ['library', 'circulation', 'desk-context'],
    queryFn: fetchLibraryDeskContext,
    enabled,
    refetchInterval: 30_000,
  });

  const activity = useQuery({
    queryKey: ['library', 'dashboard', 'activity', 'desk'],
    queryFn: () => fetchLibraryDashboardActivity(10),
    enabled,
    refetchInterval: 10_000,
  });

  const reservationQueue = useQuery({
    queryKey: ['library', 'reservations', 'queue'],
    queryFn: fetchLibraryReservationQueue,
    enabled,
  });

  const memberFines = useQuery({
    queryKey: ['library', 'fines', 'member', member?.profile.studentId],
    queryFn: () => fetchLibraryFines('UNPAID'),
    enabled: enabled && Boolean(member),
  });

  useEffect(() => {
    if (activity.data?.length) setRecentTx(activity.data);
  }, [activity.data]);

  useLibraryRealtime({
    onCirculationActivity: (item) => {
      setRecentTx((prev) => [item, ...prev.filter((p) => p.at !== item.at)].slice(0, 10));
      void qc.invalidateQueries({ queryKey: ['library', 'circulation', 'desk-context'] });
    },
  });

  const bookReservation = useMemo(() => {
    if (!book?.book.id || !reservationQueue.data) return null;
    return reservationQueue.data.find((g) => g.bookId === book.book.id) ?? null;
  }, [book?.book.id, reservationQueue.data]);

  const filteredFines = useMemo(() => {
    if (!member?.profile.studentId) return memberFines.data ?? [];
    return (memberFines.data ?? []).filter((f) => f.loan?.studentId === member.profile.studentId);
  }, [member?.profile.studentId, memberFines.data]);

  const loadMember = useMutation({
    mutationFn: (code: string) => fetchLibraryMemberSummary(code),
    onSuccess: (data) => {
      setMember(data);
      setMemberScan(data.profile.registrationNumber ?? data.profile.memberId);
      playBeep();
      setMessage('');
      setIssueBlock(null);
    },
    onError: (e) => setMessage(apiErrorMessage(e)),
  });

  const loadBook = useMutation({
    mutationFn: async (barcode: string) => {
      const preview = await fetchLibraryBookPreview(barcode);
      if (mode === 'return') {
        const ret = await fetchLibraryReturnPreview(barcode);
        return { preview, ret, ren: null as LibraryRenewPreview | null };
      }
      if (mode === 'renew') {
        const ren = await fetchLibraryRenewPreview(barcode);
        return { preview, ret: null as LibraryReturnPreview | null, ren };
      }
      return { preview, ret: null, ren: null };
    },
    onSuccess: async ({ preview, ret, ren }) => {
      setBook(preview);
      setCopyBarcode(preview.copy.barcode);
      setReturnPreview(ret);
      setRenewPreview(ren);
      playBeep();
      if (ret?.member?.registrationNumber && mode === 'return') {
        void loadMember.mutate(ret.member.registrationNumber);
      }
      if (mode === 'issue' && memberScan) {
        try {
          const ip = await fetchLibraryIssuePreview(memberScan, preview.copy.barcode);
          setIssuePreview(ip);
          setIssueBlock(null);
        } catch (e) {
          setIssuePreview(null);
          setIssueBlock(apiErrorMessage(e));
        }
      }
    },
    onError: (e) => setMessage(apiErrorMessage(e)),
  });

  const issueMut = useMutation({
    mutationFn: () => issueLibraryBook(memberScan, copyBarcode),
    onSuccess: () => {
      setMessage('Book issued successfully');
      resetBook();
      void qc.invalidateQueries({ queryKey: ['library'] });
      if (memberScan) void loadMember.mutate(memberScan);
    },
    onError: (e) => setMessage(apiErrorMessage(e)),
  });

  const returnMut = useMutation({
    mutationFn: () => returnLibraryBook(copyBarcode),
    onSuccess: (result) => {
      const fine = (result as { fine?: { id: string; amount: number } | null })?.fine;
      setMessage(
        fine && Number(fine.amount) > 0
          ? `Returned — overdue fine ₹${Number(fine.amount).toFixed(2)} created`
          : 'Book returned successfully',
      );
      resetBook();
      resetMember();
      void qc.invalidateQueries({ queryKey: ['library'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e)),
  });

  const renewMut = useMutation({
    mutationFn: () => renewLibraryLoan(copyBarcode),
    onSuccess: () => {
      setMessage('Loan renewed');
      resetBook();
      void qc.invalidateQueries({ queryKey: ['library'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e)),
  });

  const quickSearchMut = useMutation({
    mutationFn: async () => {
      const q = quickSearch.trim();
      if (!q) return;
      if (searchKind === 'barcode') {
        await loadBook.mutateAsync(q);
        return;
      }
      if (searchKind === 'member') {
        await loadMember.mutateAsync(q);
        return;
      }
      const list = await fetchLibraryBooks({ search: q, limit: 8 });
      const item =
        searchKind === 'accession'
          ? (list.items.find((b) => b.accessionNo.toLowerCase() === q.toLowerCase()) ??
            list.items[0])
          : list.items[0];
      if (!item) throw new Error('No book found');
      const barcode = item.copies?.[0]?.barcode ?? item.accessionNo;
      await loadBook.mutateAsync(barcode);
    },
    onSuccess: () => setQuickSearch(''),
    onError: (e) => setMessage(apiErrorMessage(e)),
  });

  function resetBook() {
    setCopyBarcode('');
    setBook(null);
    setIssuePreview(null);
    setIssueBlock(null);
    setReturnPreview(null);
    setRenewPreview(null);
  }

  function resetMember() {
    setMember(null);
    setMemberScan('');
  }

  const processScan = useCallback(
    (raw: string) => {
      const code = raw.trim();
      if (!code) return;
      setScanBuffer('');

      if (mode === 'issue') {
        if (!member) {
          void loadMember.mutate(code);
          return;
        }
        if (code === memberScan || code.includes(memberScan)) {
          return;
        }
        void loadBook.mutate(code);
        return;
      }

      void loadBook.mutate(code);
    },
    [loadBook, loadMember, member, memberScan, mode],
  );

  useEffect(() => {
    scanRef.current?.focus();
  }, [mode]);

  useEffect(() => {
    resetBook();
    setMessage('');
  }, [mode]);

  useEffect(() => {
    if (mode !== 'issue' || !memberScan || !copyBarcode) {
      setIssuePreview(null);
      setIssueBlock(null);
      return;
    }
    void fetchLibraryIssuePreview(memberScan, copyBarcode)
      .then((p) => {
        setIssuePreview(p);
        setIssueBlock(null);
      })
      .catch((e) => {
        setIssuePreview(null);
        setIssueBlock(apiErrorMessage(e));
      });
  }, [mode, memberScan, copyBarcode]);

  const ctx = deskContext.data;
  const stats = ctx?.stats;
  const rules = ctx?.rules;
  const fineSummary = ctx?.fineSummary;

  const alerts = useMemo(() => {
    const items: { text: string; tone: 'warn' | 'error' }[] = [];
    if (member) {
      if (!member.profile.active || member.membershipStatus !== 'ACTIVE') {
        items.push({ text: 'Membership is not active', tone: 'error' });
      }
      if (mode === 'issue' && member.borrowedCount >= member.maxBooks) {
        items.push({
          text: `Student reached borrowing limit (${member.borrowedCount}/${member.maxBooks})`,
          tone: 'warn',
        });
      }
      if (mode === 'issue' && member.outstandingFine > 0 && rules?.blockIssueOnUnpaidFines) {
        items.push({
          text: `Outstanding fine ₹${member.outstandingFine.toFixed(2)} — issue blocked`,
          tone: 'error',
        });
      }
    }
    if (book && mode === 'issue' && book.copy.status !== 'AVAILABLE') {
      items.push({ text: `Book already ${book.copy.status.toLowerCase()}`, tone: 'error' });
    }
    if (issueBlock) items.push({ text: issueBlock, tone: 'error' });
    if (renewPreview && !renewPreview.canRenew && renewPreview.blockReason) {
      items.push({ text: renewPreview.blockReason, tone: 'warn' });
    }
    return items;
  }, [member, mode, book, issueBlock, renewPreview, rules?.blockIssueOnUnpaidFines]);

  const displayLoans = member?.activeLoans?.length ? member.activeLoans : [];

  const step = !member && mode === 'issue' ? 1 : !book ? 2 : 3;

  return (
    <div className="space-y-5">
      <input
        ref={scanRef}
        type="text"
        className="sr-only"
        value={scanBuffer}
        onChange={(e) => setScanBuffer(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            processScan(scanBuffer);
          }
        }}
        aria-label="Scanner input"
      />

      {/* Header + today's stats */}
      <div className="rounded-2xl border bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 p-5 text-white shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
              Library Operations
            </p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
              <ClipboardList className="h-7 w-7" />
              Circulation Desk
            </h1>
            <p className="mt-1 text-sm text-white/70">
              Scan member → scan book → choose action → confirm
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="shrink-0"
            onClick={() => {
              void deskContext.refetch();
              void activity.refetch();
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatPill
            label="Today's Issues"
            value={stats?.issuedToday ?? '—'}
            accent="text-sky-300"
          />
          <StatPill
            label="Today's Returns"
            value={stats?.returnedToday ?? '—'}
            accent="text-emerald-300"
          />
          <StatPill label="Renewals" value={stats?.renewalsToday ?? '—'} accent="text-violet-300" />
          <StatPill label="Overdue" value={stats?.overdueLoans ?? '—'} accent="text-amber-300" />
          <StatPill
            label="Fine Collection"
            value={stats ? `₹${stats.fineCollectedToday.toFixed(0)}` : '—'}
            accent="text-rose-300"
          />
        </div>
      </div>

      {/* Workflow steps */}
      <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
        {[
          { n: 1, label: 'Scan member', done: Boolean(member) || mode !== 'issue' },
          { n: 2, label: 'Scan book', done: Boolean(book) },
          { n: 3, label: 'Choose action', done: Boolean(book) },
          { n: 4, label: 'Confirm', done: false },
        ].map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            {i > 0 ? <span className="text-muted-foreground">→</span> : null}
            <span
              className={cn(
                'rounded-full px-3 py-1',
                step === s.n
                  ? 'bg-primary text-primary-foreground'
                  : s.done
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-muted text-muted-foreground',
              )}
            >
              {s.n}. {s.label}
            </span>
          </div>
        ))}
      </div>

      {message ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {message}
        </p>
      ) : null}

      {alerts.length ? (
        <div className="space-y-2">
          {alerts.map((a) => (
            <div
              key={a.text}
              className={cn(
                'flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm',
                a.tone === 'error'
                  ? 'border-red-200 bg-red-50 text-red-900'
                  : 'border-amber-200 bg-amber-50 text-amber-900',
              )}
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {a.text}
            </div>
          ))}
        </div>
      ) : null}

      {/* Quick search */}
      <div className="flex flex-wrap items-end gap-2 rounded-xl border bg-card p-3 shadow-sm">
        <div className="flex flex-wrap gap-1">
          {(
            [
              ['book', 'Search book'],
              ['member', 'Search member'],
              ['accession', 'Accession no'],
              ['barcode', 'Barcode'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setSearchKind(k)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium',
                searchKind === k ? 'bg-primary text-primary-foreground' : 'bg-muted',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex min-w-[240px] flex-1 gap-2">
          <Input
            placeholder="Quick search…"
            value={quickSearch}
            onChange={(e) => setQuickSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') quickSearchMut.mutate();
            }}
          />
          <Button
            variant="outline"
            disabled={!quickSearch.trim() || quickSearchMut.isPending}
            onClick={() => quickSearchMut.mutate()}
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {/* Mode selector — large center buttons */}
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                {
                  m: 'issue' as const,
                  label: 'Issue',
                  icon: ArrowUpRight,
                  color: 'from-sky-500 to-blue-600',
                },
                {
                  m: 'return' as const,
                  label: 'Return',
                  icon: ArrowDownLeft,
                  color: 'from-emerald-500 to-green-600',
                },
                {
                  m: 'renew' as const,
                  label: 'Renew',
                  icon: RotateCw,
                  color: 'from-violet-500 to-purple-600',
                },
              ] as const
            ).map(({ m, label, icon: Icon, color }) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  'rounded-2xl border-2 p-4 text-center transition-all',
                  mode === m
                    ? `border-transparent bg-gradient-to-br ${color} text-white shadow-lg scale-[1.02]`
                    : 'border-dashed bg-card hover:border-primary/40',
                )}
              >
                <Icon
                  className={cn('mx-auto mb-2 h-7 w-7', mode === m ? 'text-white' : 'text-primary')}
                />
                <span className="text-lg font-bold uppercase tracking-wide">{label}</span>
              </button>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Member card */}
            <section className="rounded-2xl border bg-card p-4 shadow-sm">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Step 1 · Member information
              </h2>
              {mode === 'issue' ? (
                <Input
                  className="mb-3"
                  placeholder="Scan member card / enrollment / RFID"
                  value={memberScan}
                  onChange={(e) => setMemberScan(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void loadMember.mutate(memberScan);
                  }}
                />
              ) : (
                <p className="mb-3 text-xs text-muted-foreground">
                  Member loads automatically when you scan an issued book in return/renew mode.
                </p>
              )}
              {member ? (
                <div className="flex gap-4">
                  <MemberPhoto name={member.profile.fullName} photoUrl={member.profile.photoUrl} />
                  <div className="min-w-0 flex-1">
                    <InfoRow label="Name" value={member.profile.fullName} />
                    <InfoRow label="Enrollment" value={member.profile.registrationNumber ?? '—'} />
                    <InfoRow label="Department" value={member.profile.department ?? '—'} />
                    <InfoRow label="Semester" value={member.profile.semester ?? '—'} />
                    <InfoRow
                      label="Books issued"
                      value={`${member.borrowedCount} / ${member.maxBooks}`}
                    />
                    <InfoRow
                      label="Outstanding fine"
                      value={`₹${member.outstandingFine.toFixed(2)}`}
                    />
                    <InfoRow
                      label="Membership"
                      value={
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-semibold',
                            member.membershipStatus === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800',
                          )}
                        >
                          {member.membershipStatus}
                        </span>
                      }
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
                  <User className="mb-2 h-10 w-10 opacity-40" />
                  Scan member to begin issue flow
                </div>
              )}
              {member && mode === 'issue' ? (
                <Button variant="ghost" size="sm" className="mt-2" onClick={resetMember}>
                  Clear member
                </Button>
              ) : null}
            </section>

            {/* Book card */}
            <section className="rounded-2xl border bg-card p-4 shadow-sm">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Step 2 · Book information
              </h2>
              <Input
                className="mb-3"
                placeholder="Scan book barcode or LIB:C QR"
                value={copyBarcode}
                onChange={(e) => setCopyBarcode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void loadBook.mutate(copyBarcode);
                }}
              />
              {book ? (
                <div className="flex gap-4">
                  <BookCover title={book.book.title} />
                  <div className="min-w-0 flex-1">
                    <InfoRow label="Title" value={book.book.title} />
                    <InfoRow label="Author" value={book.book.author ?? 'Unknown'} />
                    <InfoRow label="Accession" value={book.book.accessionNo} />
                    <InfoRow label="Barcode" value={book.copy.barcode} />
                    <InfoRow
                      label="Available"
                      value={
                        <span
                          className={cn(
                            'font-semibold',
                            book.copy.status === 'AVAILABLE'
                              ? 'text-emerald-600'
                              : 'text-amber-600',
                          )}
                        >
                          {book.copy.status === 'AVAILABLE' ? 'YES' : book.copy.status}
                        </span>
                      }
                    />
                    <InfoRow
                      label="Rack"
                      value={
                        [book.book.section, book.book.rack, book.book.shelf, book.book.location]
                          .filter(Boolean)
                          .join(' · ') ||
                        book.book.location ||
                        '—'
                      }
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
                  <BookOpen className="mb-2 h-10 w-10 opacity-40" />
                  Scan a copy to preview
                </div>
              )}
              {book ? (
                <Button variant="ghost" size="sm" className="mt-2" onClick={resetBook}>
                  Clear book
                </Button>
              ) : null}
            </section>
          </div>

          {/* Step 3 — Action panel */}
          <section className="rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Step 3 · Circulation action — {mode}
            </h2>

            {mode === 'issue' && issuePreview ? (
              <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Issue date</p>
                  <p className="font-semibold">{fmtDate(new Date().toISOString())}</p>
                </div>
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Due date</p>
                  <p className="font-semibold">{fmtDate(issuePreview.dueAt)}</p>
                </div>
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Loan period</p>
                  <p className="font-semibold">{issuePreview.loanDays} days</p>
                </div>
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Fine</p>
                  <p className="font-semibold">
                    ₹{issuePreview.finePerDay}/day after {issuePreview.graceDays} grace days
                  </p>
                </div>
              </div>
            ) : null}

            {mode === 'return' && returnPreview ? (
              <div className="mb-4 space-y-2">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-xl bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Issued</p>
                    <p className="font-semibold">{fmtDate(returnPreview.loan.issuedAt)}</p>
                  </div>
                  <div className="rounded-xl bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Due</p>
                    <p className="font-semibold">{fmtDate(returnPreview.loan.dueAt)}</p>
                  </div>
                  <div className="rounded-xl bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Returned</p>
                    <p className="font-semibold">{fmtDate(returnPreview.returnedAt)}</p>
                  </div>
                </div>
                {returnPreview.overdueDays > 0 ? (
                  <p className="text-sm text-amber-800">
                    Overdue: <strong>{returnPreview.overdueDays} day(s)</strong> · Projected fine:{' '}
                    <strong>₹{returnPreview.projectedFine.toFixed(2)}</strong>
                  </p>
                ) : (
                  <p className="text-sm text-emerald-700">Returned on time — no overdue fine</p>
                )}
              </div>
            ) : null}

            {mode === 'renew' && renewPreview ? (
              <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Current due</p>
                  <p className="font-semibold">{fmtDate(renewPreview.currentDueAt)}</p>
                </div>
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Renew count</p>
                  <p className="font-semibold">
                    {renewPreview.renewalCount}/{renewPreview.maxRenewals}
                  </p>
                </div>
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">New due</p>
                  <p className="font-semibold">{fmtDate(renewPreview.newDueAt)}</p>
                </div>
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Extension</p>
                  <p className="font-semibold">+{renewPreview.loanDays} days</p>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              {mode === 'issue' ? (
                <Button
                  size="lg"
                  className="min-w-[180px] rounded-xl bg-sky-600 hover:bg-sky-700"
                  disabled={
                    !memberScan ||
                    !copyBarcode ||
                    issueMut.isPending ||
                    Boolean(issueBlock) ||
                    book?.copy.status !== 'AVAILABLE'
                  }
                  onClick={() => issueMut.mutate()}
                >
                  Confirm issue
                </Button>
              ) : null}

              {mode === 'return' ? (
                <>
                  <Button
                    size="lg"
                    className="min-w-[180px] rounded-xl bg-emerald-600 hover:bg-emerald-700"
                    disabled={!copyBarcode || returnMut.isPending}
                    onClick={() => returnMut.mutate()}
                  >
                    Complete return
                  </Button>
                  {returnPreview?.existingFineId ? (
                    <>
                      <Button
                        size="lg"
                        variant="outline"
                        disabled={!returnPreview.existingFineId}
                        onClick={async () => {
                          if (!returnPreview.existingFineId) return;
                          try {
                            await payLibraryFine(returnPreview.existingFineId);
                            setMessage('Fine collected');
                            void qc.invalidateQueries({ queryKey: ['library'] });
                          } catch (e) {
                            setMessage(apiErrorMessage(e));
                          }
                        }}
                      >
                        Collect fine
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={async () => {
                          if (!returnPreview.existingFineId) return;
                          try {
                            await waiveLibraryFine(returnPreview.existingFineId, 'Waived at desk');
                            setMessage('Fine waived');
                            void qc.invalidateQueries({ queryKey: ['library'] });
                          } catch (e) {
                            setMessage(apiErrorMessage(e));
                          }
                        }}
                      >
                        Waive fine
                      </Button>
                    </>
                  ) : null}
                </>
              ) : null}

              {mode === 'renew' ? (
                <Button
                  size="lg"
                  className="min-w-[180px] rounded-xl bg-violet-600 hover:bg-violet-700"
                  disabled={!copyBarcode || renewMut.isPending || !renewPreview?.canRenew}
                  onClick={() => renewMut.mutate()}
                >
                  Confirm renewal
                </Button>
              ) : null}
            </div>
          </section>

          {/* Active loans */}
          <section className="rounded-2xl border bg-card p-4 shadow-sm">
            <h2 className="mb-3 font-semibold">
              Active loans {member ? `— ${member.profile.fullName}` : ''} ({displayLoans.length})
            </h2>
            {displayLoans.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                      <th className="p-2">Book</th>
                      <th className="p-2">Issue date</th>
                      <th className="p-2">Due date</th>
                      <th className="p-2">Days left</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayLoans.map((l) => {
                      const st = loanStatusLabel(l.dueAt);
                      return (
                        <tr key={l.id} className="border-b">
                          <td className="p-2 font-medium">{l.copy.book.title}</td>
                          <td className="p-2">{fmtDate(l.issuedAt)}</td>
                          <td className="p-2">{fmtDate(l.dueAt)}</td>
                          <td className="p-2 tabular-nums">{daysLeft(l.dueAt)}</td>
                          <td className="p-2">
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-xs font-medium',
                                st.tone,
                              )}
                            >
                              {st.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
                {member ? 'No active loans for this member' : 'Scan a member to view their loans'}
              </p>
            )}
          </section>

          {/* Reservations + recent transactions */}
          {bookReservation ? (
            <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
              <h2 className="mb-2 font-semibold text-amber-900">Reservation queue</h2>
              <p className="text-sm">
                <strong>{bookReservation.bookTitle}</strong> — waiting:{' '}
                <strong>{bookReservation.queue.filter((r) => r.status === 'ACTIVE').length}</strong>{' '}
                student(s)
              </p>
            </section>
          ) : null}

          <section className="rounded-2xl border bg-card p-4 shadow-sm">
            <h2 className="mb-3 font-semibold">Recent transactions</h2>
            {recentTx.length ? (
              <ul className="space-y-2">
                {recentTx.map((tx, i) => (
                  <li
                    key={`${tx.at}-${i}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                  >
                    <span className="text-xs text-muted-foreground">
                      {new Date(tx.at).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="font-medium">{tx.memberName}</span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-semibold',
                        tx.action === 'ISSUE'
                          ? 'bg-sky-100 text-sky-800'
                          : tx.action === 'RETURN'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-violet-100 text-violet-800',
                      )}
                    >
                      {tx.action === 'ISSUE'
                        ? 'Issued'
                        : tx.action === 'RETURN'
                          ? 'Returned'
                          : 'Renewed'}
                    </span>
                    <span className="text-muted-foreground">{tx.bookTitle}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No circulation activity yet today.</p>
            )}
          </section>
        </div>

        {/* Right sidebar */}
        <aside className="space-y-4">
          <RulesPanel rules={rules} />
          <FinePanel
            summary={fineSummary}
            fines={filteredFines}
            onPay={async (id) => {
              await payLibraryFine(id);
              setMessage('Fine collected');
              void qc.invalidateQueries({ queryKey: ['library'] });
            }}
            onWaive={async (id) => {
              await waiveLibraryFine(id, 'Waived at desk');
              setMessage('Fine waived');
              void qc.invalidateQueries({ queryKey: ['library'] });
            }}
            onMessage={setMessage}
          />
        </aside>
      </div>
    </div>
  );
}

function RulesPanel({ rules }: { rules: LibraryCirculationDeskContext['rules'] | undefined }) {
  if (!rules) {
    return (
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <h3 className="font-semibold">Library rules</h3>
        <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <h3 className="mb-3 font-semibold">Library rules</h3>
      <dl className="space-y-2 text-sm">
        <InfoRow label="Student books" value={rules.studentMaxBooks} />
        <InfoRow label="Faculty books" value={rules.facultyMaxBooks} />
        <InfoRow label="Staff books" value={rules.staffMaxBooks} />
        <InfoRow label="Student loan period" value={`${rules.studentLoanDays} days`} />
        <InfoRow label="Faculty loan period" value={`${rules.facultyLoanDays} days`} />
        <InfoRow label="Renewals (student)" value={rules.studentMaxRenewals} />
        <InfoRow label="Fine" value={`₹${rules.finePerDay}/day`} />
        <InfoRow label="Grace days" value={rules.graceDays} />
        <InfoRow label="Max fine" value={`₹${rules.maxFine}`} />
      </dl>
    </div>
  );
}

function FinePanel({
  summary,
  fines,
  onPay,
  onWaive,
  onMessage,
}: {
  summary: LibraryCirculationDeskContext['fineSummary'] | undefined;
  fines: Array<{ id: string; amount: number; loan?: { copy: { book: { title: string } } } }>;
  onPay: (id: string) => Promise<void>;
  onWaive: (id: string) => Promise<void>;
  onMessage: (msg: string) => void;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <h3 className="mb-3 font-semibold">Fine summary</h3>
      {summary ? (
        <dl className="mb-4 space-y-2 text-sm">
          <InfoRow label="Pending fine" value={`₹${summary.pending.toFixed(2)}`} />
          <InfoRow label="Collected today" value={`₹${summary.collectedToday.toFixed(2)}`} />
          <InfoRow label="Paid (total)" value={`₹${summary.paidTotal.toFixed(2)}`} />
          <InfoRow label="Waived (total)" value={`₹${summary.waivedTotal.toFixed(2)}`} />
        </dl>
      ) : null}

      {fines.length ? (
        <>
          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Member unpaid fines
          </p>
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {fines.map((fine) => (
              <li key={fine.id} className="rounded-lg border p-2 text-sm">
                <p className="font-medium">{fine.loan?.copy.book.title ?? 'Fine'}</p>
                <p className="text-muted-foreground">₹{Number(fine.amount).toFixed(2)}</p>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => onPay(fine.id).catch((e) => onMessage(apiErrorMessage(e)))}
                  >
                    Pay
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => onWaive(fine.id).catch((e) => onMessage(apiErrorMessage(e)))}
                  >
                    Waive
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">No unpaid fines for scanned member</p>
      )}
    </div>
  );
}
