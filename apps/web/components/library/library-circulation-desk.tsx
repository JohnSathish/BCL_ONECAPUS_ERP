'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Barcode,
  BookOpen,
  Calendar,
  History,
  Library,
  Printer,
  RotateCcw,
  Search,
  Settings,
  UserPlus,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth, useAuthQueryEnabled } from '@/hooks/use-auth';
import { useBranding } from '@/hooks/use-branding';
import {
  newIssueReceiptNo,
  printIssueReceipt,
  type IssueReceiptSlip,
  type IssueReceiptWidth,
} from './library-issue-receipt';
import {
  fetchActiveLoans,
  fetchLibraryBookPreview,
  fetchLibraryBooks,
  fetchLibraryCategories,
  fetchLibraryDeskContext,
  fetchLibraryMemberSummary,
  fetchLibraryMembers,
  fetchLibraryRenewPreview,
  fetchLibraryReturnPreview,
  fetchOverdueLoans,
  issueLibraryBook,
  payLibraryFine,
  renewLibraryLoan,
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
import { COPY_TYPE_LABELS, type CopyType } from './library-copy-rules';

type Tab = 'issue' | 'return' | 'renew' | 'history';
type IssuedLine = {
  loanId: string;
  barcode: string;
  accession: string;
  title: string;
  author: string;
  dueAt: string;
  issuedAt: string;
};

const outlineAction =
  'inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50';

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'issue', label: 'Issue Book', icon: BookOpen },
  { id: 'return', label: 'Return Book', icon: RotateCcw },
  { id: 'renew', label: 'Renew Book', icon: Calendar },
  { id: 'history', label: 'Member History', icon: History },
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
    timeZone: 'Asia/Kolkata',
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
  const { session } = useAuth();
  const branding = useBranding();
  const qc = useQueryClient();
  const memberRef = useRef<HTMLInputElement>(null);
  const bookRef = useRef<HTMLInputElement>(null);
  const issuingRef = useRef(false);
  const returnRef = useRef<HTMLInputElement>(null);
  const renewRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Tab>('issue');
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('tab');
    if (
      requested === 'issue' ||
      requested === 'return' ||
      requested === 'renew' ||
      requested === 'history'
    ) {
      setTab(requested);
    }
  }, []);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [memberQuery, setMemberQuery] = useState('');
  const [bookQuery, setBookQuery] = useState('');
  const [member, setMember] = useState<LibraryMemberSummary | null>(null);
  const [book, setBook] = useState<LibraryBookPreview | null>(null);
  const [issuedNow, setIssuedNow] = useState<IssuedLine[]>([]);
  const [visit, setVisit] = useState<{ memberId: string; receiptNo: string } | null>(null);
  const [autoPrint, setAutoPrint] = useState(false);
  const [returnCode, setReturnCode] = useState('');
  const [returnPreview, setReturnPreview] = useState<LibraryReturnPreview | null>(null);
  const [condition, setCondition] = useState<'GOOD' | 'DAMAGED' | 'LOST'>('GOOD');
  const [returnRemarks, setReturnRemarks] = useState('');
  const [returnerType, setReturnerType] = useState<'BORROWER' | 'STUDENT' | 'STAFF' | 'OTHER'>(
    'BORROWER',
  );
  const [returnerName, setReturnerName] = useState('');
  const [returnerCode, setReturnerCode] = useState('');
  const [damageCharge, setDamageCharge] = useState('');
  const [renewCode, setRenewCode] = useState('');
  const [renewPreview, setRenewPreview] = useState<LibraryRenewPreview | null>(null);
  const [showOverdue, setShowOverdue] = useState(false);
  const [showDueWeek, setShowDueWeek] = useState(false);
  const [memberMode, setMemberMode] = useState<'scan' | 'search' | 'quick'>('scan');
  const [bookMode, setBookMode] = useState<'scan' | 'search' | 'category' | 'recent'>('scan');
  const [categoryId, setCategoryId] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptWidth, setReceiptWidth] = useState<IssueReceiptWidth>(80);
  const [lastReceipt, setLastReceipt] = useState<IssueReceiptSlip | null>(null);
  const [recentMembers, setRecentMembers] = useState<LibraryMemberSummary[]>([]);
  const [confirmRenewOpen, setConfirmRenewOpen] = useState(false);
  const [memberTerm, setMemberTerm] = useState('');
  const [bookTerm, setBookTerm] = useState('');

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
    enabled: enabled && showDueWeek,
  });
  const memberHits = useQuery({
    queryKey: ['library', 'members', 'search', memberTerm],
    queryFn: () => fetchLibraryMembers({ search: memberTerm, limit: 6 }),
    enabled: enabled && memberTerm.length > 2 && !member,
  });
  const bookHits = useQuery({
    queryKey: ['library', 'books', 'search', bookTerm],
    queryFn: () => fetchLibraryBooks({ search: bookTerm, limit: 6, facets: 'false' }),
    enabled:
      enabled &&
      tab === 'issue' &&
      bookMode !== 'category' &&
      bookMode !== 'recent' &&
      bookTerm.length > 2 &&
      !book,
  });
  const categories = useQuery({
    queryKey: ['library', 'categories'],
    queryFn: fetchLibraryCategories,
    enabled: enabled && tab === 'issue' && bookMode === 'category',
  });
  const categoryBooks = useQuery({
    queryKey: ['library', 'books', 'category', categoryId],
    queryFn: () => fetchLibraryBooks({ categoryId, limit: 8, facets: 'false' }),
    enabled: enabled && tab === 'issue' && bookMode === 'category' && Boolean(categoryId),
  });
  const recentBooks = useQuery({
    queryKey: ['library', 'books', 'latest-accession'],
    queryFn: () =>
      fetchLibraryBooks({ sort: 'accession', sortDir: 'desc', limit: 6, facets: 'false' }),
    enabled: enabled && tab === 'issue' && bookMode === 'recent',
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setMemberTerm(memberQuery.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [memberQuery]);
  useEffect(() => {
    const timer = window.setTimeout(() => setBookTerm(bookQuery.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [bookQuery]);

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

  useEffect(() => {
    const saved = window.localStorage.getItem('library-receipt-width');
    if (saved === '58' || saved === '80') setReceiptWidth(Number(saved) as IssueReceiptWidth);
    setAutoPrint(window.localStorage.getItem('library-auto-print-receipt') === '1');
  }, []);

  async function loadMember(code: string) {
    const scan = code.trim();
    if (!scan) return;
    setBusy(true);
    setNotice('');
    try {
      const summary = await fetchLibraryMemberSummary(scan);
      setMember(summary);
      setMemberQuery(summary.profile.fullName);
      setRecentMembers((current) =>
        [
          summary,
          ...current.filter((item) => item.profile.memberId !== summary.profile.memberId),
        ].slice(0, 5),
      );
      if (visit?.memberId !== summary.profile.memberId) {
        setVisit({ memberId: summary.profile.memberId, receiptNo: newIssueReceiptNo() });
        setIssuedNow([]);
        setLastReceipt(null);
      }
      setBook(null);
      setBookQuery('');
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

  function visitReceipt(
    forMember: LibraryMemberSummary,
    lines: IssuedLine[],
    receiptNo: string,
  ): IssueReceiptSlip {
    return receiptSlip({
      width: receiptWidth,
      receiptNo,
      issuedAt: lines[0]?.issuedAt || new Date().toISOString(),
      issuedBy: session?.user.displayName?.trim() || session?.user.email || '',
      member: forMember,
      collegeName: branding.displayName,
      address: collegeAddress(branding.displayName, branding.branding?.address),
      logoUrl: absoluteAsset(branding.logo),
      books: lines,
      notes,
    });
  }

  /** Issues the scanned copy to the loaded member straight away. The server re-checks every rule. */
  async function issueCopy(code: string) {
    const scan = code.trim();
    if (!scan || issuingRef.current) return;
    if (!member) {
      setNotice('Scan the member card first, then scan the book.');
      memberRef.current?.focus();
      return;
    }
    if (blockReason) {
      setNotice(blockReason);
      bookRef.current?.select();
      return;
    }
    const memberScan = member.profile.registrationNumber || member.profile.memberId;
    const receiptNo =
      visit?.memberId === member.profile.memberId ? visit.receiptNo : newIssueReceiptNo();
    issuingRef.current = true;
    setBusy(true);
    setNotice('');
    try {
      const { loan } = await issueLibraryBook(memberScan, scan, receiptNo);
      const storedReceipt = loan.receiptNo || receiptNo;
      const line: IssuedLine = {
        loanId: loan.id,
        barcode: loan.copy.barcode,
        accession: accessionOf(loan),
        title: loan.copy.book.title,
        author: loan.copy.book.author || '',
        dueAt: loan.dueAt,
        issuedAt: loan.issuedAt,
      };
      const lines = [...(visit?.memberId === member.profile.memberId ? issuedNow : []), line];
      setIssuedNow(lines);
      setVisit({ memberId: member.profile.memberId, receiptNo: storedReceipt });
      const refreshed = await fetchLibraryMemberSummary(memberScan).catch(() => null);
      if (refreshed) setMember(refreshed);
      const slip = visitReceipt(refreshed ?? member, lines, storedReceipt);
      setLastReceipt(slip);
      const printed = autoPrint ? printIssueReceipt(slip) : true;
      setNotice(
        `Issued "${line.title}" (${line.accession}) to ${member.profile.fullName}. Due ${fmtDate(line.dueAt)}.${
          printed ? '' : ' Allow pop-up windows to print the receipt.'
        }`,
      );
      setBook(null);
      setBookQuery('');
      void qc.invalidateQueries({ queryKey: ['library', 'circulation'] });
    } catch (error) {
      setNotice(apiErrorMessage(error));
    } finally {
      issuingRef.current = false;
      setBusy(false);
      window.setTimeout(() => {
        bookRef.current?.focus();
        bookRef.current?.select();
      }, 0);
    }
  }

  function printVisitReceipt() {
    if (!member || !issuedNow.length || !visit) return;
    const slip = visitReceipt(member, issuedNow, visit.receiptNo);
    setLastReceipt(slip);
    if (!printIssueReceipt(slip)) setNotice('Allow pop-up windows to print the receipt.');
  }

  function finishMember() {
    setMember(null);
    setMemberQuery('');
    setMemberTerm('');
    setIssuedNow([]);
    setVisit(null);
    setNotes('');
    setBook(null);
    setBookQuery('');
    memberRef.current?.focus();
  }

  function completeIssue() {
    if (!member || !issuedNow.length) return;
    printVisitReceipt();
    finishMember();
  }

  function reprintFromHistory(loan: LibraryLoan) {
    if (!member) return;
    const pool = [...member.activeLoans, ...(member.returnedLoans ?? [])];
    const group = loan.receiptNo ? pool.filter((row) => row.receiptNo === loan.receiptNo) : [loan];
    const rows = (group.length ? group : [loan]).sort(
      (left, right) => new Date(left.issuedAt).getTime() - new Date(right.issuedAt).getTime(),
    );
    const slip: IssueReceiptSlip = {
      width: receiptWidth,
      receiptNo: loan.receiptNo || legacyReceiptNo(loan),
      issuedAt: rows[0]?.issuedAt || loan.issuedAt,
      issuedBy: rows.find((row) => row.issuedByName)?.issuedByName || '',
      memberName: member.profile.fullName,
      memberId: member.profile.registrationNumber || member.profile.memberId,
      memberType: memberKind(member.profile.memberType),
      department: member.profile.department || '',
      collegeName: branding.displayName.toUpperCase(),
      address: collegeAddress(branding.displayName, branding.branding?.address),
      logoUrl: absoluteAsset(branding.logo),
      books: rows.map((row) => ({
        accession: accessionOf(row),
        title: row.copy.book.title,
        dueAt: row.dueAt,
      })),
    };
    setLastReceipt(slip);
    if (!printIssueReceipt(slip)) {
      setNotice('Allow pop-up windows to print the receipt.');
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
    const someoneElse = returnerType !== 'BORROWER';
    if (someoneElse && !returnerName.trim() && !returnerCode.trim()) {
      setNotice('Enter the name or ID of the person returning the book.');
      setBusy(false);
      return;
    }
    try {
      const charge = damageCharge.trim() ? Number(damageCharge) : 0;
      const result = await returnLibraryBook({
        copyBarcode: returnPreview.book.barcode,
        condition,
        damageCharge: condition === 'GOOD' ? undefined : charge,
        returnedByType: returnerType,
        returnedByName: someoneElse ? returnerName.trim() || undefined : undefined,
        returnedByCode: someoneElse ? returnerCode.trim() || undefined : undefined,
        remarks: returnRemarks.trim() || undefined,
      });
      const fineId = result.fine?.id;
      if (action === 'pay' && fineId) await payLibraryFine(fineId, 'Collected at return');
      if (action === 'waive' && fineId) await waiveLibraryFine(fineId, 'Waived at return');
      const by = someoneElse
        ? ` Brought back by ${returnerName.trim() || returnerCode.trim()}.`
        : '';
      const fineText =
        action === 'pay'
          ? 'The overdue fine was collected.'
          : action === 'waive'
            ? 'The overdue fine was waived.'
            : result.fine
              ? 'The overdue fine stays pending.'
              : 'No overdue fine was due.';
      setNotice(
        condition !== 'GOOD'
          ? `Returned ${returnPreview.book.title} as ${condition.toLowerCase()}${
              charge > 0 ? ` with a charge of ${money(charge)}` : ''
            }. ${fineText}${by}`
          : `Returned ${returnPreview.book.title}. ${fineText}${by}`,
      );
      setReturnPreview(null);
      setReturnCode('');
      setCondition('GOOD');
      setReturnRemarks('');
      setReturnerType('BORROWER');
      setReturnerName('');
      setReturnerCode('');
      setDamageCharge('');
      window.setTimeout(() => returnRef.current?.focus(), 0);
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
    ? member.membershipStatus === 'BLOCKED'
      ? member.blockReason
        ? `Borrowing is blocked: ${member.blockReason.replaceAll('_', ' ').toLowerCase()}.`
        : 'Borrowing is blocked for this member.'
      : member.membershipStatus === 'EXPIRED'
        ? 'This library membership has expired.'
        : !member.profile.active
          ? 'This membership is not active.'
          : member.borrowedCount >= member.maxBooks
            ? `Borrowing limit reached (${member.borrowedCount} of ${member.maxBooks}).`
            : rules?.blockIssueOnUnpaidFines && !member.fineExempt && member.outstandingFine > 0
              ? `Unpaid library fine of ${money(member.outstandingFine)} blocks new issues.`
              : null
    : null;

  const bookChoices =
    bookMode === 'category'
      ? (categoryBooks.data?.items ?? [])
      : bookMode === 'recent'
        ? (recentBooks.data?.items ?? [])
        : (bookHits.data?.items ?? []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#155EEF] text-white shadow-sm">
            <Library className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              Library Circulation
            </h1>
            <p className="text-sm text-slate-500">
              Issue, return and renew books for library members.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/library/settings" className={outlineAction}>
            <Settings className="h-4 w-4" />
            Circulation Rules
          </Link>
          <Link href="/admin/library/settings" className={outlineAction}>
            <RotateCcw className="h-4 w-4" />
            Renewal Settings
          </Link>
          <Link href="/admin/library/members" className={outlineAction}>
            <UserPlus className="h-4 w-4" />
            Add Member
          </Link>
          <button
            type="button"
            className={outlineAction}
            onClick={() => {
              setTab('history');
              memberRef.current?.focus();
            }}
          >
            <Search className="h-4 w-4" />
            Member Search
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat
          href="/admin/library/catalogue"
          icon={Library}
          tone="bg-blue-50 text-blue-600"
          label="Total Books"
          value={stats?.totalCopies}
          hint="Physical copies in library"
        />
        <Stat
          href="/admin/library/members"
          icon={Users}
          tone="bg-emerald-50 text-emerald-600"
          label="Total Members"
          value={stats?.totalMembers}
          hint="Students and staff on record"
        />
        <Stat
          icon={BookOpen}
          tone="bg-violet-50 text-violet-600"
          label="Issued Today"
          value={stats?.issuedToday}
          change={dayChange(stats?.issuedToday, stats?.issuedYesterday)}
          hint="Books issued today"
        />
        <Stat
          icon={RotateCcw}
          tone="bg-orange-50 text-orange-600"
          label="Returned Today"
          value={stats?.returnedToday}
          change={dayChange(stats?.returnedToday, stats?.returnedYesterday)}
          hint="Books returned today"
        />
        <button type="button" className="text-left" onClick={() => setShowOverdue((open) => !open)}>
          <Stat
            icon={AlertTriangle}
            tone="bg-rose-50 text-rose-600"
            label="Overdue Books"
            value={stats?.overdueLoans}
            hint="Books not yet returned"
          />
        </button>
        <button type="button" className="text-left" onClick={() => setShowDueWeek((open) => !open)}>
          <Stat
            icon={Calendar}
            tone="bg-cyan-50 text-cyan-600"
            label="Due This Week"
            value={stats?.dueThisWeek}
            hint="Books due in the next 7 days"
          />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {TABS.map((item) => {
          const Icon = item.icon;
          const active = item.id === tab;
          return (
            <button
              key={item.id}
              type="button"
              className={
                active
                  ? 'flex items-center justify-center gap-2 rounded-xl bg-[#155EEF] px-3 py-2.5 text-sm font-medium text-white shadow-sm'
                  : 'flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:border-blue-200'
              }
              onClick={() => setTab(item.id)}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {notice ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
          <p>{notice}</p>
          {lastReceipt ? (
            <Button type="button" variant="outline" onClick={() => printIssueReceipt(lastReceipt)}>
              Print receipt
            </Button>
          ) : null}
        </div>
      ) : null}
      {busy ? <p className="text-sm text-slate-500">Working…</p> : null}

      {showOverdue ? <LoanList title="Overdue books" loans={overdue.data ?? []} /> : null}
      {showDueWeek ? <LoanList title="Due within seven days" loans={dueThisWeek} /> : null}

      {tab === 'issue' ? (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-[18px] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
              <h2 className="flex items-center gap-2 font-semibold text-slate-900">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-[#155EEF]">
                  <Users className="h-4 w-4" />
                </span>
                1. Select Member
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {(
                  [
                    ['scan', 'Scan Member Card'],
                    ['search', 'Search Member'],
                    ['quick', 'Quick Member'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={
                      memberMode === id
                        ? 'rounded-lg bg-[#155EEF] px-3 py-1.5 text-xs font-medium text-white'
                        : 'rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50'
                    }
                    onClick={() => {
                      setMemberMode(id);
                      memberRef.current?.focus();
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Barcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    ref={memberRef}
                    className="h-10 border-slate-200 bg-[#F4F7FC] pl-9 text-sm"
                    placeholder="Scan member card or search name, enrolment number or roll number..."
                    value={memberQuery}
                    onChange={(event) => {
                      setMemberQuery(event.target.value);
                      setMember(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void loadMember(memberQuery);
                    }}
                  />
                </div>
                <Button
                  type="button"
                  className="h-10 shrink-0 bg-[#155EEF] px-4 hover:bg-blue-700"
                  onClick={() => void loadMember(memberQuery)}
                >
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
                <MemberCard member={member} blocked={blockReason} />
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                  <Users className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                  No member selected
                  <p className="mt-1 text-xs">Scan a card or search to load member details.</p>
                </div>
              )}
              <RecentMembers members={recentMembers} onPick={(code) => void loadMember(code)} />
              {blockReason ? (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {blockReason}
                </p>
              ) : null}
            </section>
            <section className="rounded-[18px] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
              <h2 className="flex items-center gap-2 font-semibold text-slate-900">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-[#155EEF]">
                  <BookOpen className="h-4 w-4" />
                </span>
                2. Select Book
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {(
                  [
                    ['scan', 'Scan Barcode'],
                    ['search', 'Search Catalogue'],
                    ['category', 'Browse by Category'],
                    ['recent', 'Recently Added'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={
                      bookMode === id
                        ? 'rounded-lg bg-[#155EEF] px-3 py-1.5 text-xs font-medium text-white'
                        : 'rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50'
                    }
                    onClick={() => {
                      setBookMode(id);
                      if (id === 'scan' || id === 'search') bookRef.current?.focus();
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {bookMode === 'category' ? (
                <select
                  className="mt-3 h-10 w-full rounded-md border px-3 text-sm"
                  aria-label="Category"
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                >
                  <option value="">Select a category</option>
                  {(categories.data ?? []).map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              ) : null}
              {bookMode === 'recent' ? (
                <p className="mt-2 text-xs text-slate-500">
                  Latest accession numbers on record. Acquisition date is not used.
                </p>
              ) : null}
              <div className="mt-3 flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Barcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    ref={bookRef}
                    className="h-10 border-slate-200 bg-[#F4F7FC] pl-9 text-sm"
                    placeholder={
                      bookMode === 'scan'
                        ? 'Scan book barcode or enter accession number...'
                        : 'Search title, author, accession no.'
                    }
                    value={bookQuery}
                    onChange={(event) => {
                      setBookQuery(event.target.value);
                      setBook(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') return;
                      event.preventDefault();
                      if (bookMode === 'scan') void issueCopy(event.currentTarget.value);
                      else void loadBook(bookQuery);
                    }}
                  />
                </div>
                <Button
                  type="button"
                  className="h-10 shrink-0 bg-[#155EEF] px-4 hover:bg-blue-700"
                  disabled={busy}
                  onClick={() =>
                    bookMode === 'scan' ? void issueCopy(bookQuery) : void loadBook(bookQuery)
                  }
                >
                  {bookMode === 'scan' ? 'Issue' : 'Search'}
                </Button>
              </div>
              {bookChoices.length && !book ? (
                <ul className="mt-2 divide-y rounded-lg border text-sm">
                  {bookChoices.map((item) => (
                    <li key={item.id} className="px-3 py-2">
                      <p className="font-medium">{item.title}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(item.copies?.length
                          ? item.copies
                          : [
                              {
                                id: item.id,
                                barcode: item.accessionNo,
                                accessionNumber: item.accessionNo,
                                status: '',
                                copyType: null,
                              },
                            ]
                        ).map((copy) => (
                          <button
                            key={copy.id}
                            type="button"
                            className="rounded-full border px-2 py-1 text-xs hover:bg-slate-50"
                            onClick={() => void loadBook(copy.barcode)}
                          >
                            {copy.accessionNumber || copy.barcode}
                            {copy.copyType ? ` · ${copyTypeName(copy.copyType)}` : ''} ·{' '}
                            {copy.status || 'Open'}
                          </button>
                        ))}
                      </div>
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
                  disabled={
                    !book ||
                    !member ||
                    busy ||
                    book.copy.status !== 'AVAILABLE' ||
                    book.issueAllowed === false ||
                    Boolean(blockReason)
                  }
                  onClick={() => book && void issueCopy(book.copy.barcode)}
                >
                  Issue Book
                </Button>
              </div>
            </section>
          </div>
          <section className="rounded-[18px] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
            <h2 className="font-semibold text-slate-900">
              3. Issued This Visit
              {issuedNow.length ? (
                <span className="ml-1 text-sm font-normal text-slate-500">
                  ({issuedNow.length} {issuedNow.length === 1 ? 'book' : 'books'})
                </span>
              ) : null}
            </h2>
            <div className="mt-3 grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
              {issuedNow.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="text-xs text-slate-500">
                      <tr>
                        {['Sl. No.', 'Book Title', 'Accession No.', 'Issue Date', 'Due Date'].map(
                          (header) => (
                            <th key={header} className="py-2 pr-3 font-medium">
                              {header}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {issuedNow.map((line, index) => (
                        <tr key={line.loanId} className="border-t border-slate-100">
                          <td className="py-2">{index + 1}</td>
                          <td className="py-2 font-medium text-slate-800">{line.title}</td>
                          <td className="py-2 font-mono text-xs">{line.accession}</td>
                          <td className="py-2">{fmtDate(line.issuedAt)}</td>
                          <td className="py-2">{fmtDate(line.dueAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-2 text-xs text-slate-500">
                    A scanned book is issued immediately. A wrong book is taken back on the Return
                    Book tab.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500">
                  <Library className="mx-auto mb-2 h-10 w-10 text-slate-300" />
                  No books issued yet
                  <p className="mt-1">
                    Scan the member card, then scan each book. Every scanned book is issued at once.
                  </p>
                </div>
              )}
              <div className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-3 text-sm">
                <p className="font-semibold text-slate-900">Issue Summary</p>
                <dl className="mt-2 space-y-2">
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Books in this visit</dt>
                    <dd className="font-semibold">{issuedNow.length}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Member limit</dt>
                    <dd className="font-semibold">{member ? member.maxBooks : '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Remaining limit</dt>
                    <dd className="font-semibold">
                      {member ? Math.max(0, member.maxBooks - member.borrowedCount) : '—'}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-slate-100 pt-4">
              <label className="block min-w-[240px] flex-1 text-sm">
                <span className="text-slate-500">Issue notes (optional)</span>
                <Input
                  className="mt-1"
                  placeholder="Shown on the printed receipt. Not stored on the loan."
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </label>
              <div className="text-sm text-slate-600">
                <p className="font-medium">Receipt width</p>
                <div className="mt-1 flex gap-1">
                  {([80, 58] as const).map((width) => (
                    <button
                      key={width}
                      type="button"
                      className={`rounded border px-2 py-1 text-xs ${
                        receiptWidth === width
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-700'
                      }`}
                      onClick={() => {
                        setReceiptWidth(width);
                        window.localStorage.setItem('library-receipt-width', String(width));
                      }}
                    >
                      {width} mm
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={autoPrint}
                  onChange={(event) => {
                    setAutoPrint(event.target.checked);
                    window.localStorage.setItem(
                      'library-auto-print-receipt',
                      event.target.checked ? '1' : '0',
                    );
                  }}
                />
                Print receipt after each scan
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!issuedNow.length || !member}
                  onClick={printVisitReceipt}
                >
                  <Printer className="mr-1 h-4 w-4" /> Print Receipt
                </Button>
                <Button
                  type="button"
                  className="bg-[#155EEF] hover:bg-blue-700"
                  disabled={!issuedNow.length || !member || busy}
                  onClick={completeIssue}
                >
                  Complete Issue
                </Button>
                <Button type="button" variant="outline" disabled={!member} onClick={finishMember}>
                  Done – Next Member
                </Button>
              </div>
            </div>
            {rules ? (
              <p className="mt-3 text-xs text-slate-500">
                Loan period: students {rules.studentLoanDays} working days, faculty{' '}
                {rules.facultyLoanDays} working days, counted from the day after issue. Sundays and
                holidays on the published academic calendar are skipped. A member&apos;s own
                membership period overrides this.
              </p>
            ) : null}
          </section>
        </div>
      ) : null}

      {tab === 'return' ? (
        <section className="rounded-[18px] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
          <h2 className="text-sm font-semibold">Scan the returned book</h2>
          <div className="mt-3 flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Barcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                ref={returnRef}
                className="h-10 border-slate-200 bg-[#F4F7FC] pl-9 text-sm"
                placeholder="Book barcode or accession number"
                value={returnCode}
                onChange={(event) => setReturnCode(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void loadReturn(returnCode);
                }}
              />
            </div>
            <Button
              type="button"
              className="h-10 shrink-0 bg-[#155EEF] px-4 hover:bg-blue-700"
              onClick={() => void loadReturn(returnCode)}
            >
              Find loan
            </Button>
          </div>
          {returnPreview ? (
            <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr_0.7fr]">
              <div className="space-y-1.5 rounded-xl border border-slate-200 p-4 text-sm">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Borrower Information
                </h3>
                <p className="text-base font-semibold text-slate-900">
                  {returnPreview.member?.fullName || 'Borrower not recorded'}
                </p>
                <p className="text-slate-600">
                  {returnPreview.member?.registrationNumber || 'No ID'}
                  {returnPreview.member?.department ? ` · ${returnPreview.member.department}` : ''}
                </p>
                <div className="my-2 border-t" />
                <p className="font-medium text-slate-900">{returnPreview.book.title}</p>
                <p className="text-slate-600">
                  Accession {returnPreview.book.accessionNo} ·{' '}
                  {returnPreview.book.author || 'Author not recorded'}
                </p>
                <p className="text-slate-600">
                  Issued {fmtDate(returnPreview.loan.issuedAt)} · Due{' '}
                  {fmtDate(returnPreview.loan.dueAt)}
                  {returnPreview.loan.renewalCount
                    ? ` · Renewed ${returnPreview.loan.renewalCount}×`
                    : ''}
                </p>
                <p className="text-slate-600">
                  Overdue working days after grace: {returnPreview.overdueDays}
                </p>
                <p
                  className={
                    returnPreview.projectedFine > 0 ? 'font-medium text-rose-700' : 'text-slate-600'
                  }
                >
                  Outstanding fine {money(returnPreview.projectedFine)} (
                  {money(returnPreview.finePerDay)} per overdue working day, grace{' '}
                  {returnPreview.graceDays} days)
                </p>
              </div>

              <div className="space-y-3 rounded-xl border border-slate-200 p-4 text-sm">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Return Information
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-slate-500">Return date and time</p>
                    <p className="font-medium">
                      {new Date().toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'Asia/Kolkata',
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Received by</p>
                    <p className="font-medium">
                      {session?.user.displayName?.trim() || session?.user.email || 'You'}
                    </p>
                  </div>
                </div>
                <label className="block">
                  <span className="text-xs text-slate-500">Returned by</span>
                  <select
                    className="mt-1 h-10 w-full rounded-md border px-3"
                    value={returnerType}
                    onChange={(event) =>
                      setReturnerType(
                        event.target.value as 'BORROWER' | 'STUDENT' | 'STAFF' | 'OTHER',
                      )
                    }
                  >
                    <option value="BORROWER">The borrower</option>
                    <option value="STUDENT">Another student</option>
                    <option value="STAFF">A staff member</option>
                    <option value="OTHER">Someone else</option>
                  </select>
                </label>
                {returnerType !== 'BORROWER' ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      placeholder="Name of person returning"
                      value={returnerName}
                      onChange={(event) => setReturnerName(event.target.value)}
                    />
                    <Input
                      placeholder={
                        returnerType === 'STUDENT'
                          ? 'Roll number (optional)'
                          : returnerType === 'STAFF'
                            ? 'Staff ID (optional)'
                            : 'ID or phone (optional)'
                      }
                      value={returnerCode}
                      onChange={(event) => setReturnerCode(event.target.value)}
                    />
                  </div>
                ) : null}
                <label className="block">
                  <span className="text-xs text-slate-500">Book condition</span>
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
                  <Input
                    inputMode="decimal"
                    placeholder="Damage or replacement charge (₹), blank for none"
                    value={damageCharge}
                    onChange={(event) => setDamageCharge(event.target.value)}
                  />
                ) : null}
                <label className="block">
                  <span className="text-xs text-slate-500">Remarks</span>
                  <Input
                    className="mt-1"
                    placeholder="Optional"
                    value={returnRemarks}
                    onChange={(event) => setReturnRemarks(event.target.value)}
                  />
                </label>
              </div>

              <div className="flex flex-col gap-2">
                <Button type="button" disabled={busy} onClick={() => void confirmReturn('return')}>
                  Confirm Return
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || returnPreview.projectedFine <= 0}
                  onClick={() => void confirmReturn('pay')}
                >
                  Return and Collect Fine
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || returnPreview.projectedFine <= 0}
                  onClick={() => void confirmReturn('return')}
                >
                  Record Fine as Pending
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy || returnPreview.projectedFine <= 0}
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
        <section className="rounded-[18px] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
          <h2 className="text-sm font-semibold">Find the active loan</h2>
          <div className="mt-3 flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Barcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                ref={renewRef}
                className="h-10 border-slate-200 bg-[#F4F7FC] pl-9 text-sm"
                placeholder="Book barcode or accession number"
                value={renewCode}
                onChange={(event) => setRenewCode(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void loadRenew(renewCode);
                }}
              />
            </div>
            <Button
              type="button"
              className="h-10 shrink-0 bg-[#155EEF] px-4 hover:bg-blue-700"
              onClick={() => void loadRenew(renewCode)}
            >
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
                onClick={() => setConfirmRenewOpen(true)}
              >
                Confirm Renewal
              </Button>
              {confirmRenewOpen ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
                  <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
                    <h2 className="text-lg font-semibold">Confirm renewal</h2>
                    <p className="mt-2 text-sm">{renewPreview.bookTitle}</p>
                    <p className="text-sm text-slate-600">
                      New due date {fmtDate(renewPreview.newDueAt)}. Renewal{' '}
                      {renewPreview.renewalCount + 1} of {renewPreview.maxRenewals}.
                    </p>
                    <div className="mt-4 flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setConfirmRenewOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setConfirmRenewOpen(false);
                          void confirmRenew();
                        }}
                      >
                        Renew
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
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
          <div className="rounded-[18px] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  ref={memberRef}
                  className="h-10 border-slate-200 bg-[#F4F7FC] pl-9 text-sm"
                  placeholder="Member ID, enrolment number or card"
                  value={memberQuery}
                  onChange={(event) => setMemberQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void loadMember(memberQuery);
                  }}
                />
              </div>
              <Button
                type="button"
                className="h-10 shrink-0 bg-[#155EEF] px-4 hover:bg-blue-700"
                onClick={() => void loadMember(memberQuery)}
              >
                Search
              </Button>
            </div>
            {member ? <MemberCard member={member} /> : null}
          </div>
          {member ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <LoanList
                title="Currently issued"
                loans={member.activeLoans}
                onReprint={reprintFromHistory}
              />
              <LoanList
                title="Returned"
                loans={member.returnedLoans ?? []}
                onReprint={reprintFromHistory}
              />
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
    </div>
  );
}

function dayChange(current?: number, previous?: number) {
  if (current == null || previous == null || previous <= 0) return null;
  const value = Math.round(((current - previous) / previous) * 1000) / 10;
  return { text: `${value > 0 ? '+' : ''}${value}%`, up: value >= 0 };
}

function memberKind(type: LibraryMemberSummary['profile']['memberType']) {
  if (type === 'FACULTY') return 'Faculty';
  if (type === 'STAFF') return 'Staff';
  if (type === 'RESEARCH_SCHOLAR') return 'Research scholar';
  if (type === 'VISITOR') return 'Visitor';
  return 'Student';
}

function collegeAddress(name: string, address?: string | null) {
  const saved = address?.trim();
  if (saved) return saved;
  if (/don bosco/i.test(name)) return 'Tura, Meghalaya – 794002';
  return '';
}

function absoluteAsset(url?: string | null) {
  if (!url) return '';
  if (/^https?:/i.test(url)) return url;
  if (typeof window === 'undefined') return url;
  return `${window.location.origin}${url.startsWith('/') ? url : `/${url}`}`;
}

function legacyReceiptNo(loan: LibraryLoan) {
  const date = new Date(loan.issuedAt);
  const year = String(date.getFullYear()).slice(2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `IR${year}${month}${day}${loan.id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

function receiptSlip(input: {
  width: IssueReceiptWidth;
  receiptNo: string;
  issuedAt: string;
  issuedBy: string;
  member: LibraryMemberSummary;
  collegeName: string;
  address: string;
  logoUrl: string;
  books: Array<{ accession: string; title: string; dueAt: string }>;
  notes?: string;
}): IssueReceiptSlip {
  return {
    width: input.width,
    receiptNo: input.receiptNo,
    issuedAt: input.issuedAt,
    issuedBy: input.issuedBy,
    memberName: input.member.profile.fullName,
    memberId: input.member.profile.registrationNumber || input.member.profile.memberId,
    memberType: memberKind(input.member.profile.memberType),
    department: input.member.profile.department || '',
    collegeName: input.collegeName.toUpperCase(),
    address: input.address,
    logoUrl: input.logoUrl,
    books: input.books.map((book) => ({
      accession: book.accession,
      title: book.title,
      dueAt: book.dueAt,
    })),
    notes: input.notes?.trim() || undefined,
  };
}

function Stat({
  label,
  value,
  hint,
  change,
  icon: Icon,
  tone,
  href,
}: {
  label: string;
  value?: number;
  hint: string;
  change?: { text: string; up: boolean } | null;
  icon: LucideIcon;
  tone: string;
  href?: string;
}) {
  const body = (
    <div className="flex h-full items-start justify-between gap-2 rounded-[16px] bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5">
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          {value == null ? '—' : value.toLocaleString('en-IN')}
          {change ? (
            <span
              className={change.up ? 'ml-1 text-xs text-emerald-600' : 'ml-1 text-xs text-rose-600'}
              title="Compared with yesterday"
            >
              {change.text}
            </span>
          ) : null}
        </p>
        <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>
      </div>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone}`}>
        <Icon className="h-4 w-4" />
      </span>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function eligibilityOf(member: LibraryMemberSummary, blocked?: string | null) {
  if (member.membershipStatus === 'EXPIRED') {
    return { label: 'Membership expired', tone: 'bg-orange-50 text-orange-700' };
  }
  if (member.membershipStatus === 'BLOCKED' || blocked) {
    return { label: 'Borrowing restricted', tone: 'bg-rose-50 text-rose-700' };
  }
  if (!member.profile.active) {
    return { label: 'Pending action', tone: 'bg-orange-50 text-orange-700' };
  }
  return { label: 'Eligible to Borrow', tone: 'bg-emerald-50 text-emerald-700' };
}

function MemberCard({
  member,
  blocked,
}: {
  member: LibraryMemberSummary;
  blocked?: string | null;
}) {
  const profile = member.profile;
  const overdue = member.activeLoans.filter((loan) => new Date(loan.dueAt) < new Date()).length;
  const eligibility = eligibilityOf(member, blocked);
  const roleLine =
    profile.memberType === 'FACULTY' || profile.memberType === 'STAFF'
      ? profile.designation || memberKind(profile.memberType)
      : profile.semester
        ? `Semester ${profile.semester}`
        : profile.programme || memberKind(profile.memberType);
  return (
    <div className="mt-4 rounded-xl border border-slate-100 bg-[#F8FAFC] p-3">
      <div className="flex gap-3">
        {profile.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.photoUrl} alt="" className="h-16 w-16 rounded-xl object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-blue-100 text-sm font-semibold text-[#155EEF]">
            {profile.fullName.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-slate-900">{profile.fullName}</p>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${eligibility.tone}`}
            >
              {eligibility.label}
            </span>
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
            <div>
              <dt className="text-slate-400">Roll / Staff ID</dt>
              <dd className="font-medium text-slate-800">{profile.registrationNumber || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Department</dt>
              <dd className="font-medium text-slate-800">{profile.department || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Semester / Designation</dt>
              <dd className="font-medium text-slate-800">{roleLine}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Membership ID</dt>
              <dd className="font-medium text-slate-800">{profile.memberId}</dd>
            </div>
          </dl>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-white px-2 py-2">
          <p className="text-slate-400">Books issued</p>
          <p className="font-semibold text-slate-900">
            {member.borrowedCount} / {member.maxBooks}
          </p>
        </div>
        <div className="rounded-lg bg-white px-2 py-2">
          <p className="text-slate-400">Pending returns</p>
          <p className="font-semibold text-slate-900">{overdue}</p>
        </div>
        <div className="rounded-lg bg-white px-2 py-2">
          <p className="text-slate-400">Outstanding fine</p>
          <p className="font-semibold text-slate-900">{money(member.outstandingFine)}</p>
        </div>
      </div>
      {blocked ? <p className="mt-2 text-xs text-rose-700">{blocked}</p> : null}
    </div>
  );
}

function RecentMembers({
  members,
  onPick,
}: {
  members: LibraryMemberSummary[];
  onPick: (code: string) => void;
}) {
  return (
    <div className="mt-3">
      <p className="mb-2 text-xs font-medium text-slate-500">Recent members</p>
      {members.length ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {members.map((item) => (
            <button
              key={item.profile.memberId}
              type="button"
              className="flex w-28 shrink-0 flex-col items-center rounded-xl border border-slate-100 bg-white px-2 py-2 text-center hover:border-blue-200"
              onClick={() => onPick(item.profile.registrationNumber || item.profile.memberId)}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-[11px] font-semibold text-[#155EEF]">
                {item.profile.fullName.slice(0, 2).toUpperCase()}
              </span>
              <span className="mt-1 w-full truncate text-xs font-medium text-slate-800">
                {item.profile.fullName}
              </span>
              <span className="w-full truncate text-[10px] text-slate-400">
                {item.profile.registrationNumber || item.profile.memberType}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400">Members you open in this session appear here.</p>
      )}
    </div>
  );
}

function copyTypeName(type?: string | null) {
  if (!type) return 'Copy type not set';
  return COPY_TYPE_LABELS[type as CopyType] ?? type;
}

function bookAvailability(book: LibraryBookPreview) {
  if (book.issueAllowed === false) {
    return {
      label: 'Not available',
      tone: 'bg-slate-100 text-slate-600',
    };
  }
  const status = book.copy.status.toUpperCase();
  if (status === 'AVAILABLE') return { label: 'Available', tone: 'bg-emerald-50 text-emerald-700' };
  if (status === 'ISSUED' || status === 'ON_LOAN') {
    return { label: 'Already Issued', tone: 'bg-rose-50 text-rose-700' };
  }
  if (status === 'RESERVED') return { label: 'Reserved', tone: 'bg-orange-50 text-orange-700' };
  return { label: book.copy.status || 'Not available', tone: 'bg-slate-100 text-slate-600' };
}

function BookCard({ book }: { book: LibraryBookPreview }) {
  const availability = bookAvailability(book);
  const shelf = [book.book.shelf, book.book.rack].filter(Boolean).join(' / ');
  return (
    <div className="mt-4 rounded-xl border border-slate-100 bg-[#F8FAFC] p-3 text-sm">
      <div className="flex gap-3">
        {book.book.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={book.book.coverImageUrl}
            alt=""
            className="h-24 w-16 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-24 w-16 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-[#155EEF]">
            <BookOpen className="h-6 w-6" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-slate-900">{book.book.title}</p>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${availability.tone}`}
            >
              {availability.label}
            </span>
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
            <div>
              <dt className="text-slate-400">Author</dt>
              <dd>{book.book.author || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Accession No.</dt>
              <dd className="font-mono">{book.book.accessionNo}</dd>
            </div>
            <div>
              <dt className="text-slate-400">ISBN</dt>
              <dd>{book.book.isbn || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Publisher</dt>
              <dd>{book.book.publisher || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Edition</dt>
              <dd>{book.book.edition || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Category</dt>
              <dd>{book.book.category || copyTypeName(book.copy.copyType)}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-slate-400">Shelf / Rack</dt>
              <dd>{shelf || book.book.location || '—'}</dd>
            </div>
          </dl>
          {book.issueAllowed === false && book.issueMessage ? (
            <p className="mt-2 text-xs font-medium text-rose-700">{book.issueMessage}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function LoanList({
  title,
  loans,
  onReprint,
}: {
  title: string;
  loans: LibraryLoan[];
  onReprint?: (loan: LibraryLoan) => void;
}) {
  return (
    <section className="rounded-[18px] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
      <h2 className="text-sm font-semibold">{title}</h2>
      {loans.length ? (
        <table className="mt-2 w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2">Accession</th>
              <th>Title</th>
              <th>Due</th>
              <th>Status</th>
              {onReprint ? <th /> : null}
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
                {onReprint ? (
                  <td className="text-right">
                    <button
                      type="button"
                      className="text-xs font-medium text-violet-800"
                      onClick={() => onReprint(loan)}
                    >
                      Reprint
                    </button>
                  </td>
                ) : null}
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
    <section className="rounded-[18px] bg-white p-4 text-sm shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
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
