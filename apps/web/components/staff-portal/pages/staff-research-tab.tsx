'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createMyAward,
  createMyPublication,
  deleteMyAward,
  deleteMyPublication,
  fetchMyAwards,
  fetchMyPublications,
  updateMyAward,
  updateMyPublication,
  type StaffAward,
  type StaffAwardPayload,
  type StaffPublication,
  type StaffPublicationPayload,
} from '@/services/staff';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

const PUB_TYPES = ['JOURNAL', 'CONFERENCE', 'BOOK', 'CHAPTER', 'PATENT', 'RESEARCH_PAPER'] as const;
const AWARD_LEVELS = ['INTERNATIONAL', 'NATIONAL', 'STATE', 'UNIVERSITY', 'COLLEGE'] as const;

const inputCls =
  'w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-1';

function PublicationForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: Partial<StaffPublicationPayload>;
  onSave: (v: StaffPublicationPayload) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<StaffPublicationPayload>({
    title: initial?.title ?? '',
    publicationType: initial?.publicationType ?? 'JOURNAL',
    journal: initial?.journal ?? '',
    doi: initial?.doi ?? '',
    coAuthors: initial?.coAuthors ?? '',
    indexedIn: initial?.indexedIn ?? '',
    isbnIssn: initial?.isbnIssn ?? '',
    publishedAt: initial?.publishedAt?.slice(0, 10) ?? '',
  });

  const set = <K extends keyof StaffPublicationPayload>(k: K, v: StaffPublicationPayload[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="rounded-xl border border-border/50 bg-muted/20 p-4 flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls}>Title *</label>
          <input
            className={inputCls}
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Publication title"
          />
        </div>
        <div>
          <label className={labelCls}>Type *</label>
          <select
            className={inputCls}
            value={form.publicationType}
            onChange={(e) => set('publicationType', e.target.value)}
          >
            {PUB_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Journal / Venue</label>
          <input
            className={inputCls}
            value={form.journal ?? ''}
            onChange={(e) => set('journal', e.target.value)}
            placeholder="Journal or conference name"
          />
        </div>
        <div>
          <label className={labelCls}>DOI</label>
          <input
            className={inputCls}
            value={form.doi ?? ''}
            onChange={(e) => set('doi', e.target.value)}
            placeholder="10.xxxx/..."
          />
        </div>
        <div>
          <label className={labelCls}>Published Date</label>
          <input
            className={inputCls}
            type="date"
            value={form.publishedAt ?? ''}
            onChange={(e) => set('publishedAt', e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>Co-Authors</label>
          <input
            className={inputCls}
            value={form.coAuthors ?? ''}
            onChange={(e) => set('coAuthors', e.target.value)}
            placeholder="Comma separated names"
          />
        </div>
        <div>
          <label className={labelCls}>Indexed In</label>
          <input
            className={inputCls}
            value={form.indexedIn ?? ''}
            onChange={(e) => set('indexedIn', e.target.value)}
            placeholder="Scopus, SCI, UGC CARE…"
          />
        </div>
        <div>
          <label className={labelCls}>ISBN / ISSN</label>
          <input
            className={inputCls}
            value={form.isbnIssn ?? ''}
            onChange={(e) => set('isbnIssn', e.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition"
          disabled={saving || !form.title.trim()}
          onClick={() => onSave(form)}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          className="rounded-lg border border-border/50 px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50 transition"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function AwardForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: Partial<StaffAwardPayload>;
  onSave: (v: StaffAwardPayload) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<StaffAwardPayload>({
    title: initial?.title ?? '',
    organization: initial?.organization ?? '',
    level: initial?.level ?? '',
    awardDate: initial?.awardDate?.slice(0, 10) ?? '',
    description: initial?.description ?? '',
  });

  const set = <K extends keyof StaffAwardPayload>(k: K, v: StaffAwardPayload[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="rounded-xl border border-border/50 bg-muted/20 p-4 flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls}>Award Title *</label>
          <input
            className={inputCls}
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Award name"
          />
        </div>
        <div>
          <label className={labelCls}>Awarding Organisation</label>
          <input
            className={inputCls}
            value={form.organization ?? ''}
            onChange={(e) => set('organization', e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>Level</label>
          <select
            className={inputCls}
            value={form.level ?? ''}
            onChange={(e) => set('level', e.target.value)}
          >
            <option value="">Select level</option>
            {AWARD_LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Date</label>
          <input
            className={inputCls}
            type="date"
            value={form.awardDate ?? ''}
            onChange={(e) => set('awardDate', e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <input
            className={inputCls}
            value={form.description ?? ''}
            onChange={(e) => set('description', e.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition"
          disabled={saving || !form.title.trim()}
          onClick={() => onSave(form)}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          className="rounded-lg border border-border/50 px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50 transition"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function StaffResearchTab({
  profileData,
}: {
  profileData?: Record<string, unknown> | null;
}) {
  const qc = useQueryClient();
  const pubQ = useQuery({
    queryKey: ['staff-portal', 'me', 'publications'],
    queryFn: fetchMyPublications,
  });
  const awardQ = useQuery({ queryKey: ['staff-portal', 'me', 'awards'], queryFn: fetchMyAwards });

  const [addingPub, setAddingPub] = useState(false);
  const [editingPub, setEditingPub] = useState<string | null>(null);
  const [addingAward, setAddingAward] = useState(false);
  const [editingAward, setEditingAward] = useState<string | null>(null);

  const createPubMut = useMutation({
    mutationFn: createMyPublication,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['staff-portal', 'me', 'publications'] });
      setAddingPub(false);
    },
  });
  const updatePubMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<StaffPublicationPayload> }) =>
      updateMyPublication(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['staff-portal', 'me', 'publications'] });
      setEditingPub(null);
    },
  });
  const deletePubMut = useMutation({
    mutationFn: deleteMyPublication,
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ['staff-portal', 'me', 'publications'] }),
  });
  const createAwardMut = useMutation({
    mutationFn: createMyAward,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['staff-portal', 'me', 'awards'] });
      setAddingAward(false);
    },
  });
  const updateAwardMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<StaffAwardPayload> }) =>
      updateMyAward(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['staff-portal', 'me', 'awards'] });
      setEditingAward(null);
    },
  });
  const deleteAwardMut = useMutation({
    mutationFn: deleteMyAward,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['staff-portal', 'me', 'awards'] }),
  });

  const scholar = profileData?.googleScholarUrl as string | undefined;
  const orcid = profileData?.orcidUrl as string | undefined;
  const researchAreas = profileData?.researchAreas as string | undefined;

  return (
    <div className="flex flex-col gap-8">
      {/* Scholar / ORCID links */}
      {(scholar || orcid || researchAreas) && (
        <div className="flex flex-wrap gap-3 rounded-xl border border-border/50 bg-muted/20 p-4">
          {researchAreas && (
            <div className="w-full">
              <span className="text-xs font-semibold text-muted-foreground">Research Areas: </span>
              <span className="text-sm">{researchAreas}</span>
            </div>
          )}
          {scholar && (
            <a
              href={scholar}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-background px-3 py-1.5 text-xs font-medium text-primary hover:bg-muted/50 transition"
            >
              Google Scholar ↗
            </a>
          )}
          {orcid && (
            <a
              href={orcid}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-background px-3 py-1.5 text-xs font-medium text-primary hover:bg-muted/50 transition"
            >
              ORCID ↗
            </a>
          )}
        </div>
      )}

      {/* Publications */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold">Publications</h3>
          {!addingPub && (
            <button
              className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition"
              onClick={() => setAddingPub(true)}
            >
              + Add
            </button>
          )}
        </div>

        {addingPub && (
          <div className="mb-3">
            <PublicationForm
              onSave={(v) => createPubMut.mutate(v)}
              onCancel={() => setAddingPub(false)}
              saving={createPubMut.isPending}
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          {pubQ.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {pubQ.data?.length === 0 && !addingPub && (
            <p className="text-sm text-muted-foreground">
              No publications yet. Add your first one.
            </p>
          )}
          {pubQ.data?.map((pub) => (
            <div key={pub.id} className="rounded-xl border border-border/50 bg-background p-4">
              {editingPub === pub.id ? (
                <PublicationForm
                  initial={pub}
                  onSave={(v) => updatePubMut.mutate({ id: pub.id, payload: v })}
                  onCancel={() => setEditingPub(null)}
                  saving={updatePubMut.isPending}
                />
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-semibold">{pub.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {pub.publicationType}
                      {pub.journal ? ` · ${pub.journal}` : ''}
                      {pub.publishedAt ? ` · ${new Date(pub.publishedAt).getFullYear()}` : ''}
                    </p>
                    {pub.indexedIn && (
                      <p className="text-xs text-muted-foreground">Indexed: {pub.indexedIn}</p>
                    )}
                    {pub.doi && (
                      <a
                        href={`https://doi.org/${pub.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        DOI: {pub.doi}
                      </a>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      className="rounded px-2 py-1 text-xs text-muted-foreground hover:text-primary hover:bg-muted/50 transition"
                      onClick={() => setEditingPub(pub.id)}
                    >
                      Edit
                    </button>
                    <button
                      className="rounded px-2 py-1 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                      onClick={() => deletePubMut.mutate(pub.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Awards */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold">Awards & Recognitions</h3>
          {!addingAward && (
            <button
              className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition"
              onClick={() => setAddingAward(true)}
            >
              + Add
            </button>
          )}
        </div>

        {addingAward && (
          <div className="mb-3">
            <AwardForm
              onSave={(v) => createAwardMut.mutate(v)}
              onCancel={() => setAddingAward(false)}
              saving={createAwardMut.isPending}
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          {awardQ.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {awardQ.data?.length === 0 && !addingAward && (
            <p className="text-sm text-muted-foreground">
              No awards recorded yet. Add your first one.
            </p>
          )}
          {awardQ.data?.map((award) => (
            <div key={award.id} className="rounded-xl border border-border/50 bg-background p-4">
              {editingAward === award.id ? (
                <AwardForm
                  initial={award}
                  onSave={(v) => updateAwardMut.mutate({ id: award.id, payload: v })}
                  onCancel={() => setEditingAward(null)}
                  saving={updateAwardMut.isPending}
                />
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-semibold">{award.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {award.level ?? ''}
                      {award.organization ? ` · ${award.organization}` : ''}
                      {award.awardDate ? ` · ${new Date(award.awardDate).getFullYear()}` : ''}
                    </p>
                    {award.description && (
                      <p className="text-xs text-muted-foreground">{award.description}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      className="rounded px-2 py-1 text-xs text-muted-foreground hover:text-primary hover:bg-muted/50 transition"
                      onClick={() => setEditingAward(award.id)}
                    >
                      Edit
                    </button>
                    <button
                      className="rounded px-2 py-1 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                      onClick={() => deleteAwardMut.mutate(award.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
