'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  CalendarClock,
  Library,
  RotateCcw,
  Search,
  Settings,
  UserPlus,
  Users,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  fetchActiveLoans,
  fetchLibraryBookPreview,
  fetchLibraryBooks,
  fetchLibraryDeskContext,
  fetchLibraryIssuePreview,
  fetchLibraryMemberSummary,
  fetchLibraryMembers,
  fetchLibraryRenewPreview,
  fetchLibraryReturnPreview,
  fetchOverdueLoans,
  issueLibraryBook,
  payLibraryFine,
  renewLibraryLoan,
  reportLibraryCopyIncident,
  returnLibraryBook,
  waiveLibraryFine,
} from '@/services/library';
import type {
  LibraryBookPreview,
  LibraryLoan,
  LibraryMemberSummary,
  LibraryRenewPreview,
  LibraryReturnPreview,
} from '@/types/library';
import { apiErrorMessage } from '@/utils/api-error';

type Tab = 'issue' | 'return' | 'renew' | 'history';
type IssueLine = { barcode: string; accession: string; title: string; dueAt: string };

const TABS: { id: Tab; label: string }[] = [
  { id: 'issue', label: 'Issue Book' },
  { id: 'return', label: 'Return Book' },
  { id: 'renew', label: 'Renew Book' },
  { id: 'history', label: 'Member History' },
];

function money(value: number) {
  return `₹${value.toFixed(2)}`;
}

function fmtDate(iso?: string | null) {
  if (!iso) return 'Not applicable';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function accessionOf(loan: LibraryLoan) {
  const copy = loan.copy as {
    accessionNumber?: string | null;
    barcode: string;
    book: { accessionNo: string; title: string };
  };
  return copy.accessionNumber || copy.book.accessionNo || copy.barcode;
}

export function LibraryCirculationDesk() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const memberRef = useRef<HTMLInputElement>(null);
  const bookRef = useRef<HTMLInputElement>(null);
  const returnRef = useRef<HTMLInputElement>(null);
  const renewRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Tab>('issue');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [memberQuery, setMemberQuery] = useState('');
  const [bookQuery, setBookQuery] = useState('');
  const [member, setMember] = useState<LibraryMemberSummary | null>(null);
  const [book, setBook] = useState<LibraryBookPreview | null>(null);
  const [cart, setCart] = useState<IssueLine[]>([]);
  const [confirmIssue, setConfirmIssue] = useState(false);
  const [returnCode, setReturnCode] = useState('');
  const [returnPreview, setReturnPreview] = useState<LibraryReturnPreview | null>(null);
  const [condition, setCondition] = useState<'GOOD' | 'DAMAGED' | 'LOST'>('GOOD');
  const [conditionNote, setConditionNote] = useState('');
  const [damageCharge, setDamageCharge] = useState('');
  const [renewCode, setRenewCode] = useState('');
  const [renewPreview, setRenewPreview] = useState<LibraryRenewPreview | null>(null);
  const [showOverdue, setShowOverdue] = useState(false);
  const [showDueWeek, setShowDueWeek] = useState(false);

  const desk = useQuery({
    queryKey: ['library', 'circulation', 'desk-context'],
    queryFn: fetchLibraryDeskContext,
    enabled,
  });
  const overdue = useQuery({
    queryKey: ['library', 'circulation', 'overdue'],
    queryFn: fetchOverdueLoans,
    enabled: enabled && showOverdue,
  });
  const active = useQuery({
    queryKey: ['library', 'circulation', 'active'],
    queryFn: fetchActiveLoans,
    enabled: enabled && (tab === 'issue' || showDueWeek),
  });
  const memberHits = useQuery({
    queryKey: ['library', 'members', 'search', memberQuery],
    queryFn: () => fetchLibraryMembers({ search: memberQuery, limit: 6 }),
    enabled: enabled && memberQuery.trim().length > 2 && !member,
  });
  const bookHits = useQuery({
    queryKey: ['library', 'books', 'search', bookQuery],
    queryFn: () => fetchLibraryBooks({ search: bookQuery, limit: 6 }),
    enabled: enabled && tab === 'issue' && bookQuery.trim().length > 2 && !book,
  });

  useEffect(() => {
    const node =
      tab === 'issue'
        ? memberRef.current
        : tab === 'return'
          ? returnRef.current
          : tab === 'renew'
            ? renewRef.current
            : memberRef.current;
    node?.focus();
  }, [tab]);

  const stats = desk.data?.stats;
  const rules = desk.data?.rules;
  const dueThisWeek = (active.data ?? []).filter((loan) => {
    const due = new Date(loan.dueAt).getTime();
    return loan.status === 'ACTIVE' && due >= Date.now() && due <= Date.now() + 7 * 86_400_000;
  });
  const nextDue = member?.activeLoans.map((loan) => loan.dueAt).sort()[0];

  async function loadMember(code: string) {
    const scan = code.trim();
    if (!scan) return;
    setBusy(true);
    setNotice('');
    try {
      const summary = await fetchLibraryMemberSummary(scan);
      setMember(summary);
      setMemberQuery(summary.profile.fullName);
      bookRef.current?.focus();
    } catch (error) {
      setMember(null);
      setNotice(apiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function loadBook(code: string) {
    const scan = code.trim();
    if (!scan) return;
    setBusy(true);
    setNotice('');
    try {
      const preview = await fetchLibraryBookPreview(scan);
      setBook(preview);
      setBookQuery(preview.book.title);
    } catch (error) {
      setBook(null);
      setNotice(apiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function addBook() {
    if (!member || !book) {
      setNotice('Select a member and an available copy first.');
      return;
    }
    if (book.copy.status !== 'AVAILABLE') {
      setNotice(
        `This copy is ${book.copy.status.replaceAll('_', ' ').toLowerCase()} and cannot be issued.`,
      );
      return;
    }
    if (cart.some((line) => line.barcode === book.copy.barcode)) {
      setNotice('That copy is already in the issue list.');
      return;
    }
    if (member.borrowedCount + cart.length >= member.maxBooks) {
      setNotice(`Borrowing limit reached (${member.borrowedCount} of ${member.maxBooks}).`);
      return;
    }
    const scan = member.profile.registrationNumber || member.profile.memberId;
    try {
      const preview = await fetchLibraryIssuePreview(scan, book.copy.barcode);
      setCart((current) => [
        ...current,
        {
          barcode: book.copy.barcode,
          accession: book.book.accessionNo,
          title: book.book.title,
          dueAt: preview.dueAt,
        },
      ]);
      setBook(null);
      setBookQuery('');
      bookRef.current?.focus();
    } catch (error) {
      setNotice(apiErrorMessage(error));
    }
  }

  async function issueCart() {
    if (!member || !cart.length) return;
    const scan = member.profile.registrationNumber || member.profile.memberId;
    setBusy(true);
    setNotice('');
    const issued: string[] = [];
    try {
      for (const line of cart) {
        await issueLibraryBook(scan, line.barcode);
        issued.push(line.accession);
      }
      setNotice(
        `Issued ${issued.length} ${issued.length === 1 ? 'book' : 'books'} to ${member.profile.fullName}: ${issued.join(', ')}.`,
      );
      setCart([]);
      setBook(null);
      setConfirmIssue(false);
      await loadMember(scan);
      void qc.invalidateQueries({ queryKey: ['library', 'circulation'] });
    } catch (error) {
      setNotice(
        `${issued.length ? `Issued ${issued.join(', ')} before the next copy failed. ` : ''}${apiErrorMessage(error)}`,
      );
      setCart((current) => current.filter((line) => !issued.includes(line.accession)));
      setConfirmIssue(false);
    } finally {
      setBusy(false);
    }
  }

  async function loadReturn(code: string) {
    setBusy(true);
    setNotice('');
    try {
      setReturnPreview(await fetchLibraryReturnPreview(code.trim()));
    } catch (error) {
      setReturnPreview(null);
      setNotice(apiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function confirmReturn(action: 'return' | 'pay' | 'waive') {
    if (!returnPreview) return;
    setBusy(true);
    setNotice('');
    try {
      const charge = damageCharge.trim() ? Number(damageCharge) : 0;
      if (condition !== 'GOOD' && charge > 0) {
        await reportLibraryCopyIncident({
          copyBarcode: returnPreview.book.barcode,
          incidentType: condition,
          notes: conditionNote || undefined,
          chargeAmount: charge,
        });
        setNotice(
          `Closed the loan for ${returnPreview.book.title} and recorded a ${condition.toLowerCase()} charge of ${money(charge)}.`,
        );
      } else {
        const result = await returnLibraryBook(returnPreview.book.barcode);
        const fineId = result.fine?.id;
        if (condition === 'GOOD' && action === 'pay' && fineId)
          await payLibraryFine(fineId, 'Collected at return');
        if (condition === 'GOOD' && action === 'waive' && fineId)
          await waiveLibraryFine(fineId, 'Waived at return');
        if (condition !== 'GOOD') {
          await reportLibraryCopyIncident({
            copyBarcode: returnPreview.book.barcode,
            incidentType: condition,
            notes: conditionNote || undefined,
            chargeAmount: 0,
          });
        }
        setNotice(
          condition !== 'GOOD'
            ? `Returned ${returnPreview.book.title} as ${condition.toLowerCase()}. ${result.fine ? 'The overdue fine stays pending.' : 'No overdue fine was due.'}`
            : action === 'pay'
              ? `Returned ${returnPreview.book.title} and recorded the fine payment.`
              : action === 'waive'
                ? `Returned ${returnPreview.book.title}. The overdue fine was waived.`
                : `Returned ${returnPreview.book.title}. ${result.fine ? 'The fine stays pending.' : 'No fine was due.'}`,
        );
      }
      setReturnPreview(null);
      setReturnCode('');
      setCondition('GOOD');
      setConditionNote('');
      setDamageCharge('');
      void qc.invalidateQueries({ queryKey: ['library', 'circulation'] });
    } catch (error) {
      setNotice(apiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function loadRenew(code: string) {
    setBusy(true);
    setNotice('');
    try {
      setRenewPreview(await fetchLibraryRenewPreview(code.trim()));
    } catch (error) {
      setRenewPreview(null);
      setNotice(apiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function confirmRenew() {
    if (!renewPreview?.canRenew) return;
    setBusy(true);
    try {
      const loan = await renewLibraryLoan(renewPreview.barcode);
      setNotice(`Renewed ${renewPreview.bookTitle}. New due date ${fmtDate(loan.dueAt)}.`);
      setRenewPreview(null);
      setRenewCode('');
      void qc.invalidateQueries({ queryKey: ['library', 'circulation'] });
    } catch (error) {
      setNotice(apiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const blockReason = member
    ? !member.profile.active
      ? 'This membership is not active.'
      : member.borrowedCount >= member.maxBooks
        ? `Borrowing limit reached (${member.borrowedCount} of ${member.maxBooks}).`
        : rules?.blockIssueOnUnpaidFines && member.outstandingFine > 0
          ? `Unpaid library fine of ${money(member.outstandingFine)} blocks new issues.`
          : null
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">Library / Circulation</p>
          <h1 className="text-2xl font-semibold text-slate-900">Library Circulation</h1>
          <p className="text-sm text-slate-500">
            Issue, return and renew books for library members.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" asChild>
            <Link href="/admin/library/settings">
              <Settings className="mr-1 h-4 w-4" /> Circulation Rules
            </Link>
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/admin/library/settings">
              <RotateCcw className="mr-1 h-4 w-4" /> Renewal Settings
            </Link>
          </Button>
          <Button type="button" asChild>
            <Link href="/admin/library/members">
              <UserPlus className="mr-1 h-4 w-4" /> Add Member
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setTab('history');
              memberRef.current?.focus();
            }}
          >
            <Search className="mr-1 h-4 w-4" /> Member Search
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Stat
          href="/admin/library/catalogue"
          icon={<Library className="h-4 w-4" />}
          label="Total Books"
          value={stats?.totalCopies}
        />
        <Stat
          href="/admin/library/members"
          icon={<Users className="h-4 w-4" />}
          label="Total Members"
          value={stats?.totalMembers}
        />
        <Stat
          icon={<BookOpen className="h-4 w-4" />}
          label="Issued Books"
          value={stats?.issuedNow}
          hint={`Today: ${stats?.issuedToday ?? 0}`}
        />
        <Stat
          icon={<RotateCcw className="h-4 w-4" />}
          label="Returned Today"
          value={stats?.returnedToday}
        />
        <button type="button" className="text-left" onClick={() => setShowOverdue((open) => !open)}>
          <Stat
            icon={<CalendarClock className="h-4 w-4" />}
            label="Overdue Books"
            value={stats?.overdueLoans}
            warn
          />
        </button>
        <button type="button" className="text-left" onClick={() => setShowDueWeek((open) => !open)}>
          <Stat
            icon={<CalendarClock className="h-4 w-4" />}
            label="Due This Week"
            value={stats?.dueThisWeek}
          />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 md:grid-cols-4">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={
              item.id === tab
                ? 'rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white'
                : 'rounded-lg px-3 py-2 text-sm text-slate-600'
            }
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {notice ? (
        <p className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
          {notice}
        </p>
      ) : null}
      {busy ? <p className="text-sm text-slate-500">Working…</p> : null}

      {showOverdue ? <LoanList title="Overdue books" loans={overdue.data ?? []} /> : null}
      {showDueWeek ? <LoanList title="Due within seven days" loans={dueThisWeek} /> : null}

      {tab === 'issue' ? (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-xl border bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold">1. Select Member</h2>
              <div className="mt-3 flex gap-2">
                <Input
                  ref={memberRef}
                  placeholder="Scan member card or search name, enrolment no."
                  value={memberQuery}
                  onChange={(event) => {
                    setMemberQuery(event.target.value);
                    setMember(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void loadMember(memberQuery);
                  }}
                />
                <Button type="button" onClick={() => void loadMember(memberQuery)}>
                  Search
                </Button>
              </div>
              {(memberHits.data?.items ?? []).length && !member ? (
                <ul className="mt-2 divide-y rounded-lg border text-sm">
                  {memberHits.data?.items.map((item) => (
                    <li key={`${item.memberType}-${item.memberId}`}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-slate-50"
                        onClick={() =>
                          item.registrationNumber && void loadMember(item.registrationNumber)
                        }
                      >
                        {item.fullName} · {item.registrationNumber || item.memberType}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {member ? (
                <MemberCard member={member} />
              ) : (
                <p className="mt-4 text-sm text-slate-500">
                  Scan a card or search to load a member.
                </p>
              )}
              {blockReason ? (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {blockReason}
                </p>
              ) : null}
            </section>
            <section className="rounded-xl border bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold">2. Select Book</h2>
              <div className="mt-3 flex gap-2">
                <Input
                  ref={bookRef}
                  placeholder="Scan book barcode or search title, author, accession no."
                  value={bookQuery}
                  onChange={(event) => {
                    setBookQuery(event.target.value);
                    setBook(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void loadBook(bookQuery);
                  }}
                />
                <Button type="button" variant="outline" onClick={() => void loadBook(bookQuery)}>
                  Search
                </Button>
              </div>
              {(bookHits.data?.items ?? []).length && !book ? (
                <ul className="mt-2 divide-y rounded-lg border text-sm">
                  {bookHits.data?.items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-slate-50"
                        onClick={() => void loadBook(item.copies?.[0]?.barcode || item.accessionNo)}
                      >
                        {item.title} · {item.accessionNo}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {book ? (
                <BookCard book={book} />
              ) : (
                <p className="mt-4 text-sm text-slate-500">
                  Scan a barcode or search the catalogue.
                </p>
              )}
              <div className="mt-3 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setBook(null);
                    setBookQuery('');
                  }}
                >
                  Clear
                </Button>
                <Button
                  type="button"
                  disabled={!book || book.copy.status !== 'AVAILABLE' || Boolean(blockReason)}
                  onClick={() => void addBook()}
                >
                  Add to Issue List
                </Button>
              </div>
            </section>
          </div>
          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">3. Books to Issue</h2>
              <Button type="button" variant="ghost" size="sm" onClick={() => setCart([])}>
                Clear selected books
              </Button>
            </div>
            <table className="mt-3 w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2">#</th>
                  <th>Accession no.</th>
                  <th>Book title</th>
                  <th>Due date</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {cart.map((line, index) => (
                  <tr key={line.barcode} className="border-t">
                    <td className="py-2">{index + 1}</td>
                    <td className="font-mono text-xs">{line.accession}</td>
                    <td>{line.title}</td>
                    <td>{fmtDate(line.dueAt)}</td>
                    <td>
                      <button
                        type="button"
                        className="text-red-600"
                        onClick={() =>
                          setCart((current) =>
                            current.filter((item) => item.barcode !== line.barcode),
                          )
                        }
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!cart.length ? (
              <p className="py-4 text-sm text-slate-500">No books selected.</p>
            ) : null}
            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                disabled={!cart.length || Boolean(blockReason) || busy}
                onClick={() => setConfirmIssue(true)}
              >
                Issue Books to Member ({cart.length})
              </Button>
            </div>
          </section>
        </div>
      ) : null}

      {tab === 'return' ? (
        <section className="rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold">Scan the returned book</h2>
          <div className="mt-3 flex gap-2">
            <Input
              ref={returnRef}
              placeholder="Book barcode or accession number"
              value={returnCode}
              onChange={(event) => setReturnCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void loadReturn(returnCode);
              }}
            />
            <Button type="button" onClick={() => void loadReturn(returnCode)}>
              Find loan
            </Button>
          </div>
          {returnPreview ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
              <div className="space-y-2 text-sm">
                <p className="text-lg font-semibold">{returnPreview.book.title}</p>
                <p>
                  Accession {returnPreview.book.accessionNo} ·{' '}
                  {returnPreview.book.author || 'Author not recorded'}
                </p>
                <p>
                  Member {returnPreview.member?.fullName || 'Not recorded'} ·{' '}
                  {returnPreview.member?.registrationNumber || 'No ID'}
                </p>
                <p>
                  Issued {fmtDate(returnPreview.loan.issuedAt)} · Due{' '}
                  {fmtDate(returnPreview.loan.dueAt)}
                </p>
                <p>Overdue days after grace: {returnPreview.overdueDays}</p>
                <p>
                  Fine rate {money(returnPreview.finePerDay)} per day · Grace{' '}
                  {returnPreview.graceDays} days · Projected fine{' '}
                  {money(returnPreview.projectedFine)}
                </p>
                <label className="block">
                  Condition
                  <select
                    className="mt-1 h-10 w-full rounded-md border px-3"
                    value={condition}
                    onChange={(event) =>
                      setCondition(event.target.value as 'GOOD' | 'DAMAGED' | 'LOST')
                    }
                  >
                    <option value="GOOD">Good</option>
                    <option value="DAMAGED">Damaged</option>
                    <option value="LOST">Lost or incomplete</option>
                  </select>
                </label>
                {condition !== 'GOOD' ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      placeholder="Condition note"
                      value={conditionNote}
                      onChange={(event) => setConditionNote(event.target.value)}
                    />
                    <Input
                      placeholder="Damage charge, leave blank for none"
                      value={damageCharge}
                      onChange={(event) => setDamageCharge(event.target.value)}
                    />
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Button type="button" disabled={busy} onClick={() => void confirmReturn('return')}>
                  Confirm Return
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || returnPreview.projectedFine <= 0 || condition !== 'GOOD'}
                  onClick={() => void confirmReturn('pay')}
                >
                  Return and Collect Fine
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || returnPreview.projectedFine <= 0 || condition !== 'GOOD'}
                  onClick={() => void confirmReturn('return')}
                >
                  Record Fine as Pending
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy || returnPreview.projectedFine <= 0 || condition !== 'GOOD'}
                  onClick={() => void confirmReturn('waive')}
                >
                  Mark Fine Waived
                </Button>
                <Button type="button" variant="ghost" onClick={() => setReturnPreview(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              Scan the barcode on the physical book. If it was already returned, the desk shows its
              current status.
            </p>
          )}
        </section>
      ) : null}

      {tab === 'renew' ? (
        <section className="rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold">Find the active loan</h2>
          <div className="mt-3 flex gap-2">
            <Input
              ref={renewRef}
              placeholder="Book barcode or accession number"
              value={renewCode}
              onChange={(event) => setRenewCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void loadRenew(renewCode);
              }}
            />
            <Button type="button" onClick={() => void loadRenew(renewCode)}>
              Check renewal
            </Button>
          </div>
          {renewPreview ? (
            <div className="mt-4 space-y-2 text-sm">
              <p className="text-lg font-semibold">{renewPreview.bookTitle}</p>
              <p>Barcode {renewPreview.barcode}</p>
              <p>
                Renewals used {renewPreview.renewalCount} of {renewPreview.maxRenewals}
              </p>
              <p>Current due {fmtDate(renewPreview.currentDueAt)}</p>
              <p>Proposed due {fmtDate(renewPreview.newDueAt)}</p>
              {renewPreview.blockReason ? (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
                  {renewPreview.blockReason}
                </p>
              ) : null}
              <Button
                type="button"
                disabled={!renewPreview.canRenew || busy}
                onClick={() => void confirmRenew()}
              >
                Confirm Renewal
              </Button>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              Renewal limits, overdue blocks and the new due date come from the circulation rules.
            </p>
          )}
        </section>
      ) : null}

      {tab === 'history' ? (
        <section className="space-y-4">
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex gap-2">
              <Input
                ref={memberRef}
                placeholder="Member ID, enrolment number or card"
                value={memberQuery}
                onChange={(event) => setMemberQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void loadMember(memberQuery);
                }}
              />
              <Button type="button" onClick={() => void loadMember(memberQuery)}>
                Search
              </Button>
            </div>
            {member ? <MemberCard member={member} /> : null}
          </div>
          {member ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <LoanList title="Currently issued" loans={member.activeLoans} />
              <LoanList title="Returned" loans={member.returnedLoans ?? []} />
            </div>
          ) : null}
        </section>
      ) : null}

      {member && tab !== 'history' ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Summary
            title="Member Summary"
            rows={[
              ['Books issued', `${member.borrowedCount} / ${member.maxBooks}`],
              [
                'Overdue books',
                String(
                  member.activeLoans.filter((loan) => new Date(loan.dueAt) < new Date()).length,
                ),
              ],
              ['Outstanding fines', money(member.outstandingFine)],
              ['Membership', member.membershipStatus],
            ]}
          />
          <Summary
            title="Important Dates"
            rows={[
              ['Next due date', nextDue ? fmtDate(nextDue) : 'No active loans'],
              ['Last visit', member.lastVisitAt ? fmtDate(member.lastVisitAt) : 'Not applicable'],
            ]}
          />
        </div>
      ) : null}

      {confirmIssue && member ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold">Confirm issue</h2>
            <p className="mt-1 text-sm text-slate-600">
              {member.profile.fullName} · {member.profile.registrationNumber}
            </p>
            <ul className="mt-3 space-y-1 text-sm">
              {cart.map((line) => (
                <li key={line.barcode}>
                  {line.accession} · {line.title} · due {fmtDate(line.dueAt)}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm">
              Books after this issue: {member.borrowedCount + cart.length} of {member.maxBooks}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setConfirmIssue(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={busy} onClick={() => void issueCart()}>
                Confirm issue
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  warn,
  icon,
  href,
}: {
  label: string;
  value?: number;
  hint?: string;
  warn?: boolean;
  icon: ReactNode;
  href?: string;
}) {
  const body = (
    <div className={`rounded-xl border bg-white p-3 shadow-sm ${warn ? 'border-red-200' : ''}`}>
      <p className="flex items-center gap-2 text-xs text-slate-500">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold">{value ?? '…'}</p>
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function MemberCard({ member }: { member: LibraryMemberSummary }) {
  const profile = member.profile;
  return (
    <div className="mt-4 flex gap-3 rounded-xl border p-3">
      {profile.photoUrl ? (
        <img src={profile.photoUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-xs">
          Photo
        </div>
      )}
      <div className="text-sm">
        <p className="font-semibold">
          {profile.fullName}{' '}
          <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">
            {profile.active ? 'Active' : profile.status}
          </span>
        </p>
        <p>
          {profile.registrationNumber || 'No enrolment number'} · {profile.memberType}
        </p>
        <p>
          {profile.programme || 'Course not recorded'} ·{' '}
          {profile.department || 'Department not recorded'}
        </p>
        <p>
          Issued {member.borrowedCount} / {member.maxBooks} · Overdue{' '}
          {member.activeLoans.filter((loan) => new Date(loan.dueAt) < new Date()).length} · Fine{' '}
          {money(member.outstandingFine)}
        </p>
      </div>
    </div>
  );
}

function BookCard({ book }: { book: LibraryBookPreview }) {
  const available = book.copy.status === 'AVAILABLE';
  return (
    <div className="mt-4 rounded-xl border p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{book.book.title}</p>
          <p>{book.book.author || 'Author not recorded'}</p>
          <p>
            Accession {book.book.accessionNo} · Barcode {book.copy.barcode}
          </p>
          <p>
            Call no. {book.book.callNumber || 'Not recorded'} ·{' '}
            {book.book.category || 'No category'}
          </p>
          <p>
            ISBN {book.book.isbn || 'Not recorded'} ·{' '}
            {book.book.publisher || 'Publisher not recorded'} ·{' '}
            {book.book.edition || 'Edition not recorded'}
          </p>
          <p>Location {book.book.location || 'Not recorded'}</p>
        </div>
        <span
          className={
            available
              ? 'rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-800'
              : 'rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-900'
          }
        >
          {book.copy.status}
        </span>
      </div>
    </div>
  );
}

function LoanList({ title, loans }: { title: string; loans: LibraryLoan[] }) {
  return (
    <section className="rounded-xl border bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold">{title}</h2>
      {loans.length ? (
        <table className="mt-2 w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2">Accession</th>
              <th>Title</th>
              <th>Due</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loans.map((loan) => (
              <tr key={loan.id} className="border-t">
                <td className="py-2 font-mono text-xs">{accessionOf(loan)}</td>
                <td>{loan.copy.book.title}</td>
                <td>{fmtDate(loan.dueAt)}</td>
                <td>
                  {loan.returnedAt
                    ? `Returned ${fmtDate(loan.returnedAt)}`
                    : new Date(loan.dueAt) < new Date()
                      ? 'Overdue'
                      : 'On time'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="py-4 text-sm text-slate-500">No loans in this list.</p>
      )}
    </section>
  );
}

function Summary({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <section className="rounded-xl border bg-white p-4 text-sm shadow-sm">
      <h2 className="font-semibold">{title}</h2>
      <dl className="mt-2 space-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-slate-500">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
