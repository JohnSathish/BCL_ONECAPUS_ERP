'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Barcode,
  BookOpen,
  Calendar,
  History,
  Info,
  Library,
  RotateCcw,
  Search,
  Settings,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  librarySearchButtonClass,
  librarySearchInputClass,
  librarySearchPanelClass,
} from '@/components/library/library-search-panel';
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
import { COPY_TYPE_LABELS, type CopyType } from './library-copy-rules';

type Tab = 'issue' | 'return' | 'renew' | 'history';
type IssueLine = {
  barcode: string;
  accession: string;
  title: string;
  author: string;
  category: string;
  copyType: string;
  callNumber: string;
  publisher: string;
  edition: string;
  publicationYear: string;
  coverImageUrl: string;
  dueAt: string;
};

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
  const [memberMode, setMemberMode] = useState<'scan' | 'search' | 'quick'>('scan');
  const [bookMode, setBookMode] = useState<'scan' | 'search' | 'category' | 'recent'>('scan');
  const [categoryId, setCategoryId] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptWidth, setReceiptWidth] = useState<IssueReceiptWidth>(80);
  const [lastReceipt, setLastReceipt] = useState<IssueReceiptSlip | null>(null);
  const [recentMembers, setRecentMembers] = useState<LibraryMemberSummary[]>([]);
  const [checked, setChecked] = useState<string[]>([]);
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
    if (book.issueAllowed === false) {
      setNotice(book.issueMessage || 'Issue is not permitted for this copy.');
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
          author: book.book.author || '',
          category: book.book.category || '',
          copyType: copyTypeName(book.copy.copyType),
          callNumber: book.book.callNumber || '',
          publisher: book.book.publisher || '',
          edition: book.book.edition || '',
          publicationYear: book.book.publicationYear || '',
          coverImageUrl: book.book.coverImageUrl || '',
          dueAt: preview.dueAt,
        },
      ]);
      setChecked((current) => [...current, book.copy.barcode]);
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
    const issued: Array<IssueLine & { loanId: string; issuedAt: string }> = [];
    const receiptNo = newIssueReceiptNo();
    let storedReceipt = receiptNo;
    try {
      for (const line of cart) {
        const result = await issueLibraryBook(scan, line.barcode, receiptNo);
        storedReceipt = result.loan.receiptNo || storedReceipt;
        issued.push({
          ...line,
          loanId: result.loan.id,
          issuedAt: result.loan.issuedAt,
        });
      }
      const slip = receiptSlip({
        width: receiptWidth,
        receiptNo: storedReceipt,
        issuedAt: issued[0]?.issuedAt || new Date().toISOString(),
        issuedBy: session?.user.displayName?.trim() || session?.user.email || '',
        member,
        collegeName: branding.displayName,
        address: collegeAddress(branding.displayName, branding.branding?.address),
        logoUrl: absoluteAsset(branding.logo),
        books: issued,
        notes,
      });
      setLastReceipt(slip);
      const opened = printIssueReceipt(slip);
      setNotice(
        `Issued ${issued.length} ${issued.length === 1 ? 'book' : 'books'} to ${member.profile.fullName}.${
          opened ? '' : ' Allow pop-up windows to print the receipt.'
        }`,
      );
      setCart([]);
      setChecked([]);
      setNotes('');
      setBook(null);
      setBookQuery('');
      setMember(null);
      setMemberQuery('');
      setMemberTerm('');
      setConfirmIssue(false);
      memberRef.current?.focus();
      void qc.invalidateQueries({ queryKey: ['library', 'circulation'] });
    } catch (error) {
      if (issued.length) {
        setLastReceipt(
          receiptSlip({
            width: receiptWidth,
            receiptNo: storedReceipt,
            issuedAt: issued[0]?.issuedAt || new Date().toISOString(),
            issuedBy: session?.user.displayName?.trim() || session?.user.email || '',
            member,
            collegeName: branding.displayName,
            address: collegeAddress(branding.displayName, branding.branding?.address),
            logoUrl: absoluteAsset(branding.logo),
            books: issued,
            notes,
          }),
        );
      }
      setNotice(
        `${issued.length ? `Issued ${issued.map((line) => line.accession).join(', ')} before the next copy failed. ` : ''}${apiErrorMessage(error)}`,
      );
      setCart((current) =>
        current.filter((line) => !issued.some((done) => done.accession === line.accession)),
      );
      setConfirmIssue(false);
    } finally {
      setBusy(false);
    }
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white">
            <BookOpen className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Library Circulation</h1>
            <p className="text-sm text-slate-500">
              Issue, return and renew books for library members.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" asChild>
            <Link href="/admin/library/settings">
              <Settings className="mr-1 h-4 w-4" />
              Circulation Rules
            </Link>
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/admin/library/settings">
              <RotateCcw className="mr-1 h-4 w-4" />
              Renewal Settings
            </Link>
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/admin/library/members">
              <UserPlus className="mr-1 h-4 w-4" />
              Add Member
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
            <Search className="mr-1 h-4 w-4" />
            Member Search
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <Stat
          href="/admin/library/catalogue"
          icon={Library}
          tone="bg-blue-50 text-blue-700"
          label="Total Books"
          value={stats?.totalCopies}
          hint="Physical copies in library"
        />
        <Stat
          href="/admin/library/members"
          icon={Users}
          tone="bg-emerald-50 text-emerald-700"
          label="Total Members"
          value={stats?.totalMembers}
          hint="Students and staff on record"
        />
        <Stat
          icon={BookOpen}
          tone="bg-violet-50 text-violet-700"
          label="Issued Today"
          value={stats?.issuedToday}
          change={dayChange(stats?.issuedToday, stats?.issuedYesterday)}
          hint="Books issued today"
        />
        <Stat
          icon={RotateCcw}
          tone="bg-orange-50 text-orange-700"
          label="Returned Today"
          value={stats?.returnedToday}
          change={dayChange(stats?.returnedToday, stats?.returnedYesterday)}
          hint="Books returned today"
        />
        <button type="button" className="text-left" onClick={() => setShowOverdue((open) => !open)}>
          <Stat
            icon={AlertTriangle}
            tone="bg-rose-50 text-rose-700"
            label="Overdue Books"
            value={stats?.overdueLoans}
            hint="Books not yet returned"
          />
        </button>
        <button type="button" className="text-left" onClick={() => setShowDueWeek((open) => !open)}>
          <Stat
            icon={Calendar}
            tone="bg-sky-50 text-sky-700"
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
                  ? 'flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-3 text-sm font-medium text-white shadow-sm'
                  : 'flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-600'
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
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="font-semibold text-slate-900">1. Select Member</h2>
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
                        ? 'rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white'
                        : 'rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600'
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
              <div className={`mt-3 flex gap-3 ${librarySearchPanelClass}`}>
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                  <Input
                    ref={memberRef}
                    className={librarySearchInputClass}
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
                </div>
                <Button
                  type="button"
                  className={librarySearchButtonClass}
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
                <MemberCard member={member} />
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_0.8fr]">
                  <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                    <Users className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                    No member selected
                    <p className="mt-1 text-xs">Scan a card or search to load member details.</p>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase text-slate-400">
                      Recent members
                    </p>
                    {recentMembers.length ? (
                      recentMembers.map((item) => (
                        <button
                          key={item.profile.memberId}
                          type="button"
                          className="mb-2 block w-full rounded-lg border border-slate-100 px-2 py-1.5 text-left text-sm hover:bg-slate-50"
                          onClick={() =>
                            void loadMember(
                              item.profile.registrationNumber || item.profile.memberId,
                            )
                          }
                        >
                          <span className="font-medium">{item.profile.fullName}</span>
                          <span className="block text-xs text-slate-500">
                            {item.profile.registrationNumber || item.profile.memberType}
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400">
                        Members you open in this session appear here.
                      </p>
                    )}
                  </div>
                </div>
              )}
              {blockReason ? (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {blockReason}
                </p>
              ) : null}
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="font-semibold text-slate-900">2. Select Book</h2>
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
                        ? 'rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white'
                        : 'rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600'
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
              <div className={`mt-3 flex gap-3 ${librarySearchPanelClass}`}>
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                  <Input
                    ref={bookRef}
                    className={librarySearchInputClass}
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
                </div>
                <Button
                  type="button"
                  className={librarySearchButtonClass}
                  onClick={() => void loadBook(bookQuery)}
                >
                  Search
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
                    book.copy.status !== 'AVAILABLE' ||
                    book.issueAllowed === false ||
                    Boolean(blockReason)
                  }
                  onClick={() => void addBook()}
                >
                  Add to Issue List
                </Button>
              </div>
            </section>
          </div>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">3. Books to Issue</h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setCart((current) => current.filter((line) => !checked.includes(line.barcode)))
                }
              >
                Clear Selected
              </Button>
            </div>
            {cart.length ? (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="text-xs text-slate-500">
                    <tr>
                      {[
                        '',
                        '#',
                        'Accession No.',
                        'Book Title',
                        'Author',
                        'Category',
                        'Due Date',
                        'Actions',
                      ].map((header) => (
                        <th key={header || 'check'} className="py-2 pr-3 font-medium">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((line, index) => (
                      <tr key={line.barcode} className="border-t">
                        <td className="py-2">
                          <input
                            type="checkbox"
                            checked={checked.includes(line.barcode)}
                            onChange={(event) =>
                              setChecked((current) =>
                                event.target.checked
                                  ? [...current, line.barcode]
                                  : current.filter((id) => id !== line.barcode),
                              )
                            }
                          />
                        </td>
                        <td className="py-2">{index + 1}</td>
                        <td className="py-2 font-mono text-xs">{line.accession}</td>
                        <td className="py-2">{line.title}</td>
                        <td className="py-2">{line.author || '—'}</td>
                        <td className="py-2">{line.category || '—'}</td>
                        <td className="py-2">{fmtDate(line.dueAt)}</td>
                        <td className="py-2">
                          <button
                            type="button"
                            className="text-rose-600"
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
              </div>
            ) : (
              <div className="py-10 text-center text-sm text-slate-500">
                <Library className="mx-auto mb-2 h-10 w-10 text-slate-300" />
                No books selected
                <p className="mt-1">Search and add books to the issue list.</p>
              </div>
            )}
            <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t pt-4">
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
              <div className="text-sm text-slate-600">
                <p className="font-medium">Due date</p>
                <p>{cart[0] ? fmtDate(cart[0].dueAt) : 'Calculated from college working days'}</p>
              </div>
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
          <div className={`mt-3 flex gap-3 ${librarySearchPanelClass}`}>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <Input
                ref={returnRef}
                className={librarySearchInputClass}
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
              className={librarySearchButtonClass}
              onClick={() => void loadReturn(returnCode)}
            >
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
                <p>Overdue working days after grace: {returnPreview.overdueDays}</p>
                <p>
                  Fine rate {money(returnPreview.finePerDay)} per overdue working day · Grace{' '}
                  {returnPreview.graceDays} working days · Projected fine{' '}
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
          <div className={`mt-3 flex gap-3 ${librarySearchPanelClass}`}>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <Input
                ref={renewRef}
                className={librarySearchInputClass}
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
              className={librarySearchButtonClass}
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
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className={`flex gap-3 ${librarySearchPanelClass}`}>
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                <Input
                  ref={memberRef}
                  className={librarySearchInputClass}
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
                className={librarySearchButtonClass}
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

      {confirmIssue && member && cart.length ? (
        <ConfirmIssueDialog
          member={member}
          cart={cart}
          collegeName={branding.displayName}
          notes={notes}
          busy={busy}
          onClose={() => setConfirmIssue(false)}
          onConfirm={() => void issueCart()}
        />
      ) : null}
    </div>
  );
}

function dayChange(current?: number, previous?: number) {
  if (current == null || previous == null || previous <= 0) return null;
  const value = Math.round(((current - previous) / previous) * 1000) / 10;
  return { text: `${value > 0 ? '+' : ''}${value}%`, up: value >= 0 };
}

function ConfirmIssueDialog({
  member,
  cart,
  collegeName,
  notes,
  busy,
  onClose,
  onConfirm,
}: {
  member: LibraryMemberSummary;
  cart: IssueLine[];
  collegeName: string;
  notes: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const overdue = member.activeLoans.filter((loan) => new Date(loan.dueAt) < new Date()).length;
  const after = member.borrowedCount + cart.length;
  const sameDue = cart.every((line) => line.dueAt === cart[0]?.dueAt);
  const code = member.profile.registrationNumber || member.profile.memberId;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        role="dialog"
        aria-labelledby="confirm-issue-title"
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <BookOpen className="h-5 w-5" />
            </span>
            <div>
              <h2 id="confirm-issue-title" className="text-lg font-semibold text-slate-900">
                Confirm Issue
              </h2>
              <p className="text-sm text-slate-500">
                Please review the details before issuing the book to the member.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-start gap-3">
              {member.profile.photoUrl ? (
                <img
                  src={member.profile.photoUrl}
                  alt=""
                  className="h-14 w-14 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                  {initials(member.profile.fullName)}
                </span>
              )}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-900">{member.profile.fullName}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      member.profile.active
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {member.profile.active ? 'Active' : member.membershipStatus}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-slate-500">
                  {code} · {memberKind(member.profile.memberType)}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Department: {member.profile.department || '—'}
                </p>
                <p className="text-sm text-slate-600">{collegeName}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Metric
                icon={<BookOpen className="h-4 w-4 text-blue-600" />}
                value={`${member.borrowedCount} / ${member.maxBooks}`}
                label="Currently Issued"
              />
              <Metric
                icon={<AlertTriangle className="h-4 w-4 text-rose-500" />}
                value={String(overdue)}
                label="Overdue Books"
              />
              <Metric
                icon={<span className="text-sm font-semibold text-amber-600">₹</span>}
                value={money(member.outstandingFine)}
                label="Outstanding Fine"
              />
            </div>
          </section>

          <div className="space-y-3">
            {cart.map((line) => (
              <section key={line.barcode} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex gap-3">
                  {line.coverImageUrl ? (
                    <img
                      src={line.coverImageUrl}
                      alt=""
                      className="h-24 w-16 shrink-0 rounded-md border object-cover"
                    />
                  ) : (
                    <span className="flex h-24 w-16 shrink-0 items-center justify-center rounded-md border bg-slate-50 text-slate-400">
                      <BookOpen className="h-6 w-6" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{line.title}</p>
                    <p className="text-sm text-slate-500">Author: {line.author || '—'}</p>
                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                      <Field label="Accession No." value={line.accession || '—'} />
                      <Field label="Publisher" value={line.publisher || '—'} />
                      <Field label="Call No." value={line.callNumber || '—'} />
                      <Field label="Publication Year" value={line.publicationYear || '—'} />
                      <Field label="Copy type" value={line.copyType || '—'} />
                      <Field label="Book Category" value={line.category || '—'} />
                      <Field label="Edition" value={line.edition || '—'} />
                    </dl>
                    {!sameDue ? (
                      <p className="mt-2 text-xs text-slate-500">Due {fmtDate(line.dueAt)}</p>
                    ) : null}
                  </div>
                </div>
              </section>
            ))}
          </div>
        </div>

        <div className="mt-3 grid gap-3 rounded-2xl border border-slate-200 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-50 text-violet-600">
              <Calendar className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold text-slate-900">Due Date</p>
              <p className="text-sm text-slate-600">
                Books after this issue: {after} of {member.maxBooks}
              </p>
              <p className="text-xs text-slate-500">
                Due dates count college working days. Sundays and college holidays are skipped.
              </p>
            </div>
          </div>
          <div className="rounded-xl bg-violet-50 px-4 py-3 text-violet-800">
            <p className="text-lg font-semibold">
              {sameDue ? fmtDate(cart[0].dueAt) : 'See each book'}
            </p>
            <p className="text-xs">college working days</p>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-slate-700">
          <p className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <span>
              This will count as {cart.length} {cart.length === 1 ? 'book' : 'books'} out of{' '}
              {member.maxBooks} allowed for this member.
            </span>
          </p>
          <p className="mt-1 pl-6">
            The member will be required to return {cart.length === 1 ? 'the book' : 'each book'} on
            or before the due date.
          </p>
          {notes ? <p className="mt-1 pl-6">Receipt note: {notes}</p> : null}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            <X className="mr-1 h-4 w-4" /> Cancel
          </Button>
          <Button type="button" disabled={busy} onClick={onConfirm}>
            <BookOpen className="mr-1 h-4 w-4" /> Confirm Issue
          </Button>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <div>
      <div className="flex items-center justify-center gap-1 text-sm font-semibold text-slate-900">
        {icon}
        {value}
      </div>
      <p className="mt-1 text-[11px] text-slate-500">{label}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="font-medium text-slate-800">{value}</dd>
    </div>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
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
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-semibold text-slate-900">
          {value ?? '—'}
          {change ? (
            <span
              className={change.up ? 'ml-2 text-xs text-emerald-600' : 'ml-2 text-xs text-rose-600'}
              title="Compared with yesterday"
            >
              {change.text}
            </span>
          ) : null}
        </p>
        <p className="text-xs text-slate-500">{hint}</p>
      </div>
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

function copyTypeName(type?: string | null) {
  if (!type) return 'Copy type not set';
  return COPY_TYPE_LABELS[type as CopyType] ?? type;
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
            {copyTypeName(book.copy.copyType)} ·{' '}
            {book.issueAllowed === false ? 'Issue not allowed' : 'Issue allowed'}
          </p>
          {book.issueAllowed === false && book.issueMessage ? (
            <p className="mt-1 font-medium text-rose-700">{book.issueMessage}</p>
          ) : null}
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
