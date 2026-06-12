'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { SectionCard } from '@/components/student-profile/student-profile-shell';
import { buttonVariants } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
import { createStaffAward, deleteStaffAward, fetchStaffAwards } from '@/services/staff';
import type { StaffProfile } from '@/types/staff';
import { AWARD_LEVELS } from '@/types/staff';
import { apiErrorMessage } from '@/utils/api-error';
import { formatShortDate } from '@/utils/format-date';
import { cn } from '@/utils/cn';

const emptyForm = () => ({
  title: '',
  organization: '',
  level: 'COLLEGE',
  awardDate: '',
  description: '',
});

export function StaffAwardsTab({ profile, canEdit }: { profile: StaffProfile; canEdit: boolean }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState('');

  const awards = useQuery({
    queryKey: ['staff', profile.id, 'awards'],
    queryFn: () => fetchStaffAwards(profile.id),
  });

  const createMut = useMutation({
    mutationFn: () => createStaffAward(profile.id, form),
    onSuccess: () => {
      setForm(emptyForm());
      setError('');
      void qc.invalidateQueries({ queryKey: ['staff', profile.id, 'awards'] });
      void qc.invalidateQueries({ queryKey: ['staff', profile.id, 'profile'] });
    },
    onError: (e) => setError(apiErrorMessage(e, 'Failed to add award')),
  });

  const deleteMut = useMutation({
    mutationFn: (awardId: string) => deleteStaffAward(profile.id, awardId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['staff', profile.id, 'awards'] });
      void qc.invalidateQueries({ queryKey: ['staff', profile.id, 'profile'] });
    },
  });

  const inputClass = 'h-8 w-full rounded-md border border-input bg-background px-2 text-xs';

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <SectionCard title="Awards & recognition" description="Honours and achievements">
        {awards.isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : (awards.data ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground">No awards recorded.</p>
        ) : (
          <ul className="space-y-2">
            {(awards.data ?? []).map((award) => (
              <li key={award.id} className="rounded-md border border-border/60 p-2 text-xs">
                <p className="font-medium">{award.title}</p>
                <p className="text-muted-foreground">
                  {award.level?.replace(/_/g, ' ')}
                  {award.organization ? ` · ${award.organization}` : ''}
                  {award.awardDate ? ` · ${formatShortDate(award.awardDate)}` : ''}
                </p>
                {award.description ? (
                  <p className="mt-1 text-[10px] text-muted-foreground">{award.description}</p>
                ) : null}
                {canEdit ? (
                  <button
                    type="button"
                    className="mt-1 text-[10px] text-destructive hover:underline"
                    onClick={() => deleteMut.mutate(award.id)}
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {canEdit ? (
        <SectionCard title="Add award" description="Recognition entry">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="sm:col-span-2 text-xs">
              Award title
              <input
                className={cn(inputClass, 'mt-1')}
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </label>
            <label className="text-xs">
              Level
              <select
                className={cn(inputClass, 'mt-1')}
                value={form.level}
                onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
              >
                {AWARD_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l.charAt(0) + l.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              Award date
              <DateInput
                className="mt-1"
                value={form.awardDate}
                onChange={(awardDate) => setForm((f) => ({ ...f, awardDate }))}
              />
            </label>
            <label className="sm:col-span-2 text-xs">
              Organization
              <input
                className={cn(inputClass, 'mt-1')}
                value={form.organization}
                onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))}
              />
            </label>
            <label className="sm:col-span-2 text-xs">
              Description
              <textarea
                className={cn(inputClass, 'mt-1 min-h-[60px] py-1')}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
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
            Add award
          </button>
        </SectionCard>
      ) : null}
    </div>
  );
}
