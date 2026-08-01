'use client';

import { ErpWorkspace } from '@/components/erp/erp-workspace-shell';
import { QueryErrorPanel } from '@/components/erp/query-error-panel';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { StudentAcademicProgressCard } from '@/components/student-portal/dashboard/student-academic-progress-card';
import {
  StudentAnnouncementsCard,
  StudentLatestUpdatesCard,
} from '@/components/student-portal/dashboard/student-announcements-reminders';
import { StudentDashboardAiBar } from '@/components/student-portal/dashboard/student-dashboard-ai-bar';
import { StudentDashboardHeader } from '@/components/student-portal/dashboard/student-dashboard-header';
import { StudentQuickLinksCard } from '@/components/student-portal/dashboard/student-quick-links-card';
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
    <DashboardShell role="student" title="Student Dashboard">
      <ErpWorkspace
        className={cn(
          'relative space-y-5 pb-4',
          'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:-z-10 before:h-[420px] before:bg-[radial-gradient(ellipse_at_top,_rgba(56,189,248,0.12),_transparent_55%),radial-gradient(ellipse_at_80%_0%,_rgba(167,139,250,0.10),_transparent_45%)]',
          compact && 'space-y-3.5',
        )}
      >
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

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,0.9fr)]">
          <StudentSubjectsTable
            chips={shell?.academicChips}
            semesterSequence={shell?.profile.semesterSequence}
            loading={shellLoading}
          />
          <TodayTimetableWidget schedule={timetableQ.data} loading={timetableQ.isLoading} />
        </div>

        <StudentDashboardAiBar firstName={firstName} />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StudentAnnouncementsCard
            notifications={notificationsQ.data?.notifications}
            unreadCount={
              notificationsQ.data?.unreadNotificationCount ?? shell?.unreadNotificationCount
            }
            loading={notificationsQ.isLoading}
          />
          <StudentAcademicProgressCard
            data={shellEnriched}
            loading={shellLoading || healthQ.isLoading}
          />
          <StudentLatestUpdatesCard
            notifications={notificationsQ.data?.notifications}
            calendarEvents={calendarQ.data}
            loading={notificationsQ.isLoading || calendarQ.isLoading}
          />
          <StudentQuickLinksCard />
        </div>
      </ErpWorkspace>
    </DashboardShell>
  );
}
