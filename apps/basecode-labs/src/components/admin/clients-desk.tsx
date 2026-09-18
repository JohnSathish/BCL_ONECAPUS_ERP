'use client';

import Link from 'next/link';
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  Pencil,
  Phone,
  Plus,
  Search,
  Shield,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { cn } from '@/lib/cn';

export type ClientRow = {
  id: string;
  clientCode: string;
  organisation: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  institutionType: string | null;
  website: string | null;
  status: string;
  createdAt: string;
  licenseCount: number;
  expiringSoon: number;
};

const PAGE_SIZES = [10, 25, 50];

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

function hue(name: string) {
  let h = 0;
  for (const ch of name) h = (h + ch.charCodeAt(0) * 17) % 360;
  return h;
}

export function ClientsDesk({ clients: initial }: { clients: ClientRow[] }) {
  const [rows] = useState(initial);
  const [org, setOrg] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState('all');
  const [license, setLicense] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [applied, setApplied] = useState({
    org: '',
    contact: '',
    email: '',
    phone: '',
    type: 'all',
    license: 'all',
    fromDate: '',
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [addOpen, setAddOpen] = useState(false);
  const [edit, setEdit] = useState<ClientRow | null>(null);
  const [view, setView] = useState<ClientRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [importMsg, setImportMsg] = useState('');

  const types = useMemo(() => {
    const set = new Set(rows.map((r) => r.institutionType).filter(Boolean) as string[]);
    return [...set].sort();
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (applied.org && !r.organisation.toLowerCase().includes(applied.org.toLowerCase()))
        return false;
      if (
        applied.contact &&
        !(r.contactPerson ?? '').toLowerCase().includes(applied.contact.toLowerCase())
      )
        return false;
      if (applied.email && !(r.email ?? '').toLowerCase().includes(applied.email.toLowerCase()))
        return false;
      if (applied.phone && !(r.phone ?? '').includes(applied.phone)) return false;
      if (applied.type !== 'all' && r.institutionType !== applied.type) return false;
      if (applied.license === 'has' && r.licenseCount < 1) return false;
      if (applied.license === 'none' && r.licenseCount > 0) return false;
      if (applied.license === 'expiring' && r.expiringSoon < 1) return false;
      if (applied.fromDate && r.createdAt.slice(0, 10) < applied.fromDate) return false;
      return true;
    });
  }, [rows, applied]);

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pages);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const active = rows.filter((r) => r.status === 'ACTIVE').length;
  const inactive = rows.length - active;
  const licenses = rows.reduce((s, r) => s + r.licenseCount, 0);
  const expiring = rows.reduce((s, r) => s + r.expiringSoon, 0);
  const thisMonth = rows.filter((r) => {
    const d = new Date(r.createdAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const activePct = rows.length ? Math.round((active / rows.length) * 100) : 0;

  function applyFilters(e: FormEvent) {
    e.preventDefault();
    setApplied({ org, contact, email, phone, type, license, fromDate });
    setPage(1);
  }

  function clearFilters() {
    setOrg('');
    setContact('');
    setEmail('');
    setPhone('');
    setType('all');
    setLicense('all');
    setFromDate('');
    setApplied({
      org: '',
      contact: '',
      email: '',
      phone: '',
      type: 'all',
      license: 'all',
      fromDate: '',
    });
    setPage(1);
  }

  function exportCsv() {
    const header = [
      'Client ID',
      'Organisation',
      'Contact',
      'Email',
      'Phone',
      'Type',
      'Licenses',
      'Status',
      'Created',
    ];
    const lines = [
      header.join(','),
      ...filtered.map((r) =>
        [
          r.clientCode,
          `"${r.organisation.replace(/"/g, '""')}"`,
          `"${(r.contactPerson ?? '').replace(/"/g, '""')}"`,
          r.email ?? '',
          r.phone ?? '',
          r.institutionType ?? '',
          r.licenseCount,
          r.status,
          r.createdAt.slice(0, 10),
        ].join(','),
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'basecode-clients.csv';
    a.click();
  }

  async function createClient(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch('/api/admin/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(form.entries())),
    });
    setBusy(false);
    if (res.ok) window.location.reload();
  }

  async function saveEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!edit) return;
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch(`/api/admin/clients/${edit.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(form.entries())),
    });
    setBusy(false);
    if (res.ok) window.location.reload();
  }

  async function importCsv(file: File) {
    setImportMsg('');
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      setImportMsg('CSV needs a header row and at least one client.');
      return;
    }
    const header = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/"/g, ''));
    const orgIdx = header.findIndex(
      (h) => h.includes('organisation') || h === 'organization' || h === 'name',
    );
    if (orgIdx < 0) {
      setImportMsg('CSV must include an Organisation column.');
      return;
    }
    const idx = (keys: string[]) => header.findIndex((h) => keys.some((k) => h.includes(k)));
    let created = 0;
    for (const line of lines.slice(1)) {
      const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      const organisation = cols[orgIdx];
      if (!organisation) continue;
      const res = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organisation,
          contactPerson: cols[idx(['contact'])] || undefined,
          email: cols[idx(['email'])] || undefined,
          phone: cols[idx(['phone'])] || undefined,
          institutionType: cols[idx(['type', 'institution'])] || undefined,
        }),
      });
      if (res.ok) created += 1;
    }
    setImportMsg(`Imported ${created} client${created === 1 ? '' : 's'}.`);
    if (created) window.location.reload();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-400">
            <Link href="/admin" className="hover:text-blue-600">
              Dashboard
            </Link>
            <span className="mx-1">›</span>
            Clients
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Clients</h1>
          <p className="text-sm text-slate-500">
            Organisations with licenses, tickets and portal access.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="flex items-center gap-4 rounded-[22px] border border-white bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
            <Users className="h-6 w-6" />
          </span>
          <div>
            <p className="text-2xl font-semibold text-slate-900">{rows.length}</p>
            <p className="text-xs text-slate-500">Total Clients</p>
            <p className="text-xs font-semibold text-emerald-600">+{thisMonth} this month</p>
          </div>
        </article>
        <article className="flex items-center gap-4 rounded-[22px] border border-white bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <Building2 className="h-6 w-6" />
          </span>
          <div className="flex-1">
            <p className="text-2xl font-semibold text-slate-900">{active}</p>
            <p className="text-xs text-slate-500">Active Clients</p>
          </div>
          <svg viewBox="0 0 36 36" className="h-12 w-12">
            <circle cx="18" cy="18" r="14" fill="none" stroke="#e2e8f0" strokeWidth="4" />
            <circle
              cx="18"
              cy="18"
              r="14"
              fill="none"
              stroke="#10b981"
              strokeWidth="4"
              strokeDasharray={`${(activePct / 100) * 88} 88`}
              transform="rotate(-90 18 18)"
            />
            <text x="18" y="20" textAnchor="middle" fontSize="8" fontWeight="700" fill="#047857">
              {activePct}%
            </text>
          </svg>
        </article>
        <article className="flex items-center gap-4 rounded-[22px] border border-white bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <Clock3 className="h-6 w-6" />
          </span>
          <div>
            <p className="text-2xl font-semibold text-slate-900">{inactive}</p>
            <p className="text-xs text-slate-500">Inactive Clients</p>
          </div>
        </article>
        <article className="flex items-center justify-between gap-4 rounded-[22px] border border-white bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
              <Shield className="h-6 w-6" />
            </span>
            <div>
              <p className="text-2xl font-semibold text-slate-900">{licenses}</p>
              <p className="text-xs text-slate-500">Total Licenses</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold text-slate-900">{expiring}</p>
            <p className="text-xs text-slate-500">Expiring in 30 days</p>
          </div>
        </article>
      </div>

      <form
        onSubmit={applyFilters}
        className="rounded-[22px] border border-white bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.05)]"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs font-semibold text-slate-500">
            Organisation
            <span className="relative mt-1 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={org}
                onChange={(e) => setOrg(e.target.value)}
                placeholder="Search organisation name…"
                className="bcl-input !mt-0 !pl-9"
              />
            </span>
          </label>
          <label className="text-xs font-semibold text-slate-500">
            Contact person
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Search contact person…"
              className="bcl-input"
            />
          </label>
          <label className="text-xs font-semibold text-slate-500">
            Email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Search email address…"
              className="bcl-input"
            />
          </label>
          <label className="text-xs font-semibold text-slate-500">
            Phone
            <span className="relative mt-1 block">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Search phone number…"
                className="bcl-input !mt-0 !pl-9"
              />
            </span>
          </label>
          <label className="text-xs font-semibold text-slate-500">
            Institution type
            <select value={type} onChange={(e) => setType(e.target.value)} className="bcl-input">
              <option value="all">All types</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-500">
            License status
            <select
              value={license}
              onChange={(e) => setLicense(e.target.value)}
              className="bcl-input"
            >
              <option value="all">All statuses</option>
              <option value="has">Has license</option>
              <option value="none">No license</option>
              <option value="expiring">Expiring in 30 days</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-500">
            Created date
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bcl-input"
            />
          </label>
          <div className="flex items-end justify-end gap-2">
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600"
            >
              Clear filters
            </button>
            <button className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">
              <Search className="h-4 w-4" /> Search
            </button>
          </div>
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Showing {slice.length} of {total} clients
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
          >
            <Download className="h-4 w-4" /> Export
          </button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold">
            <Upload className="h-4 w-4" /> Import
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importCsv(file);
                e.target.value = '';
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-3 py-2 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" /> Add Client
          </button>
        </div>
      </div>
      {importMsg ? <p className="text-sm text-slate-600">{importMsg}</p> : null}

      <div className="overflow-hidden rounded-[22px] border border-white bg-white shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Client ID</th>
                <th className="px-4 py-3">Organisation</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Licenses</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created on</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2 font-mono text-xs font-semibold text-slate-700">
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ background: `hsl(${hue(c.organisation)} 70% 42%)` }}
                      >
                        {initials(c.organisation)}
                      </span>
                      {c.clientCode}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{c.organisation}</p>
                    <p className="text-xs text-slate-500">{c.institutionType ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p>{c.contactPerson ?? '—'}</p>
                    <p className="text-xs text-slate-500">{c.email ?? ''}</p>
                  </td>
                  <td className="px-4 py-3">{c.licenseCount}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[11px] font-bold uppercase',
                        c.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-600',
                      )}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {new Date(c.createdAt).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        aria-label="View"
                        onClick={() => setView(c)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Edit"
                        onClick={() => setEdit(c)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!slice.length ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    No clients match these filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm">
          <label className="flex items-center gap-2 text-slate-500">
            Show
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 px-2 py-1"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
            entries
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>
            <span className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-bold text-white">
              {safePage}
            </span>
            <button
              type="button"
              disabled={safePage >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 disabled:opacity-40"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {addOpen || edit ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{edit ? 'Edit client' : 'Add Client'}</h2>
              <button
                type="button"
                onClick={() => {
                  setAddOpen(false);
                  setEdit(null);
                }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              className="mt-4 grid gap-3 sm:grid-cols-2"
              onSubmit={edit ? saveEdit : createClient}
            >
              <input
                required
                name="organisation"
                defaultValue={edit?.organisation}
                placeholder="Organisation"
                className="bcl-input sm:col-span-2"
              />
              <input
                name="contactPerson"
                defaultValue={edit?.contactPerson ?? ''}
                placeholder="Contact person"
                className="bcl-input"
              />
              <input
                name="email"
                type="email"
                defaultValue={edit?.email ?? ''}
                placeholder="Email"
                className="bcl-input"
              />
              <input
                name="phone"
                defaultValue={edit?.phone ?? ''}
                placeholder="Phone"
                className="bcl-input"
              />
              <input
                name="institutionType"
                defaultValue={edit?.institutionType ?? ''}
                placeholder="Institution type"
                className="bcl-input"
              />
              <input
                name="website"
                defaultValue={edit?.website ?? ''}
                placeholder="Website"
                className="bcl-input sm:col-span-2"
              />
              {edit ? (
                <select
                  name="status"
                  defaultValue={edit.status}
                  className="bcl-input sm:col-span-2"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              ) : null}
              <button disabled={busy} className="bcl-btn bcl-btn-primary sm:col-span-2">
                {busy ? 'Saving…' : edit ? 'Save changes' : 'Create client'}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {view ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/40">
          <aside className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{view.organisation}</h2>
              <button type="button" onClick={() => setView(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <dl className="mt-6 space-y-3 text-sm">
              {[
                ['Client ID', view.clientCode],
                ['Contact', view.contactPerson ?? '—'],
                ['Email', view.email ?? '—'],
                ['Phone', view.phone ?? '—'],
                ['Type', view.institutionType ?? '—'],
                ['Website', view.website ?? '—'],
                ['Licenses', String(view.licenseCount)],
                ['Status', view.status],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">{k}</dt>
                  <dd className="font-medium text-slate-900">{v}</dd>
                </div>
              ))}
            </dl>
            <Link
              href="/admin/licenses"
              className="mt-6 inline-flex text-sm font-semibold text-blue-700"
            >
              Open licenses →
            </Link>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
