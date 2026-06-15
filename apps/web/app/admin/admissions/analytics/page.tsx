'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRequireAuth } from '@/hooks/use-auth';
import { fetchAdmissionsFunnel, fetchCycles, fetchProgramBreakdown } from '@/services/admissions';

export default function AdmissionsAnalyticsPage() {
  useRequireAuth();
  const [cycleId, setCycleId] = useState<string>('');

  const { data: cycles = [] } = useQuery({
    queryKey: ['admission-cycles'],
    queryFn: () => fetchCycles(),
  });

  const activeCycleId = cycleId || cycles.find((c) => c.status === 'OPEN')?.id || cycles[0]?.id;

  const { data: funnel } = useQuery({
    queryKey: ['admissions-funnel', activeCycleId],
    queryFn: () => fetchAdmissionsFunnel(activeCycleId),
    enabled: Boolean(activeCycleId),
  });

  const { data: programs } = useQuery({
    queryKey: ['admissions-programs', activeCycleId],
    queryFn: () => fetchProgramBreakdown(activeCycleId),
    enabled: Boolean(activeCycleId),
  });

  const funnelSteps = funnel
    ? [
        { label: 'Registered', value: funnel.registered },
        { label: 'Form Started', value: funnel.formStarted },
        { label: 'Submitted', value: funnel.submitted },
        { label: 'Paid', value: funnel.paid },
        { label: 'Verified', value: funnel.verified },
        { label: 'Allotted', value: funnel.allotted },
        { label: 'Enrolled', value: funnel.enrolled },
      ]
    : [];

  return (
    <DashboardShell role="admin" title="Admissions Analytics">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button variant="outline" asChild>
          <Link href="/admin/admissions">← Desk</Link>
        </Button>
        <select
          className="h-10 rounded-md border bg-card px-3 text-sm"
          value={activeCycleId}
          onChange={(e) => setCycleId(e.target.value)}
        >
          {cycles.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title} ({c.status})
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {funnelSteps.map((step) => (
          <Card key={step.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {step.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{step.value ?? 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Programme-wise Applications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(programs ?? []).map(
              (row: {
                program: { code: string; name: string };
                total: number;
                byStatus: Record<string, number>;
              }) => (
                <div
                  key={row.program.code}
                  className="flex items-center justify-between border-b pb-2"
                >
                  <div>
                    <p className="font-medium">{row.program.name}</p>
                    <p className="text-xs text-muted-foreground">{row.program.code}</p>
                  </div>
                  <p className="text-lg font-semibold">{row.total}</p>
                </div>
              ),
            )}
          </div>
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
