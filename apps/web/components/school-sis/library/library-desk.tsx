'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import { GhostButton, PrimaryButton } from '../academic/academic-ui';
import { WaBadge, WaCard } from '../whatsapp/whatsapp-ui';
import {
  addLibCopies,
  closeLibStock,
  createLibReservation,
  downloadLibExport,
  downloadLibLabels,
  fetchLibActivity,
  fetchLibAudit,
  fetchLibBooks,
  fetchLibDashboard,
  fetchLibFines,
  fetchLibLoans,
  fetchLibMasters,
  fetchLibMembers,
  fetchLibPurchases,
  fetchLibReservations,
  fetchLibRules,
  fetchLibSettings,
  issueLibLoan,
  lookupLibCopy,
  lookupLibMember,
  markLibLost,
  payLibFine,
  receiveLibPurchase,
  renewLibLoan,
  returnLibLoan,
  saveLibBook,
  saveLibMaster,
  saveLibPurchase,
  saveLibRule,
  saveLibSettings,
  scanLibStock,
  startLibStock,
  syncLibMembers,
  waiveLibFine,
} from '@/services/school-library';

const LINKS = [
  ['Dashboard', '/admin/school-sis/library'],
  ['Books', '/admin/school-sis/library/books'],
  ['Add Book', '/admin/school-sis/library/books/new'],
  ['Copies', '/admin/school-sis/library/copies'],
  ['Members', '/admin/school-sis/library/members'],
  ['Issue', '/admin/school-sis/library/issue'],
  ['Return', '/admin/school-sis/library/return'],
  ['Quick', '/admin/school-sis/library/quick'],
  ['Loans', '/admin/school-sis/library/loans'],
  ['Overdue', '/admin/school-sis/library/overdue'],
  ['Reservations', '/admin/school-sis/library/reservations'],
  ['Fines', '/admin/school-sis/library/fines'],
  ['Lost', '/admin/school-sis/library/lost'],
  ['Acquisitions', '/admin/school-sis/library/acquisitions'],
  ['Stock', '/admin/school-sis/library/stock'],
  ['Reports', '/admin/school-sis/library/reports'],
  ['Settings', '/admin/school-sis/library/settings'],
] as const;

function memberName(m: Record<string, unknown> | null | undefined) {
  const student = m?.student as { fullName?: string; admissionNumber?: string } | undefined;
  const staff = m?.staff as { fullName?: string; employeeCode?: string } | undefined;
  return student?.fullName || staff?.fullName || String(m?.libraryCode ?? '—');
}

function copyTitle(c: Record<string, unknown> | null | undefined) {
  const book = c?.book as { title?: string } | undefined;
  return book?.title || String(c?.barcode ?? 'Copy');
}

function statusClass(status: string) {
  const map: Record<string, string> = {
    AVAILABLE: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    ISSUED: 'bg-sky-50 text-sky-800 ring-sky-200',
    OVERDUE: 'bg-rose-50 text-rose-800 ring-rose-200',
    RESERVED: 'bg-amber-50 text-amber-800 ring-amber-200',
    LOST: 'bg-rose-50 text-rose-800 ring-rose-200',
    DAMAGED: 'bg-orange-50 text-orange-800 ring-orange-200',
    PENDING: 'bg-amber-50 text-amber-800 ring-amber-200',
    PAID: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    WAITING: 'bg-amber-50 text-amber-800 ring-amber-200',
    HOLD: 'bg-sky-50 text-sky-800 ring-sky-200',
  };
  return map[status] ?? 'bg-slate-100 text-slate-600 ring-slate-200';
}

export function LibraryDesk() {
  const path = usePathname() ?? '';
  const parts = path.split('/').filter(Boolean);
  const idx = parts.indexOf('library');
  const section = parts[idx + 1] ?? 'dashboard';
  const sub = parts[idx + 2];
  const ready = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [memberQ, setMemberQ] = useState('');
  const [copyQ, setCopyQ] = useState('');
  const [search, setSearch] = useState('');
  const [bookTitle, setBookTitle] = useState('');
  const [isbn, setIsbn] = useState('');
  const [qty, setQty] = useState(1);
  const [stockId, setStockId] = useState('');
  const [stockScan, setStockScan] = useState('');
  const [condition, setCondition] = useState('GOOD');

  const dash = useQuery({
    queryKey: ['lib-dash'],
    queryFn: fetchLibDashboard,
    enabled: ready,
  });
  const books = useQuery({
    queryKey: ['lib-books', search],
    queryFn: () => fetchLibBooks({ search }),
    enabled: ready,
  });
  const members = useQuery({
    queryKey: ['lib-members'],
    queryFn: () => fetchLibMembers(),
    enabled: ready && (section === 'members' || section === 'reservations'),
  });
  const loans = useQuery({
    queryKey: ['lib-loans', section],
    queryFn: () => fetchLibLoans(section === 'overdue' ? 'OVERDUE' : 'ISSUED'),
    enabled: ready && ['loans', 'overdue', 'lost'].includes(section),
  });
  const fines = useQuery({
    queryKey: ['lib-fines'],
    queryFn: () => fetchLibFines('PENDING'),
    enabled: ready && section === 'fines',
  });
  const reservations = useQuery({
    queryKey: ['lib-res'],
    queryFn: fetchLibReservations,
    enabled: ready && section === 'reservations',
  });
  const masters = useQuery({
    queryKey: ['lib-masters'],
    queryFn: fetchLibMasters,
    enabled: ready,
  });
  const settings = useQuery({
    queryKey: ['lib-settings'],
    queryFn: fetchLibSettings,
    enabled: ready && section === 'settings',
  });
  const rules = useQuery({
    queryKey: ['lib-rules'],
    queryFn: fetchLibRules,
    enabled: ready && section === 'settings',
  });
  const purchases = useQuery({
    queryKey: ['lib-po'],
    queryFn: fetchLibPurchases,
    enabled: ready && section === 'acquisitions',
  });
  const audit = useQuery({
    queryKey: ['lib-audit'],
    queryFn: fetchLibAudit,
    enabled: ready && section === 'reports',
  });
  const activity = useQuery({
    queryKey: ['lib-act'],
    queryFn: fetchLibActivity,
    enabled: ready && section === 'reports',
  });

  const kpis = (dash.data?.kpis ?? {}) as Record<string, number | string>;
  const monthly = (dash.data?.monthly ?? []) as Array<{
    month: string;
    issued: number;
    returned: number;
  }>;
  const copies = useMemo(() => {
    const rows: Array<Record<string, unknown>> = [];
    for (const b of books.data ?? []) {
      for (const c of (b.copies as Array<Record<string, unknown>>) ?? []) {
        rows.push({ ...c, book: b });
      }
    }
    return rows;
  }, [books.data]);

  function onErr(err: unknown) {
    setNotice(apiErrorMessage(err));
  }
  function refresh() {
    void qc.invalidateQueries({ queryKey: ['lib-dash'] });
    void qc.invalidateQueries({ queryKey: ['lib-books'] });
    void qc.invalidateQueries({ queryKey: ['lib-loans'] });
    void qc.invalidateQueries({ queryKey: ['lib-fines'] });
    void qc.invalidateQueries({ queryKey: ['lib-members'] });
  }

  const issueMut = useMutation({
    mutationFn: () => issueLibLoan(memberQ, copyQ),
    onSuccess: () => {
      setNotice('Book issued.');
      setCopyQ('');
      refresh();
    },
    onError: onErr,
  });
  const returnMut = useMutation({
    mutationFn: () => returnLibLoan(copyQ, condition),
    onSuccess: (row: Record<string, unknown>) => {
      setNotice(
        row.fine
          ? `Returned. Fine ₹${String((row.fine as { amount?: unknown }).amount ?? '')}`
          : 'Returned.',
      );
      setCopyQ('');
      refresh();
    },
    onError: onErr,
  });
  const addBookMut = useMutation({
    mutationFn: async () => {
      const book = (await saveLibBook({
        title: bookTitle,
        isbn,
      })) as { id: string };
      if (qty > 0) await addLibCopies(book.id, qty);
      return book;
    },
    onSuccess: () => {
      setNotice('Book and copies added.');
      setBookTitle('');
      setIsbn('');
      refresh();
    },
    onError: onErr,
  });

  const isCirc = ['issue', 'return', 'quick'].includes(section);
  const isDash = section === 'dashboard';
  const isBooks = section === 'books' && sub !== 'new';
  const isNew = section === 'books' && sub === 'new';
  const isMaster = ['categories', 'authors', 'publishers', 'subjects', 'locations'].includes(
    section,
  );

  return (
    <div className="space-y-4 bg-[#f4f7fb] p-4 sm:p-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          Campus Operations
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Library</h1>
        <p className="mt-1 text-sm text-slate-500">
          Scan a member card, then scan a copy barcode to issue or return.
        </p>
      </div>
      <nav className="flex flex-wrap gap-1">
        {LINKS.map(([label, href]) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium ring-1',
              path === href || (href !== '/admin/school-sis/library' && path.startsWith(href))
                ? 'bg-slate-900 text-white ring-slate-900'
                : 'bg-white text-slate-600 ring-slate-200',
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
      {notice ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{notice}</p>
      ) : null}

      {isDash ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ['Total books', kpis.titles],
              ['Copies', kpis.copies],
              ['Available', kpis.available],
              ['Issued', kpis.issued],
              ['Overdue', kpis.overdue],
              ['Reserved', kpis.reserved],
              ['Lost', kpis.lost],
              ['Damaged', kpis.damaged],
              ['Pending fines', `₹${kpis.pendingFines ?? '0.00'}`],
              ['Added this month', kpis.addedMonth],
            ].map(([label, value]) => (
              <WaCard key={String(label)} label={String(label)} value={String(value ?? 0)} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/school-sis/library/books/new">
              <PrimaryButton type="button">Add book</PrimaryButton>
            </Link>
            <Link href="/admin/school-sis/library/quick">
              <GhostButton type="button">Scan / issue</GhostButton>
            </Link>
            <Link href="/admin/school-sis/library/overdue">
              <GhostButton type="button">Overdue</GhostButton>
            </Link>
            <Link href="/admin/school-sis/library/fines">
              <GhostButton type="button">Collect fine</GhostButton>
            </Link>
          </div>
          <WaCard className="h-72 p-4" label="Issued vs returned">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="issued" fill="#2563eb" />
                <Bar dataKey="returned" fill="#059669" />
              </BarChart>
            </ResponsiveContainer>
          </WaCard>
        </>
      ) : null}

      {isCirc ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <WaCard className="space-y-3 p-5" label="Quick circulation">
            <label className="block text-sm font-medium text-slate-700">
              Scan member card
              <input
                autoFocus
                value={memberQ}
                onChange={(e) => setMemberQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                }}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                placeholder="Library ID / admission no."
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Scan book barcode
              <input
                value={copyQ}
                onChange={(e) => setCopyQ(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                placeholder="STL-LIB-000001"
              />
            </label>
            {section !== 'issue' ? (
              <label className="block text-sm text-slate-600">
                Return condition
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                >
                  {['GOOD', 'FAIR', 'DAMAGED', 'HEAVILY_DAMAGED', 'LOST'].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {section !== 'return' ? (
                <PrimaryButton
                  type="button"
                  disabled={!memberQ || !copyQ || issueMut.isPending}
                  onClick={() => issueMut.mutate()}
                >
                  Issue book
                </PrimaryButton>
              ) : null}
              {section !== 'issue' ? (
                <GhostButton
                  type="button"
                  disabled={!copyQ || returnMut.isPending}
                  onClick={() => returnMut.mutate()}
                >
                  Return book
                </GhostButton>
              ) : null}
            </div>
          </WaCard>
          <LookupPanel memberQ={memberQ} copyQ={copyQ} />
        </div>
      ) : null}

      {isBooks ? (
        <WaCard className="overflow-hidden p-0">
          <div className="flex gap-2 p-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, ISBN, author, barcode"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="max-h-[70vh] overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Author</th>
                  <th className="px-3 py-2">Copies</th>
                  <th className="px-3 py-2">Available</th>
                </tr>
              </thead>
              <tbody>
                {(books.data ?? []).map((b) => {
                  const copiesOf = (b.copies as Array<{ status: string }>) ?? [];
                  return (
                    <tr key={String(b.id)} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-medium">{String(b.title)}</td>
                      <td className="px-3 py-2">
                        {String((b.author as { name?: string } | null)?.name ?? '—')}
                      </td>
                      <td className="px-3 py-2">{copiesOf.length}</td>
                      <td className="px-3 py-2">
                        {copiesOf.filter((c) => c.status === 'AVAILABLE').length}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </WaCard>
      ) : null}

      {isNew ? (
        <WaCard className="max-w-xl space-y-3 p-5" label="Add book">
          <input
            value={bookTitle}
            onChange={(e) => setBookTitle(e.target.value)}
            placeholder="Title"
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
          <input
            value={isbn}
            onChange={(e) => setIsbn(e.target.value)}
            placeholder="ISBN"
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
          <PrimaryButton
            type="button"
            disabled={!bookTitle || addBookMut.isPending}
            onClick={() => addBookMut.mutate()}
          >
            Save and create copies
          </PrimaryButton>
        </WaCard>
      ) : null}

      {section === 'copies' ? (
        <WaCard className="overflow-auto p-0">
          <div className="flex justify-end p-3">
            <GhostButton
              type="button"
              onClick={() => void downloadLibLabels(copies.slice(0, 25).map((c) => String(c.id)))}
            >
              Print 25 labels
            </GhostButton>
          </div>
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Barcode</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {copies.map((c) => (
                <tr key={String(c.id)} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-mono text-xs">{String(c.barcode)}</td>
                  <td className="px-3 py-2">{copyTitle(c)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1',
                        statusClass(String(c.status)),
                      )}
                    >
                      {String(c.status)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <GhostButton
                      type="button"
                      onClick={() =>
                        markLibLost(String(c.id))
                          .then(() => refresh())
                          .catch(onErr)
                      }
                    >
                      Mark lost
                    </GhostButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </WaCard>
      ) : null}

      {section === 'members' ? (
        <WaCard className="overflow-auto p-0">
          <div className="p-3">
            <PrimaryButton
              type="button"
              onClick={() =>
                syncLibMembers()
                  .then(() => {
                    setNotice('Students and staff synced as library members.');
                    refresh();
                  })
                  .catch(onErr)
              }
            >
              Sync from SIS
            </PrimaryButton>
          </div>
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Library ID</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Kind</th>
                <th className="px-3 py-2">Issued</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {(members.data ?? []).map((m) => (
                <tr key={String(m.id)} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-mono text-xs">{String(m.libraryCode)}</td>
                  <td className="px-3 py-2">{memberName(m)}</td>
                  <td className="px-3 py-2">{String(m.memberKind)}</td>
                  <td className="px-3 py-2">
                    {String((m._count as { loans?: number })?.loans ?? 0)}
                  </td>
                  <td className="px-3 py-2">
                    <WaBadge value={String(m.status)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </WaCard>
      ) : null}

      {['loans', 'overdue'].includes(section) ? (
        <LoanTable
          rows={loans.data ?? []}
          onRenew={(id) => renewLibLoan(id).then(refresh).catch(onErr)}
        />
      ) : null}

      {section === 'reservations' ? (
        <ReservationsPanel
          reservations={reservations.data ?? []}
          books={books.data ?? []}
          members={members.data ?? []}
          onCreate={(bookId, memberId) =>
            createLibReservation(bookId, memberId).then(refresh).catch(onErr)
          }
        />
      ) : null}

      {section === 'fines' ? (
        <WaCard className="overflow-auto p-0">
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Member</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Kind</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {(fines.data ?? []).map((f) => (
                <tr key={String(f.id)} className="border-t border-slate-100">
                  <td className="px-3 py-2">{memberName(f.member as Record<string, unknown>)}</td>
                  <td className="px-3 py-2">₹{String(f.amount)}</td>
                  <td className="px-3 py-2">{String(f.kind)}</td>
                  <td className="flex gap-2 px-3 py-2">
                    <PrimaryButton
                      type="button"
                      onClick={() =>
                        payLibFine(String(f.id), { mode: 'CASH' })
                          .then(() => {
                            setNotice(
                              `Receipt ${(f as { receiptNo?: string }).receiptNo ?? 'collected'}`,
                            );
                            refresh();
                          })
                          .catch(onErr)
                      }
                    >
                      Collect cash
                    </PrimaryButton>
                    <GhostButton
                      type="button"
                      onClick={() =>
                        waiveLibFine(String(f.id), 'Waived at counter').then(refresh).catch(onErr)
                      }
                    >
                      Waive
                    </GhostButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </WaCard>
      ) : null}

      {section === 'lost' ? (
        <p className="text-sm text-slate-600">
          Mark copies lost from the Copies screen. Recovery posts as a library fine.
        </p>
      ) : null}

      {section === 'acquisitions' ? (
        <AcqPanel
          purchases={purchases.data ?? []}
          onSave={(title) => saveLibPurchase({ title }).then(refresh).catch(onErr)}
          onReceive={(id) => receiveLibPurchase(id).then(refresh).catch(onErr)}
        />
      ) : null}

      {section === 'stock' ? (
        <WaCard className="max-w-xl space-y-3 p-5" label="Stock verification">
          <PrimaryButton
            type="button"
            onClick={() =>
              startLibStock()
                .then((row) => {
                  setStockId(String(row.id));
                  setNotice(`Stock check ${row.id} opened. Expected ${row.expected}.`);
                })
                .catch(onErr)
            }
          >
            Start verification
          </PrimaryButton>
          <input
            value={stockScan}
            onChange={(e) => setStockScan(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && stockId) {
                scanLibStock(stockId, stockScan)
                  .then(() => {
                    setStockScan('');
                    setNotice('Scanned.');
                  })
                  .catch(onErr);
              }
            }}
            placeholder="Scan barcode and press Enter"
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
          <GhostButton
            type="button"
            disabled={!stockId}
            onClick={() =>
              closeLibStock(stockId)
                .then((row) =>
                  setNotice(
                    `Closed. Scanned ${String((row as { scanned?: number }).scanned)} missing ${String((row as { missing?: number }).missing)}`,
                  ),
                )
                .catch(onErr)
            }
          >
            Close check
          </GhostButton>
        </WaCard>
      ) : null}

      {section === 'reports' ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {['inventory', 'loans', 'overdue'].map((key) => (
              <GhostButton
                key={key}
                type="button"
                onClick={() => void downloadLibExport(key, 'pdf')}
              >
                {key} PDF
              </GhostButton>
            ))}
            <GhostButton type="button" onClick={() => void downloadLibExport('inventory', 'xlsx')}>
              Inventory Excel
            </GhostButton>
          </div>
          <pre className="overflow-auto rounded-lg bg-white p-3 text-xs text-slate-600">
            {JSON.stringify({ activity: activity.data, audit: audit.data?.slice(0, 20) }, null, 2)}
          </pre>
        </div>
      ) : null}

      {section === 'settings' ? (
        <SettingsPanel
          settings={settings.data}
          rules={rules.data ?? []}
          onSaveSettings={(body) =>
            saveLibSettings(body)
              .then(() => setNotice('Settings saved.'))
              .catch(onErr)
          }
          onSaveRule={(body) =>
            saveLibRule(body)
              .then(() => qc.invalidateQueries({ queryKey: ['lib-rules'] }))
              .catch(onErr)
          }
        />
      ) : null}

      {isMaster ? (
        <MasterPanel
          kind={
            section === 'categories'
              ? 'category'
              : section === 'authors'
                ? 'author'
                : section === 'publishers'
                  ? 'publisher'
                  : section === 'subjects'
                    ? 'subject'
                    : 'location'
          }
          rows={
            (masters.data?.[
              section === 'categories'
                ? 'categories'
                : section === 'authors'
                  ? 'authors'
                  : section === 'publishers'
                    ? 'publishers'
                    : section === 'subjects'
                      ? 'subjects'
                      : 'locations'
            ] ?? []) as Array<Record<string, unknown>>
          }
          onSave={(kind, name) =>
            saveLibMaster(kind, { name }).then(() =>
              qc.invalidateQueries({ queryKey: ['lib-masters'] }),
            )
          }
        />
      ) : null}
    </div>
  );
}

function LookupPanel({ memberQ, copyQ }: { memberQ: string; copyQ: string }) {
  const member = useQuery({
    queryKey: ['lib-lu-m', memberQ],
    queryFn: () => lookupLibMember(memberQ),
    enabled: memberQ.length > 2,
  });
  const copy = useQuery({
    queryKey: ['lib-lu-c', copyQ],
    queryFn: () => lookupLibCopy(copyQ),
    enabled: copyQ.length > 2,
  });
  return (
    <WaCard className="space-y-3 p-5" label="Lookup">
      <p className="text-sm">
        Member: <strong>{memberName(member.data as Record<string, unknown>)}</strong>{' '}
        {member.data ? <WaBadge value={String(member.data.status)} /> : 'scan to load'}
      </p>
      <p className="text-sm">
        Copy: <strong>{copyTitle(copy.data as Record<string, unknown>)}</strong>{' '}
        {copy.data ? (
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1',
              statusClass(String(copy.data.status)),
            )}
          >
            {String(copy.data.status)}
          </span>
        ) : (
          'scan to load'
        )}
      </p>
    </WaCard>
  );
}

function LoanTable({
  rows,
  onRenew,
}: {
  rows: Array<Record<string, unknown>>;
  onRenew: (id: string) => void;
}) {
  return (
    <WaCard className="overflow-auto p-0">
      <table className="min-w-full text-left text-sm">
        <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2">Member</th>
            <th className="px-3 py-2">Book</th>
            <th className="px-3 py-2">Due</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => (
            <tr key={String(l.id)} className="border-t border-slate-100">
              <td className="px-3 py-2">{memberName(l.member as Record<string, unknown>)}</td>
              <td className="px-3 py-2">{copyTitle(l.copy as Record<string, unknown>)}</td>
              <td className="px-3 py-2">{String(l.dueAt).slice(0, 10)}</td>
              <td className="px-3 py-2">
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1',
                    statusClass(
                      new Date(String(l.dueAt)) < new Date() && l.status === 'ISSUED'
                        ? 'OVERDUE'
                        : String(l.status),
                    ),
                  )}
                >
                  {String(l.status)}
                </span>
              </td>
              <td className="px-3 py-2">
                <GhostButton type="button" onClick={() => onRenew(String(l.id))}>
                  Renew
                </GhostButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </WaCard>
  );
}

function ReservationsPanel({
  reservations,
  books,
  members,
  onCreate,
}: {
  reservations: Array<Record<string, unknown>>;
  books: Array<Record<string, unknown>>;
  members: Array<Record<string, unknown>>;
  onCreate: (bookId: string, memberId: string) => void;
}) {
  const [bookId, setBookId] = useState('');
  const [memberId, setMemberId] = useState('');
  return (
    <div className="space-y-3">
      <WaCard className="flex flex-wrap gap-2 p-4">
        <select
          value={bookId}
          onChange={(e) => setBookId(e.target.value)}
          className="rounded-lg border px-2 py-2 text-sm"
        >
          <option value="">Book</option>
          {books.map((b) => (
            <option key={String(b.id)} value={String(b.id)}>
              {String(b.title)}
            </option>
          ))}
        </select>
        <select
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
          className="rounded-lg border px-2 py-2 text-sm"
        >
          <option value="">Member</option>
          {members.map((m) => (
            <option key={String(m.id)} value={String(m.id)}>
              {memberName(m)}
            </option>
          ))}
        </select>
        <PrimaryButton
          type="button"
          disabled={!bookId || !memberId}
          onClick={() => onCreate(bookId, memberId)}
        >
          Reserve
        </PrimaryButton>
      </WaCard>
      <WaCard className="overflow-auto p-0">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Book</th>
              <th className="px-3 py-2 text-left">Member</th>
              <th className="px-3 py-2 text-left">Queue</th>
              <th className="px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((r) => (
              <tr key={String(r.id)} className="border-t">
                <td className="px-3 py-2">{String((r.book as { title?: string })?.title)}</td>
                <td className="px-3 py-2">{memberName(r.member as Record<string, unknown>)}</td>
                <td className="px-3 py-2">{String(r.queueNo)}</td>
                <td className="px-3 py-2">{String(r.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </WaCard>
    </div>
  );
}

function AcqPanel({
  purchases,
  onSave,
  onReceive,
}: {
  purchases: Array<Record<string, unknown>>;
  onSave: (title: string) => void;
  onReceive: (id: string) => void;
}) {
  const [title, setTitle] = useState('');
  return (
    <div className="space-y-3">
      <WaCard className="flex gap-2 p-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Purchase request title"
          className="flex-1 rounded-lg border px-3 py-2"
        />
        <PrimaryButton type="button" disabled={!title} onClick={() => onSave(title)}>
          Request
        </PrimaryButton>
      </WaCard>
      {purchases.map((p) => (
        <WaCard key={String(p.id)} className="flex items-center justify-between p-4">
          <div>
            <p className="font-medium">{String(p.title)}</p>
            <p className="text-xs text-slate-500">
              {String(p.kind)} · {String(p.status)}
            </p>
          </div>
          <GhostButton type="button" onClick={() => onReceive(String(p.id))}>
            Receive
          </GhostButton>
        </WaCard>
      ))}
    </div>
  );
}

function SettingsPanel({
  settings,
  rules,
  onSaveSettings,
  onSaveRule,
}: {
  settings?: Record<string, unknown>;
  rules: Array<Record<string, unknown>>;
  onSaveSettings: (body: Record<string, unknown>) => void;
  onSaveRule: (body: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState<Record<string, unknown>>({});
  const merged = { ...settings, ...form };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <WaCard className="space-y-2 p-5" label="General">
        {['libraryName', 'libraryCode', 'barcodePrefix', 'accessionPrefix', 'email', 'phone'].map(
          (k) => (
            <input
              key={k}
              defaultValue={String(settings?.[k] ?? '')}
              onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
              placeholder={k}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          ),
        )}
        <PrimaryButton type="button" onClick={() => onSaveSettings(merged)}>
          Save settings
        </PrimaryButton>
      </WaCard>
      <WaCard className="space-y-2 p-5" label="Circulation rules">
        {rules.map((r) => (
          <p key={String(r.id)} className="text-sm">
            {String(r.memberKind)} {String(r.gradePattern ?? 'all')} · {String(r.maxBooks)} books ·{' '}
            {String(r.loanDays)} days · ₹{String(r.finePerDay)}/day
          </p>
        ))}
        <GhostButton
          type="button"
          onClick={() =>
            onSaveRule({
              memberKind: 'STUDENT',
              maxBooks: 2,
              loanDays: 14,
              maxRenewals: 1,
              finePerDay: 2,
            })
          }
        >
          Add student default
        </GhostButton>
      </WaCard>
    </div>
  );
}

function MasterPanel({
  kind,
  rows,
  onSave,
}: {
  kind: string;
  rows: Array<Record<string, unknown>>;
  onSave: (kind: string, name: string) => void;
}) {
  const [name, setName] = useState('');
  return (
    <WaCard className="space-y-3 p-5">
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="flex-1 rounded-lg border px-3 py-2"
        />
        <PrimaryButton type="button" disabled={!name} onClick={() => onSave(kind, name)}>
          Add
        </PrimaryButton>
      </div>
      <ul className="space-y-1 text-sm">
        {rows.map((r) => (
          <li key={String(r.id)}>{String(r.name ?? r.label)}</li>
        ))}
      </ul>
    </WaCard>
  );
}
