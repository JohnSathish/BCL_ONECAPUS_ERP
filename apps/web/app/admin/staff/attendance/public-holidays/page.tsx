'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';

/** Legacy Attendance holiday master — redirects to ERP Academic Calendar. */
export default function PublicHolidaysRedirectPage() {
  const session = useRequireAuth();
  const router = useRouter();

  useEffect(() => {
    if (!session) return;
    router.replace('/admin/academics/academic-calendar');
  }, [session, router]);

  if (!session) return null;

  return (
    <DashboardShell role="admin" title="Public Holidays">
      <p className="text-sm text-muted-foreground">Redirecting to Academics → Academic Calendar…</p>
    </DashboardShell>
  );
}
