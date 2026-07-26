'use client';

import { ErpWorkspace } from '@/components/erp/erp-workspace-shell';
import { QueryErrorPanel } from '@/components/erp/query-error-panel';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { PortalCalendarWidget } from '@/components/portal/portal-calendar-widget';
import { StudentAcademicProgressCard } from '@/components/student-portal/dashboard/student-academic-progress-card';
import { StudentActivitySummaryCard } from '@/components/student-portal/dashboard/student-activity-summary-card';
import {
  StudentAnnouncementsCard,
  StudentRemindersCard,
} from '@/components/student-portal/dashboard/student-announcements-reminders';
import { StudentDashboardAiBar } from '@/components/student-portal/dashboard/student-dashboard-ai-bar';
import { StudentDashboardHeader } from '@/components/student-portal/dashboard/student-dashboard-header';
import { StudentQuickStats } from '@/components/student-portal/dashboard/student-quick-stats';
import { StudentSubjectsTable } from '@/components/student-portal/dashboard/student-subjects-table';
import { TodayTimetableWidget } from '@/components/student-portal/widgets/today-timetable-widget';
import { useStudentDashboard } from '@/hooks/use-student-dashboard';
import { useStudentDashboardWidget } from '@/hooks/use-student-dashboard-widget';
import { useRequireAuth } from '@/hooks/use-auth';
import { useStudentPortalPreferencesStore } from '@/store/student-portal-preferences-store';
import { cn } from '@/utils/cn';

export function StudentDashboardPage() {
  useRequireAuth();
  const {
    data: shell,
    isLoading: shellLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useStudentDashboard();
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

  const shellEnriched = shell
    ? {
        ...shell,
        todayTimetable: timetableQ.data ?? [],
        fees: feesQ.data ?? shell.fees,
        lms: lmsQ.data ?? shell.lms,
        examinations: examsQ.data ?? shell.examinations,
        library: libraryQ.data ? { ...shell.library, ...libraryQ.data } : shell.library,
        health: healthQ.data ?? {
          score: shell.profile.profileCompletion,
          label: 'Profile',
          tone: 'warn' as const,
          signals: [],
        },
        notifications: notificationsQ.data?.notifications ?? shell.notifications,
      }
    : undefined;

  const displayName = shell?.profile.displayFullName?.trim() || shell?.profile.fullName || '';
  const firstName = displayName.split(/\s+/)[0];

  return (
    <DashboardShell
      role="student"
      title="Student Dashboard"
      subtitle={
        firstName
          ? `Welcome back, ${firstName}! Keep learning, keep growing.`
          : 'Welcome back! Keep learning, keep growing.'
      }
    >
      <ErpWorkspace className={cn('relative space-y-4 pb-2', compact && 'space-y-3')}>
        {isError ? (
          <QueryErrorPanel
            title="Unable to load student dashboard"
            error={error}
            onRetry={() => void refetch()}
            isRetrying={isFetching}
          />
        ) : null}

        <StudentDashboardHeader data={shellEnriched} loading={shellLoading} />

        <StudentQuickStats
          data={shellEnriched}
          loading={shellLoading}
          attendancePercent={attendanceQ.data?.overall ?? null}
          libraryIssued={libraryQ.data?.issuedBooks ?? shell?.library?.issuedBooks ?? null}
          libraryDueInDays={libraryQ.data?.dueInDays ?? shell?.library?.dueInDays ?? null}
        />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <StudentSubjectsTable
            chips={shell?.academicChips}
            semesterSequence={shell?.profile.semesterSequence}
            loading={shellLoading}
          />
          <TodayTimetableWidget schedule={timetableQ.data} loading={timetableQ.isLoading} />
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <PortalCalendarWidget
            events={calendarQ.data}
            loading={calendarQ.isLoading}
            title="Calendar"
          />
          <StudentAcademicProgressCard
            data={shellEnriched}
            loading={shellLoading || healthQ.isLoading}
          />
          <StudentAnnouncementsCard
            notifications={notificationsQ.data?.notifications}
            unreadCount={
              notificationsQ.data?.unreadNotificationCount ?? shell?.unreadNotificationCount
            }
            loading={notificationsQ.isLoading}
          />
          <StudentActivitySummaryCard />
        </div>

        <div className="grid gap-4 xl:grid-cols-1">
          <StudentRemindersCard
            data={shellEnriched}
            calendarEvents={calendarQ.data}
            loading={shellLoading || lmsQ.isLoading || feesQ.isLoading}
          />
        </div>

        <StudentDashboardAiBar firstName={firstName} />
      </ErpWorkspace>
    </DashboardShell>
  );
}
