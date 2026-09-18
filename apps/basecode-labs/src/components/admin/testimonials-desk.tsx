'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowUp,
  Building2,
  Eye,
  FileText,
  MessageSquareQuote,
  Pencil,
  Plus,
  Quote,
  Search,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { cn } from '@/lib/cn';

export type TestimonialRow = {
  id: string;
  name: string;
  designation: string;
  organisation: string;
  quote: string;
  photo: string | null;
  rating: number;
  project: string | null;
  industry: string | null;
  website: string | null;
  featured: boolean;
  displayOrder: number;
  status: string;
};

function Stars({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          className={onChange ? 'cursor-pointer' : 'cursor-default'}
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
        >
          <Star
            className={cn(
              'h-4 w-4',
              n <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-300',
            )}
          />
        </button>
      ))}
    </span>
  );
}

async function uploadPhoto(file: File, name: string) {
  const data = new FormData();
  data.set('file', file);
  data.set('name', name);
  const res = await fetch('/api/admin/testimonials/photo', { method: 'POST', body: data });
  if (!res.ok) return null;
  const json = await res.json();
  return String(json.url ?? '');
}

export function TestimonialsDesk({ items }: { items: TestimonialRow[] }) {
  const [q, setQ] = useState('');
  const [industry, setIndustry] = useState('all');
  const [status, setStatus] = useState('all');
  const [edit, setEdit] = useState<TestimonialRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState(5);
  const [editRating, setEditRating] = useState(5);
  const [photoUrl, setPhotoUrl] = useState('');
  const [editPhoto, setEditPhoto] = useState('');

  const published = items.filter((t) => t.status === 'PUBLISHED').length;
  const featured = items.filter((t) => t.featured && t.status === 'PUBLISHED').length;
  const orgs = new Set(items.map((t) => t.organisation)).size;
  const avg = items.length ? items.reduce((s, t) => s + t.rating, 0) / items.length : 0;
  const industries = useMemo(
    () => [...new Set(items.map((t) => t.industry).filter(Boolean) as string[])].sort(),
    [items],
  );

  const visible = useMemo(() => {
    return items.filter((t) => {
      if (
        q &&
        !`${t.name} ${t.organisation} ${t.quote} ${t.project ?? ''}`
          .toLowerCase()
          .includes(q.toLowerCase())
      )
        return false;
      if (industry !== 'all' && t.industry !== industry) return false;
      if (status !== 'all' && t.status !== status) return false;
      return true;
    });
  }, [items, q, industry, status]);

  async function addItem(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    const file = (form.elements.namedItem('photoFile') as HTMLInputElement)?.files?.[0];
    let photo = String(data.get('photo') || photoUrl || '');
    if (file) photo = (await uploadPhoto(file, String(data.get('name')))) || photo;
    const res = await fetch('/api/admin/testimonials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.get('name'),
        designation: data.get('designation'),
        organisation: data.get('organisation'),
        quote: data.get('quote'),
        photo: photo || undefined,
        rating,
        project: data.get('project') || undefined,
        industry: data.get('industry') || undefined,
        website: data.get('website') || undefined,
        featured: data.get('featured') === 'on',
        status: data.get('status'),
      }),
    });
    setBusy(false);
    if (res.ok) {
      form.reset();
      setRating(5);
      setPhotoUrl('');
      window.location.reload();
    }
  }

  async function saveEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!edit) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    const file = (form.elements.namedItem('photoFile') as HTMLInputElement)?.files?.[0];
    let photo = String(data.get('photo') || editPhoto || '');
    if (file) photo = (await uploadPhoto(file, String(data.get('name')))) || photo;
    const res = await fetch(`/api/admin/testimonials/${edit.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.get('name'),
        designation: data.get('designation'),
        organisation: data.get('organisation'),
        quote: data.get('quote'),
        photo: photo || null,
        rating: editRating,
        project: data.get('project') || null,
        industry: data.get('industry') || null,
        website: data.get('website') || null,
        featured: data.get('featured') === 'on',
        status: data.get('status'),
      }),
    });
    setBusy(false);
    if (res.ok) window.location.reload();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(true);
    await fetch(`/api/admin/testimonials/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    window.location.reload();
  }

  async function remove(id: string, name: string) {
    if (
      !confirm(`Remove the testimonial from ${name}? It will no longer appear on the public site.`)
    )
      return;
    setBusy(true);
    await fetch(`/api/admin/testimonials/${id}`, { method: 'DELETE' });
    window.location.reload();
  }

  async function move(row: TestimonialRow, dir: -1 | 1) {
    const ordered = [...items].sort((a, b) => a.displayOrder - b.displayOrder);
    const idx = ordered.findIndex((t) => t.id === row.id);
    const swap = ordered[idx + dir];
    if (!swap) return;
    setBusy(true);
    await Promise.all([
      fetch(`/api/admin/testimonials/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayOrder: swap.displayOrder }),
      }),
      fetch(`/api/admin/testimonials/${swap.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayOrder: row.displayOrder }),
      }),
    ]);
    window.location.reload();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-400">
            <Link href="/admin" className="hover:text-blue-600">
              Dashboard
            </Link>
            <span className="mx-1">›</span> Testimonials
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Testimonials</h1>
          <p className="text-sm text-slate-500">
            Publish only quotes given with permission. They appear on the public Clients page.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-amber-900">
          <Quote className="h-8 w-8" />
          <p className="text-xs leading-5">
            <span className="block font-semibold">Real voices only</span>
            Do not invent names, ratings or extra clients
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Total Testimonials',
            value: items.length,
            sub: `${orgs} organisations`,
            color: 'text-sky-600 bg-sky-50',
            icon: MessageSquareQuote,
          },
          {
            label: 'Published',
            value: published,
            sub: items.length ? `${Math.round((published / items.length) * 100)}% live` : '—',
            color: 'text-emerald-600 bg-emerald-50',
            icon: Eye,
          },
          {
            label: 'Featured',
            value: featured,
            sub: 'Shown in the carousel first',
            color: 'text-violet-600 bg-violet-50',
            icon: Star,
          },
          {
            label: 'Average rating',
            value: avg ? avg.toFixed(1) : '—',
            sub: 'From stored ratings',
            color: 'text-amber-600 bg-amber-50',
            icon: Star,
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
          onSubmit={addItem}
          className="rounded-[22px] border border-white bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-slate-900">
                <Plus className="h-5 w-5 text-sky-600" /> Add testimonial
              </h2>
              <p className="text-sm text-slate-500">
                Use the person’s name, role and organisation as they approved it.
              </p>
            </div>
            <Link
              href="/testimonials"
              target="_blank"
              className="text-sm font-semibold text-blue-600"
            >
              View on Website ↗
            </Link>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="text-xs font-semibold text-slate-500">
              Name *
              <input
                required
                name="name"
                placeholder="e.g. Fr. Bivan Rodriques Mukhim"
                className="bcl-input"
              />
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Designation *
              <input
                required
                name="designation"
                placeholder="e.g. Principal"
                className="bcl-input"
              />
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Organisation *
              <span className="relative mt-1 block">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  name="organisation"
                  placeholder="Institution or company"
                  className="bcl-input !mt-0 !pl-9"
                />
              </span>
            </label>
            <label className="text-xs font-semibold text-slate-500 md:col-span-3">
              Quote *
              <textarea
                required
                name="quote"
                placeholder="Paste the approved quote…"
                className="bcl-input min-h-[96px]"
              />
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Project
              <input name="project" placeholder="e.g. School website" className="bcl-input" />
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Industry
              <input
                name="industry"
                placeholder="School, College, Business…"
                className="bcl-input"
              />
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Website
              <input name="website" placeholder="https://" className="bcl-input" />
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Photo URL
              <input
                name="photo"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="/images/testimonials/…"
                className="bcl-input"
              />
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Upload photo
              <span className="relative mt-1 block">
                <Upload className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  name="photoFile"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="bcl-input !mt-0 !pl-9 file:mr-3 file:border-0 file:bg-transparent file:text-sm"
                />
              </span>
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Rating
              <span className="mt-2 flex items-center gap-2">
                <Stars value={rating} onChange={setRating} />
                <span className="text-slate-400">{rating}/5</span>
              </span>
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Status
              <select name="status" defaultValue="PUBLISHED" className="bcl-input">
                <option value="PUBLISHED">Published</option>
                <option value="DRAFT">Draft</option>
              </select>
            </label>
            <label className="flex items-center gap-2 pt-6 text-sm font-semibold text-slate-600">
              <input
                type="checkbox"
                name="featured"
                defaultChecked
                className="h-4 w-4 rounded border-slate-300"
              />
              Featured
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
            >
              <Plus className="h-4 w-4" /> Add testimonial
            </button>
            <button
              type="reset"
              onClick={() => {
                setRating(5);
                setPhotoUrl('');
              }}
              className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600"
            >
              Clear form
            </button>
          </div>
        </form>

        <aside className="rounded-[22px] border border-white bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
          <h3 className="flex items-center gap-2 font-semibold text-slate-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
              <FileText className="h-4 w-4" />
            </span>
            How to use
          </h3>
          <ol className="mt-3 space-y-2 text-sm text-slate-600">
            <li>1. Use the real name and organisation</li>
            <li>2. Paste the quote as approved</li>
            <li>3. Add a portrait if you have one</li>
            <li>4. Publish only with permission</li>
            <li>5. Reorder with the arrows for the carousel</li>
          </ol>
        </aside>
      </div>

      <div className="rounded-[22px] border border-white bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900">Testimonials ({visible.length})</h2>
            <p className="text-xs text-slate-500">
              Manage quotes, publication status and carousel order.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, organisation or quote…"
                className="h-10 rounded-full border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm"
              />
            </span>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="h-10 rounded-full border border-slate-200 px-3 text-sm"
            >
              <option value="all">All industries</option>
              {industries.map((i) => (
                <option key={i}>{i}</option>
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
          </div>
        </div>

        <ul className="mt-4 divide-y divide-slate-100">
          {visible.map((t) => (
            <li key={t.id} className="flex flex-wrap items-start gap-4 py-4">
              {t.photo ? (
                <Image
                  src={t.photo}
                  alt={t.name}
                  width={72}
                  height={72}
                  className="h-[72px] w-[72px] rounded-2xl object-cover object-top"
                />
              ) : (
                <span className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-sky-50 text-lg font-semibold text-sky-700">
                  {t.name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((p) => p[0])
                    .join('')
                    .toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{t.name}</p>
                <p className="text-sm text-slate-500">
                  {t.designation}, {t.organisation}
                </p>
                <p className="mt-2 line-clamp-3 text-sm text-slate-600">“{t.quote}”</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Stars value={t.rating} />
                  {t.industry ? (
                    <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      {t.industry}
                    </span>
                  ) : null}
                  {t.project ? (
                    <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                      {t.project}
                    </span>
                  ) : null}
                  {t.featured ? (
                    <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                      Featured
                    </span>
                  ) : null}
                </div>
              </div>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px] font-bold uppercase',
                  t.status === 'PUBLISHED'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-amber-50 text-amber-700',
                )}
              >
                {t.status}
              </span>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  disabled={busy || items.findIndex((x) => x.id === t.id) === 0}
                  onClick={() => move(t, -1)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                  title="Move up"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={busy || items.findIndex((x) => x.id === t.id) === items.length - 1}
                  onClick={() => move(t, 1)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                  title="Move down"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
              </div>
              <div className="flex gap-1">
                {t.website ? (
                  <a
                    href={t.website}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                  >
                    <Eye className="h-4 w-4" />
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setEdit(t);
                    setEditRating(t.rating);
                    setEditPhoto(t.photo ?? '');
                  }}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    patch(t.id, { status: t.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED' })
                  }
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                  title={t.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
                >
                  <Eye className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => remove(t.id, t.name)}
                  className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {edit ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <form
            onSubmit={saveEdit}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Edit testimonial</h2>
              <button type="button" onClick={() => setEdit(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 grid gap-3">
              <input required name="name" defaultValue={edit.name} className="bcl-input" />
              <input
                required
                name="designation"
                defaultValue={edit.designation}
                className="bcl-input"
              />
              <input
                required
                name="organisation"
                defaultValue={edit.organisation}
                className="bcl-input"
              />
              <textarea
                required
                name="quote"
                defaultValue={edit.quote}
                className="bcl-input min-h-[120px]"
              />
              <input
                name="project"
                defaultValue={edit.project ?? ''}
                placeholder="Project"
                className="bcl-input"
              />
              <input
                name="industry"
                defaultValue={edit.industry ?? ''}
                placeholder="Industry"
                className="bcl-input"
              />
              <input
                name="website"
                defaultValue={edit.website ?? ''}
                placeholder="Website"
                className="bcl-input"
              />
              <input
                name="photo"
                value={editPhoto}
                onChange={(e) => setEditPhoto(e.target.value)}
                placeholder="Photo URL"
                className="bcl-input"
              />
              <input
                name="photoFile"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="bcl-input file:mr-3 file:border-0 file:bg-transparent"
              />
              <div className="flex items-center gap-2">
                <Stars value={editRating} onChange={setEditRating} />
                <span className="text-xs text-slate-400">{editRating}/5</span>
              </div>
              <select name="status" defaultValue={edit.status} className="bcl-input">
                <option value="PUBLISHED">Published</option>
                <option value="DRAFT">Draft</option>
              </select>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                <input
                  type="checkbox"
                  name="featured"
                  defaultChecked={edit.featured}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Featured
              </label>
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
