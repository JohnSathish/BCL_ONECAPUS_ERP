'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRequireAuth } from '@/hooks/use-auth';

export default function ShiftAttendancePage() {
  const session = useRequireAuth();
  if (!session) return null;

  return (
    <DashboardShell role="shift" title="Attendance">
      <Card>
        <CardHeader>
          <CardTitle>Shift attendance</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Attendance sessions are created per shift via the shift-operations API. Phase 1 provides
          list/create stubs scoped to your shift.
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
