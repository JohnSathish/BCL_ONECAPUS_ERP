'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

import { DirectoryRegistrationBadge } from '@/components/students-module/directory/ui/directory-registration-badge';
import { DirectoryStatusPill } from '@/components/students-module/directory/ui/directory-status-pill';
import { fetchStudentProfile } from '@/services/students';
import type { StudentDirectoryRow } from '@/types/students';
import { cn } from '@/utils/cn';

type Props = {
  row: StudentDirectoryRow;
  expanded: boolean;
};

const NEP_BUCKETS = ['MDC', 'AEC', 'SEC', 'VAC', 'VTC'] as const;

function slugToLabel(slug: string) {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-[11px]">
      <dt className="w-28 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 font-medium">{value}</dd>
    </div>
  );
}

export function DirectoryRowPreview({ row, expanded }: Props) {
  const profile = useQuery({
    queryKey: ['students', 'profile', row.id],
    queryFn: () => fetchStudentProfile(row.id),
    enabled: expanded,
    staleTime: 60_000,
  });

  const choices = profile.data?.programChoices ?? [];
  const major = choices.find((c) => c.choiceType === 'MAJOR');
  const minor = choices.find((c) => c.choiceType === 'MINOR');

  const enrollments = profile.data?.sectionEnrollments ?? [];
  const currentSemEnrollments = enrollments.filter((e) => e.semesterSequence === row.semester);
  const bucketMap = Object.fromEntries(
    NEP_BUCKETS.map((b) => [b, currentSemEnrollments.filter((e) => e.category === b)]),
  ) as Record<(typeof NEP_BUCKETS)[number], typeof currentSemEnrollments>;

  const guardians = profile.data?.guardians ?? [];
  const primaryGuardian = guardians[0];
  const pendingDocs =
    profile.data?.documents?.filter(
      (d) => d.verificationStatus !== 'verified' && d.verificationStatus !== 'approved',
    ).length ?? 0;

  return (
    <div className="grid gap-3 lg:grid-cols-4">
      <section className="space-y-1.5 rounded-lg border border-border/40 bg-background/40 p-2.5">
        <h4 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Programme & subjects
        </h4>
        {profile.isLoading ? (
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading…
          </p>
        ) : (
          <dl className="space-y-1">
            <InfoRow
              label="Major"
              value={major ? slugToLabel(major.subjectSlug) : row.majorSubject}
            />
            <InfoRow label="Minor" value={minor ? slugToLabel(minor.subjectSlug) : null} />
            {NEP_BUCKETS.map((bucket) => {
              const items = bucketMap[bucket];
              if (!items?.length) return null;
              return (
                <div key={bucket} className="flex gap-2 text-[11px]">
                  <dt className="w-28 shrink-0 text-muted-foreground">{bucket}</dt>
                  <dd className="min-w-0 truncate font-medium">
                    {items.map((i) => i.courseCode).join(', ')}
                  </dd>
                </div>
              );
            })}
          </dl>
        )}
        <DirectoryRegistrationBadge status={row.registrationStatus} />
      </section>

      <section className="space-y-1.5 rounded-lg border border-border/40 bg-background/40 p-2.5">
        <h4 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Identity & contact
        </h4>
        <dl className="space-y-1">
          <InfoRow label="Aadhaar" value={profile.data?.nationalId ?? '—'} />
          <InfoRow label="Email" value={row.email} />
          <InfoRow label="Mobile" value={row.mobileNumber} />
          <InfoRow
            label="Guardian"
            value={
              primaryGuardian
                ? `${primaryGuardian.fullName ?? 'Guardian'}${primaryGuardian.contactNumber ? ` · ${primaryGuardian.contactNumber}` : ''}`
                : null
            }
          />
          <InfoRow label="Admission batch" value={row.batch} />
        </dl>
      </section>

      <section className="space-y-1.5 rounded-lg border border-border/40 bg-background/40 p-2.5">
        <h4 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Academic metrics
        </h4>
        <dl className="space-y-1">
          <InfoRow label="Attendance" value="—" />
          <InfoRow label="Fee due" value="—" />
          <InfoRow
            label="RFID"
            value={row.rfidNumber ? `Assigned · ${row.rfidNumber}` : 'Not assigned'}
          />
          <InfoRow label="Last login" value="—" />
          <InfoRow
            label="Documents"
            value={pendingDocs > 0 ? `${pendingDocs} pending` : 'Up to date'}
          />
        </dl>
      </section>

      <section className="flex flex-col justify-between gap-2 rounded-lg border border-border/40 bg-background/40 p-2.5">
        <div>
          <h4 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Status
          </h4>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <DirectoryStatusPill label={row.studentStatus ?? row.academicStatus} />
          </div>
        </div>
        <Link
          href={`/admin/students/${row.id}`}
          className={cn(
            'inline-flex text-[11px] font-medium text-primary underline-offset-2 hover:underline',
          )}
        >
          Open full profile →
        </Link>
      </section>
    </div>
  );
}
