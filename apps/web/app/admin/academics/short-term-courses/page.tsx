'use client';

import { Suspense } from 'react';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ShortTermCoursesWorkspace } from '@/components/short-term-courses/short-term-courses-workspace';
import { useRequireAuth } from '@/hooks/use-auth';

export default function AdminShortTermCoursesPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Short-Term Courses">
      <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>
        <ShortTermCoursesWorkspace />
      </Suspense>
    </DashboardShell>
  );
}
