'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRequireAuth } from '@/hooks/use-auth';

export default function ComplianceReportsPage() {
  const session = useRequireAuth();
  if (!session) return null;

  return (
    <DashboardShell role="admin" title="Compliance Reports">
      <Card>
        <CardHeader>
          <CardTitle>Accreditation & compliance exports</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          NAAC, NBA, AICTE, and UGC export packs will be generated via background jobs.
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
