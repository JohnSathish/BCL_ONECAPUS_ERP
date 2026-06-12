'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRequireAuth } from '@/hooks/use-auth';

export default function ShiftExaminationsPage() {
  const session = useRequireAuth();
  if (!session) return null;

  return (
    <DashboardShell role="shift" title="Examinations">
      <Card>
        <CardHeader>
          <CardTitle>Shift examinations</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Internal examination schedules are shift-scoped. Use the API or future UI forms to create
          shift-wise exam timetables.
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
