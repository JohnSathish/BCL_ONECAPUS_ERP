'use client';

import Link from 'next/link';
import {
  Ban,
  Calendar,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  Globe,
  Hash,
  KeyRound,
  LifeBuoy,
  Pause,
  Pencil,
  Play,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  Timer,
  Trash2,
} from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { cn } from '@/lib/cn';

export type LicenseRow = {
  id: string;
  licenseCode: string;
  licenseKey: string;
  status: string;
  licenseType: string;
  startDate: string;
  expiryDate: string | null;
  domainRestriction: string | null;
  clientName: string;
  productName: string;
  productId: string;
  activations: number;
  activationLimit: number;
  createdAt: string;
};

const TYPES = ['Trial', 'Monthly', 'Quarterly', 'Annual', 'Lifetime', 'Per Institution'];

function monthsUntil(iso: string | null) {
  if (!iso) return '—';
  const end = new Date(iso);
  const now = new Date();
  const months = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
  if (end < now) return 'Expired';
  if (months <= 0) return 'This month';
  if (months === 1) return 'In 1 month';
  return `In ${months} months`;
}

function addPeriod(start: string, type: string) {
  const d = new Date(start);
  if (type === 'Monthly') d.setMonth(d.getMonth() + 1);
  else if (type === 'Quarterly') d.setMonth(d.getMonth() + 3);
  else if (type === 'Trial') d.setDate(d.getDate() + 14);
  else if (type === 'Lifetime') return '';
  else d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

export function LicenseDesk({
  licenses,
  clients,
  products,
}: {
  licenses: LicenseRow[];
  clients: { id: string; name: string }[];
  products: { id: string; name: string }[];
}) {
  const [q, setQ] = useState('');
  const [product, setProduct] = useState('all');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState('');
  const [edit, setEdit] = useState<LicenseRow | null>(null);
  const [startDate, setStartDate] = useState('');
  const [validity, setValidity] = useState('Annual');
  const [expiry, setExpiry] = useState('');

  const now = Date.now();
  const soon = now + 30 * 86400000;
  const active = licenses.filter((l) => l.status === 'ACTIVE').length;
  const suspended = licenses.filter((l) => l.status === 'SUSPENDED').length;
  const expiring = licenses.filter((l) => {
    if (l.status !== 'ACTIVE' || !l.expiryDate) return false;
    const t = new Date(l.expiryDate).getTime();
    return t >= now && t <= soon;
  }).length;
  const thisMonth = licenses.filter((l) => {
    const d = new Date(l.createdAt);
    const n = new Date();
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  }).length;

  const filtered = useMemo(() => {
    return licenses.filter((l) => {
      if (
        q &&
        !`${l.clientName} ${l.productName} ${l.licenseKey} ${l.licenseCode}`
          .toLowerCase()
          .includes(q.toLowerCase())
      )
        return false;
      if (product !== 'all' && l.productId !== product) return false;
      if (status !== 'all' && l.status !== status) return false;
      return true;
    });
  }, [licenses, q, product, status]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const slice = filtered.slice((page - 1) * pageSize, page * pageSize);

  async function createLicense(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    const type = String(data.get('licenseType') || 'Annual');
    const start = String(data.get('startDate'));
    const expiryDate = String(data.get('expiryDate') || addPeriod(start, type) || '');
    const res = await fetch('/api/admin/licenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: data.get('clientId'),
        productId: data.get('productId'),
        licenseType: type,
        startDate: start,
        expiryDate: expiryDate || undefined,
        activationLimit: data.get('activationLimit'),
        domainRestriction: data.get('domainRestriction') || undefined,
      }),
    });
    setBusy(false);
    if (res.ok) {
      form.reset();
      window.location.reload();
    }
  }

  async function act(id: string, action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    await fetch('/api/admin/licenses/actions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action, ...extra }),
    });
    setBusy(false);
    window.location.reload();
  }

  async function copyKey(key: string) {
    await navigator.clipboard.writeText(key);
    setCopied(key);
    setTimeout(() => setCopied(''), 1500);
  }

  function exportCsv() {
    const header = [
      'ID',
      'Client',
      'Product',
      'License Key',
      'Status',
      'Validity',
      'Start',
      'Expiry',
      'Domains',
      'Activations',
    ];
    const lines = filtered.map((l) =>
      [
        l.licenseCode,
        l.clientName,
        l.productName,
        l.licenseKey,
        l.status,
        l.licenseType,
        l.startDate.slice(0, 10),
        l.expiryDate?.slice(0, 10) ?? '',
        l.domainRestriction ?? '',
        `${l.activations}/${l.activationLimit}`,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'basecode-licenses.csv';
    a.click();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-400">
            <Link href="/admin" className="hover:text-blue-600">
              Dashboard
            </Link>
            <span className="mx-1">›</span> Licenses
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Licenses</h1>
          <p className="text-sm text-slate-500">
            Generate and manage product licenses for your clients.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl bg-blue-50 px-4 py-3 text-blue-800">
          <ShieldCheck className="h-8 w-8" />
          <p className="text-xs leading-5">
            <span className="block font-semibold">Secure Licensing</span>
            Powering your clients with trusted software
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Total Licenses',
            value: licenses.length,
            sub: `+${thisMonth} this month`,
            color: 'text-sky-600 bg-sky-50',
            icon: KeyRound,
          },
          {
            label: 'Active Licenses',
            value: active,
            sub: licenses.length ? `${Math.round((active / licenses.length) * 100)}%` : '—',
            color: 'text-emerald-600 bg-emerald-50',
            icon: CheckCircle2,
          },
          {
            label: 'Expiring in 30 days',
            value: expiring,
            sub: 'Renew soon',
            color: 'text-amber-600 bg-amber-50',
            icon: Timer,
          },
          {
            label: 'Suspended',
            value: suspended,
            sub: suspended ? 'Needs review' : 'None',
            color: 'text-rose-600 bg-rose-50',
            icon: Ban,
          },
        ].map((c) => (
          <article
            key={c.label}
            className="flex items-center gap-4 rounded-[22px] border border-white bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.05)]"
          >
            <span className={cn('flex h-12 w-12 items-center justify-center rounded-2xl', c.color)}>
              <c.icon className="h-6 w-6" />
            </span>
            <div>
              <p className="text-2xl font-semibold text-slate-900">{c.value}</p>
              <p className="text-xs text-slate-500">{c.label}</p>
              <p className="text-xs font-semibold text-emerald-600">{c.sub}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
        <form
          onSubmit={createLicense}
          className="rounded-[22px] border border-white bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)]"
        >
          <h2 className="flex items-center gap-2 font-semibold text-slate-900">
            <KeyRound className="h-5 w-5 text-sky-600" /> Generate New License
          </h2>
          <p className="text-sm text-slate-500">
            Create a license key for a client and product. Copy the key and use it in the client’s
            system.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="text-xs font-semibold text-slate-500">
              Client *
              <select required name="clientId" defaultValue="" className="bcl-input">
                <option value="" disabled>
                  Select client
                </option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Product *
              <select required name="productId" defaultValue="" className="bcl-input">
                <option value="" disabled>
                  Select product
                </option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Validity *
              <select
                name="licenseType"
                value={validity}
                onChange={(e) => {
                  setValidity(e.target.value);
                  if (startDate) setExpiry(addPeriod(startDate, e.target.value));
                }}
                className="bcl-input"
              >
                {TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Start date *
              <span className="relative mt-1 block">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  type="date"
                  name="startDate"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setExpiry(addPeriod(e.target.value, validity));
                  }}
                  className="bcl-input !mt-0 !pl-9"
                />
              </span>
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Expiry date *
              <span className="relative mt-1 block">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  name="expiryDate"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  required={validity !== 'Lifetime'}
                  className="bcl-input !mt-0 !pl-9"
                />
              </span>
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Number of licenses *
              <span className="relative mt-1 block">
                <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="number"
                  min={1}
                  name="activationLimit"
                  defaultValue={1}
                  className="bcl-input !mt-0 !pl-9"
                />
              </span>
            </label>
            <label className="text-xs font-semibold text-slate-500 md:col-span-3">
              Domain restriction
              <span className="relative mt-1 block">
                <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  name="domainRestriction"
                  placeholder="st-lukes-tura or stlukestura.in (optional)"
                  className="bcl-input !mt-0 !pl-9"
                />
              </span>
            </label>
          </div>
          <button
            disabled={busy}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white"
          >
            <KeyRound className="h-4 w-4" /> Generate license
          </button>
        </form>

        <aside className="rounded-[22px] border border-white bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
          <h3 className="flex items-center gap-2 font-semibold text-slate-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
              <FileText className="h-4 w-4" />
            </span>
            How to use
          </h3>
          <ol className="mt-3 space-y-2 text-sm text-slate-600">
            <li>
              1. Select the client and <strong>BCL OneCampus ERP</strong>
            </li>
            <li>2. Set validity and expiry date</li>
            <li>
              3. Domain: <span className="font-mono text-xs">st-lukes-tura</span> or stlukestura.in
              (optional)
            </li>
            <li>4. Generate and copy the BCL-ONC- key</li>
            <li>5. Paste it on the St. Luke’s ERP license screen</li>
          </ol>
        </aside>
      </div>

      <div className="rounded-[22px] border border-white bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900">Licenses ({filtered.length})</h2>
            <p className="text-xs text-slate-500">
              Manage all generated licenses, their status and expiry.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by client, product or key…"
                className="h-10 rounded-full border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm"
              />
            </span>
            <select
              value={product}
              onChange={(e) => {
                setProduct(e.target.value);
                setPage(1);
              }}
              className="h-10 rounded-full border border-slate-200 px-3 text-sm"
            >
              <option value="all">All products</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="h-10 rounded-full border border-slate-200 px-3 text-sm"
            >
              <option value="all">All status</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex h-10 items-center gap-1 rounded-full bg-blue-600 px-4 text-sm font-semibold text-white"
            >
              <Download className="h-4 w-4" /> Export
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Client / Product</th>
                <th className="px-3 py-2">License key</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Validity</th>
                <th className="px-3 py-2">Expiry</th>
                <th className="px-3 py-2">Domains</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((l) => (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="px-3 py-3 font-mono text-xs text-slate-600">{l.licenseCode}</td>
                  <td className="px-3 py-3">
                    <p className="font-semibold text-slate-900">{l.clientName}</p>
                    <p className="text-xs text-blue-600">{l.productName}</p>
                  </td>
                  <td className="px-3 py-3">
                    <span className="font-mono text-xs">{l.licenseKey}</span>
                    <button
                      type="button"
                      onClick={() => copyKey(l.licenseKey)}
                      className="ml-2 text-[11px] font-semibold text-blue-600"
                    >
                      {copied === l.licenseKey ? 'Copied' : 'Copy'}
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[11px] font-bold uppercase',
                        l.status === 'ACTIVE' && 'bg-emerald-50 text-emerald-700',
                        l.status === 'SUSPENDED' && 'bg-amber-50 text-amber-700',
                        l.status === 'CANCELLED' && 'bg-slate-100 text-slate-600',
                      )}
                    >
                      {l.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-600">{l.licenseType}</td>
                  <td className="px-3 py-3">
                    <p>{l.expiryDate ? l.expiryDate.slice(0, 10) : '—'}</p>
                    <p className="text-[11px] text-slate-400">{monthsUntil(l.expiryDate)}</p>
                  </td>
                  <td className="px-3 py-3 text-slate-500">{l.domainRestriction || '—'}</td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => copyKey(l.licenseKey)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                        title="Copy"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEdit(l)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {l.status === 'SUSPENDED' ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => act(l.id, 'activate')}
                          className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50"
                          title="Activate"
                        >
                          <Play className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => act(l.id, 'suspend')}
                          className="rounded-lg p-1.5 text-amber-600 hover:bg-amber-50"
                          title="Suspend"
                        >
                          <Pause className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (confirm(`Delete license ${l.licenseCode}? This cannot be undone.`))
                            act(l.id, 'delete');
                        }}
                        className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
          <p>
            Show{' '}
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-md border border-slate-200 px-1"
            >
              {[10, 25, 50].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>{' '}
            entries
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-full border px-3 py-1 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="rounded-full bg-blue-600 px-3 py-1 text-white">{page}</span>
            <button
              type="button"
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-full border px-3 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <article className="rounded-[22px] border border-white bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
          <p className="flex items-center gap-2 font-semibold text-slate-900">
            <ShieldCheck className="h-5 w-5 text-emerald-600" /> Secure & Reliable
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Our licensing system ensures secure and authorised usage of BaseCode Labs products.
          </p>
        </article>
        <article className="rounded-[22px] border border-white bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
          <p className="flex items-center gap-2 font-semibold text-slate-900">
            <LifeBuoy className="h-5 w-5 text-violet-600" /> Client Support
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Need help with licensing? Our team is here to assist you.
          </p>
          <Link href="/contact" className="mt-3 inline-block text-sm font-semibold text-blue-600">
            Contact Support →
          </Link>
        </article>
        <article className="rounded-[22px] border border-white bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
          <p className="flex items-center gap-2 font-semibold text-slate-900">
            <Scale className="h-5 w-5 text-sky-600" /> License Terms
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Make sure your clients follow the product license terms and conditions.
          </p>
          <Link
            href="/legal/software-license"
            className="mt-3 inline-block text-sm font-semibold text-blue-600"
          >
            View License Agreement →
          </Link>
        </article>
      </div>

      {edit ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <form
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              act(edit.id, 'update', {
                licenseType: data.get('licenseType'),
                expiryDate: data.get('expiryDate') || null,
                activationLimit: Number(data.get('activationLimit')),
                domainRestriction: data.get('domainRestriction') || null,
              });
            }}
          >
            <h2 className="text-lg font-semibold">Edit {edit.licenseCode}</h2>
            <div className="mt-4 grid gap-3">
              <select name="licenseType" defaultValue={edit.licenseType} className="bcl-input">
                {TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <input
                type="date"
                name="expiryDate"
                defaultValue={edit.expiryDate?.slice(0, 10) ?? ''}
                className="bcl-input"
              />
              <input
                type="number"
                min={1}
                name="activationLimit"
                defaultValue={edit.activationLimit}
                className="bcl-input"
              />
              <input
                name="domainRestriction"
                defaultValue={edit.domainRestriction ?? ''}
                placeholder="Domain restriction"
                className="bcl-input"
              />
              <div className="flex gap-2">
                <button disabled={busy} className="bcl-btn bcl-btn-primary flex-1">
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => act(edit.id, 'renew')}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-full border border-slate-200 text-sm font-semibold"
                >
                  <RefreshCw className="h-4 w-4" /> Renew 12m
                </button>
              </div>
              <button
                type="button"
                onClick={() => setEdit(null)}
                className="text-sm text-slate-500"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
