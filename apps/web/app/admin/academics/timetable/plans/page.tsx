'use client';

import { useQuery } from '@tanstack/react-query';
import { TimetableSectionPage } from '@/components/timetable/timetable-section-page';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchTimetablePlans } from '@/services/timetable';

export default function TimetablePlansPage() {
  const plansQ = useQuery({
    queryKey: ['timetable', 'plans', 'plans-page'],
    queryFn: () => fetchTimetablePlans(),
  });

  return (
    <TimetableSectionPage
      title="Timetable Plans"
      eyebrow="Plan control"
      description="Create and review stream/shift timetable plans. Use the dashboard page for plan creation and draft generation."
      actions={[
        { label: 'Open Dashboard', href: '/admin/academics/timetable' },
        {
          label: 'Generation Engine',
          href: '/admin/academics/timetable/generate',
          variant: 'outline',
        },
      ]}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Existing Plans</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(plansQ.data ?? []).map((plan) => (
            <div key={plan.id} className="rounded-2xl border p-3 text-sm">
              <div className="font-medium">{plan.name}</div>
              <div className="text-xs text-muted-foreground">
                {plan.status} · {plan.approvalState} ·{' '}
                {(plan.metadata as any)?.streamName ?? 'All Streams'}
              </div>
            </div>
          ))}
          {!plansQ.data?.length ? (
            <p className="text-sm text-muted-foreground">No timetable plans found.</p>
          ) : null}
        </CardContent>
      </Card>
    </TimetableSectionPage>
  );
}
