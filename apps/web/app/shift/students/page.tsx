'use client';

import { useQuery } from '@tanstack/react-query';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRequireAuth } from '@/hooks/use-auth';
import { useShiftScope } from '@/hooks/use-shift-scope';
import { api } from '@/services/api';

export default function ShiftStudentsPage() {
  const session = useRequireAuth();
  const scope = useShiftScope();

  const students = useQuery({
    queryKey: ['shift', 'students', scope.activeShiftId],
    queryFn: async () => {
      const { data } = await api.get('/v1/students', {
        params: { limit: 50, shiftId: scope.activeShiftId },
      });
      return data.data as {
        id: string;
        enrollmentNumber: string;
        user: { email: string };
      }[];
    },
    enabled: Boolean(session) && Boolean(scope.activeShiftId),
  });

  if (!session) return null;

  return (
    <DashboardShell role="shift" title="Shift students">
      <Card>
        <CardHeader>
          <CardTitle>Students in your shift</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {(students.data ?? []).map((s) => (
              <li key={s.id} className="rounded border border-border px-3 py-2">
                {s.enrollmentNumber} — {s.user.email}
              </li>
            ))}
            {!students.data?.length ? (
              <li className="text-muted-foreground">No students in this shift.</li>
            ) : null}
          </ul>
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
