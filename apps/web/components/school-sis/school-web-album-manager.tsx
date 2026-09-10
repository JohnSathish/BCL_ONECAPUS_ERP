'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  bulkSchoolWebGalleryItems,
  fetchSchoolWebGalleryAlbum,
  fetchSchoolWebGalleryAlbums,
  fetchSchoolWebGalleryCategories,
  fetchSchoolWebGalleryTags,
  patchSchoolWebGalleryItem,
  replaceSchoolWebGalleryImage,
  reorderSchoolWebGalleryItems,
  setSchoolWebGalleryCover,
  uploadSchoolWebGalleryImages,
  upsertSchoolWebGalleryAlbum,
  type SchoolWebGalleryAlbum,
} from '@/services/school-web';
import { apiErrorMessage } from '@/utils/api-error';

type PendingFile = { id: string; file: File; preview: string };

export function SchoolWebAlbumManager({ albumId }: { albumId: string }) {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    eventName: '',
    eventDate: '',
    location: '',
    status: 'DRAFT',
    visibility: 'PUBLIC',
    categoryId: '',
    academicYear: '',
    scheduledAt: '',
    allowDownload: false,
    tagIds: [] as string[],
    seoTitle: '',
    seoDescription: '',
  });

  const album = useQuery({
    queryKey: ['school-web-gallery-album', albumId, page],
    queryFn: () => fetchSchoolWebGalleryAlbum(albumId, page),
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
  const others = useQuery({
    queryKey: ['school-web-gallery'],
    queryFn: () => fetchSchoolWebGalleryAlbums(),
    enabled,
  });

  useEffect(() => {
    const row = album.data;
    if (!row) return;
    setForm({
      title: row.title,
      description: row.description || '',
      eventName: row.eventName || '',
      eventDate: row.eventDate ? row.eventDate.slice(0, 10) : '',
      location: row.location || '',
      status: row.status,
      visibility: row.visibility,
      categoryId: row.category?.id || '',
      academicYear: row.academicYear || '',
      scheduledAt: row.scheduledAt ? row.scheduledAt.slice(0, 16) : '',
      allowDownload: row.allowDownload,
      tagIds: (row.tags ?? []).map((t) => t.id),
      seoTitle:
        typeof (row as { seoJson?: { title?: string } }).seoJson?.title === 'string'
          ? String((row as { seoJson?: { title?: string } }).seoJson?.title)
          : '',
      seoDescription: '',
    });
  }, [album.data?.id]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['school-web-gallery-album', albumId] });
    void qc.invalidateQueries({ queryKey: ['school-web-gallery'] });
    void qc.invalidateQueries({ queryKey: ['school-web-gallery-dash'] });
  };

  const save = useMutation({
    mutationFn: () =>
      upsertSchoolWebGalleryAlbum(
        {
          ...form,
          categoryId: form.categoryId || null,
          eventDate: form.eventDate || null,
          scheduledAt: form.scheduledAt || null,
          seoJson: { title: form.seoTitle, description: form.seoDescription },
        },
        albumId,
      ),
    onSuccess: () => {
      setNotice('Album saved.');
      invalidate();
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const items = album.data?.items ?? [];
  const photoCount = album.data?.photoCount ?? items.length;
  const pages = Math.max(1, Math.ceil(photoCount / (album.data?.pageSize || 80)));

  function addFiles(list: FileList | File[]) {
    const next: PendingFile[] = [];
    for (const file of Array.from(list)) {
      if (!file.type.startsWith('image/')) continue;
      next.push({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        file,
        preview: URL.createObjectURL(file),
      });
    }
    setPending((cur) => [...cur, ...next]);
  }

  async function uploadPending() {
    if (!pending.length) return;
    setProgress(`Uploading ${pending.length} image(s)…`);
    setError(null);
    try {
      await uploadSchoolWebGalleryImages(
        albumId,
        pending.map((p) => p.file),
      );
      pending.forEach((p) => URL.revokeObjectURL(p.preview));
      setPending([]);
      setNotice('Images uploaded.');
      invalidate();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setProgress(null);
    }
  }

  async function onDropReorder(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const ids = items.map((i) => i.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1);
    ids.splice(to, 0, dragId);
    setDragId(null);
    try {
      await reorderSchoolWebGalleryItems(albumId, ids);
      invalidate();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  const editing = useMemo(() => items.find((i) => i.id === editItem), [items, editItem]);

  if (album.isLoading) return <p className="text-sm text-slate-500">Loading album…</p>;
  if (!album.data) return <p className="text-sm text-rose-600">Album not found.</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/school-sis/website/albums" className="text-sm text-slate-500">
            ← Albums
          </Link>
          <h1 className="text-xl font-semibold text-[#1a365d]">{album.data.title}</h1>
          <p className="text-sm text-slate-500">{photoCount} photographs</p>
        </div>
        <button
          type="button"
          className="h-10 rounded-xl bg-[#2563eb] px-4 text-sm font-semibold text-white"
          onClick={() => save.mutate()}
        >
          Save album
        </button>
      </div>
      {error ? (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}
      {notice ? (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-[#1a365d]">Album information</h2>
          <input
            className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Title"
          />
          <textarea
            className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Description"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
              value={form.eventName}
              onChange={(e) => setForm({ ...form, eventName: e.target.value })}
              placeholder="Event / programme"
            />
            <input
              type="date"
              className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
              value={form.eventDate}
              onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
            />
            <input
              className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Location / venue"
            />
            <input
              className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
              value={form.academicYear}
              onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
              placeholder="Academic year"
            />
            <select
              className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {['DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select
              className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
              value={form.visibility}
              onChange={(e) => setForm({ ...form, visibility: e.target.value })}
            >
              {['PUBLIC', 'PRIVATE', 'STAFF'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select
              className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            >
              <option value="">No category</option>
              {(cats.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              type="datetime-local"
              className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
              value={form.scheduledAt}
              onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.allowDownload}
              onChange={(e) => setForm({ ...form, allowDownload: e.target.checked })}
            />
            Allow public download
          </label>
          <div className="flex flex-wrap gap-2">
            {(tags.data ?? []).map((t) => (
              <label key={t.id} className="rounded-full border border-slate-200 px-3 py-1 text-xs">
                <input
                  type="checkbox"
                  className="mr-1"
                  checked={form.tagIds.includes(t.id)}
                  onChange={() =>
                    setForm({
                      ...form,
                      tagIds: form.tagIds.includes(t.id)
                        ? form.tagIds.filter((id) => id !== t.id)
                        : [...form.tagIds, t.id],
                    })
                  }
                />
                {t.name}
              </label>
            ))}
          </div>
          <input
            className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
            value={form.seoTitle}
            onChange={(e) => setForm({ ...form, seoTitle: e.target.value })}
            placeholder="SEO title"
          />
          <input
            className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
            value={form.seoDescription}
            onChange={(e) => setForm({ ...form, seoDescription: e.target.value })}
            placeholder="SEO description"
          />
        </section>
        <aside className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Cover</p>
          {album.data.cover?.card ? (
            <img
              src={album.data.cover.card}
              alt=""
              className="mt-2 h-40 w-full rounded-xl object-cover"
            />
          ) : (
            <p className="mt-2 text-sm text-slate-500">
              Upload a photograph and set it as the cover.
            </p>
          )}
        </aside>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-[#1a365d]">Photo manager</h2>
        <div
          className="mt-3 rounded-2xl border-2 border-dashed border-slate-300 p-6 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            addFiles(e.dataTransfer.files);
          }}
        >
          <p className="text-sm text-slate-600">
            Drag photographs here or choose files. JPEG, PNG or WebP, up to 8 MB each.
          </p>
          <button
            type="button"
            className="mt-3 h-10 rounded-xl bg-slate-900 px-4 text-sm text-white"
            onClick={() => inputRef.current?.click()}
          >
            Select images
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
        {pending.length ? (
          <div className="mt-3">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {pending.map((p) => (
                <figure key={p.id} className="relative">
                  <img src={p.preview} alt="" className="h-20 w-full rounded-lg object-cover" />
                  <button
                    type="button"
                    className="absolute right-1 top-1 rounded bg-black/70 px-1 text-xs text-white"
                    onClick={() => setPending((cur) => cur.filter((x) => x.id !== p.id))}
                  >
                    ×
                  </button>
                </figure>
              ))}
            </div>
            <button
              type="button"
              className="mt-3 h-10 rounded-xl bg-[#2563eb] px-4 text-sm font-semibold text-white"
              onClick={() => void uploadPending()}
            >
              {progress || `Upload ${pending.length} image(s)`}
            </button>
          </div>
        ) : null}

        {selected.length ? (
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <button
              type="button"
              className="rounded-lg bg-rose-600 px-3 py-1 text-white"
              onClick={() => {
                if (!window.confirm('Delete the selected photographs?')) return;
                void bulkSchoolWebGalleryItems(albumId, { ids: selected, action: 'DELETE' }).then(
                  () => {
                    setSelected([]);
                    invalidate();
                  },
                );
              }}
            >
              Delete selected
            </button>
            <select
              className="h-8 rounded-lg border border-slate-200 px-2"
              defaultValue=""
              onChange={(e) => {
                const dest = e.target.value;
                if (!dest) return;
                void bulkSchoolWebGalleryItems(albumId, {
                  ids: selected,
                  action: 'MOVE',
                  albumId: dest,
                }).then(() => {
                  setSelected([]);
                  invalidate();
                });
              }}
            >
              <option value="">Move to album…</option>
              {(others.data ?? [])
                .filter((a) => a.id !== albumId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
            </select>
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {items.map((item) => (
            <figure
              key={item.id}
              className="relative rounded-xl border border-slate-200 p-1"
              draggable
              onDragStart={() => setDragId(item.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => void onDropReorder(item.id)}
            >
              <img
                src={item.urls.thumb}
                alt={item.altText || ''}
                className="h-28 w-full rounded-lg object-cover"
              />
              <label className="absolute left-2 top-2">
                <input
                  type="checkbox"
                  checked={selected.includes(item.id)}
                  onChange={() =>
                    setSelected((cur) =>
                      cur.includes(item.id)
                        ? cur.filter((id) => id !== item.id)
                        : [...cur, item.id],
                    )
                  }
                />
              </label>
              <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                <button
                  type="button"
                  className="text-[#2563eb]"
                  onClick={() => void setSchoolWebGalleryCover(albumId, item.id).then(invalidate)}
                >
                  Cover
                </button>
                <button
                  type="button"
                  className="text-slate-600"
                  onClick={() => setEditItem(item.id)}
                >
                  Edit
                </button>
                <label className="text-slate-600">
                  Replace
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file)
                        void replaceSchoolWebGalleryImage(albumId, item.id, file).then(invalidate);
                    }}
                  />
                </label>
              </div>
            </figure>
          ))}
        </div>
        {pages > 1 ? (
          <div className="mt-3 flex gap-2">
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                className={`h-8 w-8 rounded-lg ${n === page ? 'bg-[#1a365d] text-white' : 'bg-slate-100'}`}
                onClick={() => setPage(n)}
              >
                {n}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {editing ? (
        <ItemEditor
          item={editing}
          onClose={() => setEditItem(null)}
          onSave={async (payload) => {
            await patchSchoolWebGalleryItem(editing.id, payload);
            setEditItem(null);
            invalidate();
          }}
        />
      ) : null}
    </div>
  );
}

function ItemEditor({
  item,
  onClose,
  onSave,
}: {
  item: NonNullable<SchoolWebGalleryAlbum['items']>[number];
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [title, setTitle] = useState(item.title || '');
  const [caption, setCaption] = useState(item.caption || '');
  const [description, setDescription] = useState(item.description || '');
  const [altText, setAltText] = useState(item.altText || '');
  const [credit, setCredit] = useState(item.credit || '');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-4">
        <h3 className="font-semibold text-[#1a365d]">Image details</h3>
        <div className="mt-3 space-y-2">
          <input
            className="h-10 w-full rounded-xl border px-3 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
          />
          <input
            className="h-10 w-full rounded-xl border px-3 text-sm"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Caption"
          />
          <input
            className="h-10 w-full rounded-xl border px-3 text-sm"
            value={altText}
            onChange={(e) => setAltText(e.target.value)}
            placeholder="Alt text"
          />
          <input
            className="h-10 w-full rounded-xl border px-3 text-sm"
            value={credit}
            onChange={(e) => setCredit(e.target.value)}
            placeholder="Photographer / credit"
          />
          <textarea
            className="min-h-20 w-full rounded-xl border px-3 py-2 text-sm"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
          />
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" className="h-9 rounded-lg px-3 text-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="h-9 rounded-lg bg-[#2563eb] px-3 text-sm text-white"
            onClick={() => void onSave({ title, caption, description, altText, credit })}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
