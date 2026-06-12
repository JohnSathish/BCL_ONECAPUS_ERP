'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ErpWorkspace } from '@/components/erp/erp-workspace-shell';
import { TimetableImportExportPanel } from '@/components/timetable/timetable-import-export-panel';
import { TimetableFilterBar } from '@/components/timetable/timetable-components';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthQueryEnabled, useRequireAuth } from '@/hooks/use-auth';
import { fetchTimetableContext, fetchTimetablePlans } from '@/services/timetable';

export default function TimetableBulkPage() {
  useRequireAuth();
  const authReady = useAuthQueryEnabled();
  const [shiftId, setShiftId] = useState('');
  const [streamId, setStreamId] = useState('');
  const [semesterMode, setSemesterMode] = useState<'ODD' | 'EVEN'>('ODD');
  const [academicYearId, setAcademicYearId] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');

  const contextQ = useQuery({
    queryKey: ['timetable', 'context'],
    queryFn: fetchTimetableContext,
    enabled: authReady,
  });
  const plansQ = useQuery({
    queryKey: ['timetable', 'plans', shiftId, streamId, semesterMode],
    queryFn: () =>
      fetchTimetablePlans({
        shiftId: shiftId || undefined,
        streamId: streamId || undefined,
        semesterMode,
      }),
    enabled: authReady,
  });

  useEffect(() => {
    if (contextQ.data?.currentAcademicMode) {
      setSemesterMode(contextQ.data.currentAcademicMode);
    }
  }, [contextQ.data?.currentAcademicMode]);

  const plans = useMemo(() => plansQ.data ?? [], [plansQ.data]);

  return (
    <DashboardShell role="admin" title="Timetable Import / Export">
      <ErpWorkspace>
        <div className="space-y-4">
          <TimetableFilterBar
            shiftId={shiftId}
            setShiftId={setShiftId}
            streamId={streamId}
            setStreamId={setStreamId}
            semesterMode={semesterMode}
            setSemesterMode={setSemesterMode}
            academicYearId={academicYearId}
            setAcademicYearId={setAcademicYearId}
            selectedPlanId={selectedPlanId}
            setSelectedPlanId={setSelectedPlanId}
            plans={plans}
            context={contextQ.data}
          />
          <TimetableImportExportPanel planId={selectedPlanId} />
        </div>
      </ErpWorkspace>
    </DashboardShell>
  );
}
