'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { StaffAttendanceStudio } from '@/components/staff-module/attendance/staff-attendance-studio';
import { useRequireAuth } from '@/hooks/use-auth';

type PageKind =
  | 'dashboard'
  | 'live'
  | 'processing'
  | 'register'
  | 'daily'
  | 'monthly'
  | 'late'
  | 'leave'
  | 'corrections'
  | 'devices'
  | 'sync'
  | 'mappings'
  | 'upload'
  | 'rules'
  | 'shift-rules'
  | 'reports'
  | 'audit'
  | 'inspector'
  | 'settings';

const SECTION_MAP: Record<string, { title: string; page: PageKind; redirectTo?: string }> = {
  'pull-logs': { title: 'Pull Logs', page: 'processing' },
  process: { title: 'Process Attendance', page: 'processing' },
  reprocess: { title: 'Reprocess Attendance', page: 'processing' },
  'processing-queue': { title: 'Processing Queue', page: 'processing' },
  'missing-punch': { title: 'Missing Punch Handling', page: 'corrections' },
  'reports/daily': { title: 'Daily Report', page: 'reports' },
  'reports/monthly': { title: 'Monthly Report', page: 'reports' },
  'reports/late': { title: 'Late Report', page: 'late' },
  'reports/ot': { title: 'OT Report', page: 'late' },
  'reports/shift': { title: 'Shift Report', page: 'reports' },
  'reports/department': { title: 'Department Report', page: 'reports' },
  'reports/device-log': { title: 'Device Log Report', page: 'reports' },
  'attendance-master': { title: 'Attendance Master', page: 'settings' },
  'shift-assignment': { title: 'Shift Assignment', page: 'settings' },
  'leave-types': { title: 'Leave Types', page: 'settings' },
  'public-holidays': {
    title: 'Public Holidays',
    page: 'settings',
    redirectTo: '/admin/academics/academic-calendar',
  },
  'processing-rules': { title: 'Processing Rules', page: 'rules' },
};

export default function StaffAttendanceSectionPage({
  params,
}: {
  params: Promise<{ section: string[] }>;
}) {
  const { section } = use(params);
  const session = useRequireAuth();
  const router = useRouter();
  const key = section.join('/');
  const target = SECTION_MAP[key] ?? { title: 'Staff Attendance', page: 'dashboard' as PageKind };

  useEffect(() => {
    if (!session || !target.redirectTo) return;
    router.replace(target.redirectTo);
  }, [session, router, target.redirectTo]);

  if (!session) return null;

  if (target.redirectTo) {
    return (
      <DashboardShell role="admin" title={target.title}>
        <p className="text-sm text-muted-foreground">Redirecting to Academic Calendar…</p>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell role="admin" title={target.title}>
      <StaffAttendanceStudio page={target.page} />
    </DashboardShell>
  );
}
