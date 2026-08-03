'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { AdmissionsCycleCloneWizard } from '@/components/admissions-module/admissions-cycle-clone-wizard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRequireAuth } from '@/hooks/use-auth';
import { fetchCycles } from '@/services/admissions';
import { cn } from '@/utils/cn';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-slate-500',
  OPEN: 'bg-emerald-600',
  CLOSED: 'bg-amber-600',
  ARCHIVED: 'bg-slate-700',
};

export default function AdmissionCyclesPage() {
  useRequireAuth();
  const [wizardOpen, setWizardOpen] = useState(false);
  const { data: cycles = [], isLoading } = useQuery({
    queryKey: ['admission-cycles'],
    queryFn: () => fetchCycles(),
  });

  return (
    <DashboardShell role="admin" title="Admission Cycles">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" asChild>
          <Link href="/admin/admissions">← Admissions</Link>
        </Button>
        <Button onClick={() => setWizardOpen(true)}>Create New Admission Cycle</Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading cycles…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {cycles.map((cycle) => (
            <Card key={cycle.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">{cycle.title}</CardTitle>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs text-white',
                    STATUS_COLORS[cycle.status] ?? 'bg-slate-500',
                  )}
                >
                  {cycle.status}
                </span>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>Code: {cycle.code}</p>
                <p>Academic year: {cycle.academicYear?.name ?? '—'}</p>
                <p>Applications: {cycle._count?.applications ?? 0}</p>
                <Button asChild size="sm" className="mt-2">
                  <Link href={`/admin/admissions/cycles/${cycle.id}`}>Configure</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AdmissionsCycleCloneWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </DashboardShell>
  );
}
