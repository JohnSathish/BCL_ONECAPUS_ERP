'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRequireAuth } from '@/hooks/use-auth';
import { StatCard } from '@/modules/dashboard/stat-card';

type Role = 'admin' | 'faculty' | 'student' | 'parent' | 'accountant' | 'librarian';

export function ModulePlaceholder({
  role,
  title,
  heading,
  description,
}: {
  role: Role;
  title: string;
  heading: string;
  description: string;
}) {
  const session = useRequireAuth();
  if (!session) return null;

  return (
    <DashboardShell role={role} title={title}>
      <Card>
        <CardHeader>
          <CardTitle>{heading}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">{description}</CardContent>
      </Card>
    </DashboardShell>
  );
}

export function RoleDashboard({ role, title }: { role: Role; title: string }) {
  const session = useRequireAuth();
  if (!session) return null;

  return (
    <DashboardShell role={role} title={title}>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Notifications" value="0" description="Unread" />
        <StatCard title="Tasks" value="—" description="Pending workflows" />
        <StatCard title="Tenant" value={session.user.tenantSlug} />
      </div>
    </DashboardShell>
  );
}
