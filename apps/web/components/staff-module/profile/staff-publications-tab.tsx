'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { NaacEvidenceTagButton } from '@/components/naac-iqac-module/naac-evidence-tag-button';
import { SectionCard } from '@/components/student-profile/student-profile-shell';
import { buttonVariants } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
import {
  createStaffPublication,
  deleteStaffPublication,
  fetchStaffPublications,
} from '@/services/staff';
import type { StaffProfile } from '@/types/staff';
import { PUBLICATION_TYPES } from '@/types/staff';
import { apiErrorMessage } from '@/utils/api-error';
import { formatShortDate } from '@/utils/format-date';
import { cn } from '@/utils/cn';

const emptyForm = () => ({
  title: '',
  publicationType: 'JOURNAL',
  journal: '',
  isbnIssn: '',
  doi: '',
  coAuthors: '',
  indexedIn: '',
  publishedAt: '',
});

export function StaffPublicationsTab({
  profile,
  canEdit,
}: {
  profile: StaffProfile;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState('');

  const pubs = useQuery({
    queryKey: ['staff', profile.id, 'publications'],
    queryFn: () => fetchStaffPublications(profile.id),
  });

  const createMut = useMutation({
    mutationFn: () => createStaffPublication(profile.id, form),
    onSuccess: () => {
      setForm(emptyForm());
      setError('');
      void qc.invalidateQueries({ queryKey: ['staff', profile.id, 'publications'] });
      void qc.invalidateQueries({ queryKey: ['staff', profile.id, 'profile'] });
    },
    onError: (e) => setError(apiErrorMessage(e, 'Failed to add publication')),
  });

  const deleteMut = useMutation({
    mutationFn: (pubId: string) => deleteStaffPublication(profile.id, pubId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['staff', profile.id, 'publications'] });
      void qc.invalidateQueries({ queryKey: ['staff', profile.id, 'profile'] });
    },
  });

  const inputClass = 'h-8 w-full rounded-md border border-input bg-background px-2 text-xs';

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <SectionCard title="Publications" description="Research and publication records">
        {pubs.isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : (pubs.data ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground">No publications recorded.</p>
        ) : (
          <ul className="space-y-2">
            {(pubs.data ?? []).map((pub) => (
              <li key={pub.id} className="rounded-md border border-border/60 p-2 text-xs">
                <p className="font-medium">{pub.title}</p>
                <p className="text-muted-foreground">
                  {pub.publicationType}
                  {pub.journal ? ` · ${pub.journal}` : ''}
                  {pub.publishedAt ? ` · ${formatShortDate(pub.publishedAt)}` : ''}
                </p>
                {pub.doi ? (
                  <p className="text-[10px] text-muted-foreground">DOI: {pub.doi}</p>
                ) : null}
                {canEdit ? (
                  <button
                    type="button"
                    className="mt-1 text-[10px] text-destructive hover:underline"
                    onClick={() => deleteMut.mutate(pub.id)}
                  >
                    Remove
                  </button>
                ) : null}
                <NaacEvidenceTagButton
                  sourceType="staff_publication"
                  sourceId={pub.id}
                  label="Tag NAAC"
                  defaultCriterion={3}
                  defaultDepartmentId={profile.departmentId ?? undefined}
                  defaultActivityTitle={pub.title}
                  defaultEvidenceNotes={`${pub.publicationType}${pub.journal ? ` — ${pub.journal}` : ''}`}
                />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {canEdit ? (
        <SectionCard title="Add publication" description="Journal, conference, book, or patent">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="sm:col-span-2 text-xs">
              Title
              <input
                className={cn(inputClass, 'mt-1')}
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </label>
            <label className="text-xs">
              Type
              <select
                className={cn(inputClass, 'mt-1')}
                value={form.publicationType}
                onChange={(e) => setForm((f) => ({ ...f, publicationType: e.target.value }))}
              >
                {PUBLICATION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              Published date
              <DateInput
                className="mt-1"
                value={form.publishedAt}
                onChange={(publishedAt) => setForm((f) => ({ ...f, publishedAt }))}
              />
            </label>
            <label className="sm:col-span-2 text-xs">
              Journal / Conference
              <input
                className={cn(inputClass, 'mt-1')}
                value={form.journal}
                onChange={(e) => setForm((f) => ({ ...f, journal: e.target.value }))}
              />
            </label>
            <label className="text-xs">
              ISBN / ISSN
              <input
                className={cn(inputClass, 'mt-1')}
                value={form.isbnIssn}
                onChange={(e) => setForm((f) => ({ ...f, isbnIssn: e.target.value }))}
              />
            </label>
            <label className="text-xs">
              DOI
              <input
                className={cn(inputClass, 'mt-1')}
                value={form.doi}
                onChange={(e) => setForm((f) => ({ ...f, doi: e.target.value }))}
              />
            </label>
            <label className="sm:col-span-2 text-xs">
              Co-authors
              <input
                className={cn(inputClass, 'mt-1')}
                value={form.coAuthors}
                onChange={(e) => setForm((f) => ({ ...f, coAuthors: e.target.value }))}
              />
            </label>
            <label className="sm:col-span-2 text-xs">
              Indexed in
              <input
                className={cn(inputClass, 'mt-1')}
                value={form.indexedIn}
                onChange={(e) => setForm((f) => ({ ...f, indexedIn: e.target.value }))}
              />
            </label>
          </div>
          {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
          <button
            type="button"
            disabled={!form.title.trim() || createMut.isPending}
            className={cn(buttonVariants({ size: 'sm' }), 'mt-3 h-7 text-xs')}
            onClick={() => createMut.mutate()}
          >
            Add publication
          </button>
        </SectionCard>
      ) : null}
    </div>
  );
}
