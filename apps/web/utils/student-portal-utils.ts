import type { SemesterRegistration } from '@/types/academic-engine';
import type { StudentFeeLedger } from '@/types/fees';
import type {
  StudentAcademicChip,
  StudentPortalNotification,
  StudentTimetableSlot,
} from '@/types/student-portal';
import type { TimetableEntry } from '@/services/timetable';

const CATEGORY_LABELS: Record<string, string> = {
  MAJOR: 'Major',
  MINOR: 'Minor',
  MDC: 'MDC',
  AEC: 'AEC',
  SEC: 'SEC',
  VAC: 'VAC',
  VTC: 'VTC',
};

export function getLocalGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function parseTimeToMinutes(time: string): number | null {
  const raw = time.trim();
  const match12 = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (match12) {
    let hour = Number(match12[1]);
    const minute = Number(match12[2]);
    const period = match12[3]?.toUpperCase();
    if (period === 'PM' && hour < 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    return hour * 60 + minute;
  }
  const match24 = raw.match(/^(\d{1,2}):(\d{2})/);
  if (match24) return Number(match24[1]) * 60 + Number(match24[2]);
  return null;
}

export function isCurrentTimeSlot(startTime: string, endTime: string, now = new Date()) {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start == null || end == null) return false;
  const current = now.getHours() * 60 + now.getMinutes();
  return current >= start && current < end;
}

export function isPastTimeSlot(endTime: string, now = new Date()) {
  const end = parseTimeToMinutes(endTime);
  if (end == null) return false;
  return now.getHours() * 60 + now.getMinutes() >= end;
}

export function getTodayTimetableEntries(entries: TimetableEntry[]): StudentTimetableSlot[] {
  const day = new Date().getDay();
  return entries
    .filter((e) => e.dayOfWeek === day)
    .sort((a, b) => (parseTimeToMinutes(a.startTime) ?? 0) - (parseTimeToMinutes(b.startTime) ?? 0))
    .map((entry) => ({
      ...entry,
      isCurrent: isCurrentTimeSlot(entry.startTime, entry.endTime),
      isPast: isPastTimeSlot(entry.endTime),
    }));
}

export function summarizeStudentFees(ledger?: StudentFeeLedger | null) {
  const demands = ledger?.demands ?? [];
  const due = demands.reduce((sum, d) => sum + Number(d.balanceAmount ?? 0), 0);
  const paid = demands.reduce((sum, d) => sum + Number(d.paidAmount ?? 0), 0);
  const currentDemand = demands.find((d) => d.balanceAmount > 0) ?? demands[0];
  return {
    paid,
    due,
    status: due > 0 ? ('PENDING' as const) : ('PAID' as const),
    semesterLabel: currentDemand?.billingPeriod ?? 'Current semester',
  };
}

export function academicChipsFromRegistration(
  registration: SemesterRegistration | null | undefined,
  majorMinor?: {
    majorSubject?: { name: string };
    minorSubject?: { name: string } | null;
  } | null,
): StudentAcademicChip[] {
  const chips: StudentAcademicChip[] = [];
  const lines = registration?.lines ?? [];

  for (const line of lines) {
    const category = line.category?.toUpperCase() ?? 'OTHER';
    if (['MAJOR', 'MINOR', 'MDC', 'AEC', 'SEC', 'VAC'].includes(category)) {
      chips.push({
        category,
        label: CATEGORY_LABELS[category] ?? category,
        courseTitle: line.offering?.course?.title ?? line.offering?.course?.code ?? '—',
      });
    }
  }

  if (!chips.some((c) => c.category === 'MAJOR') && majorMinor?.majorSubject) {
    chips.unshift({
      category: 'MAJOR',
      label: 'Major',
      courseTitle: majorMinor.majorSubject.name,
    });
  }
  if (!chips.some((c) => c.category === 'MINOR') && majorMinor?.minorSubject) {
    chips.push({
      category: 'MINOR',
      label: 'Minor',
      courseTitle: majorMinor.minorSubject.name,
    });
  }

  const order = ['MAJOR', 'MINOR', 'MDC', 'AEC', 'SEC', 'VAC'];
  return chips.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
}

export function computeProfileCompletion(input: {
  hasPhoto: boolean;
  hasMobile: boolean;
  hasRfid: boolean;
  registrationComplete: boolean;
  feesClear: boolean;
}) {
  let score = 0;
  if (input.hasPhoto) score += 25;
  if (input.hasMobile) score += 15;
  if (input.hasRfid) score += 20;
  if (input.registrationComplete) score += 25;
  if (input.feesClear) score += 15;
  return Math.min(100, score);
}

export function computeHealthScore(input: {
  attendancePct: number | null;
  feesDue: number;
  registrationComplete: boolean;
  hasDocuments: boolean;
  libraryFines: number;
}) {
  let points = 0;
  const max = 5;
  if (input.attendancePct != null && input.attendancePct >= 75) points += 1;
  if (input.feesDue <= 0) points += 1;
  if (input.registrationComplete) points += 1;
  if (input.hasDocuments) points += 1;
  if (input.libraryFines <= 0) points += 1;
  const score = Math.round((points / max) * 100);
  if (score >= 80) return { score, label: 'Healthy profile', tone: 'good' as const };
  if (score >= 50) return { score, label: 'Needs attention', tone: 'warn' as const };
  return { score, label: 'Action required', tone: 'bad' as const };
}

export function buildStudentNotifications(input: {
  feeDue: number;
  attendanceAlerts: { message: string }[];
  lmsAnnouncements: { id: string; title: string; body?: string; publishAt?: string }[];
}): StudentPortalNotification[] {
  const items: StudentPortalNotification[] = [];

  for (const a of input.lmsAnnouncements.slice(0, 3)) {
    items.push({
      id: `lms-${a.id}`,
      type: 'notice',
      title: a.title,
      body: a.body ?? 'New announcement from your course.',
      createdAt: a.publishAt ?? new Date().toISOString(),
      read: false,
    });
  }

  if (input.feeDue > 0) {
    items.push({
      id: 'fee-reminder',
      type: 'fee',
      title: 'Fee Reminder',
      body: `₹${input.feeDue.toLocaleString()} pending for the current semester.`,
      createdAt: new Date().toISOString(),
      read: false,
    });
  }

  for (const alert of input.attendanceAlerts.slice(0, 2)) {
    items.push({
      id: `att-${alert.message}`,
      type: 'attendance',
      title: 'Attendance Alert',
      body: alert.message,
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      read: false,
    });
  }

  if (!items.length) {
    items.push({
      id: 'welcome',
      type: 'notice',
      title: 'Welcome to your portal',
      body: 'Your dashboard shows attendance, fees, timetable, and LMS updates in one place.',
      createdAt: new Date().toISOString(),
      read: true,
    });
  }

  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
