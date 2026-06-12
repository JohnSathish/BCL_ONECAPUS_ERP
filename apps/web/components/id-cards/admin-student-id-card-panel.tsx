'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { GlassCard } from '@/components/erp/glass-card';
import { useInstitutionBranding } from '@/hooks/use-institution-branding';
import { fetchIdCardPrintRequests } from '@/services/id-cards';
import type { StudentProfile } from '@/types/students';
import { buildStudentIdCardModelFromProfile } from './build-student-id-card-model-from-profile';
import { StudentIdCardStudio } from './id-card-studio';

type Props = {
  profile: StudentProfile;
};

export function AdminStudentIdCardPanel({ profile }: Props) {
  const { branding, isLoading: brandLoading } = useInstitutionBranding();

  const requestsQ = useQuery({
    queryKey: ['students', profile.id, 'id-card-print-requests'],
    queryFn: () =>
      fetchIdCardPrintRequests('PENDING').then((rows) =>
        rows.filter((r) => r.studentId === profile.id),
      ),
  });

  const model = useMemo(
    () =>
      buildStudentIdCardModelFromProfile({
        profile,
        branding: branding ?? undefined,
      }),
    [profile, branding],
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

      <StudentIdCardStudio canPrint model={model} loading={brandLoading} />
    </div>
  );
}
