'use client';

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { GlassCard } from '@/components/erp/glass-card';
import { Button } from '@/components/ui/button';
import { useInstitutionBranding } from '@/hooks/use-institution-branding';
import { fetchIdCardIssues, fetchIdCardPrintRequests, generateIdCard } from '@/services/id-cards';
import type { StaffProfile } from '@/types/staff';
import { apiErrorMessage } from '@/utils/api-error';
import {
  buildStaffIdCardModelFromProfile,
  staffHolderTypeForGenerate,
} from './build-staff-id-card-model-from-profile';
import { IdCardStudio } from './id-card-studio';

type Props = {
  profile: StaffProfile;
};

export function AdminStaffIdCardPanel({ profile }: Props) {
  const { branding, isLoading: brandLoading } = useInstitutionBranding();
  const qc = useQueryClient();

  const requestsQ = useQuery({
    queryKey: ['staff', profile.id, 'id-card-print-requests'],
    queryFn: () =>
      fetchIdCardPrintRequests('PENDING').then((rows) =>
        rows.filter((r) => r.staffProfileId === profile.id),
      ),
  });

  const issuesQ = useQuery({
    queryKey: ['staff', profile.id, 'id-card-issues'],
    queryFn: () =>
      fetchIdCardIssues({ staffProfileId: profile.id }).then((rows) =>
        rows.filter((r) => ['GENERATED', 'PRINTED', 'ASSIGNED'].includes(r.status)),
      ),
  });

  const activeIssue = issuesQ.data?.[0] ?? null;

  const generateMut = useMutation({
    mutationFn: () =>
      generateIdCard({
        holderType: staffHolderTypeForGenerate(profile.staffType),
        staffProfileId: profile.id,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['staff', profile.id, 'id-card-issues'] });
      void qc.invalidateQueries({ queryKey: ['id-cards'] });
    },
  });

  const model = useMemo(
    () =>
      buildStaffIdCardModelFromProfile({
        profile,
        branding: branding ?? undefined,
        cardNumber: activeIssue?.cardNumber ?? null,
      }),
    [profile, branding, activeIssue?.cardNumber],
  );

  const pendingCount = requestsQ.data?.filter((r) => r.status === 'PENDING').length ?? 0;

  return (
    <div className="space-y-4">
      {pendingCount > 0 ? (
        <GlassCard className="border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            {pendingCount} pending print request{pendingCount > 1 ? 's' : ''}
          </p>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {requestsQ.data
              ?.filter((r) => r.status === 'PENDING')
              .slice(0, 5)
              .map((r) => (
                <li key={r.id}>
                  {r.requestType === 'REPRINT' ? 'Reprint' : 'New card'}
                  {r.note ? ` — ${r.note}` : ''}
                  <span className="ml-1 text-[10px] opacity-70">
                    ({new Date(r.submittedAt).toLocaleDateString()})
                  </span>
                </li>
              ))}
          </ul>
        </GlassCard>
      ) : null}

      {!activeIssue ? (
        <GlassCard className="border-primary/20 bg-primary/5 p-4">
          <p className="text-sm text-muted-foreground">
            No active card issue yet. Generate a card record to assign a verification QR number
            (e.g. DBC-STF-2026-0001).
          </p>
          <Button
            className="mt-3 rounded-xl"
            size="sm"
            disabled={generateMut.isPending}
            onClick={() => generateMut.mutate()}
          >
            {generateMut.isPending ? 'Generating…' : 'Generate card record'}
          </Button>
          {generateMut.isError ? (
            <p className="mt-2 text-xs text-destructive">
              {apiErrorMessage(generateMut.error, 'Could not generate card record')}
            </p>
          ) : null}
        </GlassCard>
      ) : (
        <GlassCard className="p-3 text-xs text-muted-foreground">
          Card number:{' '}
          <span className="font-mono font-medium text-foreground">{activeIssue.cardNumber}</span>
          {' · '}
          Status: {activeIssue.status}
        </GlassCard>
      )}

      <IdCardStudio canPrint model={model} loading={brandLoading} holderType="STAFF" />
    </div>
  );
}
