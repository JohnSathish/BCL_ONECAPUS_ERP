'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { StreamMasterRoutineView } from '@/components/timetable/stream-master-routine';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEffectiveShiftId } from '@/hooks/use-bind-workspace-shift';
import { useShiftScope } from '@/hooks/use-shift-scope';
import { fetchStreamMasterRoutine, fetchTimetablePlans } from '@/services/timetable';
import {
  openDepartmentNoticePrint,
  openTimetablePrint,
} from '@/lib/timetable/open-timetable-print';

export default function TimetableReportsPage() {
  const { hideShiftSelectors, activeShiftName, activeShiftCode } = useShiftScope();
  const effectiveShiftId = useEffectiveShiftId(undefined);
  const [planId, setPlanId] = useState('');
  const plansQ = useQuery({
    queryKey: ['timetable', 'plans', 'reports', effectiveShiftId],
    queryFn: () => fetchTimetablePlans({ shiftId: effectiveShiftId }),
  });
  const plans = plansQ.data ?? [];

  useEffect(() => {
    if (!planId) return;
    if (!plans.some((plan) => plan.id === planId)) {
      setPlanId('');
    }
  }, [planId, plans]);
  const routineQ = useQuery({
    queryKey: ['timetable', 'stream-master-report', planId],
    queryFn: () => fetchStreamMasterRoutine(planId),
    enabled: Boolean(planId),
  });
  return (
    <DashboardShell role="admin" title="Timetable Reports">
      <div className="space-y-5">
        {hideShiftSelectors ? (
          <p className="text-sm text-muted-foreground">
            Showing plans for{' '}
            <span className="font-medium text-foreground">
              {activeShiftName ?? activeShiftCode ?? 'workspace shift'}
            </span>
            .
          </p>
        ) : null}
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
              {plans.map((plan) => (
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
            <Button
              variant="outline"
              onClick={() => {
                if (!planId) return;
                openDepartmentNoticePrint(planId);
              }}
              disabled={!planId}
            >
              Dept. notice
            </Button>
          </CardContent>
        </Card>
        <StreamMasterRoutineView routine={routineQ.data} />
      </div>
    </DashboardShell>
  );
}
