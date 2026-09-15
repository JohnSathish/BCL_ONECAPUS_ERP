'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Banknote,
  Barcode,
  CheckCircle2,
  FileText,
  Globe,
  HelpCircle,
  Landmark,
  Loader2,
  Minus,
  Pause,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  Smartphone,
  Trash2,
  Wallet,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import { useAuthStore } from '@/store/auth-store';
import {
  completeStationerySale,
  fetchStationeryCategories,
  fetchStationeryDashboard,
  fetchStationeryProducts,
  fetchStationerySale,
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

type PayLine = {
  method: string;
  amount: number;
  reference?: string;
  bankName?: string;
  chequeNumber?: string;
  instrumentDate?: string;
};

const HOLD_KEY = 'sls-stationery-holds';
const METHOD_UI = [
  { id: 'CASH', label: 'Cash', icon: Banknote },
  { id: 'UPI', label: 'UPI', icon: Smartphone },
  { id: 'BANK_TRANSFER', label: 'Bank', icon: Landmark },
  { id: 'CHEQUE', label: 'Cheque', icon: FileText },
  { id: 'ONLINE', label: 'Online', icon: Globe },
  { id: 'OTHER', label: 'Other', icon: Wallet },
] as const;

function lineNet(l: CartLine) {
  return Math.round(l.rate * l.qty * (1 - l.discountPct / 100));
}

function loadHolds(): any[] {
  try {
    return JSON.parse(localStorage.getItem(HOLD_KEY) || '[]');
  } catch {
    return [];
  }
}

export function StationeryPosDesk() {
  const ready = useAuthQueryEnabled();
  const session = useAuthStore((s) => s.session);
  const perms = session?.user.permissions;
  const canManage = canManageSchoolSis(perms);
  const cashierLabel = session?.user.displayName || session?.user.email || 'Cashier';
  const qc = useQueryClient();
  const searchRef = useRef<HTMLInputElement>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const studentRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [barcode, setBarcode] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [customerType, setCustomerType] = useState<'STUDENT' | 'WALK_IN'>('STUDENT');
  const [studentQ, setStudentQ] = useState('');
  const [student, setStudent] = useState<any>(null);
  const [walkIn, setWalkIn] = useState({ name: '', mobile: '' });
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [billDiscountPct, setBillDiscountPct] = useState(0);
  const [billDiscountAmt, setBillDiscountAmt] = useState(0);
  const [discMode, setDiscMode] = useState<'pct' | 'amt'>('pct');
  const [split, setSplit] = useState(false);
  const [pays, setPays] = useState<PayLine[]>([{ method: 'CASH', amount: 0 }]);
  const [cashReceived, setCashReceived] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successSale, setSuccessSale] = useState<any>(null);
  const [holdOpen, setHoldOpen] = useState(false);
  const [holdNote, setHoldNote] = useState('');
  const [heldOpen, setHeldOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const [holds, setHolds] = useState<any[]>([]);
  const idemRef = useRef<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 220);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setHolds(loadHolds());
  }, [cart.length, holdOpen, heldOpen]);

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
  const methods = METHOD_UI.filter((m) => m.id !== 'CREDIT' || settings?.allowCreditSales);

  const subtotal = cart.reduce((s, l) => s + l.rate * l.qty, 0);
  const itemDisc = cart.reduce((s, l) => s + (l.rate * l.qty * l.discountPct) / 100, 0);
  const billDisc =
    discMode === 'pct' ? (subtotal * billDiscountPct) / 100 : Math.min(billDiscountAmt, subtotal);
  const grand = Math.max(0, Math.round(subtotal - itemDisc - billDisc));
  const paidSplit = pays.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const cashAmt = split
    ? pays.filter((p) => p.method === 'CASH').reduce((s, p) => s + p.amount, 0)
    : pays[0]?.method === 'CASH'
      ? grand
      : 0;
  const change = Math.max(0, (Number(cashReceived) || 0) - cashAmt);
  const paid = split ? paidSplit : grand;
  const due = Math.max(0, grand - paid);

  const addProduct = useCallback((p: any, variant?: any) => {
    const stock = Number(variant?.qtyOnHand ?? p.qtyOnHand ?? 0);
    if (stock <= 0 && p.stockStatus === 'OUT') return;
    if (stock <= 0) return;
    const key = `${p.id}:${variant?.id || ''}`;
    const rate = Number(variant?.sellingPrice ?? p.sellingPrice);
    setCart((prev) => {
      const hit = prev.find((l) => l.key === key);
      if (hit) {
        if (hit.qty + 1 > stock) {
          setError(`Only ${stock} units are currently available.`);
          return prev;
        }
        return prev.map((l) => (l.key === key ? { ...l, qty: l.qty + 1, stock } : l));
      }
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
    setSelectedKey(key);
    setError(null);
    setQ('');
  }, []);

  function setQty(key: string, qty: number) {
    setCart((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        if (qty < 1) return l;
        if (qty > l.stock) {
          setError(`Only ${l.stock} units are currently available.`);
          return l;
        }
        return { ...l, qty };
      }),
    );
  }

  async function scanBarcode(code: string) {
    const term = code.trim();
    if (!term) return;
    try {
      const rows = await fetchStationeryProducts({ q: term });
      const hit =
        rows.find((p: any) => String(p.barcode || '').toLowerCase() === term.toLowerCase()) ||
        rows.find((p: any) => String(p.sku || '').toLowerCase() === term.toLowerCase()) ||
        rows[0];
      if (!hit) {
        setError(`No product for barcode ${term}`);
        return;
      }
      const v =
        hit.variants?.find(
          (x: any) => String(x.barcode || '').toLowerCase() === term.toLowerCase(),
        ) || (hit.variants?.length === 1 ? hit.variants[0] : undefined);
      if (hit.variants?.length > 1 && !v) {
        setError('Select a size/variant for this item');
        setQ(hit.name);
        return;
      }
      addProduct(hit, v);
      setBarcode('');
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  function openConfirm() {
    setError(null);
    if (!cart.length) return setError('Add at least one item');
    if (customerType === 'STUDENT' && !student) return setError('Select a student');
    if (split && Math.abs(paidSplit - grand) > 0.5) {
      return setError('Split payments must equal the grand total');
    }
    if (split && paidSplit > grand) return setError('Split amount cannot exceed the bill total');
    if (
      !split &&
      pays[0]?.method === 'CASH' &&
      cashReceived < grand &&
      !settings?.allowCreditSales
    ) {
      return setError('Insufficient amount.');
    }
    if (!split && due > 0 && !settings?.allowCreditSales && pays[0]?.method !== 'CREDIT') {
      if (pays[0]?.method === 'CASH' && cashReceived < grand)
        return setError('Insufficient amount.');
    }
    setConfirmOpen(true);
  }

  async function checkout(draft = false) {
    setError(null);
    if (!cart.length) return setError('Add at least one item');
    if (customerType === 'STUDENT' && !student && !draft) return setError('Select a student');
    const payments = draft
      ? []
      : pays[0]?.method === 'CREDIT'
        ? []
        : split
          ? pays.filter((p) => p.amount > 0)
          : [
              {
                method: pays[0]?.method || 'CASH',
                amount: grand,
                reference: pays[0]?.reference,
                bankName: pays[0]?.bankName,
                chequeNumber: pays[0]?.chequeNumber,
                instrumentDate: pays[0]?.instrumentDate,
              },
            ];
    if (!draft && !settings?.allowCreditSales) {
      const sum = payments.reduce((s, p) => s + p.amount, 0);
      if (sum < grand) return setError('Full payment is required before completing the sale');
    }
    setBusy(true);
    if (!idemRef.current) idemRef.current = crypto.randomUUID();
    try {
      const sale = await completeStationerySale({
        customerType,
        studentId: student?.id,
        walkInName: walkIn.name || 'Walk-in Customer',
        walkInMobile: walkIn.mobile,
        billDiscountPct: discMode === 'pct' ? billDiscountPct : undefined,
        billDiscount: discMode === 'amt' ? Math.round(billDisc) : undefined,
        draft,
        cashReceived: draft ? undefined : cashReceived || undefined,
        idempotencyKey: draft ? undefined : idemRef.current,
        items: cart.map((l) => ({
          productId: l.productId,
          variantId: l.variantId,
          qty: l.qty,
          discountPct: l.discountPct,
        })),
        payments,
      });
      if (draft) {
        setCart([]);
        setConfirmOpen(false);
      } else {
        setSuccessSale(sale);
        setCart([]);
        setStudent(null);
        setWalkIn({ name: '', mobile: '' });
        setPays([{ method: settings?.defaultPaymentMethod || 'CASH', amount: 0 }]);
        setBillDiscountPct(0);
        setBillDiscountAmt(0);
        setCashReceived(0);
        setSplit(false);
        setConfirmOpen(false);
        idemRef.current = null;
      }
      await qc.invalidateQueries({
        predicate: (query) => String(query.queryKey[0] || '').startsWith('sls-stn'),
      });
    } catch (err) {
      setError(apiErrorMessage(err));
      setConfirmOpen(false);
      idemRef.current = null;
    } finally {
      setBusy(false);
    }
  }

  function persistHold() {
    const next = [
      {
        at: Date.now(),
        note: holdNote,
        customerType,
        student,
        walkIn,
        cart,
        billDiscountPct,
        billDiscountAmt,
        discMode,
      },
      ...loadHolds(),
    ].slice(0, 12);
    localStorage.setItem(HOLD_KEY, JSON.stringify(next));
    setHolds(next);
    setCart([]);
    setHoldNote('');
    setHoldOpen(false);
  }

  function resumeHold(h: any, idx: number) {
    setCart(h.cart || []);
    setStudent(h.student);
    setWalkIn(h.walkIn || { name: '', mobile: '' });
    setCustomerType(h.customerType);
    setBillDiscountPct(h.billDiscountPct || 0);
    setBillDiscountAmt(h.billDiscountAmt || 0);
    setDiscMode(h.discMode || 'pct');
    const next = loadHolds().filter((_: any, i: number) => i !== idx);
    localStorage.setItem(HOLD_KEY, JSON.stringify(next));
    setHolds(next);
    setHeldOpen(false);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === 'Escape') {
        setConfirmOpen(false);
        setHoldOpen(false);
        setHeldOpen(false);
        setKeysOpen(false);
        return;
      }
      if (e.key === 'F2') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'F4') {
        e.preventDefault();
        barcodeRef.current?.focus();
      }
      if (e.key === 'F6') {
        e.preventDefault();
        studentRef.current?.focus();
      }
      if (e.key === 'F8') {
        e.preventDefault();
        setHoldOpen(true);
      }
      if (e.key === 'F9') {
        e.preventDefault();
        openConfirm();
      }
      if (e.key === 'Delete' && tag !== 'INPUT' && tag !== 'TEXTAREA' && selectedKey) {
        setCart((prev) => prev.filter((l) => l.key !== selectedKey));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    if (!split && pays[0]?.method === 'CASH') setCashReceived(grand);
  }, [grand, split, pays]);

  const cashPct = dash?.todaySales ? Math.round((dash.todayCash / dash.todaySales) * 100) : 0;
  const upiPct = dash?.todaySales ? Math.round((dash.todayUpi / dash.todaySales) * 100) : 0;

  return (
    <StationeryShell
      title="Stationery Billing"
      subtitle="Sell books, stationery, uniforms and other school supplies."
      extra={
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700 ring-1 ring-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Counter Open
          </span>
          <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-slate-600 ring-1 ring-slate-200">
            Counter 01
          </span>
          <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-slate-600 ring-1 ring-slate-200">
            Cashier: {cashierLabel}
          </span>
          <button
            type="button"
            className="rounded-full bg-white px-2.5 py-1 font-semibold text-[#2563eb] ring-1 ring-slate-200"
            onClick={() => setHeldOpen(true)}
          >
            Held Bills ({holds.length})
          </button>
          <button
            type="button"
            className="rounded-full bg-white px-2.5 py-1 text-slate-500 ring-1 ring-slate-200"
            onClick={() => setKeysOpen(true)}
            title="Keyboard shortcuts"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </div>
      }
    >
      {dash ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          {[
            {
              label: "Today's Sales",
              value: rs(dash.todaySales),
              hint: `${dash.todayTransactions} transactions`,
              icon: Wallet,
              color: 'text-[#2563eb] bg-blue-50',
            },
            {
              label: 'Transactions',
              value: dash.todayTransactions,
              hint: 'Today',
              icon: ShoppingCart,
              color: 'text-violet-600 bg-violet-50',
            },
            {
              label: 'Cash',
              value: rs(dash.todayCash),
              hint: dash.todaySales ? `${cashPct}% of sales` : 'Today',
              icon: Banknote,
              color: 'text-emerald-700 bg-emerald-50',
            },
            {
              label: 'UPI',
              value: rs(dash.todayUpi),
              hint: dash.todaySales ? `${upiPct}% of sales` : 'Today',
              icon: Smartphone,
              color: 'text-sky-700 bg-sky-50',
            },
            {
              label: 'Pending / Credit',
              value: rs(dash.pendingPayments),
              hint: `${dash.pendingCount || 0} bills`,
              icon: Pause,
              color: 'text-amber-700 bg-amber-50',
            },
            {
              label: 'Low Stock',
              value: dash.lowStockItems,
              hint: 'Below threshold',
              icon: AlertTriangle,
              color: 'text-orange-700 bg-orange-50',
            },
            {
              label: 'Out of Stock',
              value: dash.outOfStockItems,
              hint: 'Unavailable',
              icon: AlertTriangle,
              color: 'text-rose-700 bg-rose-50',
            },
            {
              label: 'Inventory Value',
              value: rs(dash.inventoryValue),
              hint: `Month ${rs(dash.monthlySales)}`,
              icon: Wallet,
              color: 'text-[#1e3a8a] bg-slate-100',
            },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5"
            >
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {card.label}
                </p>
                <span className={cn('rounded-md p-1', card.color)}>
                  <card.icon className="h-3.5 w-3.5" />
                </span>
              </div>
              <p className="mt-1 text-base font-semibold text-[#1e3a8a]">{card.value}</p>
              <p className="text-[10px] text-slate-400">{card.hint}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid items-start gap-3 xl:grid-cols-[minmax(280px,0.95fr)_minmax(0,1.15fr)_320px]">
        <section className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-[#1e3a8a]">Products</p>
            <span className="text-[10px] text-slate-400">F2 search · F4 barcode</span>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              ref={searchRef}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/15"
              placeholder="Search product, barcode, SKU..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && products[0]) {
                  e.preventDefault();
                  const p = products[0];
                  if (p.variants?.length > 1) return;
                  addProduct(p, p.variants?.[0]);
                }
              }}
            />
          </div>
          <div className="relative mt-2">
            <Barcode className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              ref={barcodeRef}
              className="h-10 w-full rounded-lg border border-dashed border-slate-300 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-[#2563eb] focus:bg-white"
              placeholder="Scan barcode / enter barcode"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void scanBarcode(barcode);
                }
              }}
            />
          </div>
          <div className="mt-2 flex gap-1 overflow-x-auto pb-1">
            <button
              type="button"
              className={cn(
                'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                !categoryId ? 'bg-[#2563eb] text-white' : 'bg-slate-100 text-slate-600',
              )}
              onClick={() => setCategoryId('')}
            >
              All
            </button>
            {(catQ.data ?? []).map((c: any) => (
              <button
                key={c.id}
                type="button"
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                  categoryId === c.id ? 'bg-[#2563eb] text-white' : 'bg-slate-100 text-slate-600',
                )}
                onClick={() => setCategoryId(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
          <div className="mt-2 max-h-[52vh] space-y-1 overflow-auto">
            {prodQ.isError ? (
              <p className="p-2 text-sm text-rose-700">{apiErrorMessage(prodQ.error)}</p>
            ) : null}
            {products.map((p: any) => {
              const out = p.stockStatus === 'OUT' || Number(p.qtyOnHand) <= 0;
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{p.name}</p>
                    <p className="text-[11px] text-slate-500">
                      SKU: {p.sku}
                      {p.category?.name ? ` · ${p.category.name}` : ''}
                    </p>
                    <p className="text-sm font-semibold text-[#1e3a8a]">{rs(p.sellingPrice)}</p>
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1',
                      stockBadge(p.stockStatus),
                    )}
                  >
                    {p.stockStatus === 'OUT'
                      ? 'Out of stock'
                      : p.stockStatus === 'LOW'
                        ? `Low stock (${Number(p.qtyOnHand)})`
                        : `In stock (${Number(p.qtyOnHand)})`}
                  </span>
                  {p.variants?.length ? (
                    <div className="flex flex-wrap gap-1">
                      {p.variants.map((v: any) => (
                        <button
                          key={v.id}
                          type="button"
                          disabled={Number(v.qtyOnHand) <= 0}
                          className="rounded-md bg-[#2563eb] px-1.5 py-0.5 text-[10px] font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400"
                          onClick={() => addProduct(p, v)}
                        >
                          {v.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={out}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#2563eb] text-white disabled:bg-slate-200 disabled:text-slate-400"
                      onClick={() => addProduct(p)}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
            {!prodQ.isError && !products.length ? (
              <p className="p-3 text-sm text-slate-500">
                {debounced
                  ? `No product matches “${debounced}”.`
                  : 'No products yet. Add items under Products.'}
                <Link
                  href="/admin/school-sis/stationery/products"
                  className="mt-1 block font-semibold text-[#2563eb]"
                >
                  Go to Stationery Products →
                </Link>
              </p>
            ) : null}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-[#1e3a8a]">Current Bill</p>
            <button
              type="button"
              className="text-xs font-semibold text-rose-600"
              onClick={() => setCart([])}
            >
              Clear Cart
            </button>
          </div>
          <div className="flex gap-2">
            {(['STUDENT', 'WALK_IN'] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-semibold',
                  customerType === t ? 'bg-[#2563eb] text-white' : 'bg-slate-100 text-slate-600',
                )}
                onClick={() => setCustomerType(t)}
              >
                {t === 'STUDENT' ? 'Student' : 'Walk-in'}
              </button>
            ))}
          </div>
          {customerType === 'STUDENT' ? (
            student ? (
              <div className="mt-2 rounded-lg bg-sky-50 p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[#1e3a8a]">{student.fullName}</p>
                    <p className="text-slate-600">
                      {student.admissionNumber} · {student.className || '—'} ·{' '}
                      {student.academicYear}
                    </p>
                    <p className="text-xs text-slate-500">
                      Guardian: {student.guardianName || '—'} ·{' '}
                      {student.guardianPhone || student.phone || '—'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-xs font-semibold text-[#2563eb]"
                    onClick={() => {
                      setStudent(null);
                      setStudentQ('');
                    }}
                  >
                    Change Student
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-2">
                <input
                  ref={studentRef}
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                  placeholder="Search student by name, admission no., roll no. or mobile…"
                  value={studentQ}
                  onChange={(e) => setStudentQ(e.target.value)}
                />
                <div className="mt-1 max-h-36 overflow-auto">
                  {(stuQ.data ?? []).map((s: any) => (
                    <button
                      key={s.id}
                      type="button"
                      className="block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-50"
                      onClick={() => setStudent(s)}
                    >
                      <span className="font-medium">{s.fullName}</span>
                      <span className="block text-[11px] text-slate-500">
                        {s.admissionNumber} · {s.className || '—'} ·{' '}
                        {s.guardianPhone || s.phone || ''}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )
          ) : (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <input
                className="h-10 rounded-lg border px-3 text-sm"
                placeholder="Customer name (optional)"
                value={walkIn.name}
                onChange={(e) => setWalkIn({ ...walkIn, name: e.target.value })}
              />
              <input
                className="h-10 rounded-lg border px-3 text-sm"
                placeholder="Mobile (optional)"
                value={walkIn.mobile}
                onChange={(e) => setWalkIn({ ...walkIn, mobile: e.target.value })}
              />
            </div>
          )}

          {sugQ.data?.length ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {sugQ.data.slice(0, 8).map((p: any) => (
                <button
                  key={p.id}
                  type="button"
                  className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
                  onClick={() => addProduct(p, p.variants?.[0])}
                >
                  {p.name}
                </button>
              ))}
            </div>
          ) : null}

          {cart.length ? (
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase text-slate-400">
                  <th className="pb-1">Item</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Disc.</th>
                  <th>Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {cart.map((l) => (
                  <tr
                    key={l.key}
                    className={cn(
                      'border-t border-slate-100',
                      selectedKey === l.key && 'bg-blue-50/60',
                    )}
                    onClick={() => setSelectedKey(l.key)}
                  >
                    <td className="py-2">
                      <p className="font-medium">{l.name}</p>
                      <p className="text-[11px] text-slate-500">{l.variantLabel || l.sku}</p>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="h-7 w-7 rounded-md bg-slate-100"
                          onClick={() => setQty(l.key, l.qty - 1)}
                        >
                          <Minus className="mx-auto h-3 w-3" />
                        </button>
                        <input
                          className="h-7 w-10 rounded-md border text-center text-xs"
                          value={l.qty}
                          onChange={(e) => setQty(l.key, Number(e.target.value) || 1)}
                        />
                        <button
                          type="button"
                          className="h-7 w-7 rounded-md bg-slate-100"
                          onClick={() => setQty(l.key, l.qty + 1)}
                        >
                          <Plus className="mx-auto h-3 w-3" />
                        </button>
                      </div>
                    </td>
                    <td>{rs(l.rate)}</td>
                    <td>
                      <input
                        className="h-7 w-12 rounded-md border px-1 text-xs"
                        type="number"
                        value={l.discountPct}
                        onChange={(e) =>
                          setCart((prev) =>
                            prev.map((x) =>
                              x.key === l.key
                                ? { ...x, discountPct: Math.max(0, Number(e.target.value) || 0) }
                                : x,
                            ),
                          )
                        }
                      />
                    </td>
                    <td className="font-semibold">{rs(lineNet(l))}</td>
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
          ) : (
            <div className="mt-8 pb-8 text-center text-slate-400">
              <ShoppingCart className="mx-auto h-8 w-8" />
              <p className="mt-2 text-sm font-medium text-slate-600">No items added</p>
              <p className="text-xs">Search or scan a product to start billing.</p>
            </div>
          )}
        </section>

        <aside className="sticky top-3 space-y-3 rounded-xl border border-slate-200 bg-white p-3 xl:top-4">
          <p className="text-sm font-semibold text-[#1e3a8a]">Billing Summary</p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Subtotal ({cart.length} items)</span>
              <span>{rs(subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Item Discount</span>
              <span>-{rs(itemDisc)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Bill Discount</span>
              <span className="flex items-center gap-1">
                <input
                  className="h-8 w-16 rounded-md border px-1 text-right text-sm"
                  type="number"
                  value={discMode === 'pct' ? billDiscountPct : billDiscountAmt}
                  onChange={(e) =>
                    discMode === 'pct'
                      ? setBillDiscountPct(Number(e.target.value) || 0)
                      : setBillDiscountAmt(Number(e.target.value) || 0)
                  }
                />
                <button
                  type="button"
                  className="text-[10px] font-semibold text-[#2563eb]"
                  onClick={() => setDiscMode(discMode === 'pct' ? 'amt' : 'pct')}
                >
                  {discMode === 'pct' ? '%' : '₹'}
                </button>
              </span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Bill Discount</span>
              <span>-{rs(billDisc)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 text-lg font-semibold text-[#1e3a8a]">
              <span>Grand Total</span>
              <span>{rs(grand)}</span>
            </div>
          </div>

          <p className="text-xs font-semibold uppercase text-slate-400">Payment Method</p>
          <div className="grid grid-cols-3 gap-1.5">
            {methods.map((m) => (
              <button
                key={m.id}
                type="button"
                className={cn(
                  'flex flex-col items-center rounded-lg border py-2 text-[11px] font-semibold',
                  pays[0]?.method === m.id && !split
                    ? 'border-[#2563eb] bg-blue-50 text-[#2563eb]'
                    : 'border-slate-200 text-slate-600',
                )}
                onClick={() => {
                  setSplit(false);
                  setPays([{ method: m.id, amount: grand }]);
                }}
              >
                <m.icon className="mb-0.5 h-4 w-4" />
                {m.label}
              </button>
            ))}
            {settings?.allowCreditSales ? (
              <button
                type="button"
                className={cn(
                  'flex flex-col items-center rounded-lg border py-2 text-[11px] font-semibold',
                  pays[0]?.method === 'CREDIT'
                    ? 'border-amber-400 bg-amber-50 text-amber-800'
                    : 'border-slate-200 text-slate-600',
                )}
                onClick={() => {
                  setSplit(false);
                  setPays([{ method: 'CREDIT', amount: 0 }]);
                }}
              >
                Credit
              </button>
            ) : null}
          </div>

          {!split && pays[0]?.method === 'CASH' ? (
            <div className="rounded-lg bg-emerald-50 p-2 text-sm">
              <div className="flex justify-between">
                <span>Amount due</span>
                <span>{rs(grand)}</span>
              </div>
              <label className="mt-1 flex items-center justify-between gap-2">
                Cash received
                <input
                  className="h-8 w-24 rounded-md border px-2 text-right"
                  type="number"
                  value={cashReceived || ''}
                  onChange={(e) => setCashReceived(Number(e.target.value) || 0)}
                />
              </label>
              <div className="mt-1 flex justify-between font-semibold text-emerald-800">
                <span>Change to return</span>
                <span>{rs(change)}</span>
              </div>
            </div>
          ) : null}

          {!split && pays[0]?.method === 'UPI' ? (
            <input
              className="h-9 w-full rounded-lg border px-2 text-sm"
              placeholder="UPI reference number"
              value={pays[0]?.reference || ''}
              onChange={(e) =>
                setPays([{ ...pays[0], method: 'UPI', amount: grand, reference: e.target.value }])
              }
            />
          ) : null}

          {!split && pays[0]?.method === 'BANK_TRANSFER' ? (
            <div className="grid gap-1">
              <input
                className="h-9 rounded-lg border px-2 text-sm"
                placeholder="Bank name"
                value={pays[0]?.bankName || ''}
                onChange={(e) =>
                  setPays([
                    {
                      ...pays[0],
                      method: 'BANK_TRANSFER',
                      amount: grand,
                      bankName: e.target.value,
                    },
                  ])
                }
              />
              <input
                className="h-9 rounded-lg border px-2 text-sm"
                placeholder="Transaction reference"
                value={pays[0]?.reference || ''}
                onChange={(e) =>
                  setPays([
                    {
                      ...pays[0],
                      method: 'BANK_TRANSFER',
                      amount: grand,
                      reference: e.target.value,
                    },
                  ])
                }
              />
              <input
                className="h-9 rounded-lg border px-2 text-sm"
                type="date"
                value={pays[0]?.instrumentDate || ''}
                onChange={(e) =>
                  setPays([
                    {
                      ...pays[0],
                      method: 'BANK_TRANSFER',
                      amount: grand,
                      instrumentDate: e.target.value,
                    },
                  ])
                }
              />
            </div>
          ) : null}

          {!split && pays[0]?.method === 'CHEQUE' ? (
            <div className="grid gap-1">
              <input
                className="h-9 rounded-lg border px-2 text-sm"
                placeholder="Cheque number"
                value={pays[0]?.chequeNumber || ''}
                onChange={(e) =>
                  setPays([
                    { ...pays[0], method: 'CHEQUE', amount: grand, chequeNumber: e.target.value },
                  ])
                }
              />
              <input
                className="h-9 rounded-lg border px-2 text-sm"
                placeholder="Bank name"
                value={pays[0]?.bankName || ''}
                onChange={(e) =>
                  setPays([
                    { ...pays[0], method: 'CHEQUE', amount: grand, bankName: e.target.value },
                  ])
                }
              />
              <input
                className="h-9 rounded-lg border px-2 text-sm"
                type="date"
                value={pays[0]?.instrumentDate || ''}
                onChange={(e) =>
                  setPays([
                    { ...pays[0], method: 'CHEQUE', amount: grand, instrumentDate: e.target.value },
                  ])
                }
              />
            </div>
          ) : null}

          {split ? (
            <div className="space-y-1">
              {pays.map((p, idx) => (
                <div key={idx} className="flex gap-1">
                  <select
                    className="h-8 flex-1 rounded-md border text-xs"
                    value={p.method}
                    onChange={(e) =>
                      setPays((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, method: e.target.value } : x)),
                      )
                    }
                  >
                    {methods.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <input
                    className="h-8 w-20 rounded-md border px-1 text-xs"
                    type="number"
                    value={p.amount || ''}
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
              <p className="text-xs">
                Paid {rs(paidSplit)} · Balance {rs(Math.max(0, grand - paidSplit))}
              </p>
            </div>
          ) : null}

          <button
            type="button"
            className="text-xs font-semibold text-[#2563eb]"
            onClick={() => {
              setSplit(true);
              setPays([
                { method: 'CASH', amount: Math.round(grand / 2) },
                { method: 'UPI', amount: grand - Math.round(grand / 2) },
              ]);
            }}
          >
            + Split payment
          </button>

          {error ? (
            <p className="rounded-md bg-rose-50 p-2 text-xs text-rose-700">{error}</p>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="h-10 rounded-lg border text-sm"
              onClick={() => setHoldOpen(true)}
            >
              Hold Bill
            </button>
            <button
              type="button"
              className="h-10 rounded-lg border text-sm"
              disabled={busy}
              onClick={() => void checkout(true)}
            >
              Save Draft
            </button>
            <button
              type="button"
              className="col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#2563eb] text-sm font-semibold text-white disabled:opacity-50"
              disabled={busy}
              onClick={openConfirm}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Complete Payment (F9)
            </button>
          </div>
          {!canManage ? (
            <p className="text-[10px] text-slate-400">
              Product and stock masters require manager access.
            </p>
          ) : null}
        </aside>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-[#1e3a8a]">Recent Transactions</p>
          <Link
            href="/admin/school-sis/stationery/reports"
            className="text-xs font-semibold text-[#2563eb]"
          >
            View all
          </Link>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase text-slate-400">
                <th className="py-1">Invoice</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Amount</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Cashier</th>
                <th>Date</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(recentQ.data ?? []).map((s: any) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="py-2 font-medium">{s.invoiceNo}</td>
                  <td>{s.student?.fullName || s.walkInName || 'Walk-in'}</td>
                  <td>{s.items?.length ?? 0}</td>
                  <td>{rs(s.grandTotal)}</td>
                  <td>{(s.payments || []).map((p: any) => p.method).join(', ') || '—'}</td>
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
                  <td className="text-xs text-slate-500">
                    {new Date(s.completedAt || s.createdAt).toLocaleString('en-IN')}
                  </td>
                  <td className="space-x-2">
                    <button
                      type="button"
                      className="text-xs font-semibold text-[#2563eb]"
                      onClick={async () => printStationeryReceipt(await fetchStationerySale(s.id))}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      className="text-xs font-semibold text-slate-600"
                      onClick={async () => printStationeryReceipt(await fetchStationerySale(s.id))}
                    >
                      <Printer className="inline h-3 w-3" /> Print
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm payment</DialogTitle>
            <DialogDescription>Review the bill before recording the sale.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1 text-sm">
            <p>
              <span className="text-slate-500">Customer:</span>{' '}
              {customerType === 'STUDENT' ? student?.fullName : walkIn.name || 'Walk-in Customer'}
            </p>
            <p>
              <span className="text-slate-500">Items:</span> {cart.length}
            </p>
            <p className="text-base font-semibold">Grand total {rs(grand)}</p>
            <p>
              Payment:{' '}
              {split ? pays.map((p) => `${p.method} ${rs(p.amount)}`).join(', ') : pays[0]?.method}
            </p>
            {pays[0]?.method === 'CASH' && !split ? (
              <>
                <p>Cash received {rs(cashReceived)}</p>
                <p>Change {rs(change)}</p>
              </>
            ) : null}
            <p>
              Cashier: {cashierLabel} · {new Date().toLocaleString('en-IN')}
            </p>
          </div>
          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          <DialogFooter>
            <button
              type="button"
              className="h-10 rounded-lg border px-4 text-sm"
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="h-10 rounded-lg bg-[#2563eb] px-4 text-sm font-semibold text-white disabled:opacity-50"
              disabled={busy}
              onClick={() => void checkout(false)}
            >
              {busy ? 'Processing payment…' : `Confirm & Complete ${rs(grand)}`}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!successSale} onOpenChange={(o) => !o && setSuccessSale(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" /> Payment successful
            </DialogTitle>
            <DialogDescription>Invoice recorded and stock updated.</DialogDescription>
          </DialogHeader>
          {successSale ? (
            <div className="space-y-1 text-sm">
              <p>Invoice: {successSale.invoiceNo}</p>
              <p>Amount: {rs(successSale.grandTotal)}</p>
              <p>Payment: {(successSale.payments || []).map((p: any) => p.method).join(', ')}</p>
              <p>Cashier: {successSale.cashierName}</p>
            </div>
          ) : null}
          <DialogFooter>
            <button
              type="button"
              className="h-10 rounded-lg border px-4 text-sm"
              onClick={() => successSale && printStationeryReceipt(successSale)}
            >
              Print receipt
            </button>
            <button
              type="button"
              className="h-10 rounded-lg bg-[#2563eb] px-4 text-sm font-semibold text-white"
              onClick={() => setSuccessSale(null)}
            >
              New bill
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={holdOpen} onOpenChange={setHoldOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hold bill</DialogTitle>
            <DialogDescription>
              Park this cart and resume it later. Stock is not reduced.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            {customerType === 'STUDENT'
              ? student?.fullName || 'No student selected'
              : walkIn.name || 'Walk-in'}{' '}
            · {cart.length} items · {rs(grand)}
          </p>
          <input
            className="h-10 w-full rounded-lg border px-3 text-sm"
            placeholder="Hold reason / note"
            value={holdNote}
            onChange={(e) => setHoldNote(e.target.value)}
          />
          <DialogFooter>
            <button
              type="button"
              className="h-10 rounded-lg border px-4"
              onClick={() => setHoldOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="h-10 rounded-lg bg-[#2563eb] px-4 text-sm font-semibold text-white"
              onClick={persistHold}
            >
              Hold bill
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={heldOpen} onOpenChange={setHeldOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Held bills</DialogTitle>
            <DialogDescription>Resume a parked cart.</DialogDescription>
          </DialogHeader>
          <div className="max-h-64 space-y-2 overflow-auto">
            {holds.map((h, i) => (
              <button
                key={h.at}
                type="button"
                className="block w-full rounded-lg border p-2 text-left text-sm hover:bg-slate-50"
                onClick={() => resumeHold(h, i)}
              >
                {h.student?.fullName || h.walkIn?.name || 'Walk-in'} · {h.cart?.length || 0} items ·{' '}
                {new Date(h.at).toLocaleTimeString('en-IN')}
                {h.note ? <span className="block text-xs text-slate-500">{h.note}</span> : null}
              </button>
            ))}
            {!holds.length ? <p className="text-sm text-slate-500">No held bills.</p> : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={keysOpen} onOpenChange={setKeysOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
          </DialogHeader>
          <ul className="space-y-1 text-sm text-slate-600">
            <li>F2 — Product search</li>
            <li>F4 — Barcode scan</li>
            <li>F6 — Student search</li>
            <li>F8 — Hold bill</li>
            <li>F9 — Complete payment</li>
            <li>Enter — Add first search result</li>
            <li>Delete — Remove selected cart line</li>
            <li>Esc — Close dialog</li>
          </ul>
        </DialogContent>
      </Dialog>
    </StationeryShell>
  );
}
