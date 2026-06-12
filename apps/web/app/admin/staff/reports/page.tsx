'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { AnimatedCounter } from '@/components/dashboard/animated-counter';
import { useRequireAuth } from '@/hooks/use-auth';
import { useStaffPermissions } from '@/hooks/use-staff-permissions';
import { fetchEnhancedStaffSummary } from '@/services/staff';

export default function StaffReportsPage() {
  const session = useRequireAuth();
  const perms = useStaffPermissions();

  const summary = useQuery({
    queryKey: ['staff', 'summary', 'enhanced'],
    queryFn: fetchEnhancedStaffSummary,
    enabled: Boolean(session) && perms.canRead,
  });

  if (!session) return null;

  const s = summary.data;

  const metrics = [
    { label: 'Total staff', value: s?.total ?? 0 },
    { label: 'Teaching', value: s?.teaching ?? 0 },
    { label: 'Non-teaching', value: s?.nonTeaching ?? 0 },
    { label: 'Guest / Visiting', value: s?.guest ?? 0 },
    { label: 'Departments', value: s?.departments ?? 0 },
    { label: 'Portal active', value: s?.activeAccounts ?? 0 },
    { label: 'Portal pending', value: s?.pendingActivation ?? 0 },
    { label: 'On leave', value: s?.onLeave ?? 0 },
    { label: 'RFID assigned', value: s?.rfidAssigned ?? 0 },
    { label: 'Timetable assigned', value: s?.timetableAssigned ?? 0 },
  ];

  return (
    <DashboardShell role="admin" title="Staff Reports">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Staff module KPIs and operational reports. Export detailed lists from the Staff Directory.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map((m) => (
            <CompactCard key={m.label}>
              <CompactCardBody>
                <p className="text-[11px] text-muted-foreground">{m.label}</p>
                <p className="text-2xl font-bold">
                  <AnimatedCounter value={m.value} />
                </p>
              </CompactCardBody>
            </CompactCard>
          ))}
        </div>

        <CompactCard>
          <CompactCardHeader title="Exports" description="CSV export from directory" />
          <CompactCardBody>
            <Link href="/admin/staff" className="text-sm text-primary hover:underline">
              Open Staff Directory to export →
            </Link>
          </CompactCardBody>
        </CompactCard>

        <Link href="/admin/staff" className="text-sm text-primary hover:underline">
          ← Back to Staff Directory
        </Link>
      </div>
    </DashboardShell>
  );
}
