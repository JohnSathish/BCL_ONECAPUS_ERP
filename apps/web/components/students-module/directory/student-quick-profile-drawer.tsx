'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Loader2 } from 'lucide-react';

import {
  student360Score,
  studentHealthSignals,
} from '@/components/students-module/directory/directory-student-health';
import { DirectoryRegistrationBadge } from '@/components/students-module/directory/ui/directory-registration-badge';
import { DirectoryStatusPill } from '@/components/students-module/directory/ui/directory-status-pill';
import { DirectoryStudentAvatar } from '@/components/students-module/directory/ui/directory-student-avatar';
import { useStudentNameFormat } from '@/components/providers/student-name-format-provider';
import { FilterDrawerShell } from '@/components/erp/filter-drawer-shell';
import { Button } from '@/components/ui/button';
import { fetchStudentProfile } from '@/services/students';
import type { StudentDirectoryRow } from '@/types/students';
import { cn } from '@/utils/cn';

type Props = {
  row: StudentDirectoryRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function ProfileRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/40 py-2.5 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[58%] text-right font-medium">{value?.trim() ? value : '—'}</span>
    </div>
  );
}

export function StudentQuickProfileDrawer({ row, open, onOpenChange }: Props) {
  const { formatStudentName } = useStudentNameFormat();
  const profile = useQuery({
    queryKey: ['students', 'profile', row?.id],
    queryFn: () => fetchStudentProfile(row!.id),
    enabled: open && Boolean(row?.id),
    staleTime: 60_000,
  });

  if (!row) return null;

  const displayName = formatStudentName(row.displayFullName ?? row.fullName);

  const score = student360Score(row);
  const signals = studentHealthSignals(row);
  const docCount = profile.data?.documents?.length ?? 0;
  const base = `/admin/students/${row.id}`;

  const SCORE_STYLES = {
    good: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    warn: 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200',
    bad: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  };

  return (
    <FilterDrawerShell
      open={open}
      onOpenChange={onOpenChange}
      title={displayName}
      description="Quick student profile"
      footer={
        <div className="flex gap-2">
          <Button asChild variant="outline" className="flex-1">
            <Link href={base}>Open full profile</Link>
          </Button>
          <Button asChild className="flex-1">
            <Link href={`${base}?tab=edit`}>
              Edit
              <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-3 pb-4">
        <DirectoryStudentAvatar row={row} size="lg" />
        <div className="text-center">
          <p className="font-mono text-xs text-muted-foreground">{row.enrollmentNumber}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            <DirectoryStatusPill label={row.studentStatus ?? row.academicStatus} />
            <DirectoryRegistrationBadge status={row.registrationStatus} />
          </div>
        </div>
        <span
          className={cn(
            'inline-flex rounded-full border px-3 py-1 text-xs font-semibold',
            SCORE_STYLES[score.tone],
          )}
        >
          Student 360 · {score.label} ({score.score}%)
        </span>
      </div>

      <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Health indicators
        </p>
        <div className="flex flex-wrap gap-1.5">
          {signals.map((s) => (
            <span
              key={s.key}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border border-border/50 px-2 py-0.5 text-[10px] font-medium',
                s.tone === 'good' && 'border-emerald-500/30 bg-emerald-500/10',
                s.tone === 'warn' && 'border-amber-500/30 bg-amber-500/10',
                s.tone === 'bad' && 'border-rose-500/30 bg-rose-500/10',
              )}
            >
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {profile.isLoading ? (
        <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading profile…
        </p>
      ) : (
        <div className="mt-2">
          <ProfileRow label="Reg No" value={row.enrollmentNumber} />
          <ProfileRow label="Roll No" value={row.rollNumber} />
          <ProfileRow label="Programme" value={row.programme} />
          <ProfileRow
            label="Major"
            value={row.majorSubject ? `Major: ${row.majorSubject}` : null}
          />
          <ProfileRow label="Semester" value={`Sem ${row.semester}`} />
          <ProfileRow label="Shift" value={row.shift} />
          <ProfileRow label="Mobile" value={row.mobileNumber ?? profile.data?.mobileNumber} />
          <ProfileRow label="Email" value={profile.data?.email ?? row.email} />
          <ProfileRow
            label="Attendance"
            value={
              row.attendancePercent != null
                ? `${row.attendancePercent}%${row.attendanceEligibility ? ` · ${row.attendanceEligibility}` : ''}`
                : '—'
            }
          />
          <ProfileRow
            label="Fees"
            value={
              row.feeStatus === 'CLEAR' || (row.feeDueAmount ?? 0) <= 0
                ? 'Paid'
                : `Due · ₹${(row.feeDueAmount ?? 0).toLocaleString()} (${row.feeStatus ?? 'DUE'})`
            }
          />
          <ProfileRow label="Certificates" value={docCount > 0 ? String(docCount) : '0'} />
          <ProfileRow
            label="Residence"
            value={
              row.isHosteller
                ? `Hosteller${row.hostelBlock ? ` · ${row.hostelBlock}` : ''}${row.hostelRoom ? ` ${row.hostelRoom}` : ''}`
                : row.residenceType === 'DAY_SCHOLAR'
                  ? 'Day scholar'
                  : '—'
            }
          />
          <ProfileRow label="RFID" value={row.rfidNumber ? 'Assigned' : 'Not assigned'} />
        </div>
      )}
    </FilterDrawerShell>
  );
}
