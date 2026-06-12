'use client';

import { useMemo } from 'react';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Sem1MigrationStudio } from '@/components/students-module/sem-1-migration-studio';
import { useRequireAuth } from '@/hooks/use-auth';

export default function Sem1MigrationPage() {
  const session = useRequireAuth();

  const canAccess = useMemo(
    () =>
      session?.user.roles.some((r) =>
        ['college-admin', 'super-admin', 'university-admin'].includes(r),
      ) ?? false,
    [session],
  );

  if (!session) return null;

  if (!canAccess) {
    return (
      <DashboardShell role="admin" title="Sem 1 Migration">
        <p className="text-sm text-muted-foreground">
          You do not have permission to access this page.
        </p>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell role="admin" title="Sem 1 Migration">
      <Sem1MigrationStudio />
    </DashboardShell>
  );
}
