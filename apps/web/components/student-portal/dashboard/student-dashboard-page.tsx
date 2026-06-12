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
import { useRequireAuth } from '@/hooks/use-auth';
import { useStudentPortalPreferencesStore } from '@/store/student-portal-preferences-store';
import { cn } from '@/utils/cn';

export function StudentDashboardPage() {
  useRequireAuth();
  const { data, isLoading, qrPass } = useStudentDashboard();
  const compact = useStudentPortalPreferencesStore((s) => s.compact);

  return (
    <DashboardShell role="student" title="Student Dashboard">
      <ErpWorkspace className={cn('space-y-4', compact && 'space-y-3')}>
        <StudentDashboardHeader data={data} loading={isLoading} />
        <StudentQuickStats data={data} loading={isLoading} />
        <AcademicSnapshotWidget chips={data?.academicChips} loading={isLoading} />

        <TodayTimetableWidget schedule={data?.todayTimetable} loading={isLoading} />

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <AttendanceWidget data={data?.attendance} loading={isLoading} />
          <FeeWidget fees={data?.fees} loading={isLoading} />
          <LmsWidget lms={data?.lms} loading={isLoading} />
          <ExaminationWidget exams={data?.examinations} loading={isLoading} />
          <StudentNotificationsWidget
            notifications={data?.notifications}
            unreadCount={data?.unreadNotificationCount}
            loading={isLoading}
          />
          <PortalCalendarWidget
            events={data?.calendarEvents}
            loading={isLoading}
            title="Student Calendar"
          />
          <DigitalIdWidget profile={data?.profile} qrPass={qrPass} loading={isLoading} />
          <HealthScoreWidget health={data?.health} loading={isLoading} />
        </div>
      </ErpWorkspace>
    </DashboardShell>
  );
}
