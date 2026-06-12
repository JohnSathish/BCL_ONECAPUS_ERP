'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchTimetablePlans, fetchTimetableValidationCenter } from '@/services/timetable';

export default function TimetableValidationCenterPage() {
  const [planId, setPlanId] = useState('');
  const plansQ = useQuery({
    queryKey: ['timetable', 'plans'],
    queryFn: () => fetchTimetablePlans(),
  });
  const validationQ = useQuery({
    queryKey: ['timetable', 'validation-center', planId],
    queryFn: () => fetchTimetableValidationCenter(planId),
    enabled: Boolean(planId),
  });

  return (
    <DashboardShell role="admin" title="Timetable Validation Center">
      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Validation Center</CardTitle>
          </CardHeader>
          <CardContent>
            <select
              className="h-10 w-full rounded-md border bg-card px-3 text-sm md:w-96"
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
          </CardContent>
        </Card>
        {validationQ.data ? (
          <Card>
            <CardHeader>
              <CardTitle>
                {validationQ.data.readyForPublish ? 'Ready for Publish' : 'Conflicts Found'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                <Metric label="Entries" value={validationQ.data.totalEntries} />
                <Metric label="Conflicts" value={validationQ.data.totalConflicts} />
                <Metric label="Blocking" value={validationQ.data.blockingConflicts} />
              </div>
              <div className="space-y-2">
                {validationQ.data.suggestions.map((item, index) => (
                  <div key={`${item.conflictType}-${index}`} className="rounded-2xl border p-3">
                    <p className="font-medium">{item.conflictType}</p>
                    <p className="text-sm text-muted-foreground">{item.message}</p>
                    <p className="mt-1 text-sm text-primary">{item.action}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </DashboardShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
