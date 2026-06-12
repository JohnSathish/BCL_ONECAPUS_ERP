'use client';

import { useQuery } from '@tanstack/react-query';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ErpWorkspace } from '@/components/erp/erp-workspace-shell';
import {
  TimetableSlotCell,
  TimetableStudioShell,
} from '@/components/timetable/timetable-components';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRequireAuth } from '@/hooks/use-auth';
import { fetchStudentWeekTimetable } from '@/services/timetable';

const dayLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function StudentTimetablePage() {
  const session = useRequireAuth();
  const timetableQ = useQuery({
    queryKey: ['student', 'week-timetable'],
    queryFn: fetchStudentWeekTimetable,
    enabled: Boolean(session),
  });
  if (!session) return null;

  const entries = timetableQ.data?.entries ?? [];

  return (
    <DashboardShell role="student" title="Timetable">
      <ErpWorkspace>
        <TimetableStudioShell
          title="My Class Timetable"
          description="Published class routine based on your registered FYUGP offering sections."
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {timetableQ.data?.plan?.name ?? 'Published Week Routine'}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((day) => (
                <div key={day} className="rounded-2xl border border-border/70 p-3">
                  <h3 className="mb-3 text-sm font-semibold">{dayLabels[day]}</h3>
                  <div className="space-y-2">
                    {entries
                      .filter((entry) => entry.dayOfWeek === day)
                      .map((entry) => (
                        <TimetableSlotCell key={entry.id} entry={entry} />
                      ))}
                    {!entries.some((entry) => entry.dayOfWeek === day) ? (
                      <p className="text-xs text-muted-foreground">No scheduled classes.</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TimetableStudioShell>
      </ErpWorkspace>
    </DashboardShell>
  );
}
