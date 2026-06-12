'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ErpWorkspace } from '@/components/erp/erp-workspace-shell';
import {
  TimetableMatrixGrid,
  TimetableStudioShell,
} from '@/components/timetable/timetable-components';
import { useRequireStaffPortal } from '@/hooks/use-require-staff-portal';
import { fetchFacultyWeekTimetable } from '@/services/timetable';
import { fetchFacultyTodayAttendance } from '@/services/student-attendance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function StaffAcademicTimetablePage() {
  useRequireStaffPortal();
  const timetableQ = useQuery({
    queryKey: ['staff', 'faculty-week-timetable'],
    queryFn: () => fetchFacultyWeekTimetable(),
  });
  const todayQ = useQuery({
    queryKey: ['staff', 'today-attendance-sessions'],
    queryFn: fetchFacultyTodayAttendance,
  });

  return (
    <DashboardShell role="staff" title="Timetable">
      <ErpWorkspace>
        <TimetableStudioShell
          title="My Weekly Teaching Timetable"
          description="Published lecture, tutorial, lab, and combined FYUGP slots assigned to you."
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Today&apos;s Classes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(todayQ.data ?? []).length ? (
                (todayQ.data ?? []).map((session) => (
                  <div
                    key={session.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {session.course?.code ?? session.sessionType} ·{' '}
                        {session.startTime?.slice(0, 5) ?? '--:--'}–
                        {session.endTime?.slice(0, 5) ?? '--:--'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Sec {session.section?.sectionCode ?? '-'} ·{' '}
                        {session.classroom?.code ?? session.location?.roomCode ?? 'Room TBA'}
                      </p>
                    </div>
                    <Link
                      href={`/staff/academic/attendance-entry?sessionId=${session.id}`}
                      className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm hover:bg-muted"
                    >
                      Mark Attendance
                    </Link>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No published classes scheduled for today.
                </p>
              )}
            </CardContent>
          </Card>
          <TimetableMatrixGrid matrix={timetableQ.data} />
        </TimetableStudioShell>
      </ErpWorkspace>
    </DashboardShell>
  );
}
