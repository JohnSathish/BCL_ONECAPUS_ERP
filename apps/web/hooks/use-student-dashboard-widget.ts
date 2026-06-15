'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchStudentDashboardWidget } from '@/services/student-portal';

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

export function useStudentDashboardWidget<T = unknown>(widget: DashboardWidgetId) {
  const enabled = useAuthQueryEnabled();
  return useQuery({
    queryKey: ['student-portal', 'dashboard-widget', widget],
    queryFn: () => fetchStudentDashboardWidget<T>(widget),
    enabled,
    staleTime: 30_000,
  });
}
