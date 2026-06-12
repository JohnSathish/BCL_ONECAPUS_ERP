'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { ErpWorkspace } from '@/components/erp/erp-workspace-shell';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { FacultyAttendanceWorkspace } from '@/components/student-attendance/faculty-attendance-workspace';
import { Button } from '@/components/ui/button';
import { useRequireStaffPortal } from '@/hooks/use-require-staff-portal';

export default function StaffAttendanceEntryPage() {
  useRequireStaffPortal();

  return (
    <DashboardShell role="staff" title="Attendance Entry">
      <ErpWorkspace className="space-y-4">
        <Button variant="ghost" size="sm" className="w-fit rounded-xl" asChild>
          <Link href="/staff/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
        <FacultyAttendanceWorkspace />
      </ErpWorkspace>
    </DashboardShell>
  );
}
