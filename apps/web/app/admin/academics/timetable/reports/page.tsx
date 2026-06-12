'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { StreamMasterRoutineView } from '@/components/timetable/stream-master-routine';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchStreamMasterRoutine, fetchTimetablePlans } from '@/services/timetable';
import { openTimetablePrint } from '@/lib/timetable/open-timetable-print';

export default function TimetableReportsPage() {
  const [planId, setPlanId] = useState('');
  const plansQ = useQuery({
    queryKey: ['timetable', 'plans'],
    queryFn: () => fetchTimetablePlans(),
  });
  const routineQ = useQuery({
    queryKey: ['timetable', 'stream-master-report', planId],
    queryFn: () => fetchStreamMasterRoutine(planId),
    enabled: Boolean(planId),
  });
  return (
    <DashboardShell role="admin" title="Timetable Reports">
      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Master Routine Export Center</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 md:flex-row md:items-center">
            <select
              className="h-10 rounded-md border bg-card px-3 text-sm md:w-96"
              value={planId}
              onChange={(event) => setPlanId(event.target.value)}
            >
              <option value="">Select timetable plan</option>
              {(plansQ.data ?? []).map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} · {plan.status}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              onClick={() => {
                if (!planId) return;
                openTimetablePrint({ planId });
              }}
              disabled={!planId}
            >
              Print / Save PDF
            </Button>
          </CardContent>
        </Card>
        <StreamMasterRoutineView routine={routineQ.data} />
      </div>
    </DashboardShell>
  );
}
