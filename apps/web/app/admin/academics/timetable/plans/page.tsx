'use client';

import { useQuery } from '@tanstack/react-query';
import { TimetableSectionPage } from '@/components/timetable/timetable-section-page';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEffectiveShiftId } from '@/hooks/use-bind-workspace-shift';
import { useShiftScope } from '@/hooks/use-shift-scope';
import { fetchTimetablePlans } from '@/services/timetable';

export default function TimetablePlansPage() {
  const { hideShiftSelectors, activeShiftName, activeShiftCode } = useShiftScope();
  const effectiveShiftId = useEffectiveShiftId(undefined);
  const plansQ = useQuery({
    queryKey: ['timetable', 'plans', 'plans-page', effectiveShiftId],
    queryFn: () => fetchTimetablePlans({ shiftId: effectiveShiftId }),
  });
  const plans = plansQ.data ?? [];

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
          {hideShiftSelectors ? (
            <p className="text-xs text-muted-foreground">
              Scoped to {activeShiftName ?? activeShiftCode ?? 'workspace shift'}
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-2">
          {plans.map((plan) => (
            <div key={plan.id} className="rounded-2xl border p-3 text-sm">
              <div className="font-medium">{plan.name}</div>
              <div className="text-xs text-muted-foreground">
                {plan.status} · {plan.approvalState} ·{' '}
                {(plan.metadata as any)?.streamName ?? 'All Streams'}
              </div>
            </div>
          ))}
          {!plans.length ? (
            <p className="text-sm text-muted-foreground">No timetable plans found.</p>
          ) : null}
        </CardContent>
      </Card>
    </TimetableSectionPage>
  );
}
