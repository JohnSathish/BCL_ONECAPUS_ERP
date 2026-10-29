'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  FileText,
  GraduationCap,
  Link2,
  Search,
  Upload,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import {
  createDigitalAsset,
  createResearchItem,
  downloadDigitalAsset,
  fetchDigitalAssets,
  fetchDigitalSummary,
  fetchPendingResearch,
  fetchResearchItems,
  publishDigitalAsset,
  reviewResearchItem,
  submitResearchItem,
  syncQuestionBankToLibrary,
} from '@/services/library';
import type { LibraryDigitalAsset } from '@/types/library';
import { downloadBlob } from '@/utils/download-blob';
import { cn } from '@/utils/cn';
import { apiErrorMessage } from '@/utils/api-error';

type DigitalProps = { mode: 'digital' };
type ResearchProps = { mode: 'research' };
type Props = DigitalProps | ResearchProps;

const ASSET_TYPES = [
  'PDF',
  'EBOOK',
  'RESEARCH_PAPER',
  'QUESTION_PAPER',
  'LECTURE_NOTES',
  'LAB_MANUAL',
  'MAGAZINE',
  'JOURNAL',
];
const RESEARCH_TYPES = [
  'PUBLICATION',
  'THESIS',
  'DISSERTATION',
  'PATENT',
  'ARTICLE',
  'PROJECT',
  'INTERNSHIP_REPORT',
];

export function LibraryDigitalWorkspace({ mode }: Props) {
  const enabled = useAuthQueryEnabled();
  const { canAny } = usePermissions();
  const canManage = canAny('library:digital:manage', 'library:manage');
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [departmentId, setDepartmentId] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    bucket: '',
    assetType: '',
    departmentId: '',
    status: '',
    year: '',
    page: 1,
  });
  const [draftSearch, setDraftSearch] = useState('');
  const [grid, setGrid] = useState(false);
  const [form, setForm] = useState({
    title: '',
    author: '',
    assetType: mode === 'digital' ? 'PDF' : 'THESIS',
    abstract: '',
  });

  const summary = useQuery({
    queryKey: ['library', 'digital', 'summary'],
    queryFn: fetchDigitalSummary,
    enabled: enabled && mode === 'digital',
  });

  const digital = useQuery({
    queryKey: ['library', 'digital', filters],
    queryFn: () =>
      fetchDigitalAssets({
        limit: 20,
        page: filters.page,
        search: filters.search || undefined,
        bucket: filters.bucket || undefined,
        assetType: filters.assetType || undefined,
        departmentId: filters.departmentId || undefined,
        status: filters.status || undefined,
        year: filters.year || undefined,
      }),
    enabled: enabled && mode === 'digital',
  });

  const research = useQuery({
    queryKey: ['library', 'research'],
    queryFn: () => fetchResearchItems({ limit: 50 }),
    enabled: enabled && mode === 'research',
  });

  const pending = useQuery({
    queryKey: ['library', 'research', 'pending'],
    queryFn: fetchPendingResearch,
    enabled: enabled && mode === 'research',
  });

  const uploadMut = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append('title', form.title);
      if (form.author) fd.append('author', form.author);
      if (mode === 'research') {
        fd.append('itemType', form.assetType);
        if (form.abstract) fd.append('abstract', form.abstract);
        const file = fileRef.current?.files?.[0];
        if (file) fd.append('file', file);
        return createResearchItem(fd);
      }
      fd.append('assetType', form.assetType);
      if (departmentId) fd.append('departmentId', departmentId);
      const file = pickedFile ?? fileRef.current?.files?.[0];
      if (file) fd.append('file', file);
      return createDigitalAsset(fd);
    },
    onSuccess: () => {
      setMessage('Uploaded successfully');
      setForm({
        title: '',
        author: '',
        assetType: mode === 'digital' ? 'PDF' : 'THESIS',
        abstract: '',
      });
      if (fileRef.current) fileRef.current.value = '';
      setPickedFile(null);
      setDepartmentId('');
      void qc.invalidateQueries({ queryKey: ['library'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e)),
  });

  const publishMut = useMutation({
    mutationFn: (id: string) => publishDigitalAsset(id),
    onSuccess: () => {
      setMessage('Published');
      void qc.invalidateQueries({ queryKey: ['library', 'digital'] });
    },
  });

  const syncQbMut = useMutation({
    mutationFn: syncQuestionBankToLibrary,
    onSuccess: (data: { synced?: number }) => {
      setMessage(`Synced ${(data as { synced?: number }).synced ?? 0} question papers`);
      void qc.invalidateQueries({ queryKey: ['library', 'digital'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e)),
  });

  const submitMut = useMutation({
    mutationFn: (id: string) => submitResearchItem(id),
    onSuccess: () => {
      setMessage('Submitted for review');
      void qc.invalidateQueries({ queryKey: ['library', 'research'] });
    },
  });

  const reviewMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'APPROVE' | 'REJECT' }) =>
      reviewResearchItem(id, action),
    onSuccess: () => {
      setMessage('Review recorded');
      void qc.invalidateQueries({ queryKey: ['library', 'research'] });
    },
  });

  if (mode === 'digital') {
    const stats = summary.data;
    const total = stats?.total ?? 0;
    const items = digital.data?.items ?? [];
    const pages = Math.max(1, Math.ceil((digital.data?.total ?? 0) / 20));
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">Library / Digital Library</p>
            <h1 className="text-xl font-semibold text-slate-900">Digital Library</h1>
            <p className="text-sm text-slate-500">
              Manage and access e-books, question papers, research papers and digital learning
              resources
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canManage ? (
              <Button
                variant="outline"
                disabled={syncQbMut.isPending}
                onClick={() => syncQbMut.mutate()}
              >
                {syncQbMut.isPending ? 'Syncing…' : 'Sync Question Bank'}
              </Button>
            ) : null}
            <Button
              onClick={() =>
                document.getElementById('digital-upload')?.scrollIntoView({ behavior: 'smooth' })
              }
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload Resource
            </Button>
          </div>
        </div>
        {message ? (
          <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">{message}</p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Stat
            icon={BookOpen}
            label="Total Resources"
            value={stats ? total : '—'}
            hint="All digital files"
            tone="bg-blue-50 text-blue-700"
          />
          <Stat
            icon={BookOpen}
            label="E-Books"
            value={stats ? stats.ebooks : '—'}
            hint={share(stats?.shares.ebooks)}
            tone="bg-emerald-50 text-emerald-700"
            onClick={() => setFilters({ ...filters, bucket: 'EBOOK', assetType: '', page: 1 })}
          />
          <Stat
            icon={FileText}
            label="Question Papers"
            value={stats ? stats.papers : '—'}
            hint={share(stats?.shares.papers)}
            tone="bg-sky-50 text-sky-700"
            onClick={() =>
              setFilters({ ...filters, bucket: 'QUESTION_PAPER', assetType: '', page: 1 })
            }
          />
          <Stat
            icon={GraduationCap}
            label="Research Papers"
            value={stats ? stats.research : '—'}
            hint={share(stats?.shares.research)}
            tone="bg-violet-50 text-violet-700"
            onClick={() =>
              setFilters({ ...filters, bucket: 'RESEARCH_PAPER', assetType: '', page: 1 })
            }
          />
          <Stat
            icon={Link2}
            label="Other Resources"
            value={stats ? stats.other : '—'}
            hint={share(stats?.shares.other)}
            tone="bg-rose-50 text-rose-700"
            onClick={() => setFilters({ ...filters, bucket: 'OTHER', assetType: '', page: 1 })}
          />
        </div>
        <div className="grid gap-4 xl:grid-cols-[1fr_260px]">
          <form
            id="digital-upload"
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            onSubmit={(event) => {
              event.preventDefault();
              if (!form.title || uploadMut.isPending) return;
              uploadMut.mutate();
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const file = event.dataTransfer.files?.[0];
              if (file) setPickedFile(file);
            }}
          >
            <h2 className="mb-3 font-semibold">Upload New Resource</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <button
                type="button"
                className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-sm text-slate-500"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="mb-2 h-6 w-6 text-blue-600" />
                {pickedFile ? pickedFile.name : 'Drag and drop a file here, or click to browse'}
                <span className="mt-1 text-xs">PDF, DOC, DOCX, PPT, ZIP</span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.epub,.zip"
                className="hidden"
                onChange={(event) => setPickedFile(event.target.files?.[0] ?? null)}
              />
              <div className="grid gap-2">
                <Input
                  required
                  placeholder="Resource title"
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                />
                <Input
                  placeholder="Author (optional)"
                  value={form.author}
                  onChange={(event) => setForm({ ...form, author: event.target.value })}
                />
                <select
                  className="h-10 rounded-md border px-2 text-sm"
                  value={form.assetType}
                  onChange={(event) => setForm({ ...form, assetType: event.target.value })}
                >
                  {ASSET_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {labelType(type)}
                    </option>
                  ))}
                </select>
                <select
                  className="h-10 rounded-md border px-2 text-sm"
                  value={departmentId}
                  onChange={(event) => setDepartmentId(event.target.value)}
                >
                  <option value="">Department / subject</option>
                  {(stats?.departments ?? []).map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
                <Button
                  type="submit"
                  disabled={!form.title || !pickedFile || uploadMut.isPending || !canManage}
                >
                  {uploadMut.isPending ? 'Uploading…' : 'Upload Resource'}
                </Button>
              </div>
            </div>
          </form>
          <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-2 font-semibold">Quick Links</h2>
            <div className="space-y-2 text-sm">
              <Link
                className="block rounded-lg px-2 py-2 hover:bg-slate-50"
                href="/admin/library/settings"
              >
                Access permissions
              </Link>
              <Link
                className="block rounded-lg px-2 py-2 hover:bg-slate-50"
                href="/admin/library/reports"
              >
                View reports
              </Link>
              <Link
                className="block rounded-lg px-2 py-2 hover:bg-slate-50"
                href="/admin/library/research"
              >
                Research repository
              </Link>
            </div>
          </aside>
        </div>
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
            <div className="flex flex-wrap gap-2">
              {[
                ['', 'All Resources', total],
                ['EBOOK', 'E-Books', stats?.ebooks ?? 0],
                ['QUESTION_PAPER', 'Question Papers', stats?.papers ?? 0],
                ['RESEARCH_PAPER', 'Research Papers', stats?.research ?? 0],
                ['OTHER', 'Other', stats?.other ?? 0],
              ].map(([id, label, count]) => (
                <button
                  key={String(id)}
                  type="button"
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-sm',
                    filters.bucket === id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600',
                  )}
                  onClick={() =>
                    setFilters({ ...filters, bucket: String(id), assetType: '', page: 1 })
                  }
                >
                  {label} ({count})
                </button>
              ))}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                setFilters({ ...filters, search: draftSearch, page: 1 });
              }}
            >
              <Input
                placeholder="Search by title, author, subject..."
                value={draftSearch}
                onChange={(event) => setDraftSearch(event.target.value)}
              />
              <Button type="submit" variant="outline">
                <Search className="h-4 w-4" />
              </Button>
              <Button type="button" variant="outline" onClick={() => setGrid((value) => !value)}>
                {grid ? 'Table' : 'Grid'}
              </Button>
            </form>
          </div>
          <div className="grid gap-2 border-b px-4 py-3 md:grid-cols-5">
            <select
              className="h-10 rounded-md border px-2 text-sm"
              value={filters.departmentId}
              onChange={(event) =>
                setFilters({ ...filters, departmentId: event.target.value, page: 1 })
              }
            >
              <option value="">All Departments</option>
              {(stats?.departments ?? []).map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border px-2 text-sm"
              value={filters.assetType}
              onChange={(event) =>
                setFilters({ ...filters, assetType: event.target.value, bucket: '', page: 1 })
              }
            >
              <option value="">All Types</option>
              {ASSET_TYPES.map((type) => (
                <option key={type} value={type}>
                  {labelType(type)}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border px-2 text-sm"
              value={filters.status}
              onChange={(event) => setFilters({ ...filters, status: event.target.value, page: 1 })}
            >
              <option value="">All Status</option>
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Draft</option>
              <option value="ARCHIVED">Archived</option>
            </select>
            <select
              className="h-10 rounded-md border px-2 text-sm"
              value={filters.year}
              onChange={(event) => setFilters({ ...filters, year: event.target.value, page: 1 })}
            >
              <option value="">All years added</option>
              {(stats?.years ?? []).map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFilters({
                  search: '',
                  bucket: '',
                  assetType: '',
                  departmentId: '',
                  status: '',
                  year: '',
                  page: 1,
                });
                setDraftSearch('');
              }}
            >
              Clear Filters
            </Button>
          </div>
          <p className="px-4 pt-3 text-sm text-slate-500">
            {digital.data?.total
              ? `Showing ${digital.data.from}–${digital.data.to} of ${digital.data.total}`
              : digital.isLoading
                ? 'Loading resources…'
                : 'No resources match these filters.'}
          </p>
          {grid ? (
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((asset) => (
                <article key={asset.id} className="rounded-xl border p-3">
                  <h3 className="font-medium">{asset.title}</h3>
                  <p className="text-sm text-slate-500">
                    {asset.author || '—'} · {labelType(asset.assetType)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {asset.departmentName || '—'} · {asset.addedYear || '—'}
                  </p>
                  <p className="mt-1 text-sm">{asset.downloadCount ?? 0} downloads</p>
                  <AssetActions
                    asset={asset}
                    canManage={canManage}
                    onPublish={(id) => publishMut.mutate(id)}
                  />
                </article>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Author</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Department / Subject</th>
                    <th className="px-3 py-2" title="Year the file was added">
                      Year added
                    </th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Downloads</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((asset, index) => (
                    <tr key={asset.id} className="border-t">
                      <td className="px-3 py-2 text-slate-500">
                        {(filters.page - 1) * 20 + index + 1}
                      </td>
                      <td className="px-3 py-2 font-medium">{asset.title}</td>
                      <td className="px-3 py-2">{asset.author || '—'}</td>
                      <td className="px-3 py-2">
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                          {labelType(asset.assetType)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {asset.departmentName || asset.category?.name || '—'}
                      </td>
                      <td className="px-3 py-2">{asset.addedYear || '—'}</td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs',
                            asset.status === 'PUBLISHED'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-600',
                          )}
                        >
                          {asset.status}
                        </span>
                      </td>
                      <td className="px-3 py-2">{asset.downloadCount ?? 0}</td>
                      <td className="px-3 py-2">
                        <AssetActions
                          asset={asset}
                          canManage={canManage}
                          onPublish={(id) => publishMut.mutate(id)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex justify-end gap-2 border-t px-4 py-3 text-sm">
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page <= 1}
              onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
            >
              Previous
            </Button>
            <span className="self-center">
              {filters.page} / {pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page >= pages}
              onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
            >
              Next
            </Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Research Repository</h1>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <div className="rounded-lg border p-4">
        <h2 className="mb-3 text-sm font-medium">Submit research</h2>
        <div className="grid gap-2 md:grid-cols-2">
          <Input
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <select
            className="rounded-md border px-2 py-2 text-sm"
            value={form.assetType}
            onChange={(e) => setForm({ ...form, assetType: e.target.value })}
          >
            {RESEARCH_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <Input
            placeholder="Abstract"
            value={form.abstract}
            className="md:col-span-2"
            onChange={(e) => setForm({ ...form, abstract: e.target.value })}
          />
          <input ref={fileRef} type="file" accept=".pdf" className="text-sm md:col-span-2" />
          <Button disabled={!form.title || uploadMut.isPending} onClick={() => uploadMut.mutate()}>
            Upload draft
          </Button>
        </div>
      </div>

      {(pending.data?.length ?? 0) > 0 ? (
        <div>
          <h2 className="mb-2 text-sm font-medium">Pending review ({pending.data?.length})</h2>
          <ul className="space-y-2">
            {pending.data?.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-sm"
              >
                <span>
                  {item.title} · {item.itemType}
                </span>
                <span className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => reviewMut.mutate({ id: item.id, action: 'APPROVE' })}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => reviewMut.mutate({ id: item.id, action: 'REJECT' })}
                  >
                    Reject
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <h2 className="mb-2 text-sm font-medium">Repository ({research.data?.total ?? 0})</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left">Title</th>
                <th className="p-2 text-left">Type</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {research.data?.items.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="p-2">{item.title}</td>
                  <td className="p-2">{item.itemType}</td>
                  <td className="p-2">{item.status}</td>
                  <td className="p-2">
                    {item.status === 'DRAFT' || item.status === 'REJECTED' ? (
                      <Button size="sm" variant="outline" onClick={() => submitMut.mutate(item.id)}>
                        Submit
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function labelType(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function share(value: number | undefined) {
  return value == null ? '—' : `${value}% of total`;
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  hint: string;
  tone: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{hint}</p>
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm"
        onClick={onClick}
      >
        {body}
      </button>
    );
  }
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm">
      {body}
    </div>
  );
}

function AssetActions({
  asset,
  canManage,
  onPublish,
}: {
  asset: LibraryDigitalAsset;
  canManage: boolean;
  onPublish: (id: string) => void;
}) {
  return (
    <div className="flex gap-1">
      {asset.fileName ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            void downloadDigitalAsset(asset.id).then((blob) =>
              downloadBlob(blob, asset.fileName || `${asset.title}.bin`),
            );
          }}
        >
          Download
        </Button>
      ) : null}
      {canManage && asset.status === 'DRAFT' ? (
        <Button type="button" size="sm" variant="outline" onClick={() => onPublish(asset.id)}>
          Publish
        </Button>
      ) : null}
    </div>
  );
}
