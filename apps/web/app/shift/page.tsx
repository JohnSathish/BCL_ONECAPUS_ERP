'use client';

import { useQuery } from '@tanstack/react-query';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRequireAuth } from '@/hooks/use-auth';
import { useShiftScope } from '@/hooks/use-shift-scope';
import { fetchShiftOperationsSummary } from '@/services/shifts';

export default function ShiftDashboardPage() {
  const session = useRequireAuth();
  const scope = useShiftScope();

  const summary = useQuery({
    queryKey: ['shift', 'operations-summary'],
    queryFn: () => fetchShiftOperationsSummary(),
    enabled: Boolean(session),
  });

  if (!session) return null;

  const row = summary.data?.[0];

  return (
    <DashboardShell role="shift" title="Shift operations">
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Scoped to your assigned shift
          {scope.primaryShiftId ? ` (${scope.shiftIds.length} assignment(s))` : ''}
        </p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Students</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{row?.students ?? '—'}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Active sections</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {row?.activeSections ?? '—'}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Faculty mapped</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {row?.facultyAssignments ?? '—'}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Timetable entries</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {row?.timetableEntries ?? '—'}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Pending approvals</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {row?.pendingApprovals ?? '—'}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
