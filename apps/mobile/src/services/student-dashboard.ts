import { apiFetch } from '@/api/client';

export type TimetableWidgetSlot = {
  startTime?: string;
  endTime?: string;
  isCurrent?: boolean;
  isPast?: boolean;
  course?: { code?: string; title?: string };
};

export type LmsWidget = {
  pendingAssignments?: number;
  notesAvailable?: number;
  upcomingTests?: number;
};

export type ExaminationsWidget = {
  hasResults?: boolean;
  hasAdmitCard?: boolean;
  cgpa?: number | null;
};

export type LibraryWidget = {
  issuedBooks?: number;
  finesDue?: number;
};

export type NotificationsWidget = {
  notifications?: {
    id: string;
    title: string;
    body?: string;
    createdAt?: string;
    read?: boolean;
  }[];
  unreadNotificationCount?: number;
};

export type StudentDashboardWidgets = {
  timetable?: TimetableWidgetSlot[];
  lms?: LmsWidget;
  examinations?: ExaminationsWidget;
  library?: LibraryWidget;
  notifications?: NotificationsWidget;
  birthdays?: BirthdaysWidget;
};

export type DashboardWidgetName =
  | 'timetable'
  | 'lms'
  | 'examinations'
  | 'library'
  | 'notifications'
  | 'birthdays';

export type BirthdaysWidget = {
  isMyBirthday?: boolean;
  birthdays?: {
    id: string;
    fullName: string;
    photoUrl?: string | null;
    role: 'student' | 'staff';
  }[];
};

export function fetchStudentDashboardWidget<T>(widget: DashboardWidgetName) {
  return apiFetch<T>(`/v1/students/me/dashboard/widgets/${widget}`);
}

export function fetchStaffBirthdaysWidget() {
  return apiFetch<BirthdaysWidget>('/v1/staff/me/dashboard/widgets/birthdays');
}

export async function fetchStudentHomeWidgets() {
  const [timetable, lms, examinations, library, notifications, birthdays] = await Promise.all([
    fetchStudentDashboardWidget<TimetableWidgetSlot[]>('timetable').catch(
      () => [] as TimetableWidgetSlot[],
    ),
    fetchStudentDashboardWidget<LmsWidget>('lms').catch(() => ({}) as LmsWidget),
    fetchStudentDashboardWidget<ExaminationsWidget>('examinations').catch(
      () => ({}) as ExaminationsWidget,
    ),
    fetchStudentDashboardWidget<LibraryWidget>('library').catch(() => ({}) as LibraryWidget),
    fetchStudentDashboardWidget<NotificationsWidget>('notifications').catch(
      () => ({}) as NotificationsWidget,
    ),
    fetchStudentDashboardWidget<BirthdaysWidget>('birthdays').catch(() => ({}) as BirthdaysWidget),
  ]);
  return { timetable, lms, examinations, library, notifications, birthdays };
}
