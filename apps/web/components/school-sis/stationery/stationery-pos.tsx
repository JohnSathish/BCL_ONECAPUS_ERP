'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Trash2 } from 'lucide-react';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import { useAuthStore } from '@/store/auth-store';
import {
  completeStationerySale,
  fetchStationeryCategories,
  fetchStationeryDashboard,
  fetchStationeryProducts,
  fetchStationerySales,
  fetchStationerySettings,
  fetchStationerySuggested,
  searchStationeryStudents,
} from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import {
  printStationeryReceipt,
  rs,
  StationeryShell,
  statusBadge,
  stockBadge,
} from './stationery-ui';

type CartLine = {
  key: string;
  productId: string;
  variantId?: string;
  name: string;
  variantLabel?: string;
  sku: string;
  rate: number;
  qty: number;
  discountPct: number;
  stock: number;
};

const PAY = ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'ONLINE', 'CREDIT', 'OTHER'] as const;
const HOLD_KEY = 'sls-stationery-holds';

function lineAmt(l: CartLine) {
  const gross = l.rate * l.qty;
  const disc = (gross * l.discountPct) / 100;
  return Math.round(gross - disc);
}

export function StationeryPosDesk() {
  const ready = useAuthQueryEnabled();
  const perms = useAuthStore((s) => s.session?.user.permissions);
  const canManage = canManageSchoolSis(perms);
  const qc = useQueryClient();
  const searchRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [customerType, setCustomerType] = useState<'STUDENT' | 'WALK_IN'>('STUDENT');
  const [studentQ, setStudentQ] = useState('');
  const [student, setStudent] = useState<any>(null);
  const [walkIn, setWalkIn] = useState({ name: '', mobile: '', address: '' });
  const [cart, setCart] = useState<CartLine[]>([]);
  const [billDiscountPct, setBillDiscountPct] = useState(0);
  const [pays, setPays] = useState<Array<{ method: string; amount: number }>>([
    { method: 'CASH', amount: 0 },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  const settingsQ = useQuery({
    queryKey: ['sls-stn-settings'],
    queryFn: fetchStationerySettings,
    enabled: ready,
  });
  const dashQ = useQuery({
    queryKey: ['sls-stn-dash'],
    queryFn: fetchStationeryDashboard,
    enabled: ready,
  });
  const catQ = useQuery({
    queryKey: ['sls-stn-cats'],
    queryFn: fetchStationeryCategories,
    enabled: ready,
  });
  const prodQ = useQuery({
    queryKey: ['sls-stn-prod', debounced, categoryId],
    queryFn: () =>
      fetchStationeryProducts({ q: debounced || undefined, categoryId: categoryId || undefined }),
    enabled: ready,
  });
  const stuQ = useQuery({
    queryKey: ['sls-stn-stu', studentQ],
    queryFn: () => searchStationeryStudents(studentQ),
    enabled: ready && customerType === 'STUDENT' && studentQ.trim().length >= 2,
  });
  const sugQ = useQuery({
    queryKey: ['sls-stn-sug', student?.id],
    queryFn: () => fetchStationerySuggested(student.id),
    enabled: ready && !!student?.id,
  });
  const recentQ = useQuery({
    queryKey: ['sls-stn-recent'],
    queryFn: () => fetchStationerySales(),
    enabled: ready,
  });

  const settings = settingsQ.data;
  const products = prodQ.data ?? [];
  const dash = dashQ.data;

  const subtotal = cart.reduce((s, l) => s + l.rate * l.qty, 0);
  const itemDisc = cart.reduce((s, l) => s + (l.rate * l.qty * l.discountPct) / 100, 0);
  const billDisc = (subtotal * billDiscountPct) / 100;
  const grand = Math.max(0, Math.round(subtotal - itemDisc - billDisc));
  const paid = pays.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const due = Math.max(0, grand - paid);

  function addProduct(p: any, variant?: any) {
    const key = `${p.id}:${variant?.id || ''}`;
    const rate = variant?.sellingPrice ?? p.sellingPrice;
    const stock = Number(variant?.qtyOnHand ?? p.qtyOnHand ?? 0);
    setCart((prev) => {
      const hit = prev.find((l) => l.key === key);
      if (hit) return prev.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l));
      return [
        ...prev,
        {
          key,
          productId: p.id,
          variantId: variant?.id,
          name: p.name,
          variantLabel: variant?.label,
          sku: variant?.sku ?? p.sku,
          rate,
          qty: 1,
          discountPct: 0,
          stock,
        },
      ];
    });
    setQ('');
    searchRef.current?.focus();
  }

  async function checkout(draft = false) {
    setError(null);
    if (!cart.length) return setError('Add at least one item');
    if (customerType === 'STUDENT' && !student) return setError('Select a student');
    if (customerType === 'WALK_IN' && !walkIn.name.trim()) return setError('Enter customer name');
    if (!draft && due > 0 && !settings?.allowCreditSales) {
      return setError('Full payment is required before completing the sale');
    }
    setBusy(true);
    try {
      const sale = await completeStationerySale({
        customerType,
        studentId: student?.id,
        walkInName: walkIn.name,
        walkInMobile: walkIn.mobile,
        walkInAddress: walkIn.address,
        billDiscountPct,
        draft,
        items: cart.map((l) => ({
          productId: l.productId,
          variantId: l.variantId,
          qty: l.qty,
          rate: l.rate,
          discountPct: l.discountPct,
        })),
        payments: draft
          ? []
          : pays
              .filter((p) => p.amount > 0)
              .map((p) => ({ method: p.method, amount: Math.round(p.amount) })),
      });
      setLastSale(sale);
      setCart([]);
      setPays([{ method: settings?.defaultPaymentMethod || 'CASH', amount: 0 }]);
      setBillDiscountPct(0);
      await qc.invalidateQueries({
        predicate: (query) => String(query.queryKey[0] || '').startsWith('sls-stn'),
      });
      await dashQ.refetch();
      await recentQ.refetch();
      await prodQ.refetch();
      if (!draft) printStationeryReceipt(sale);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function holdBill() {
    const holds = JSON.parse(localStorage.getItem(HOLD_KEY) || '[]');
    holds.unshift({ at: Date.now(), customerType, student, walkIn, cart, billDiscountPct });
    localStorage.setItem(HOLD_KEY, JSON.stringify(holds.slice(0, 12)));
    setCart([]);
  }

  const holds = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(HOLD_KEY) || '[]');
    } catch {
      return [];
    }
  }, [cart.length]);

  return (
    <StationeryShell title="Stationery Billing">
      {dash ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Today’s sales', rs(dash.todaySales)],
            ['Transactions', dash.todayTransactions],
            ['Cash / UPI', `${rs(dash.todayCash)} / ${rs(dash.todayUpi)}`],
            ['Pending', rs(dash.pendingPayments)],
            ['Low stock', dash.lowStockItems],
            ['Out of stock', dash.outOfStockItems],
            ['Inventory value', rs(dash.inventoryValue)],
            ['This month', rs(dash.monthlySales)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {label}
              </p>
              <p className="mt-1 text-lg font-semibold text-[#1e3a8a]">{value}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_300px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <label className="text-[11px] font-semibold uppercase text-slate-400">
            Product search
          </label>
          <div className="relative mt-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              ref={searchRef}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/20"
              placeholder="Name, SKU or barcode"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && products[0]) {
                  e.preventDefault();
                  const p = products[0];
                  const v = p.variants?.[0];
                  if (p.variants?.length > 1) return;
                  addProduct(p, v);
                }
              }}
            />
          </div>
          <select
            className="mt-2 h-10 w-full rounded-xl border border-slate-200 text-sm"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">All categories</option>
            {(catQ.data ?? []).map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="mt-2 max-h-[480px] space-y-1 overflow-auto">
            {products.map((p: any) => (
              <button
                key={p.id}
                type="button"
                className="flex w-full flex-col rounded-xl px-2 py-2 text-left hover:bg-slate-50"
                onClick={() => {
                  if (p.variants?.length) return;
                  addProduct(p);
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{p.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {p.sku} · {rs(p.sellingPrice)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1',
                      stockBadge(p.stockStatus),
                    )}
                  >
                    {p.stockStatus} {Number(p.qtyOnHand)}
                  </span>
                </div>
                {p.variants?.length ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {p.variants.map((v: any) => (
                      <span
                        key={v.id}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          addProduct(p, v);
                        }}
                        className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700"
                      >
                        {v.label} ({Number(v.qtyOnHand)})
                      </span>
                    ))}
                  </div>
                ) : null}
              </button>
            ))}
            {!products.length ? (
              <p className="p-3 text-sm text-slate-500">No products match.</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex gap-2">
            {(['STUDENT', 'WALK_IN'] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs font-semibold ring-1',
                  customerType === t
                    ? 'bg-[#2563eb] text-white ring-[#2563eb]'
                    : 'bg-white text-slate-600 ring-slate-200',
                )}
                onClick={() => setCustomerType(t)}
              >
                {t === 'STUDENT' ? 'Student' : 'Walk-in'}
              </button>
            ))}
          </div>
          {customerType === 'STUDENT' ? (
            <div className="mt-3">
              <input
                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
                placeholder="Admission no., name, roll no. or ID"
                value={studentQ}
                onChange={(e) => {
                  setStudentQ(e.target.value);
                  setStudent(null);
                }}
              />
              {student ? (
                <div className="mt-2 rounded-xl bg-sky-50 p-3 text-sm text-slate-700">
                  <p className="font-semibold text-[#1e3a8a]">{student.fullName}</p>
                  <p>
                    {student.admissionNumber} · {student.className || '—'} · {student.academicYear}
                  </p>
                  <p>
                    Guardian: {student.guardianName || '—'} ·{' '}
                    {student.guardianPhone || student.phone || '—'}
                  </p>
                </div>
              ) : (
                <div className="mt-1 max-h-36 overflow-auto">
                  {(stuQ.data ?? []).map((s: any) => (
                    <button
                      key={s.id}
                      type="button"
                      className="block w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-50"
                      onClick={() => setStudent(s)}
                    >
                      {s.fullName} · {s.admissionNumber} · {s.className || ''}
                    </button>
                  ))}
                </div>
              )}
              {sugQ.data?.length ? (
                <div className="mt-2">
                  <p className="text-[11px] font-semibold uppercase text-slate-400">
                    Suggested for class
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {sugQ.data.map((p: any) => (
                      <button
                        key={p.id}
                        type="button"
                        className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold ring-1 ring-slate-200"
                        onClick={() => addProduct(p, p.variants?.[0])}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <input
                className="h-10 rounded-xl border px-3 text-sm"
                placeholder="Customer name"
                value={walkIn.name}
                onChange={(e) => setWalkIn({ ...walkIn, name: e.target.value })}
              />
              <input
                className="h-10 rounded-xl border px-3 text-sm"
                placeholder="Mobile"
                value={walkIn.mobile}
                onChange={(e) => setWalkIn({ ...walkIn, mobile: e.target.value })}
              />
              <input
                className="h-10 rounded-xl border px-3 text-sm sm:col-span-2"
                placeholder="Address (optional)"
                value={walkIn.address}
                onChange={(e) => setWalkIn({ ...walkIn, address: e.target.value })}
              />
            </div>
          )}

          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase text-slate-400">
                <th className="pb-2">Item</th>
                <th>Qty</th>
                <th>Disc %</th>
                <th>Amt</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {cart.map((l) => (
                <tr key={l.key} className="border-t border-slate-100">
                  <td className="py-2">
                    <p className="font-medium">{l.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {l.variantLabel || l.sku} · {rs(l.rate)}
                    </p>
                  </td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      className="h-8 w-16 rounded-lg border px-2"
                      value={l.qty}
                      onChange={(e) =>
                        setCart((prev) =>
                          prev.map((x) =>
                            x.key === l.key ? { ...x, qty: Number(e.target.value) || 1 } : x,
                          ),
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      className="h-8 w-16 rounded-lg border px-2"
                      value={l.discountPct}
                      onChange={(e) =>
                        setCart((prev) =>
                          prev.map((x) =>
                            x.key === l.key
                              ? { ...x, discountPct: Number(e.target.value) || 0 }
                              : x,
                          ),
                        )
                      }
                    />
                  </td>
                  <td>{rs(lineAmt(l))}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => setCart((prev) => prev.filter((x) => x.key !== l.key))}
                    >
                      <Trash2 className="h-4 w-4 text-slate-400" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!cart.length ? (
            <p className="py-8 text-center text-sm text-slate-500">Scan or search to add items.</p>
          ) : null}
        </section>

        <aside className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase text-slate-400">Billing summary</p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{rs(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Item discount</span>
              <span>{rs(itemDisc)}</span>
            </div>
            <label className="flex items-center justify-between gap-2">
              Bill discount %
              <input
                type="number"
                className="h-8 w-20 rounded-lg border px-2"
                value={billDiscountPct}
                onChange={(e) => setBillDiscountPct(Number(e.target.value) || 0)}
              />
            </label>
            <div className="flex justify-between">
              <span>Bill discount</span>
              <span>{rs(billDisc)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold text-[#1e3a8a]">
              <span>Grand total</span>
              <span>{rs(grand)}</span>
            </div>
          </div>
          <div className="space-y-2">
            {pays.map((p, idx) => (
              <div key={idx} className="flex gap-2">
                <select
                  className="h-9 flex-1 rounded-lg border text-sm"
                  value={p.method}
                  onChange={(e) =>
                    setPays((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, method: e.target.value } : x)),
                    )
                  }
                >
                  {PAY.filter((m) => m !== 'CREDIT' || settings?.allowCreditSales).map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
                <input
                  type="number"
                  className="h-9 w-24 rounded-lg border px-2 text-sm"
                  value={p.amount || ''}
                  placeholder="Amt"
                  onChange={(e) =>
                    setPays((prev) =>
                      prev.map((x, i) =>
                        i === idx ? { ...x, amount: Number(e.target.value) || 0 } : x,
                      ),
                    )
                  }
                />
              </div>
            ))}
            <button
              type="button"
              className="text-xs font-semibold text-[#2563eb]"
              onClick={() => setPays((p) => [...p, { method: 'UPI', amount: 0 }])}
            >
              + Split payment
            </button>
            <p className="text-sm">
              Paid {rs(paid)} · Balance {rs(due)}
            </p>
          </div>
          {error ? (
            <p className="rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{error}</p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="rounded-xl border px-3 py-2 text-sm"
              onClick={() => setCart([])}
            >
              Clear cart
            </button>
            <button
              type="button"
              className="rounded-xl border px-3 py-2 text-sm"
              onClick={holdBill}
            >
              Hold bill
            </button>
            <button
              type="button"
              className="rounded-xl border px-3 py-2 text-sm"
              disabled={busy}
              onClick={() => checkout(true)}
            >
              Save draft
            </button>
            <button
              type="button"
              className="rounded-xl bg-[#2563eb] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              disabled={busy}
              onClick={() => checkout(false)}
            >
              Complete payment
            </button>
          </div>
          {holds.length ? (
            <button
              type="button"
              className="text-xs font-semibold text-[#2563eb]"
              onClick={() => {
                const h = holds[0];
                setCart(h.cart);
                setStudent(h.student);
                setWalkIn(h.walkIn);
                setCustomerType(h.customerType);
                setBillDiscountPct(h.billDiscountPct);
                localStorage.setItem(HOLD_KEY, JSON.stringify(holds.slice(1)));
              }}
            >
              Resume last held bill
            </button>
          ) : null}
          {lastSale ? (
            <button
              type="button"
              className="text-xs font-semibold text-[#2563eb]"
              onClick={() => printStationeryReceipt(lastSale)}
            >
              Reprint {lastSale.invoiceNo}
            </button>
          ) : null}
          {!canManage ? (
            <p className="text-[11px] text-slate-400">
              Stock and product master require manager access.
            </p>
          ) : null}
        </aside>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-[#1e3a8a]">Recent transactions</p>
        <div className="mt-2 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase text-slate-400">
                <th className="py-2">Invoice</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Paid</th>
                <th>Status</th>
                <th>Cashier</th>
              </tr>
            </thead>
            <tbody>
              {(recentQ.data ?? []).map((s: any) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="py-2 font-medium">{s.invoiceNo}</td>
                  <td>{s.student?.fullName || s.walkInName || '—'}</td>
                  <td>{rs(s.grandTotal)}</td>
                  <td>{rs(s.amountPaid)}</td>
                  <td>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1',
                        statusBadge(s.status),
                      )}
                    >
                      {s.status.replaceAll('_', ' ')}
                    </span>
                  </td>
                  <td>{s.cashierName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </StationeryShell>
  );
}
