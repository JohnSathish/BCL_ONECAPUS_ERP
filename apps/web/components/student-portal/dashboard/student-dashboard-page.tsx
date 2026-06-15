'use client';

import { ErpWorkspace } from '@/components/erp/erp-workspace-shell';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { StudentDashboardHeader } from '@/components/student-portal/dashboard/student-dashboard-header';
import { StudentQuickStats } from '@/components/student-portal/dashboard/student-quick-stats';
import { AcademicSnapshotWidget } from '@/components/student-portal/widgets/academic-snapshot-widget';
import { AttendanceWidget } from '@/components/student-portal/widgets/attendance-widget';
import { PortalCalendarWidget } from '@/components/portal/portal-calendar-widget';
import { DigitalIdWidget } from '@/components/student-portal/widgets/digital-id-widget';
import { ExaminationWidget } from '@/components/student-portal/widgets/examination-widget';
import { FeeWidget } from '@/components/student-portal/widgets/fee-widget';
import { HealthScoreWidget } from '@/components/student-portal/widgets/health-score-widget';
import { LmsWidget } from '@/components/student-portal/widgets/lms-widget';
import { StudentNotificationsWidget } from '@/components/student-portal/widgets/notifications-widget';
import { TodayTimetableWidget } from '@/components/student-portal/widgets/today-timetable-widget';
import { useStudentDashboard } from '@/hooks/use-student-dashboard';
import { useStudentDashboardWidget } from '@/hooks/use-student-dashboard-widget';
import { useRequireAuth } from '@/hooks/use-auth';
import { useStudentPortalPreferencesStore } from '@/store/student-portal-preferences-store';
import { cn } from '@/utils/cn';

export function StudentDashboardPage() {
  useRequireAuth();
  const { data: shell, isLoading: shellLoading } = useStudentDashboard();
  const compact = useStudentPortalPreferencesStore((s) => s.compact);

  const attendanceQ = useStudentDashboardWidget('attendance');
  const feesQ = useStudentDashboardWidget('fees');
  const timetableQ = useStudentDashboardWidget('timetable');
  const lmsQ = useStudentDashboardWidget('lms');
  const examsQ = useStudentDashboardWidget('examinations');
  const notificationsQ = useStudentDashboardWidget('notifications');
  const calendarQ = useStudentDashboardWidget('calendar');
  const libraryQ = useStudentDashboardWidget('library');
  const healthQ = useStudentDashboardWidget('health');
  const qrQ = useStudentDashboardWidget('qr-pass');

  const shellWithTimetable = shell
    ? {
        ...shell,
        todayTimetable: timetableQ.data ?? [],
        health: healthQ.data ?? {
          score: shell.profile.profileCompletion,
          label: 'Profile',
          tone: 'warn' as const,
          signals: [],
        },
      }
    : undefined;

  return (
    <DashboardShell role="student" title="Student Dashboard">
      <ErpWorkspace className={cn('space-y-4', compact && 'space-y-3')}>
        <StudentDashboardHeader data={shellWithTimetable} loading={shellLoading} />
        <StudentQuickStats data={shell} loading={shellLoading} />
        <AcademicSnapshotWidget chips={shell?.academicChips} loading={shellLoading} />

        <TodayTimetableWidget schedule={timetableQ.data} loading={timetableQ.isLoading} />

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <AttendanceWidget data={attendanceQ.data} loading={attendanceQ.isLoading} />
          <FeeWidget fees={feesQ.data ?? shell?.fees} loading={feesQ.isLoading && shellLoading} />
          <LmsWidget lms={lmsQ.data} loading={lmsQ.isLoading} />
          <ExaminationWidget exams={examsQ.data} loading={examsQ.isLoading} />
          <StudentNotificationsWidget
            notifications={notificationsQ.data?.notifications}
            unreadCount={
              notificationsQ.data?.unreadNotificationCount ?? shell?.unreadNotificationCount
            }
            loading={notificationsQ.isLoading}
          />
          <PortalCalendarWidget
            events={calendarQ.data}
            loading={calendarQ.isLoading}
            title="Student Calendar"
          />
          <DigitalIdWidget
            profile={shell?.profile}
            qrPass={qrQ.data}
            loading={shellLoading || qrQ.isLoading}
          />
          <HealthScoreWidget health={healthQ.data} loading={healthQ.isLoading} />
        </div>
      </ErpWorkspace>
    </DashboardShell>
  );
}
