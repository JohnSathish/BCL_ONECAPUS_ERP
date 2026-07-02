'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ErpWorkspace } from '@/components/erp/erp-workspace-shell';
import { TimetableSettingsPanel } from '@/components/timetable/timetable-settings-panel';
import { TimetableFilterBar } from '@/components/timetable/timetable-components';
import { useRequireAuth } from '@/hooks/use-auth';
import { useTimetableWorkspaceFilters } from '@/hooks/use-timetable-workspace-filters';

export default function TimetableSettingsPage() {
  useRequireAuth();
  const {
    shiftId,
    setShiftId,
    hideShiftFilter,
    streamId,
    setStreamId,
    semesterMode,
    setSemesterMode,
    academicYearId,
    setAcademicYearId,
    selectedPlanId,
    setSelectedPlanId,
    plans,
    context,
  } = useTimetableWorkspaceFilters();

  return (
    <DashboardShell role="admin" title="Timetable Settings">
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
            context={context}
            hideShiftFilter={hideShiftFilter}
          />
          <TimetableSettingsPanel planId={selectedPlanId} />
        </div>
      </ErpWorkspace>
    </DashboardShell>
  );
}
