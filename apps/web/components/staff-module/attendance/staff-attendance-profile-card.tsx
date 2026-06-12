'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Activity, Clock3, Fingerprint, RadioTower, ShieldCheck } from 'lucide-react';

import { SectionCard } from '@/components/student-profile/student-profile-shell';
import { buttonVariants } from '@/components/ui/button';
import { fetchStaffAttendanceProfileSummary } from '@/services/staff-attendance';
import type { StaffProfile } from '@/types/staff';
import { cn } from '@/utils/cn';

export function StaffAttendanceProfileCard({ profile }: { profile: StaffProfile }) {
  const summary = useQuery({
    queryKey: ['staff-attendance', 'profile-summary', profile.id],
    queryFn: () => fetchStaffAttendanceProfileSummary(profile.id),
  });
  const mapping = summary.data?.mapping;
  const lastPunch = summary.data?.lastPunch;
  const latestRecord = summary.data?.latestRecord;

  return (
    <SectionCard
      title="Attendance & Biometrics"
      description="Biometric identity, assigned device, sync status, last punch, and attendance summary"
    >
      <div className="grid gap-3 lg:grid-cols-4">
        <Metric
          icon={<Fingerprint className="h-4 w-4" />}
          label="Biometric ID"
          value={mapping?.biometricId ?? profile.biometricId ?? '-'}
        />
        <Metric
          icon={<RadioTower className="h-4 w-4" />}
          label="Device User ID"
          value={mapping?.deviceUserId ?? profile.biometricExternalUserId ?? '-'}
        />
        <Metric
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Sync Status"
          value={mapping?.syncStatus ?? profile.biometricSyncStatus ?? 'Not mapped'}
        />
        <Metric
          icon={<Clock3 className="h-4 w-4" />}
          label="Last Punch"
          value={formatDateTime(lastPunch?.punchTimestamp)}
        />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Assigned Device
          </p>
          <p className="mt-1 text-sm font-semibold">
            {mapping?.device?.name ?? profile.biometricDeviceId ?? 'No device mapped'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Status: {mapping?.device?.status ?? 'Pending mapping'}
          </p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Latest Attendance
          </p>
          <p className="mt-1 text-sm font-semibold">
            {latestRecord?.status ?? 'No processed record yet'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Worked {latestRecord?.workedMinutes ?? 0} minutes · Late{' '}
            {latestRecord?.lateMinutes ?? 0} · OT {latestRecord?.overtimeMinutes ?? 0}
          </p>
        </div>
      </div>

      {summary.isLoading ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Loading biometric attendance summary...
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/admin/staff/attendance/mappings"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-2')}
        >
          <Fingerprint className="h-4 w-4" />
          Manage Mapping
        </Link>
        <Link
          href="/admin/staff/attendance/live"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-2')}
        >
          <Activity className="h-4 w-4" />
          Live Punches
        </Link>
        <Link
          href="/admin/staff/attendance/daily"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-2')}
        >
          Daily Register
        </Link>
      </div>
    </SectionCard>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold">{value}</p>
    </div>
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
