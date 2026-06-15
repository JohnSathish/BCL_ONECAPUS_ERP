'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRequireAuth } from '@/hooks/use-auth';
import { fetchApplications, fetchCycles } from '@/services/admissions';

export default function AdmissionsArchivePage() {
  useRequireAuth();
  const { data: cycles = [] } = useQuery({
    queryKey: ['admission-cycles-archived'],
    queryFn: () => fetchCycles('ARCHIVED'),
  });

  const archivedCycle = cycles[0];
  const { data: apps } = useQuery({
    queryKey: ['archived-applications', archivedCycle?.id],
    queryFn: () => fetchApplications({ cycleId: archivedCycle!.id, limit: 50 }),
    enabled: Boolean(archivedCycle?.id),
  });

  return (
    <DashboardShell role="admin" title="Admission Archive">
      <div className="mb-4">
        <Button variant="outline" asChild>
          <Link href="/admin/admissions">← Desk</Link>
        </Button>
      </div>

      {cycles.length === 0 ? (
        <p className="text-muted-foreground">No archived cycles yet.</p>
      ) : (
        <div className="space-y-6">
          {cycles.map((cycle) => (
            <Card key={cycle.id}>
              <CardHeader>
                <CardTitle>
                  {cycle.title}{' '}
                  <span className="text-sm font-normal text-muted-foreground">({cycle.code})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p>Applications: {cycle._count?.applications ?? 0}</p>
                <Button variant="ghost" className="mt-2 h-auto p-0" asChild>
                  <a href={`/api/v1/admissions/admin/cycles/${cycle.id}/export`} download>
                    Export CSV
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}

          {archivedCycle && apps?.data && (
            <Card>
              <CardHeader>
                <CardTitle>Recent applications — {archivedCycle.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {apps.data.map((app) => (
                    <li key={app.id}>
                      {app.applicationNumber} — {app.firstName} {app.lastName} ({app.status})
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </DashboardShell>
  );
}
