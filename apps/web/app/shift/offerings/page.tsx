'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRequireAuth } from '@/hooks/use-auth';

export default function ShiftOfferingsPage() {
  const session = useRequireAuth();
  if (!session) return null;

  return (
    <DashboardShell role="shift" title="Shift offerings">
      <Card>
        <CardHeader>
          <CardTitle>Offerings & sections</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Section management is scoped to your shift via the academic engine and programs APIs. Use
          Programs & courses for curriculum mapping; delivery sections are filtered to your shift
          automatically.
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
