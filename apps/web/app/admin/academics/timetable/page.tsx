'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ErpWorkspace } from '@/components/erp/erp-workspace-shell';
import { TimetableManualWorkspace } from '@/components/timetable/timetable-manual-workspace';

export default function AdminAcademicsTimetablePage() {
  return (
    <DashboardShell role="admin" title="FYUGP Timetable">
      <ErpWorkspace>
        <TimetableManualWorkspace />
      </ErpWorkspace>
    </DashboardShell>
  );
}
