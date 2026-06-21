'use client';

import Link from 'next/link';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';

export default function Page() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="staff" title="Examinations">
      <div className="rounded-2xl border border-border/60 bg-card p-6 text-sm">
        <p className="font-medium">University end-semester exams are managed by NEHU.</p>
        <p className="mt-2 text-muted-foreground">
          Use the Internal Assessment portal for mark entry on your assigned subjects.
        </p>
        <Link
          href="/staff/academic/ia"
          className="mt-4 inline-block rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Open IA Mark Entry →
        </Link>
      </div>
    </DashboardShell>
  );
}
