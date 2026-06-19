'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchStudentDashboardWidget } from '@/services/student-portal';
import type { LibraryQrPass } from '@/types/library';
import type {
  StudentDashboardView,
  StudentPortalNotification,
  StudentTimetableSlot,
} from '@/types/student-portal';
import type { PortalCalendarEvent } from '@/utils/portal-calendar';

export type DashboardWidgetId =
  | 'attendance'
  | 'fees'
  | 'timetable'
  | 'lms'
  | 'examinations'
  | 'notifications'
  | 'calendar'
  | 'library'
  | 'health'
  | 'qr-pass';

type WidgetDataMap = {
  attendance: NonNullable<StudentDashboardView['attendance']>;
  fees: NonNullable<StudentDashboardView['fees']>;
  timetable: StudentTimetableSlot[];
  lms: NonNullable<StudentDashboardView['lms']>;
  examinations: NonNullable<StudentDashboardView['examinations']>;
  notifications: {
    notifications: StudentPortalNotification[];
    unreadNotificationCount: number;
  };
  calendar: PortalCalendarEvent[];
  library: NonNullable<StudentDashboardView['library']>;
  health: NonNullable<StudentDashboardView['health']>;
  'qr-pass': LibraryQrPass | null;
};

export function useStudentDashboardWidget<W extends DashboardWidgetId>(widget: W) {
  const enabled = useAuthQueryEnabled();
  return useQuery({
    queryKey: ['student-portal', 'dashboard-widget', widget],
    queryFn: () => fetchStudentDashboardWidget<WidgetDataMap[W]>(widget),
    enabled,
    staleTime: 30_000,
  });
}
