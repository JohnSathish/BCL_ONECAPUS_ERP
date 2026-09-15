'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  adjustStationeryStock,
  cancelStationerySale,
  createStationeryCategory,
  createStationeryPurchase,
  createStationeryReturn,
  downloadStationeryProductTemplate,
  fetchStationeryCategories,
  fetchStationeryMovements,
  fetchStationeryProducts,
  fetchStationeryPurchases,
  fetchStationeryReports,
  fetchStationerySales,
  fetchStationerySale,
  fetchStationerySettings,
  fetchStationerySuppliers,
  importStationeryProducts,
  saveStationeryProduct,
  saveStationerySettings,
  saveStationerySupplier,
} from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import {
  printStationeryReceipt,
  rs,
  StationeryShell,
  statusBadge,
  stockBadge,
  inputClass,
} from './stationery-ui';

const UNITS = [
  'PIECE',
  'BOX',
  'PACKET',
  'SET',
  'PAIR',
  'DOZEN',
  'REAM',
  'BUNDLE',
  'KG',
  'GRAM',
  'METRE',
];

function Banner({ error, ok }: { error?: string | null; ok?: string | null }) {
  if (error) return <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>;
  if (ok) return <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{ok}</p>;
  return null;
}

export function StationeryProductsDesk() {
  const ready = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [stock, setStock] = useState('ALL');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [form, setForm] = useState<any>({
    name: '',
    sku: '',
    sellingPrice: 0,
    purchasePrice: 0,
    unit: 'PIECE',
    openingStock: 0,
    minStock: 0,
    categoryId: '',
    subcategoryId: '',
    variantsText: '',
  });
  const cats = useQuery({
    queryKey: ['sls-stn-cats'],
    queryFn: fetchStationeryCategories,
    enabled: ready,
  });
  const list = useQuery({
    queryKey: ['sls-stn-prod', q, stock],
    queryFn: () => fetchStationeryProducts({ q: q || undefined, stock }),
    enabled: ready,
  });
  const parents = cats.data ?? [];
  const children = parents.find((c) => c.id === form.categoryId)?.children ?? [];

  async function save() {
    setError(null);
    setOk(null);
    try {
      const variants = String(form.variantsText || '')
        .split('\n')
        .map((line: string) => line.trim())
        .filter(Boolean)
        .map((line: string, i: number) => {
          const [label, size, gender, sku] = line.split('|').map((s) => s.trim());
          return {
            label: label || `Variant ${i + 1}`,
            size: size || undefined,
            gender: gender || undefined,
            sku: sku || `${form.sku}-${i + 1}`,
          };
        });
      await saveStationeryProduct({
        ...form,
        sellingPrice: Number(form.sellingPrice),
        purchasePrice: Number(form.purchasePrice),
        openingStock: Number(form.openingStock),
        minStock: Number(form.minStock),
        variants: variants.length ? variants : undefined,
      });
      setOk('Product saved');
      setForm({ ...form, name: '', sku: '', variantsText: '' });
      await qc.invalidateQueries({ queryKey: ['sls-stn-prod'] });
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function onImport(file: File) {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    const header = lines[0].split(',').map((h) => h.trim());
    const rows = lines.slice(1).map((line) => {
      const cols = line.split(',');
      const rec: any = {};
      header.forEach((h, i) => {
        rec[h] = cols[i]?.trim();
      });
      return {
        name: rec.name,
        sku: rec.sku,
        barcode: rec.barcode,
        categoryCode: rec.categoryCode,
        subcategoryCode: rec.subcategoryCode,
        unit: rec.unit || 'PIECE',
        purchasePrice: Number(rec.purchasePrice || 0),
        sellingPrice: Number(rec.sellingPrice || 0),
        openingStock: Number(rec.openingStock || 0),
        minStock: Number(rec.minStock || 0),
      };
    });
    const res = await importStationeryProducts(rows);
    setOk(
      `Imported ${res.success}/${res.total}. Failed ${res.failed} (dup ${res.duplicate}, invalid ${res.invalid}).`,
    );
    if (res.errors?.length) {
      const blob = new Blob([res.errors.map((e) => `${e.row},${e.sku},${e.error}`).join('\n')], {
        type: 'text/csv',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'stationery-import-errors.csv';
      a.click();
    }
    await qc.invalidateQueries({ queryKey: ['sls-stn-prod'] });
  }

  return (
    <StationeryShell title="Stationery Products">
      <Banner error={error} ok={ok} />
      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <form
          className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <p className="font-semibold text-[#1e3a8a]">New product</p>
          <input
            className={inputClass}
            placeholder="Product name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            className={inputClass}
            placeholder="SKU"
            value={form.sku}
            onChange={(e) => setForm({ ...form, sku: e.target.value })}
            required
          />
          <input
            className={inputClass}
            placeholder="Barcode"
            value={form.barcode || ''}
            onChange={(e) => setForm({ ...form, barcode: e.target.value })}
          />
          <select
            className={inputClass}
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value, subcategoryId: '' })}
            required
          >
            <option value="">Category</option>
            {parents.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            className={inputClass}
            value={form.subcategoryId}
            onChange={(e) => setForm({ ...form, subcategoryId: e.target.value })}
          >
            <option value="">Subcategory</option>
            {children.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <select
              className={inputClass}
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            >
              {UNITS.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
            <input
              className={inputClass}
              type="number"
              placeholder="Sell ₹"
              value={form.sellingPrice}
              onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
            />
            <input
              className={inputClass}
              type="number"
              placeholder="Purchase ₹"
              value={form.purchasePrice}
              onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
            />
            <input
              className={inputClass}
              type="number"
              placeholder="Opening stock"
              value={form.openingStock}
              onChange={(e) => setForm({ ...form, openingStock: e.target.value })}
            />
            <input
              className={inputClass}
              type="number"
              placeholder="Min stock"
              value={form.minStock}
              onChange={(e) => setForm({ ...form, minStock: e.target.value })}
            />
          </div>
          <textarea
            className="min-h-[72px] w-full rounded-xl border border-slate-200 p-2 text-sm"
            placeholder="Variants, one per line: Label | Size | Gender | SKU"
            value={form.variantsText}
            onChange={(e) => setForm({ ...form, variantsText: e.target.value })}
          />
          <button className="h-10 w-full rounded-xl bg-[#2563eb] text-sm font-semibold text-white">
            Save product
          </button>
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              className="font-semibold text-[#2563eb]"
              onClick={() => void downloadStationeryProductTemplate()}
            >
              Download Excel template
            </button>
            <label className="cursor-pointer font-semibold text-[#2563eb]">
              Import CSV
              <input
                type="file"
                accept=".csv,.xlsx"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && void onImport(e.target.files[0])}
              />
            </label>
          </div>
        </form>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex gap-2">
            <input
              className={inputClass}
              placeholder="Search products"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {['ALL', 'LOW', 'OUT', 'NORMAL'].map((s) => (
              <button
                key={s}
                type="button"
                className={cn(
                  'rounded-full px-3 text-xs font-semibold ring-1',
                  stock === s ? 'bg-[#2563eb] text-white ring-[#2563eb]' : 'ring-slate-200',
                )}
                onClick={() => setStock(s)}
              >
                {s}
              </button>
            ))}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase text-slate-400">
                <th className="py-2">Product</th>
                <th>SKU</th>
                <th>Price</th>
                <th>Stock</th>
              </tr>
            </thead>
            <tbody>
              {(list.data ?? []).map((p: any) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="py-2">
                    <p className="font-medium">{p.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {p.category?.name}
                      {p.subcategory ? ` / ${p.subcategory.name}` : ''}
                      {p.variants?.length ? ` · ${p.variants.length} variants` : ''}
                    </p>
                  </td>
                  <td>{p.sku}</td>
                  <td>{rs(p.sellingPrice)}</td>
                  <td>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1',
                        stockBadge(p.stockStatus),
                      )}
                    >
                      {Number(p.qtyOnHand)} {p.stockStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </StationeryShell>
  );
}

export function StationeryCategoriesDesk() {
  const ready = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [parentId, setParentId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const cats = useQuery({
    queryKey: ['sls-stn-cats'],
    queryFn: fetchStationeryCategories,
    enabled: ready,
  });
  return (
    <StationeryShell title="Stationery Categories">
      <Banner error={error} />
      <form
        className="mb-4 flex flex-wrap gap-2 rounded-2xl border bg-white p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await createStationeryCategory({ name, code, parentId: parentId || undefined });
            setName('');
            setCode('');
            await qc.invalidateQueries({ queryKey: ['sls-stn-cats'] });
          } catch (err) {
            setError(apiErrorMessage(err));
          }
        }}
      >
        <input
          className={inputClass}
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className={inputClass}
          placeholder="Code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />
        <select
          className={inputClass}
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
        >
          <option value="">Top-level category</option>
          {(cats.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button className="h-10 rounded-xl bg-[#2563eb] px-4 text-sm font-semibold text-white">
          Add
        </button>
      </form>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(cats.data ?? []).map((c) => (
          <div key={c.id} className="rounded-2xl border bg-white p-4 shadow-sm">
            <p className="font-semibold text-[#1e3a8a]">{c.name}</p>
            <p className="text-[11px] text-slate-400">{c.code}</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              {c.children.map((ch) => (
                <li key={ch.id}>{ch.name}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </StationeryShell>
  );
}

export function StationeryStockDesk() {
  const ready = useAuthQueryEnabled();
  const [stock, setStock] = useState('ALL');
  const list = useQuery({
    queryKey: ['sls-stn-prod', '', stock],
    queryFn: () => fetchStationeryProducts({ stock }),
    enabled: ready,
  });
  const moves = useQuery({
    queryKey: ['sls-stn-moves'],
    queryFn: () => fetchStationeryMovements(),
    enabled: ready,
  });
  return (
    <StationeryShell title="Stock / Inventory">
      <div className="mb-3 flex gap-2">
        {['ALL', 'LOW', 'OUT', 'NORMAL'].map((s) => (
          <button
            key={s}
            type="button"
            className={cn(
              'rounded-full px-3 py-1 text-xs font-semibold ring-1',
              stock === s ? 'bg-[#2563eb] text-white ring-[#2563eb]' : 'bg-white ring-slate-200',
            )}
            onClick={() => setStock(s)}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border bg-white p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase text-slate-400">
                <th>Product</th>
                <th>Qty</th>
                <th>Min</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {(list.data ?? []).map((p: any) => (
                <tr key={p.id} className="border-t">
                  <td className="py-2">{p.name}</td>
                  <td>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1',
                        stockBadge(p.stockStatus),
                      )}
                    >
                      {Number(p.qtyOnHand)}
                    </span>
                  </td>
                  <td>{Number(p.minStock)}</td>
                  <td>{rs(Number(p.qtyOnHand) * p.purchasePrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <p className="mb-2 font-semibold text-[#1e3a8a]">Stock movements</p>
          <ul className="max-h-[520px] space-y-2 overflow-auto text-sm">
            {(moves.data ?? []).map((m: any) => (
              <li key={m.id} className="border-b border-slate-100 pb-2">
                <span className="font-medium">{m.type}</span> {m.product?.name}{' '}
                {m.variant?.label || ''} · {Number(m.qty)} ·{' '}
                {new Date(m.createdAt).toLocaleString('en-IN')}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </StationeryShell>
  );
}

export function StationeryPurchasesDesk() {
  const ready = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    supplierId: '',
    invoiceNo: '',
    purchaseDate: new Date().toISOString().slice(0, 10),
    productId: '',
    qty: 1,
    rate: 0,
    paymentStatus: 'PAID',
    amountPaid: 0,
  });
  const suppliers = useQuery({
    queryKey: ['sls-stn-sup'],
    queryFn: fetchStationerySuppliers,
    enabled: ready,
  });
  const products = useQuery({
    queryKey: ['sls-stn-prod'],
    queryFn: () => fetchStationeryProducts(),
    enabled: ready,
  });
  const list = useQuery({
    queryKey: ['sls-stn-pur'],
    queryFn: fetchStationeryPurchases,
    enabled: ready,
  });
  return (
    <StationeryShell title="Stock Purchase / Receiving">
      <Banner error={error} />
      <form
        className="mb-4 grid gap-2 rounded-2xl border bg-white p-4 md:grid-cols-3"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await createStationeryPurchase({
              supplierId: form.supplierId,
              invoiceNo: form.invoiceNo,
              purchaseDate: form.purchaseDate,
              paymentStatus: form.paymentStatus,
              amountPaid: Number(form.amountPaid),
              items: [
                { productId: form.productId, qty: Number(form.qty), rate: Number(form.rate) },
              ],
            });
            await qc.invalidateQueries({ queryKey: ['sls-stn'] });
          } catch (err) {
            setError(apiErrorMessage(err));
          }
        }}
      >
        <select
          className={inputClass}
          value={form.supplierId}
          onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
          required
        >
          <option value="">Supplier</option>
          {(suppliers.data ?? []).map((s: any) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          className={inputClass}
          placeholder="Supplier invoice no."
          value={form.invoiceNo}
          onChange={(e) => setForm({ ...form, invoiceNo: e.target.value })}
          required
        />
        <input
          className={inputClass}
          type="date"
          value={form.purchaseDate}
          onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
        />
        <select
          className={inputClass}
          value={form.productId}
          onChange={(e) => setForm({ ...form, productId: e.target.value })}
          required
        >
          <option value="">Product</option>
          {(products.data ?? []).map((p: any) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          className={inputClass}
          type="number"
          placeholder="Qty"
          value={form.qty}
          onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })}
        />
        <input
          className={inputClass}
          type="number"
          placeholder="Rate"
          value={form.rate}
          onChange={(e) => setForm({ ...form, rate: Number(e.target.value) })}
        />
        <button className="h-10 rounded-xl bg-[#2563eb] text-sm font-semibold text-white md:col-span-3">
          Receive stock
        </button>
      </form>
      <div className="rounded-2xl border bg-white p-4">
        {(list.data ?? []).map((p: any) => (
          <div key={p.id} className="flex justify-between border-b py-2 text-sm">
            <span>
              {p.invoiceNo} · {p.supplier?.name} ·{' '}
              {new Date(p.purchaseDate).toLocaleDateString('en-IN')}
            </span>
            <span>
              {rs(p.grandTotal)} · {p.paymentStatus}
            </span>
          </div>
        ))}
      </div>
    </StationeryShell>
  );
}

export function StationeryAdjustmentsDesk() {
  const ready = useAuthQueryEnabled();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [form, setForm] = useState({
    productId: '',
    qty: 1,
    adjustmentType: 'DAMAGED',
    reason: '',
    remarks: '',
  });
  const products = useQuery({
    queryKey: ['sls-stn-prod'],
    queryFn: () => fetchStationeryProducts(),
    enabled: ready,
  });
  return (
    <StationeryShell title="Stock Adjustment">
      <Banner error={error} ok={ok} />
      <form
        className="max-w-lg space-y-2 rounded-2xl border bg-white p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await adjustStationeryStock({ ...form, qty: Number(form.qty) });
            setOk('Stock adjusted and movement recorded');
          } catch (err) {
            setError(apiErrorMessage(err));
          }
        }}
      >
        <select
          className={inputClass}
          value={form.productId}
          onChange={(e) => setForm({ ...form, productId: e.target.value })}
          required
        >
          <option value="">Product</option>
          {(products.data ?? []).map((p: any) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          className={inputClass}
          value={form.adjustmentType}
          onChange={(e) => setForm({ ...form, adjustmentType: e.target.value })}
        >
          {['DAMAGED', 'LOST', 'FOUND', 'PHYSICAL', 'OPENING', 'OTHER'].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <input
          className={inputClass}
          type="number"
          value={form.qty}
          onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })}
        />
        <input
          className={inputClass}
          placeholder="Reason (required)"
          value={form.reason}
          onChange={(e) => setForm({ ...form, reason: e.target.value })}
          required
        />
        <textarea
          className="w-full rounded-xl border p-2 text-sm"
          placeholder="Remarks"
          value={form.remarks}
          onChange={(e) => setForm({ ...form, remarks: e.target.value })}
        />
        <button className="h-10 w-full rounded-xl bg-[#2563eb] text-sm font-semibold text-white">
          Record adjustment
        </button>
      </form>
    </StationeryShell>
  );
}

export function StationeryReturnsDesk() {
  const ready = useAuthQueryEnabled();
  const [q, setQ] = useState('');
  const [sale, setSale] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ['sls-stn-sales', q],
    queryFn: () => fetchStationerySales({ q: q || undefined }),
    enabled: ready,
  });
  return (
    <StationeryShell title="Stationery Returns">
      <Banner error={error} />
      <input
        className={`${inputClass} mb-3 max-w-md`}
        placeholder="Invoice, student or date"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border bg-white p-4">
          {(list.data ?? []).map((s: any) => (
            <button
              key={s.id}
              type="button"
              className="block w-full border-b py-2 text-left text-sm"
              onClick={() => setSale(s)}
            >
              {s.invoiceNo} · {s.student?.fullName || s.walkInName} · {rs(s.grandTotal)}
            </button>
          ))}
        </div>
        {sale ? <ReturnForm saleId={sale.id} onError={setError} /> : null}
      </div>
    </StationeryShell>
  );
}

function ReturnForm({ saleId, onError }: { saleId: string; onError: (s: string) => void }) {
  const ready = useAuthQueryEnabled();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['sls-stn-sale', saleId],
    queryFn: () => import('@/services/school-sis').then((m) => m.fetchStationerySale(saleId)),
    enabled: ready,
  });
  const [qty, setQty] = useState<Record<string, number>>({});
  const [cond, setCond] = useState<Record<string, string>>({});
  if (!data) return null;
  return (
    <div className="rounded-2xl border bg-white p-4">
      <p className="font-semibold">{data.invoiceNo}</p>
      {(data.items ?? []).map((i: any) => (
        <div key={i.id} className="mt-2 grid grid-cols-3 gap-2 text-sm">
          <span>
            {i.productName} (sold {Number(i.qty)}, ret {Number(i.returnedQty)})
          </span>
          <input
            className={inputClass}
            type="number"
            placeholder="Return qty"
            value={qty[i.id] || ''}
            onChange={(e) => setQty({ ...qty, [i.id]: Number(e.target.value) })}
          />
          <select
            className={inputClass}
            value={cond[i.id] || 'RESALABLE'}
            onChange={(e) => setCond({ ...cond, [i.id]: e.target.value })}
          >
            <option>RESALABLE</option>
            <option>DAMAGED</option>
          </select>
        </div>
      ))}
      <button
        type="button"
        className="mt-3 h-10 rounded-xl bg-[#2563eb] px-4 text-sm font-semibold text-white"
        onClick={async () => {
          try {
            const items = (data.items ?? [])
              .filter((i: any) => qty[i.id] > 0)
              .map((i: any) => ({
                saleItemId: i.id,
                qty: qty[i.id],
                condition: cond[i.id] || 'RESALABLE',
              }));
            await createStationeryReturn({ saleId, items });
            await qc.invalidateQueries({ queryKey: ['sls-stn'] });
          } catch (err) {
            onError(apiErrorMessage(err));
          }
        }}
      >
        Process return
      </button>
    </div>
  );
}

export function StationerySuppliersDesk() {
  const ready = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    mobile: '',
    email: '',
    gstin: '',
    contactPerson: '',
    address: '',
  });
  const [error, setError] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ['sls-stn-sup'],
    queryFn: fetchStationerySuppliers,
    enabled: ready,
  });
  return (
    <StationeryShell title="Suppliers">
      <Banner error={error} />
      <form
        className="mb-4 grid gap-2 rounded-2xl border bg-white p-4 md:grid-cols-3"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await saveStationerySupplier(form);
            setForm({ name: '', mobile: '', email: '', gstin: '', contactPerson: '', address: '' });
            await qc.invalidateQueries({ queryKey: ['sls-stn-sup'] });
          } catch (err) {
            setError(apiErrorMessage(err));
          }
        }}
      >
        <input
          className={inputClass}
          placeholder="Supplier name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <input
          className={inputClass}
          placeholder="Contact person"
          value={form.contactPerson}
          onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
        />
        <input
          className={inputClass}
          placeholder="Mobile"
          value={form.mobile}
          onChange={(e) => setForm({ ...form, mobile: e.target.value })}
        />
        <input
          className={inputClass}
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <input
          className={inputClass}
          placeholder="GSTIN"
          value={form.gstin}
          onChange={(e) => setForm({ ...form, gstin: e.target.value })}
        />
        <input
          className={inputClass}
          placeholder="Address"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />
        <button className="h-10 rounded-xl bg-[#2563eb] text-sm font-semibold text-white">
          Save supplier
        </button>
      </form>
      <div className="rounded-2xl border bg-white p-4">
        {(list.data ?? []).map((s: any) => (
          <div key={s.id} className="flex flex-wrap justify-between gap-2 border-b py-2 text-sm">
            <div>
              <p className="font-medium">{s.name}</p>
              <p className="text-[11px] text-slate-500">
                {s.mobile} · {s.gstin || 'No GSTIN'}
              </p>
            </div>
            <div className="text-right">
              <p>Purchases {rs(s.totalPurchases)}</p>
              <p>Pending {rs(s.pendingPayments)}</p>
            </div>
          </div>
        ))}
      </div>
    </StationeryShell>
  );
}

export function StationeryReportsDesk() {
  const ready = useAuthQueryEnabled();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const q = useQuery({
    queryKey: ['sls-stn-rep', from, to, paymentMethod],
    queryFn: () =>
      fetchStationeryReports({
        from: from || undefined,
        to: to || undefined,
        paymentMethod: paymentMethod || undefined,
      }),
    enabled: ready,
  });
  const rows = q.data?.rows ?? [];
  const csv = useMemo(() => {
    const header = 'Invoice,Date,Customer,Class,Total,Paid,Balance,Status,Cashier,Methods';
    const body = rows
      .map((r: any) =>
        [
          r.invoiceNo,
          r.date,
          r.customer,
          r.className,
          r.grandTotal,
          r.paid,
          r.balance,
          r.status,
          r.cashier,
          r.methods,
        ].join(','),
      )
      .join('\n');
    return `${header}\n${body}`;
  }, [rows]);
  return (
    <StationeryShell title="Stationery Reports">
      <div className="mb-3 flex flex-wrap gap-2">
        <input
          className={inputClass}
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <input
          className={inputClass}
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
        <select
          className={inputClass}
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
        >
          <option value="">All payments</option>
          {['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'ONLINE', 'CREDIT', 'OTHER'].map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <button
          type="button"
          className="h-10 rounded-xl border px-3 text-sm"
          onClick={() => {
            const blob = new Blob([csv], { type: 'text/csv' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'stationery-sales.csv';
            a.click();
          }}
        >
          Export CSV
        </button>
      </div>
      <div className="rounded-2xl border bg-white p-4">
        <p className="mb-2 text-sm">
          {q.data?.count ?? 0} bills · {rs(q.data?.grandTotal ?? 0)} · Outstanding{' '}
          {rs(q.data?.outstanding ?? 0)}
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase text-slate-400">
              <th>Invoice</th>
              <th>Customer</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id} className="border-t">
                <td className="py-2">{r.invoiceNo}</td>
                <td>{r.customer}</td>
                <td>{rs(r.grandTotal)}</td>
                <td>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1',
                      statusBadge(r.status),
                    )}
                  >
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </StationeryShell>
  );
}

export function StationerySettingsDesk() {
  const ready = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ['sls-stn-settings'],
    queryFn: fetchStationerySettings,
    enabled: ready,
  });
  const [form, setForm] = useState<any>(null);
  const row = form ?? q.data;
  if (!row)
    return (
      <StationeryShell title="Stationery Settings">
        <p>Loading…</p>
      </StationeryShell>
    );
  const toggle = (k: string) => setForm({ ...row, [k]: !row[k] });
  return (
    <StationeryShell title="Stationery Settings">
      <Banner error={error} ok={ok} />
      <div className="max-w-xl space-y-3 rounded-2xl border bg-white p-4">
        {[
          ['enabled', 'Enable stationery module'],
          ['allowWalkInSales', 'Allow walk-in sales'],
          ['allowCreditSales', 'Allow stationery credit'],
          ['allowNegativeStock', 'Allow negative stock'],
          ['lowStockAlert', 'Low stock alerts'],
          ['requireStudentSelection', 'Require student selection'],
          ['enableBarcode', 'Enable barcode'],
          ['enableProductImages', 'Enable product images'],
          ['enableStockTracking', 'Enable stock tracking'],
        ].map(([k, label]) => (
          <label key={k} className="flex items-center justify-between text-sm">
            {label}
            <input type="checkbox" checked={!!row[k]} onChange={() => toggle(k)} />
          </label>
        ))}
        <input
          className={inputClass}
          value={row.invoicePrefix}
          onChange={(e) => setForm({ ...row, invoicePrefix: e.target.value })}
        />
        <select
          className={inputClass}
          value={row.defaultPaymentMethod}
          onChange={(e) => setForm({ ...row, defaultPaymentMethod: e.target.value })}
        >
          {['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'ONLINE'].map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <select
          className={inputClass}
          value={row.receiptFormat}
          onChange={(e) => setForm({ ...row, receiptFormat: e.target.value })}
        >
          <option>A4</option>
          <option>A5</option>
          <option>THERMAL</option>
        </select>
        <button
          type="button"
          className="h-10 rounded-xl bg-[#2563eb] px-4 text-sm font-semibold text-white"
          onClick={async () => {
            try {
              await saveStationerySettings(form ?? row);
              setOk('Settings saved');
              await qc.invalidateQueries({ queryKey: ['sls-stn-settings'] });
            } catch (err) {
              setError(apiErrorMessage(err));
            }
          }}
        >
          Save settings
        </button>
      </div>
    </StationeryShell>
  );
}

export function StationeryStudentPurchases({ studentId }: { studentId: string }) {
  const ready = useAuthQueryEnabled();
  const q = useQuery({
    queryKey: ['sls-stn-stu-sales', studentId],
    queryFn: () => fetchStationerySales({ studentId }),
    enabled: ready,
  });
  return (
    <div className="rounded-2xl border bg-white p-4">
      <p className="mb-2 font-semibold text-[#1e3a8a]">Stationery purchases</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase text-slate-400">
            <th>Invoice</th>
            <th>Date</th>
            <th>Total</th>
            <th>Paid</th>
            <th>Due</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {(q.data ?? []).map((s: any) => (
            <tr key={s.id} className="border-t">
              <td className="py-2">{s.invoiceNo}</td>
              <td>{new Date(s.createdAt).toLocaleDateString('en-IN')}</td>
              <td>{rs(s.grandTotal)}</td>
              <td>{rs(s.amountPaid)}</td>
              <td>{rs(s.balanceDue)}</td>
              <td>
                <button
                  type="button"
                  className="text-xs font-semibold text-[#2563eb]"
                  onClick={async () => printStationeryReceipt(await fetchStationerySale(s.id))}
                >
                  Open
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!q.data?.length ? (
        <p className="py-4 text-sm text-slate-500">No stationery bills yet.</p>
      ) : null}
    </div>
  );
}

export function StationeryInvoicesDesk() {
  const ready = useAuthQueryEnabled();
  const list = useQuery({
    queryKey: ['sls-stn-sales'],
    queryFn: () => fetchStationerySales(),
    enabled: ready,
  });
  return (
    <StationeryShell title="Stationery Invoices">
      <div className="rounded-2xl border bg-white p-4">
        {(list.data ?? []).map((s: any) => (
          <div key={s.id} className="flex items-center justify-between border-b py-2 text-sm">
            <span>
              {s.invoiceNo} · {s.student?.fullName || s.walkInName}
            </span>
            <span className="flex items-center gap-2">
              {rs(s.grandTotal)}
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1',
                  statusBadge(s.status),
                )}
              >
                {s.status}
              </span>
              <button
                type="button"
                className="text-xs font-semibold text-[#2563eb]"
                onClick={() => printStationeryReceipt(s)}
              >
                Print
              </button>
              {s.status !== 'CANCELLED' ? (
                <button
                  type="button"
                  className="text-xs text-rose-600"
                  onClick={() => void cancelStationerySale(s.id, 'Office cancel')}
                >
                  Cancel
                </button>
              ) : null}
            </span>
          </div>
        ))}
      </div>
    </StationeryShell>
  );
}
