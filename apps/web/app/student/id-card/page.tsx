'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ErpWorkspace } from '@/components/erp/erp-workspace-shell';
import { StudentIdCardStudio } from '@/components/id-cards/id-card-studio';
import { useRequireAuth } from '@/hooks/use-auth';

export default function StudentIdCardPage() {
  useRequireAuth();

  return (
    <DashboardShell role="student" title="Digital ID Card">
      <ErpWorkspace className="max-w-3xl">
        <StudentIdCardStudio canPrint={false} />
      </ErpWorkspace>
    </DashboardShell>
  );
}
