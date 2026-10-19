/** Statuses that count as attended class time under the college rule. */
const ATTENDED = new Set(['P']);
/** Approved leave. Medical leave is reported here and does not count as present. */
const LEAVE = new Set(['L', 'ML']);
const DUTY = new Set(['OD', 'SPORTS', 'NSS', 'NCC']);
/** Present + approved ordinary leave + on duty. Medical leave stays out of the numerator. */
const COUNTED_AS_PRESENT = new Set(['P', 'L', 'OD', 'SPORTS', 'NSS', 'NCC']);
const ABSENT = new Set(['A']);
const EXEMPT = new Set(['EXEMPTED']);

export type StatusFold = {
  conducted: number;
  attended: number;
  absent: number;
  leave: number;
  duty: number;
  countedPresent: number;
  exempted: number;
};

export function emptyFold(): StatusFold {
  return {
    conducted: 0,
    attended: 0,
    absent: 0,
    leave: 0,
    duty: 0,
    countedPresent: 0,
    exempted: 0,
  };
}

export function addStatus(fold: StatusFold, status: string) {
  const code = String(status ?? '').toUpperCase();
  fold.conducted += 1;
  if (EXEMPT.has(code)) {
    fold.exempted += 1;
    return;
  }
  if (ATTENDED.has(code)) fold.attended += 1;
  if (LEAVE.has(code)) fold.leave += 1;
  if (DUTY.has(code)) fold.duty += 1;
  if (ABSENT.has(code)) fold.absent += 1;
  if (COUNTED_AS_PRESENT.has(code)) fold.countedPresent += 1;
}

/** Percentage uses classes actually conducted, after exempted rows are removed. */
export function percentageFromFold(fold: StatusFold): number {
  const denominator = fold.conducted - fold.exempted;
  if (denominator <= 0) return 0;
  return Math.round((fold.countedPresent / denominator) * 10000) / 100;
}

/** Extra conducted classes still required at the policy threshold, with no further absences. */
export function classesStillNeeded(
  conducted: number,
  countedPresent: number,
  thresholdPct: number,
): number {
  if (conducted <= 0 || thresholdPct <= 0) return 0;
  return Math.max(
    0,
    Math.ceil((thresholdPct / 100) * conducted - countedPresent),
  );
}

export function shortageBand(
  percentage: number,
  thresholdPct: number,
): 'CLEAR' | 'NEAR' | 'MID' | 'LOW' {
  if (percentage >= thresholdPct) return 'CLEAR';
  if (percentage >= Math.max(0, thresholdPct - 5)) return 'NEAR';
  if (percentage >= 60) return 'MID';
  return 'LOW';
}

export function foldEntries(
  entries: Array<{ sessionId: string; status: string }>,
): StatusFold {
  const seen = new Set<string>();
  const fold = emptyFold();
  for (const entry of entries) {
    if (!entry.sessionId || seen.has(entry.sessionId)) continue;
    seen.add(entry.sessionId);
    addStatus(fold, entry.status);
  }
  return fold;
}

export function isConductedSessionStatus(status: string) {
  return ['MARKED', 'LOCKED', 'FROZEN'].includes(
    String(status ?? '').toUpperCase(),
  );
}

export type SessionAttendanceRole =
  | 'conducted'
  | 'scheduled'
  | 'cancelled'
  | 'excluded';

/**
 * Holidays, non-working days, and cancelled classes stay out of the percentage.
 * A relocated or forced class on that date is still conducted when it was marked.
 */
export function classifyAttendanceSession(input: {
  sessionStatus: string;
  blockedCalendarDay: boolean;
  relocatedOrForced: boolean;
}): SessionAttendanceRole {
  const status = String(input.sessionStatus ?? '').toUpperCase();
  if (status === 'CANCELLED') return 'cancelled';
  if (input.blockedCalendarDay && !input.relocatedOrForced) return 'excluded';
  if (isConductedSessionStatus(status)) return 'conducted';
  return 'scheduled';
}

export function countPlannerDays(
  days: Array<{
    isWorkingDay: boolean;
    createsAttendanceSession: boolean;
    dayKind: string;
  }>,
) {
  let workingDays = 0;
  let holidays = 0;
  let weekends = 0;
  let specialWorkingDays = 0;
  for (const day of days) {
    const special = Boolean(day.createsAttendanceSession) && !day.isWorkingDay;
    if (day.isWorkingDay || day.createsAttendanceSession) workingDays += 1;
    if (special) specialWorkingDays += 1;
    if (day.dayKind === 'HOLIDAY') holidays += 1;
    if (day.dayKind === 'WEEKEND' && !day.createsAttendanceSession)
      weekends += 1;
  }
  return {
    workingDays,
    holidays,
    weekends,
    specialWorkingDays,
    calendarDays: days.length,
  };
}
