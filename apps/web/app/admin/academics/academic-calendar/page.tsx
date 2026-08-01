'use client';

import Link from 'next/link';

import { AcademicCalendarWorkspace } from '@/components/academic-calendar/academic-calendar-workspace';
import { DashboardShell } from '@/components/layout/dashboard-shell';

export default function AcademicCalendarAdminPage() {
  return (
    <DashboardShell
      title="Academic Calendar"
      subtitle="Interactive institutional calendar — working days, holidays, and campus events."
      pageHeader={false}
    >
      <div className="mb-3 text-sm text-slate-500">
        <Link href="/admin/academics" className="hover:underline">
          Academics
        </Link>
        <span className="mx-1">/</span>
        <span>Calendar</span>
      </div>
      <AcademicCalendarWorkspace />
    </DashboardShell>
  );
}
