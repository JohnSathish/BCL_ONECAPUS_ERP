'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Images, Plus } from 'lucide-react';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  bulkSchoolWebGalleryAlbums,
  deleteSchoolWebGalleryCategory,
  deleteSchoolWebGalleryTag,
  fetchSchoolWebGalleryAlbums,
  fetchSchoolWebGalleryCategories,
  fetchSchoolWebGalleryDashboard,
  fetchSchoolWebGalleryTags,
  upsertSchoolWebGalleryAlbum,
  upsertSchoolWebGalleryCategory,
  upsertSchoolWebGalleryTag,
} from '@/services/school-web';
import { apiErrorMessage } from '@/utils/api-error';

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function SchoolWebAlbumsAdmin() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [visibility, setVisibility] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [catName, setCatName] = useState('');
  const [tagName, setTagName] = useState('');

  const dash = useQuery({
    queryKey: ['school-web-gallery-dash'],
    queryFn: fetchSchoolWebGalleryDashboard,
    enabled,
  });
  const albums = useQuery({
    queryKey: ['school-web-gallery', q, status, visibility, categoryId],
    queryFn: () =>
      fetchSchoolWebGalleryAlbums({
        ...(q ? { q } : {}),
        ...(status ? { status } : {}),
        ...(visibility ? { visibility } : {}),
        ...(categoryId ? { categoryId } : {}),
      }),
    enabled,
  });
  const cats = useQuery({
    queryKey: ['school-web-gallery-cats'],
    queryFn: fetchSchoolWebGalleryCategories,
    enabled,
  });
  const tags = useQuery({
    queryKey: ['school-web-gallery-tags'],
    queryFn: fetchSchoolWebGalleryTags,
    enabled,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['school-web-gallery'] });
    void qc.invalidateQueries({ queryKey: ['school-web-gallery-dash'] });
    void qc.invalidateQueries({ queryKey: ['school-web-gallery-cats'] });
    void qc.invalidateQueries({ queryKey: ['school-web-gallery-tags'] });
  };

  const create = useMutation({
    mutationFn: () => upsertSchoolWebGalleryAlbum({ title, status: 'DRAFT', visibility: 'PUBLIC' }),
    onSuccess: () => {
      setTitle('');
      invalidate();
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const bulk = useMutation({
    mutationFn: (action: string) => bulkSchoolWebGalleryAlbums({ ids: selected, action }),
    onSuccess: () => {
      setSelected([]);
      invalidate();
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const stats = dash.data;
  const rows = albums.data ?? [];
  const allSelected = rows.length > 0 && rows.every((r) => selected.includes(r.id));
  const storage = useMemo(() => formatBytes(stats?.storageBytes ?? 0), [stats?.storageBytes]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#1a365d]">Albums</h1>
          <p className="mt-1 text-sm text-slate-500">
            Create albums, upload photographs, and publish them to the school website gallery.
          </p>
        </div>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) create.mutate();
          }}
        >
          <input
            className="h-10 w-56 rounded-xl border border-slate-200 px-3 text-sm"
            placeholder="New album title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button
            type="submit"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#2563eb] px-4 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            Create album
          </button>
        </form>
      </div>

      {error ? (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Total albums', stats?.total ?? 0],
          ['Published', stats?.published ?? 0],
          ['Drafts', stats?.draft ?? 0],
          ['Images', stats?.images ?? 0],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-[#1a365d]">{value}</p>
          </div>
        ))}
      </div>
      <p className="text-sm text-slate-500">
        Archived {stats?.archived ?? 0} · Unpublished {stats?.unpublished ?? 0} · Storage {storage}
      </p>

      <div className="flex flex-wrap gap-2">
        <input
          className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
          placeholder="Search albums"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {['DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
          value={visibility}
          onChange={(e) => setVisibility(e.target.value)}
        >
          <option value="">All visibility</option>
          {['PUBLIC', 'PRIVATE', 'STAFF'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">All categories</option>
          {(cats.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {selected.length ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <span>{selected.length} selected</span>
          <button
            type="button"
            className="rounded-lg bg-white px-3 py-1"
            onClick={() => bulk.mutate('PUBLISHED')}
          >
            Publish
          </button>
          <button
            type="button"
            className="rounded-lg bg-white px-3 py-1"
            onClick={() => bulk.mutate('UNPUBLISHED')}
          >
            Unpublish
          </button>
          <button
            type="button"
            className="rounded-lg bg-white px-3 py-1"
            onClick={() => bulk.mutate('ARCHIVED')}
          >
            Archive
          </button>
          <button
            type="button"
            className="rounded-lg bg-rose-600 px-3 py-1 text-white"
            onClick={() => {
              if (
                window.confirm(
                  'Delete the selected albums? Photographs stay in storage until you remove them from an album.',
                )
              ) {
                bulk.mutate('DELETE');
              }
            }}
          >
            Delete
          </button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? [] : rows.map((r) => r.id))}
                />
              </th>
              <th className="px-3 py-2">Album</th>
              <th className="px-3 py-2">Photos</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Visibility</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((album) => (
              <tr key={album.id} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(album.id)}
                    onChange={() =>
                      setSelected((cur) =>
                        cur.includes(album.id)
                          ? cur.filter((id) => id !== album.id)
                          : [...cur, album.id],
                      )
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/admin/school-sis/website/albums/${album.id}`}
                    className="font-medium text-[#1a365d]"
                  >
                    {album.title}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {album.category?.name || 'Uncategorised'}
                  </p>
                </td>
                <td className="px-3 py-2">{album.photoCount ?? 0}</td>
                <td className="px-3 py-2">{album.status}</td>
                <td className="px-3 py-2">{album.visibility}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-slate-500">
            <Images className="h-8 w-8" />
            <p>No albums yet. Create one and upload photographs.</p>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-[#1a365d]">Categories</h2>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!catName.trim()) return;
              void upsertSchoolWebGalleryCategory({ name: catName.trim() }).then(() => {
                setCatName('');
                invalidate();
              });
            }}
          >
            <input
              className="h-10 flex-1 rounded-xl border border-slate-200 px-3 text-sm"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder="New category"
            />
            <button type="submit" className="h-10 rounded-xl bg-slate-900 px-3 text-sm text-white">
              Add
            </button>
          </form>
          <ul className="mt-3 space-y-1 text-sm">
            {(cats.data ?? []).map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2">
                <span>{c.name}</span>
                <button
                  type="button"
                  className="text-rose-600"
                  onClick={() => void deleteSchoolWebGalleryCategory(c.id).then(invalidate)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-[#1a365d]">Tags</h2>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!tagName.trim()) return;
              void upsertSchoolWebGalleryTag({ name: tagName.trim() }).then(() => {
                setTagName('');
                invalidate();
              });
            }}
          >
            <input
              className="h-10 flex-1 rounded-xl border border-slate-200 px-3 text-sm"
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
              placeholder="New tag"
            />
            <button type="submit" className="h-10 rounded-xl bg-slate-900 px-3 text-sm text-white">
              Add
            </button>
          </form>
          <ul className="mt-3 space-y-1 text-sm">
            {(tags.data ?? []).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2">
                <span>{t.name}</span>
                <button
                  type="button"
                  className="text-rose-600"
                  onClick={() => void deleteSchoolWebGalleryTag(t.id).then(invalidate)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
