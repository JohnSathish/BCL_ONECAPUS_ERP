import type { TimetableEntry } from '@/services/timetable';
import type { PortalCalendarEvent } from '@/utils/portal-calendar';

export type StudentPortalProfile = {
  studentId: string;
  fullName: string;
  displayFullName?: string | null;
  enrollmentNumber: string;
  photoUrl: string | null;
  programLabel: string;
  department: string | null;
  semesterSequence: number | null;
  academicYear: string | null;
  rfidStatus: 'assigned' | 'missing';
  profileCompletion: number;
};

export type StudentQuickStat = {
  key: string;
  title: string;
  value: string;
  subvalue?: string;
  tone?: 'good' | 'warn' | 'bad' | 'neutral';
  href?: string;
};

export type StudentAcademicChip = {
  category: string;
  label: string;
  courseTitle: string;
};

export type StudentTimetableSlot = TimetableEntry & {
  isCurrent?: boolean;
  isPast?: boolean;
};

export type StudentPortalNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  link?: string | null;
};

export type StudentDashboardView = {
  profile: StudentPortalProfile;
  quickStats: StudentQuickStat[];
  academicChips: StudentAcademicChip[];
  unreadNotificationCount: number;
  fees?: {
    paid: number;
    due: number;
    status: 'PAID' | 'PENDING';
    semesterLabel: string;
  };
  /** Loaded lazily via widget endpoints */
  todayTimetable?: StudentTimetableSlot[];
  attendance?: {
    overall: number | null;
    subjects: { id: string; label: string; percentage: number }[];
  };
  lms?: {
    pendingAssignments: number;
    notesAvailable: number;
    upcomingTests: number;
  };
  examinations?: {
    hasResults: boolean;
    hasAdmitCard: boolean;
    cgpa: number | null;
  };
  library?: {
    issuedBooks: number;
    finesDue: number;
  };
  certificates?: {
    available: number;
  };
  notifications?: StudentPortalNotification[];
  health?: {
    score: number;
    label: string;
    tone: 'good' | 'warn' | 'bad';
    signals?: { key: string; label: string; tone: string }[];
  };
  calendarEvents?: PortalCalendarEvent[];
};
