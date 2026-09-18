'use client';

import Link from 'next/link';
import {
  Boxes,
  Code2,
  Eye,
  FileText,
  Globe,
  GraduationCap,
  List,
  Package,
  Pencil,
  Plus,
  Receipt,
  Search,
  Smartphone,
  Type,
  X,
} from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { cn } from '@/lib/cn';

export type ProductRow = {
  id: string;
  name: string;
  slug: string;
  code: string;
  category: string;
  description: string;
  features: string[];
  status: string;
  updatedAt: string;
  views: number;
};

const CATEGORIES = [
  'ERP',
  'Website',
  'Mobile App',
  'Business Software',
  'Custom Software',
  'SaaS',
  'API',
  'Hosting',
];

function iconFor(category: string) {
  const c = category.toLowerCase();
  if (c.includes('erp')) return GraduationCap;
  if (c.includes('web')) return Globe;
  if (c.includes('mobile')) return Smartphone;
  if (c.includes('gst') || c.includes('business')) return Receipt;
  return Boxes;
}

export function ProductsDesk({
  products,
  pageViewsMonth,
}: {
  products: ProductRow[];
  pageViewsMonth: number;
}) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('newest');
  const [edit, setEdit] = useState<ProductRow | null>(null);
  const [busy, setBusy] = useState(false);

  const published = products.filter((p) => p.status === 'PUBLISHED').length;
  const drafts = products.length - published;
  const thisMonth = products.filter((p) => {
    const d = new Date(p.updatedAt);
    const n = new Date();
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  }).length;

  const visible = useMemo(() => {
    let list = products.filter((p) => {
      if (q && !`${p.name} ${p.code} ${p.category}`.toLowerCase().includes(q.toLowerCase()))
        return false;
      if (cat !== 'all' && p.category !== cat) return false;
      if (status !== 'all' && p.status !== status) return false;
      return true;
    });
    if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    else list = [...list].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    return list;
  }, [products, q, cat, status, sort]);

  async function addProduct(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    const data = new FormData(form);
    const res = await fetch('/api/admin/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.get('name'),
        code: data.get('code'),
        category: data.get('category'),
        description: data.get('description'),
        features: String(data.get('features') ?? '')
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    });
    setBusy(false);
    if (res.ok) {
      form.reset();
      window.location.reload();
    }
  }

  async function saveEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!edit) return;
    const data = new FormData(e.currentTarget);
    setBusy(true);
    const res = await fetch(`/api/admin/products/${edit.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.get('name'),
        code: data.get('code'),
        category: data.get('category'),
        description: data.get('description'),
        status: data.get('status'),
        features: String(data.get('features') ?? '')
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    });
    setBusy(false);
    if (res.ok) window.location.reload();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-400">
            <Link href="/admin" className="hover:text-blue-600">
              Dashboard
            </Link>
            <span className="mx-1">›</span> Products
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Products</h1>
          <p className="text-sm text-slate-500">Published products appear on the public website.</p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl bg-violet-50 px-4 py-3 text-violet-800">
          <Package className="h-8 w-8" />
          <p className="text-xs leading-5">
            <span className="block font-semibold">Manage and showcase</span>
            your products on the public website
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Total Products',
            value: products.length,
            sub: `+${thisMonth} this month`,
            color: 'text-sky-600 bg-sky-50',
            icon: Package,
          },
          {
            label: 'Published',
            value: published,
            sub: products.length ? `${Math.round((published / products.length) * 100)}%` : '—',
            color: 'text-emerald-600 bg-emerald-50',
            icon: Globe,
          },
          {
            label: 'Drafts',
            value: drafts,
            sub: 'No changes',
            color: 'text-amber-600 bg-amber-50',
            icon: FileText,
          },
          {
            label: 'Total Page Views',
            value: pageViewsMonth,
            sub: 'Last 30 days on /products*',
            color: 'text-violet-600 bg-violet-50',
            icon: Eye,
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

      <form
        onSubmit={addProduct}
        className="rounded-[22px] border border-white bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-slate-900">
              <Package className="h-5 w-5 text-sky-600" /> Add New Product
            </h2>
            <p className="text-sm text-slate-500">
              Fill in the details to publish a new product on the website.
            </p>
          </div>
          <Link href="/products" target="_blank" className="text-sm font-semibold text-blue-600">
            View on Website ↗
          </Link>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="text-xs font-semibold text-slate-500">
            Product name *
            <span className="relative mt-1 block">
              <Type className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                required
                name="name"
                placeholder="e.g. BCL OneCampus ERP"
                className="bcl-input !mt-0 !pl-9"
              />
            </span>
          </label>
          <label className="text-xs font-semibold text-slate-500">
            Product code *
            <span className="relative mt-1 block">
              <Code2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                required
                name="code"
                placeholder="e.g. ONC"
                className="bcl-input !mt-0 !pl-9"
              />
            </span>
          </label>
          <label className="text-xs font-semibold text-slate-500">
            Category *
            <select required name="category" defaultValue="" className="bcl-input">
              <option value="" disabled>
                Select category
              </option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-500 md:col-span-2">
            Short description *
            <textarea
              required
              name="description"
              placeholder="Brief description about the product…"
              className="bcl-input min-h-[72px]"
            />
          </label>
          <label className="text-xs font-semibold text-slate-500">
            Key features (one per line) *
            <span className="relative mt-1 block">
              <List className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <textarea
                required
                name="features"
                placeholder="Enter one feature per line…"
                className="bcl-input min-h-[72px] !pl-9"
              />
            </span>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" /> Add product
          </button>
          <button
            type="reset"
            className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600"
          >
            Clear form
          </button>
        </div>
      </form>

      <div className="rounded-[22px] border border-white bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900">Products ({visible.length})</h2>
            <p className="text-xs text-slate-500">
              Manage your products, their details and publication status.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search products…"
                className="h-10 rounded-full border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm"
              />
            </span>
            <select
              value={cat}
              onChange={(e) => setCat(e.target.value)}
              className="h-10 rounded-full border border-slate-200 px-3 text-sm"
            >
              <option value="all">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-10 rounded-full border border-slate-200 px-3 text-sm"
            >
              <option value="all">All status</option>
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Draft</option>
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="h-10 rounded-full border border-slate-200 px-3 text-sm"
            >
              <option value="newest">Newest first</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>
        <ul className="mt-4 divide-y divide-slate-100">
          {visible.map((p) => {
            const Icon = iconFor(p.category);
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-4 py-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
                  <Icon className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">
                    {p.name}{' '}
                    <span className="ml-1 text-xs font-medium text-slate-400">{p.code}</span>
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{p.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {[p.category, ...p.features.slice(0, 3)].map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="flex items-center gap-1 text-sm text-slate-500">
                  <Eye className="h-4 w-4" /> {p.views} views
                </p>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold uppercase text-emerald-700">
                  {p.status}
                </span>
                <p className="w-24 text-right text-xs text-slate-400">
                  {new Date(p.updatedAt).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                  <span className="mt-0.5 block">Last updated</span>
                </p>
                <div className="flex gap-1">
                  <Link
                    href={`/products/${p.slug}`}
                    target="_blank"
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                  >
                    <Eye className="h-4 w-4" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setEdit(p)}
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {edit ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <form onSubmit={saveEdit} className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Edit product</h2>
              <button type="button" onClick={() => setEdit(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 grid gap-3">
              <input required name="name" defaultValue={edit.name} className="bcl-input" />
              <input required name="code" defaultValue={edit.code} className="bcl-input" />
              <select name="category" defaultValue={edit.category} className="bcl-input">
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <select name="status" defaultValue={edit.status} className="bcl-input">
                <option value="PUBLISHED">PUBLISHED</option>
                <option value="DRAFT">DRAFT</option>
              </select>
              <textarea
                required
                name="description"
                defaultValue={edit.description}
                className="bcl-input min-h-[80px]"
              />
              <textarea
                required
                name="features"
                defaultValue={edit.features.join('\n')}
                className="bcl-input min-h-[80px]"
              />
              <button disabled={busy} className="bcl-btn bcl-btn-primary">
                Save changes
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
