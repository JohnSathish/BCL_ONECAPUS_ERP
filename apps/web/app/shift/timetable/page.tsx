'use client';

import { useQuery } from '@tanstack/react-query';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ErpWorkspace } from '@/components/erp/erp-workspace-shell';
import {
  TimetableMatrixGrid,
  TimetableStudioShell,
} from '@/components/timetable/timetable-components';
import { useRequireAuth } from '@/hooks/use-auth';
import { useShiftScope } from '@/hooks/use-shift-scope';
import { fetchTimetableMatrix, fetchTimetablePlans } from '@/services/timetable';

export default function ShiftTimetablePage() {
  const session = useRequireAuth();
  const scope = useShiftScope();

  const plans = useQuery({
    queryKey: ['shift', 'published-timetable-plan', scope.activeShiftId],
    queryFn: async () => {
      const rows = await fetchTimetablePlans({
        shiftId: scope.activeShiftId,
        status: 'PUBLISHED',
      });
      return rows;
    },
    enabled: Boolean(session),
  });
  const planId = plans.data?.[0]?.id;
  const matrix = useQuery({
    queryKey: ['shift', 'timetable-matrix', planId],
    queryFn: () => fetchTimetableMatrix(planId as string),
    enabled: Boolean(planId),
  });

  if (!session) return null;

  return (
    <DashboardShell role="shift" title="Timetable">
      <ErpWorkspace>
        <TimetableStudioShell
          title="Published Shift Routine"
          description="Notice-board style week matrix for the active shift."
        >
          <TimetableMatrixGrid matrix={matrix.data} />
        </TimetableStudioShell>
      </ErpWorkspace>
    </DashboardShell>
  );
}
