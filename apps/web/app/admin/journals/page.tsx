'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRequireAuth } from '@/hooks/use-auth';
import {
  adminDecideSubmission,
  adminInviteReviewer,
  adminPublishSubmission,
  adminAdvanceProduction,
  adminStartProduction,
  adminUploadSubmissionFile,
  createAdminAnnouncement,
  createAdminArticle,
  createAdminBoardMember,
  createAdminDownload,
  createAdminIssue,
  createAdminVolume,
  deleteAdminBoardMember,
  deleteAdminDownload,
  deleteAdminMedia,
  depositArticleDoi,
  fetchAdminAnnouncements,
  fetchAdminArticles,
  fetchAdminBoard,
  fetchAdminDownloads,
  fetchAdminJournals,
  fetchAdminMedia,
  fetchAdminPages,
  fetchAdminProduction,
  fetchAdminSubmissions,
  fetchAdminVolumes,
  fetchCrossrefSettings,
  reserveArticleDoi,
  seedAdminJournals,
  updateAdminJournal,
  updateCrossrefSettings,
  uploadAdminMedia,
  uploadSimilarityReport,
  upsertAdminPage,
  type JournalInfo,
  type JournalSubmission,
} from '@/services/journals-portal';
import { apiErrorMessage } from '@/utils/api-error';

type Tab =
  | 'branding'
  | 'pages'
  | 'announcements'
  | 'board'
  | 'downloads'
  | 'media'
  | 'volumes'
  | 'articles'
  | 'submissions'
  | 'production'
  | 'doi';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'branding', label: 'Branding & Settings' },
  { id: 'pages', label: 'Pages' },
  { id: 'announcements', label: 'Announcements' },
  { id: 'board', label: 'Board' },
  { id: 'downloads', label: 'Downloads' },
  { id: 'media', label: 'Media' },
  { id: 'volumes', label: 'Volumes & Issues' },
  { id: 'articles', label: 'Articles' },
  { id: 'submissions', label: 'Submissions' },
  { id: 'production', label: 'Production' },
  { id: 'doi', label: 'DOI settings' },
];

const BOARD_TYPE_FILTERS = [
  { value: '', label: 'All' },
  { value: 'CHIEF_PATRON', label: 'Chief Patron' },
  { value: 'PATRON', label: 'Patron' },
  { value: 'CHIEF_EDITOR', label: 'Chief Editor' },
  { value: 'COMMITTEE', label: 'Committee' },
  { value: 'ADVISORY', label: 'Advisory' },
  { value: 'EDITORIAL', label: 'Editorial' },
  { value: 'BOARD', label: 'Board' },
  { value: 'MANAGING', label: 'Managing' },
  { value: 'PUBLISHER', label: 'Publisher' },
  { value: 'OFFICE', label: 'Office' },
];

export default function AdminJournalsPage() {
  const session = useRequireAuth();
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const [selectedId, setSelectedId] = useState<string>('');
  const [tab, setTab] = useState<Tab>('branding');

  const journalsQ = useQuery({
    queryKey: ['admin-journals'],
    queryFn: fetchAdminJournals,
    enabled: Boolean(session),
  });

  const journals = journalsQ.data ?? [];
  const activeId = selectedId || journals[0]?.id || '';
  const active = useMemo(
    () => journals.find((j) => j.id === activeId) ?? null,
    [journals, activeId],
  );

  const seed = useMutation({
    mutationFn: seedAdminJournals,
    onSuccess: () => {
      setMessage('Transient and Source journals seeded.');
      void qc.invalidateQueries({ queryKey: ['admin-journals'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Seed failed')),
  });

  return (
    <DashboardShell title="Journals" subtitle="Multi-journal CMS — branding, pages, board, issues">
      <div className="space-y-4">
        {message ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {message}
          </p>
        ) : null}

        <CompactCard>
          <CompactCardHeader
            title="Journals"
            description="Select a journal to manage CMS content"
          />
          <CompactCardBody>
            <div className="mb-3">
              <Button
                size="sm"
                variant="outline"
                disabled={seed.isPending}
                onClick={() => seed.mutate()}
              >
                Seed Transient + Source
              </Button>
            </div>
            {journalsQ.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : journals.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No journals yet. Click “Seed Transient + Source” to create defaults for this tenant.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {journals.map((j) => (
                  <button
                    key={j.id}
                    type="button"
                    onClick={() => setSelectedId(j.id)}
                    className={`rounded-md border px-3 py-1.5 text-sm ${
                      j.id === activeId
                        ? 'border-primary bg-primary/10 font-semibold'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    {j.shortName || j.name}
                    {j.issn ? ` · ${j.issn}` : ''}
                  </button>
                ))}
              </div>
            )}
          </CompactCardBody>
        </CompactCard>

        {active ? (
          <>
            <div className="flex flex-wrap gap-1 border-b border-border pb-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`rounded-t-md px-3 py-2 text-sm ${
                    tab === t.id
                      ? 'bg-muted font-semibold text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'branding' ? (
              <BrandingTab
                key={active.id}
                journal={active}
                onSaved={() => {
                  setMessage('Journal settings saved.');
                  void qc.invalidateQueries({ queryKey: ['admin-journals'] });
                }}
                onError={(m) => setMessage(m)}
              />
            ) : null}
            {tab === 'pages' ? <PagesTab journalId={active.id} onMessage={setMessage} /> : null}
            {tab === 'announcements' ? (
              <AnnouncementsTab journalId={active.id} onMessage={setMessage} />
            ) : null}
            {tab === 'board' ? <BoardTab journalId={active.id} onMessage={setMessage} /> : null}
            {tab === 'downloads' ? (
              <DownloadsTab journalId={active.id} onMessage={setMessage} />
            ) : null}
            {tab === 'media' ? <MediaTab journalId={active.id} onMessage={setMessage} /> : null}
            {tab === 'volumes' ? <VolumesTab journalId={active.id} onMessage={setMessage} /> : null}
            {tab === 'articles' ? (
              <ArticlesTab journalId={active.id} onMessage={setMessage} />
            ) : null}
            {tab === 'submissions' ? (
              <SubmissionsTab journalId={active.id} onMessage={setMessage} />
            ) : null}
            {tab === 'production' ? (
              <ProductionTab journalId={active.id} onMessage={setMessage} />
            ) : null}
            {tab === 'doi' ? <DoiSettingsTab journalId={active.id} onMessage={setMessage} /> : null}
          </>
        ) : null}
      </div>
    </DashboardShell>
  );
}

function BrandingTab({
  journal,
  onSaved,
  onError,
}: {
  journal: JournalInfo;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const [form, setForm] = useState({
    name: journal.name,
    shortName: journal.shortName,
    issn: journal.issn ?? '',
    tagline: journal.tagline ?? '',
    description: journal.description ?? '',
    contactEmail: journal.contactEmail ?? '',
    contactPhone: journal.contactPhone ?? '',
    logoUrl: journal.logoUrl ?? '',
    bannerUrl: journal.bannerUrl ?? '',
  });

  const save = useMutation({
    mutationFn: () => updateAdminJournal(journal.id, form),
    onSuccess: onSaved,
    onError: (e) => onError(apiErrorMessage(e, 'Save failed')),
  });

  return (
    <CompactCard>
      <CompactCardHeader title={`${journal.name} — branding`} />
      <CompactCardBody className="grid gap-3 md:grid-cols-2">
        {(
          [
            ['name', 'Name'],
            ['shortName', 'Short name'],
            ['issn', 'ISSN'],
            ['tagline', 'Tagline'],
            ['contactEmail', 'Contact email'],
            ['contactPhone', 'Contact phone'],
            ['logoUrl', 'Logo URL'],
            ['bannerUrl', 'Banner URL'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block text-sm">
            <span className="mb-1 block text-muted-foreground">{label}</span>
            <Input
              value={form[key]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
            />
          </label>
        ))}
        <label className="block text-sm md:col-span-2">
          <span className="mb-1 block text-muted-foreground">Description</span>
          <textarea
            className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </label>
        <div className="md:col-span-2">
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            Save branding
          </Button>
        </div>
      </CompactCardBody>
    </CompactCard>
  );
}

function PagesTab({ journalId, onMessage }: { journalId: string; onMessage: (m: string) => void }) {
  const qc = useQueryClient();
  const pagesQ = useQuery({
    queryKey: ['admin-journal-pages', journalId],
    queryFn: () => fetchAdminPages(journalId),
  });
  const [key, setKey] = useState('about');
  const [title, setTitle] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [seoKeywords, setSeoKeywords] = useState('');

  const save = useMutation({
    mutationFn: () =>
      upsertAdminPage(journalId, {
        key,
        title,
        bodyHtml,
        isPublished: true,
        seoTitle: seoTitle || null,
        seoDescription: seoDescription || null,
        seoKeywords: seoKeywords
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      onMessage('Page saved.');
      void qc.invalidateQueries({ queryKey: ['admin-journal-pages', journalId] });
    },
    onError: (e) => onMessage(apiErrorMessage(e, 'Page save failed')),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CompactCard>
        <CompactCardHeader title="Existing pages" />
        <CompactCardBody className="space-y-2">
          {(pagesQ.data ?? []).map((p) => (
            <button
              key={p.id}
              type="button"
              className="block w-full rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted/40"
              onClick={() => {
                setKey(p.key);
                setTitle(p.title);
                setBodyHtml(p.bodyHtml ?? '');
                setSeoTitle(p.seoTitle ?? '');
                setSeoDescription(p.seoDescription ?? '');
                setSeoKeywords((p.seoKeywords ?? []).join(', '));
              }}
            >
              <span className="font-medium">{p.title}</span>
              <span className="ml-2 text-xs text-muted-foreground">({p.key})</span>
            </button>
          ))}
        </CompactCardBody>
      </CompactCard>
      <CompactCard>
        <CompactCardHeader title="Edit page" />
        <CompactCardBody className="space-y-3">
          <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="key" />
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
          <textarea
            className="min-h-[180px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
            placeholder="HTML body"
          />
          <Input
            value={seoTitle}
            onChange={(e) => setSeoTitle(e.target.value)}
            placeholder="SEO title"
          />
          <Input
            value={seoDescription}
            onChange={(e) => setSeoDescription(e.target.value)}
            placeholder="SEO description"
          />
          <Input
            value={seoKeywords}
            onChange={(e) => setSeoKeywords(e.target.value)}
            placeholder="SEO keywords (comma-separated)"
          />
          <Button disabled={save.isPending || !key || !title} onClick={() => save.mutate()}>
            Save page
          </Button>
        </CompactCardBody>
      </CompactCard>
    </div>
  );
}

function AnnouncementsTab({
  journalId,
  onMessage,
}: {
  journalId: string;
  onMessage: (m: string) => void;
}) {
  const qc = useQueryClient();
  const listQ = useQuery({
    queryKey: ['admin-journal-announcements', journalId],
    queryFn: () => fetchAdminAnnouncements(journalId),
  });
  const [title, setTitle] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const create = useMutation({
    mutationFn: () => createAdminAnnouncement(journalId, { title, bodyHtml, isPinned: false }),
    onSuccess: () => {
      onMessage('Announcement created.');
      setTitle('');
      setBodyHtml('');
      void qc.invalidateQueries({ queryKey: ['admin-journal-announcements', journalId] });
    },
    onError: (e) => onMessage(apiErrorMessage(e, 'Create failed')),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CompactCard>
        <CompactCardHeader title="Announcements" />
        <CompactCardBody className="space-y-2">
          {((listQ.data as Array<{ id: string; title: string }>) ?? []).map((a) => (
            <div key={a.id} className="rounded-md border border-border px-3 py-2 text-sm">
              {a.title}
            </div>
          ))}
        </CompactCardBody>
      </CompactCard>
      <CompactCard>
        <CompactCardHeader title="New announcement" />
        <CompactCardBody className="space-y-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
          <textarea
            className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
            placeholder="HTML body"
          />
          <Button disabled={!title || create.isPending} onClick={() => create.mutate()}>
            Create
          </Button>
        </CompactCardBody>
      </CompactCard>
    </div>
  );
}

function BoardTab({ journalId, onMessage }: { journalId: string; onMessage: (m: string) => void }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('');
  const listQ = useQuery({
    queryKey: ['admin-journal-board', journalId, filter],
    queryFn: () => fetchAdminBoard(journalId, filter || undefined),
  });
  const [form, setForm] = useState({
    fullName: '',
    roleTitle: '',
    boardType: 'EDITORIAL',
    institution: '',
    email: '',
  });
  const create = useMutation({
    mutationFn: () => createAdminBoardMember(journalId, form),
    onSuccess: () => {
      onMessage('Board member added.');
      setForm({
        fullName: '',
        roleTitle: '',
        boardType: 'EDITORIAL',
        institution: '',
        email: '',
      });
      void qc.invalidateQueries({ queryKey: ['admin-journal-board', journalId] });
    },
    onError: (e) => onMessage(apiErrorMessage(e, 'Create failed')),
  });
  const remove = useMutation({
    mutationFn: (memberId: string) => deleteAdminBoardMember(journalId, memberId),
    onSuccess: () => {
      onMessage('Board member removed.');
      void qc.invalidateQueries({ queryKey: ['admin-journal-board', journalId] });
    },
    onError: (e) => onMessage(apiErrorMessage(e, 'Delete failed')),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CompactCard>
        <CompactCardHeader title="Board members" />
        <CompactCardBody className="space-y-3">
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {BOARD_TYPE_FILTERS.map((f) => (
              <option key={f.value || 'all'} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          {(listQ.data ?? []).map((m) => (
            <div
              key={m.id}
              className="flex items-start justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">{m.fullName}</p>
                <p className="text-xs text-muted-foreground">
                  {m.roleTitle} · {m.boardType}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={remove.isPending}
                onClick={() => remove.mutate(m.id)}
              >
                Remove
              </Button>
            </div>
          ))}
        </CompactCardBody>
      </CompactCard>
      <CompactCard>
        <CompactCardHeader title="Add member" />
        <CompactCardBody className="space-y-3">
          <Input
            placeholder="Full name"
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
          />
          <Input
            placeholder="Role title"
            value={form.roleTitle}
            onChange={(e) => setForm((f) => ({ ...f, roleTitle: e.target.value }))}
          />
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.boardType}
            onChange={(e) => setForm((f) => ({ ...f, boardType: e.target.value }))}
          >
            {BOARD_TYPE_FILTERS.filter((f) => f.value).map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <Input
            placeholder="Institution"
            value={form.institution}
            onChange={(e) => setForm((f) => ({ ...f, institution: e.target.value }))}
          />
          <Input
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <Button
            disabled={!form.fullName || !form.roleTitle || create.isPending}
            onClick={() => create.mutate()}
          >
            Add member
          </Button>
        </CompactCardBody>
      </CompactCard>
    </div>
  );
}

function DownloadsTab({
  journalId,
  onMessage,
}: {
  journalId: string;
  onMessage: (m: string) => void;
}) {
  const qc = useQueryClient();
  const listQ = useQuery({
    queryKey: ['admin-journal-downloads', journalId],
    queryFn: () => fetchAdminDownloads(journalId),
  });
  const [form, setForm] = useState({
    title: '',
    category: 'VOLUME_PDF',
    fileUrl: '',
    fileName: '',
  });
  const create = useMutation({
    mutationFn: () => createAdminDownload(journalId, form),
    onSuccess: () => {
      onMessage('Download added.');
      setForm({ title: '', category: 'VOLUME_PDF', fileUrl: '', fileName: '' });
      void qc.invalidateQueries({ queryKey: ['admin-journal-downloads', journalId] });
    },
    onError: (e) => onMessage(apiErrorMessage(e, 'Create failed')),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteAdminDownload(journalId, id),
    onSuccess: () => {
      onMessage('Download removed.');
      void qc.invalidateQueries({ queryKey: ['admin-journal-downloads', journalId] });
    },
    onError: (e) => onMessage(apiErrorMessage(e, 'Delete failed')),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CompactCard>
        <CompactCardHeader title="Downloads" />
        <CompactCardBody className="space-y-2">
          {(listQ.data ?? []).map((d) => (
            <div
              key={d.id}
              className="flex items-start justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">{d.title}</p>
                <p className="text-xs text-muted-foreground">
                  {d.category} · {d.fileUrl}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={remove.isPending}
                onClick={() => remove.mutate(d.id)}
              >
                Remove
              </Button>
            </div>
          ))}
        </CompactCardBody>
      </CompactCard>
      <CompactCard>
        <CompactCardHeader title="Add download" />
        <CompactCardBody className="space-y-3">
          <Input
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          >
            {['CURRENT_ISSUE', 'VOLUME_PDF', 'GUIDELINE', 'TEMPLATE', 'FORM', 'OTHER'].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <Input
            placeholder="File URL"
            value={form.fileUrl}
            onChange={(e) => setForm((f) => ({ ...f, fileUrl: e.target.value }))}
          />
          <Input
            placeholder="File name"
            value={form.fileName}
            onChange={(e) => setForm((f) => ({ ...f, fileName: e.target.value }))}
          />
          <Button
            disabled={!form.title || !form.fileUrl || create.isPending}
            onClick={() => create.mutate()}
          >
            Add download
          </Button>
        </CompactCardBody>
      </CompactCard>
    </div>
  );
}

function MediaTab({ journalId, onMessage }: { journalId: string; onMessage: (m: string) => void }) {
  const qc = useQueryClient();
  const listQ = useQuery({
    queryKey: ['admin-journal-media', journalId],
    queryFn: () => fetchAdminMedia(journalId),
  });
  const [kind, setKind] = useState('OTHER');
  const upload = useMutation({
    mutationFn: (file: File) => uploadAdminMedia(journalId, file, kind),
    onSuccess: () => {
      onMessage('Media uploaded.');
      void qc.invalidateQueries({ queryKey: ['admin-journal-media', journalId] });
    },
    onError: (e) => onMessage(apiErrorMessage(e, 'Upload failed')),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteAdminMedia(journalId, id),
    onSuccess: () => {
      onMessage('Media removed.');
      void qc.invalidateQueries({ queryKey: ['admin-journal-media', journalId] });
    },
    onError: (e) => onMessage(apiErrorMessage(e, 'Delete failed')),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CompactCard>
        <CompactCardHeader title="Media library" />
        <CompactCardBody className="space-y-2">
          {(listQ.data ?? []).map((m) => (
            <div
              key={m.id}
              className="flex items-start justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">
                  {m.kind} · {m.fileName || m.publicUrl}
                </p>
                <p className="text-xs text-muted-foreground">{m.publicUrl}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={remove.isPending}
                onClick={() => remove.mutate(m.id)}
              >
                Remove
              </Button>
            </div>
          ))}
        </CompactCardBody>
      </CompactCard>
      <CompactCard>
        <CompactCardHeader title="Upload media" />
        <CompactCardBody className="space-y-3">
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            {['LOGO', 'BANNER', 'COVER', 'PHOTO', 'OTHER'].map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <Input
            type="file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload.mutate(file);
            }}
          />
          {upload.isPending ? <p className="text-xs text-muted-foreground">Uploading…</p> : null}
        </CompactCardBody>
      </CompactCard>
    </div>
  );
}

function VolumesTab({
  journalId,
  onMessage,
}: {
  journalId: string;
  onMessage: (m: string) => void;
}) {
  const qc = useQueryClient();
  const volsQ = useQuery({
    queryKey: ['admin-journal-volumes', journalId],
    queryFn: () => fetchAdminVolumes(journalId),
  });
  const [vol, setVol] = useState({ volumeNumber: 1, year: new Date().getFullYear(), label: '' });
  const [issue, setIssue] = useState({
    volumeId: '',
    issueNumber: 1,
    title: '',
    isCurrent: true,
  });

  const createVol = useMutation({
    mutationFn: () => createAdminVolume(journalId, vol),
    onSuccess: () => {
      onMessage('Volume created.');
      void qc.invalidateQueries({ queryKey: ['admin-journal-volumes', journalId] });
    },
    onError: (e) => onMessage(apiErrorMessage(e, 'Volume create failed')),
  });

  const createIss = useMutation({
    mutationFn: () => createAdminIssue(journalId, issue),
    onSuccess: () => {
      onMessage('Issue created.');
      void qc.invalidateQueries({ queryKey: ['admin-journal-volumes', journalId] });
    },
    onError: (e) => onMessage(apiErrorMessage(e, 'Issue create failed')),
  });

  type VolRow = {
    id: string;
    volumeNumber: number;
    year: number;
    label: string | null;
    issues: Array<{ id: string; issueNumber: number; title: string | null; isCurrent: boolean }>;
  };
  const volumes = (volsQ.data as VolRow[]) ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CompactCard>
        <CompactCardHeader title="Volumes" />
        <CompactCardBody className="space-y-3">
          {volumes.map((v) => (
            <div key={v.id} className="rounded-md border border-border p-3 text-sm">
              <p className="font-medium">
                Vol. {v.volumeNumber} ({v.year}) {v.label ? `— ${v.label}` : ''}
              </p>
              <ul className="mt-1 text-xs text-muted-foreground">
                {v.issues.map((i) => (
                  <li key={i.id}>
                    Issue {i.issueNumber}
                    {i.title ? `: ${i.title}` : ''}
                    {i.isCurrent ? ' (current)' : ''}
                  </li>
                ))}
              </ul>
              <Button
                size="sm"
                variant="ghost"
                className="mt-1"
                onClick={() => setIssue((s) => ({ ...s, volumeId: v.id }))}
              >
                Use for new issue
              </Button>
            </div>
          ))}
        </CompactCardBody>
      </CompactCard>
      <div className="space-y-4">
        <CompactCard>
          <CompactCardHeader title="New volume" />
          <CompactCardBody className="space-y-2">
            <Input
              type="number"
              value={vol.volumeNumber}
              onChange={(e) => setVol((v) => ({ ...v, volumeNumber: Number(e.target.value) || 1 }))}
              placeholder="Volume number"
            />
            <Input
              type="number"
              value={vol.year}
              onChange={(e) => setVol((v) => ({ ...v, year: Number(e.target.value) || 2024 }))}
              placeholder="Year"
            />
            <Input
              value={vol.label}
              onChange={(e) => setVol((v) => ({ ...v, label: e.target.value }))}
              placeholder="Label"
            />
            <Button disabled={createVol.isPending} onClick={() => createVol.mutate()}>
              Create volume
            </Button>
          </CompactCardBody>
        </CompactCard>
        <CompactCard>
          <CompactCardHeader title="New issue" />
          <CompactCardBody className="space-y-2">
            <Input
              value={issue.volumeId}
              onChange={(e) => setIssue((s) => ({ ...s, volumeId: e.target.value }))}
              placeholder="Volume ID"
            />
            <Input
              type="number"
              value={issue.issueNumber}
              onChange={(e) =>
                setIssue((s) => ({ ...s, issueNumber: Number(e.target.value) || 1 }))
              }
            />
            <Input
              value={issue.title}
              onChange={(e) => setIssue((s) => ({ ...s, title: e.target.value }))}
              placeholder="Title"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={issue.isCurrent}
                onChange={(e) => setIssue((s) => ({ ...s, isCurrent: e.target.checked }))}
              />
              Mark as current
            </label>
            <Button
              disabled={!issue.volumeId || createIss.isPending}
              onClick={() => createIss.mutate()}
            >
              Create issue
            </Button>
          </CompactCardBody>
        </CompactCard>
      </div>
    </div>
  );
}

function ArticlesTab({
  journalId,
  onMessage,
}: {
  journalId: string;
  onMessage: (m: string) => void;
}) {
  const qc = useQueryClient();
  const listQ = useQuery({
    queryKey: ['admin-journal-articles', journalId],
    queryFn: () => fetchAdminArticles(journalId),
  });
  const volsQ = useQuery({
    queryKey: ['admin-journal-volumes', journalId],
    queryFn: () => fetchAdminVolumes(journalId),
  });
  const [form, setForm] = useState({
    issueId: '',
    title: '',
    abstract: '',
    authorName: '',
    pageRange: '',
  });

  const create = useMutation({
    mutationFn: () =>
      createAdminArticle(journalId, {
        issueId: form.issueId,
        title: form.title,
        abstract: form.abstract || undefined,
        pageRange: form.pageRange || undefined,
        authors: form.authorName ? [{ fullName: form.authorName, isCorresponding: true }] : [],
      }),
    onSuccess: () => {
      onMessage('Article published.');
      setForm({ issueId: '', title: '', abstract: '', authorName: '', pageRange: '' });
      void qc.invalidateQueries({ queryKey: ['admin-journal-articles', journalId] });
    },
    onError: (e) => onMessage(apiErrorMessage(e, 'Article create failed')),
  });

  type VolRow = {
    issues: Array<{ id: string; issueNumber: number; title: string | null; volumeNumber?: number }>;
    volumeNumber: number;
    year: number;
  };
  const issueOptions = ((volsQ.data as VolRow[]) ?? []).flatMap((v) =>
    v.issues.map((i) => ({
      id: i.id,
      label: `Vol ${v.volumeNumber}/${v.year} · Issue ${i.issueNumber}${i.title ? ` — ${i.title}` : ''}`,
    })),
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CompactCard>
        <CompactCardHeader title="Published articles" />
        <CompactCardBody className="max-h-[420px] space-y-2 overflow-auto">
          {(listQ.data ?? []).map((a) => (
            <div key={a.id} className="rounded-md border border-border px-3 py-2 text-sm">
              <p className="font-medium">{a.title}</p>
              <p className="text-xs text-muted-foreground">
                {(a.authors ?? []).map((x) => x.fullName).join(', ')}
              </p>
            </div>
          ))}
        </CompactCardBody>
      </CompactCard>
      <CompactCard>
        <CompactCardHeader title="Publish article" />
        <CompactCardBody className="space-y-2">
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.issueId}
            onChange={(e) => setForm((f) => ({ ...f, issueId: e.target.value }))}
          >
            <option value="">Select issue…</option>
            {issueOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <Input
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <Input
            placeholder="Author name"
            value={form.authorName}
            onChange={(e) => setForm((f) => ({ ...f, authorName: e.target.value }))}
          />
          <Input
            placeholder="Page range"
            value={form.pageRange}
            onChange={(e) => setForm((f) => ({ ...f, pageRange: e.target.value }))}
          />
          <textarea
            className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Abstract"
            value={form.abstract}
            onChange={(e) => setForm((f) => ({ ...f, abstract: e.target.value }))}
          />
          <Button
            disabled={!form.issueId || !form.title || create.isPending}
            onClick={() => create.mutate()}
          >
            Publish
          </Button>
        </CompactCardBody>
      </CompactCard>
    </div>
  );
}

function SubmissionsTab({
  journalId,
  onMessage,
}: {
  journalId: string;
  onMessage: (m: string) => void;
}) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<JournalSubmission | null>(null);
  const [reviewerEmail, setReviewerEmail] = useState('');
  const [reviewerDueAt, setReviewerDueAt] = useState('');
  const [issueId, setIssueId] = useState('');

  const listQ = useQuery({
    queryKey: ['admin-journal-submissions', journalId],
    queryFn: () => fetchAdminSubmissions(journalId),
  });

  const volsQ = useQuery({
    queryKey: ['admin-journal-volumes', journalId],
    queryFn: () => fetchAdminVolumes(journalId),
  });

  const invite = useMutation({
    mutationFn: () =>
      adminInviteReviewer(journalId, selected!.id, {
        email: reviewerEmail,
        dueAt: reviewerDueAt ? new Date(reviewerDueAt).toISOString() : undefined,
      }),
    onSuccess: () => {
      onMessage('Reviewer invited.');
      setReviewerEmail('');
      setReviewerDueAt('');
      void qc.invalidateQueries({ queryKey: ['admin-journal-submissions', journalId] });
    },
    onError: (e) => onMessage(apiErrorMessage(e, 'Invite failed')),
  });

  const decide = useMutation({
    mutationFn: (decision: string) => adminDecideSubmission(journalId, selected!.id, { decision }),
    onSuccess: () => {
      onMessage('Decision recorded.');
      void qc.invalidateQueries({ queryKey: ['admin-journal-submissions', journalId] });
    },
    onError: (e) => onMessage(apiErrorMessage(e, 'Decision failed')),
  });

  const publish = useMutation({
    mutationFn: () => adminPublishSubmission(journalId, selected!.id, { issueId }),
    onSuccess: () => {
      onMessage('Published to catalog issue.');
      void qc.invalidateQueries({ queryKey: ['admin-journal-submissions', journalId] });
      void qc.invalidateQueries({ queryKey: ['admin-journal-articles', journalId] });
    },
    onError: (e) => onMessage(apiErrorMessage(e, 'Publish failed')),
  });

  type VolRow = {
    volumeNumber: number;
    year: number;
    issues: Array<{ id: string; issueNumber: number; title: string | null }>;
  };
  const issueOptions = ((volsQ.data as VolRow[]) ?? []).flatMap((v) =>
    v.issues.map((i) => ({
      id: i.id,
      label: `Vol ${v.volumeNumber}/${v.year} · Issue ${i.issueNumber}`,
    })),
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CompactCard>
        <CompactCardHeader title="Submission queue" />
        <CompactCardBody className="max-h-[520px] space-y-2 overflow-auto">
          {(listQ.data ?? []).map((s) => (
            <button
              key={s.id}
              type="button"
              className={`block w-full rounded-md border px-3 py-2 text-left text-sm ${
                selected?.id === s.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:bg-muted/40'
              }`}
              onClick={() => setSelected(s)}
            >
              <p className="font-medium">{s.title}</p>
              <p className="text-xs text-muted-foreground">{s.status}</p>
            </button>
          ))}
        </CompactCardBody>
      </CompactCard>
      <CompactCard>
        <CompactCardHeader title="Editorial actions" />
        <CompactCardBody className="space-y-3">
          {!selected ? (
            <p className="text-sm text-muted-foreground">Select a submission.</p>
          ) : (
            <>
              <p className="text-sm font-medium">{selected.title}</p>
              <p className="text-xs text-muted-foreground">
                Status: {selected.status} · Files: {selected.files?.length ?? 0} · Rounds:{' '}
                {selected.rounds?.length ?? 0}
              </p>
              <Input
                placeholder="Reviewer email"
                value={reviewerEmail}
                onChange={(e) => setReviewerEmail(e.target.value)}
              />
              <Input
                type="date"
                value={reviewerDueAt}
                onChange={(e) => setReviewerDueAt(e.target.value)}
                aria-label="Review due date"
              />
              <Button
                size="sm"
                disabled={!reviewerEmail || invite.isPending}
                onClick={() => invite.mutate()}
              >
                Invite reviewer
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => decide.mutate('SEND_TO_REVIEW')}>
                  Send to review
                </Button>
                <Button size="sm" variant="outline" onClick={() => decide.mutate('REVISE')}>
                  Request revision
                </Button>
                <Button size="sm" variant="outline" onClick={() => decide.mutate('ACCEPT')}>
                  Accept
                </Button>
                <Button size="sm" variant="outline" onClick={() => decide.mutate('REJECT')}>
                  Reject
                </Button>
                {selected.status === 'ACCEPTED' ? (
                  <Button
                    size="sm"
                    onClick={() =>
                      adminStartProduction(journalId, selected.id).then(() => {
                        onMessage('Sent to production (COPYEDITING).');
                        void qc.invalidateQueries({
                          queryKey: ['admin-journal-submissions', journalId],
                        });
                        void qc.invalidateQueries({
                          queryKey: ['admin-journal-production', journalId],
                        });
                      })
                    }
                  >
                    Send to production
                  </Button>
                ) : null}
              </div>
              <SimilarityBlock
                journalId={journalId}
                submissionId={selected.id}
                onMessage={onMessage}
              />
              {selected.status === 'READY_TO_PUBLISH' ? (
                <div className="space-y-2 border-t border-border pt-3">
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={issueId}
                    onChange={(e) => setIssueId(e.target.value)}
                  >
                    <option value="">Publish to issue…</option>
                    {issueOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    disabled={!issueId || publish.isPending}
                    onClick={() => publish.mutate()}
                  >
                    Publish to issue
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </CompactCardBody>
      </CompactCard>
    </div>
  );
}

function SimilarityBlock({
  journalId,
  submissionId,
  onMessage,
}: {
  journalId: string;
  submissionId: string;
  onMessage: (m: string) => void;
}) {
  const [score, setScore] = useState('12');
  const [file, setFile] = useState<File | null>(null);
  const upload = useMutation({
    mutationFn: () =>
      uploadSimilarityReport(journalId, submissionId, Number(score), file || undefined),
    onSuccess: () => onMessage('Similarity score/report saved.'),
    onError: (e) => onMessage(apiErrorMessage(e, 'Similarity upload failed')),
  });
  return (
    <div className="space-y-2 border-t border-border pt-3">
      <p className="text-xs font-medium text-muted-foreground">Plagiarism / similarity</p>
      <Input
        type="number"
        min={0}
        max={100}
        value={score}
        onChange={(e) => setScore(e.target.value)}
        placeholder="Score %"
      />
      <Input
        type="file"
        accept=".pdf,application/pdf"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <Button size="sm" disabled={upload.isPending} onClick={() => upload.mutate()}>
        Save similarity
      </Button>
    </div>
  );
}

function ProductionTab({
  journalId,
  onMessage,
}: {
  journalId: string;
  onMessage: (m: string) => void;
}) {
  const qc = useQueryClient();
  const listQ = useQuery({
    queryKey: ['admin-journal-production', journalId],
    queryFn: () => fetchAdminProduction(journalId),
  });
  const advance = useMutation({
    mutationFn: (id: string) => adminAdvanceProduction(journalId, id),
    onSuccess: () => {
      onMessage('Production stage advanced.');
      void qc.invalidateQueries({ queryKey: ['admin-journal-production', journalId] });
    },
    onError: (e) => onMessage(apiErrorMessage(e, 'Advance failed')),
  });
  const skip = useMutation({
    mutationFn: (id: string) => adminAdvanceProduction(journalId, id, { skipToReady: true }),
    onSuccess: () => {
      onMessage('Skipped to READY_TO_PUBLISH.');
      void qc.invalidateQueries({ queryKey: ['admin-journal-production', journalId] });
    },
    onError: (e) => onMessage(apiErrorMessage(e, 'Skip failed')),
  });

  async function onProofUpload(submissionId: string, file: File | null) {
    if (!file) return;
    try {
      await adminUploadSubmissionFile(journalId, submissionId, file, 'PROOF');
      onMessage('Proof file uploaded.');
      void qc.invalidateQueries({ queryKey: ['admin-journal-production', journalId] });
    } catch (e) {
      onMessage(apiErrorMessage(e, 'Proof upload failed'));
    }
  }

  return (
    <CompactCard>
      <CompactCardHeader
        title="Production queue"
        description="COPYEDITING → PROOFING → READY_TO_PUBLISH"
      />
      <CompactCardBody className="space-y-2">
        {(listQ.data ?? []).map((s) => (
          <div
            key={s.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
          >
            <div>
              <p className="font-medium">{s.title}</p>
              <p className="text-xs text-muted-foreground">{s.status}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="cursor-pointer text-xs text-muted-foreground underline">
                Upload proof
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={(e) => void onProofUpload(s.id, e.target.files?.[0] ?? null)}
                />
              </label>
              {s.status === 'ACCEPTED' ? (
                <Button size="sm" variant="outline" onClick={() => skip.mutate(s.id)}>
                  Skip to ready
                </Button>
              ) : null}
              {s.status !== 'READY_TO_PUBLISH' ? (
                <Button size="sm" onClick={() => advance.mutate(s.id)}>
                  Advance
                </Button>
              ) : (
                <span className="text-xs text-emerald-700">Ready to publish</span>
              )}
            </div>
          </div>
        ))}
        {(listQ.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No items in production.</p>
        ) : null}
      </CompactCardBody>
    </CompactCard>
  );
}

function DoiSettingsTab({
  journalId,
  onMessage,
}: {
  journalId: string;
  onMessage: (m: string) => void;
}) {
  const qc = useQueryClient();
  const settingsQ = useQuery({
    queryKey: ['admin-journal-crossref', journalId],
    queryFn: () => fetchCrossrefSettings(journalId),
  });
  const articlesQ = useQuery({
    queryKey: ['admin-journal-articles', journalId],
    queryFn: () => fetchAdminArticles(journalId),
  });
  const [form, setForm] = useState({
    doiPrefix: '',
    crossrefEnabled: false,
    crossrefDepositorName: '',
    crossrefDepositorEmail: '',
    crossrefRegistrant: '',
    crossrefUsername: '',
    crossrefPassword: '',
  });

  useEffect(() => {
    if (settingsQ.data) {
      setForm({
        doiPrefix: settingsQ.data.doiPrefix ?? '10.0000',
        crossrefEnabled: settingsQ.data.crossrefEnabled,
        crossrefDepositorName: settingsQ.data.crossrefDepositorName ?? '',
        crossrefDepositorEmail: settingsQ.data.crossrefDepositorEmail ?? '',
        crossrefRegistrant: settingsQ.data.crossrefRegistrant ?? '',
        crossrefUsername: settingsQ.data.crossrefUsername ?? '',
        crossrefPassword: '',
      });
    }
  }, [settingsQ.data]);

  const save = useMutation({
    mutationFn: () => updateCrossrefSettings(journalId, form),
    onSuccess: () => {
      onMessage('Crossref / DOI settings saved.');
      void qc.invalidateQueries({ queryKey: ['admin-journal-crossref', journalId] });
    },
    onError: (e) => onMessage(apiErrorMessage(e, 'Save failed')),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CompactCard>
        <CompactCardHeader
          title="Crossref settings"
          description="Dry-run deposit if credentials empty"
        />
        <CompactCardBody className="space-y-2">
          <Input
            placeholder="DOI prefix (e.g. 10.xxxxx)"
            value={form.doiPrefix}
            onChange={(e) => setForm((f) => ({ ...f, doiPrefix: e.target.value }))}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.crossrefEnabled}
              onChange={(e) => setForm((f) => ({ ...f, crossrefEnabled: e.target.checked }))}
            />
            Enable live Crossref deposit
          </label>
          <Input
            placeholder="Depositor name"
            value={form.crossrefDepositorName}
            onChange={(e) => setForm((f) => ({ ...f, crossrefDepositorName: e.target.value }))}
          />
          <Input
            placeholder="Depositor email"
            value={form.crossrefDepositorEmail}
            onChange={(e) => setForm((f) => ({ ...f, crossrefDepositorEmail: e.target.value }))}
          />
          <Input
            placeholder="Registrant"
            value={form.crossrefRegistrant}
            onChange={(e) => setForm((f) => ({ ...f, crossrefRegistrant: e.target.value }))}
          />
          <Input
            placeholder="Crossref username"
            value={form.crossrefUsername}
            onChange={(e) => setForm((f) => ({ ...f, crossrefUsername: e.target.value }))}
          />
          <Input
            type="password"
            placeholder="Crossref password (leave blank to keep)"
            value={form.crossrefPassword}
            onChange={(e) => setForm((f) => ({ ...f, crossrefPassword: e.target.value }))}
          />
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            Save settings
          </Button>
        </CompactCardBody>
      </CompactCard>
      <CompactCard>
        <CompactCardHeader title="Mint DOI on articles" />
        <CompactCardBody className="max-h-[420px] space-y-2 overflow-auto">
          {(articlesQ.data ?? []).map((a) => (
            <div
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">{a.title}</p>
                <p className="text-xs text-muted-foreground">{a.doi || 'No DOI'}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    reserveArticleDoi(journalId, a.id).then(() => {
                      onMessage('DOI reserved.');
                      void qc.invalidateQueries({
                        queryKey: ['admin-journal-articles', journalId],
                      });
                    })
                  }
                >
                  Reserve
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    depositArticleDoi(journalId, a.id).then(() => {
                      onMessage('DOI deposited (or dry-run).');
                      void qc.invalidateQueries({
                        queryKey: ['admin-journal-articles', journalId],
                      });
                    })
                  }
                >
                  Deposit
                </Button>
              </div>
            </div>
          ))}
        </CompactCardBody>
      </CompactCard>
    </div>
  );
}
