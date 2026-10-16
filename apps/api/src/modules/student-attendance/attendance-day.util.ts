export type AttendanceDayDecisionInput = {
  weekendHolidayHandling: 'SKIP_NON_WORKING' | 'ALLOW_IF_GENERATED';
  isWorkingDay: boolean;
  createsAttendanceSession: boolean;
  dayKind: string;
  eventTitles?: string[];
  forceRun: boolean;
  dayCancelled: boolean;
  /** A class was explicitly moved onto this date. */
  relocated: boolean;
};

/** Whether the published weekday timetable should open sessions on this date. */
export function dayTemplateShouldRun(
  input: AttendanceDayDecisionInput,
): boolean {
  if (
    input.dayCancelled &&
    !input.forceRun &&
    !input.createsAttendanceSession
  ) {
    return false;
  }
  if (input.weekendHolidayHandling === 'ALLOW_IF_GENERATED') return true;
  return input.isWorkingDay || input.createsAttendanceSession || input.forceRun;
}

/** Whether a class on this date may be marked. Relocated and holiday-class dates stay open. */
export function sessionMarkingAllowed(input: AttendanceDayDecisionInput): {
  allowed: boolean;
  reason: string | null;
} {
  if (input.weekendHolidayHandling === 'ALLOW_IF_GENERATED') {
    return { allowed: true, reason: null };
  }
  if (input.relocated || input.forceRun || input.createsAttendanceSession) {
    return { allowed: true, reason: null };
  }
  if (input.dayCancelled) {
    return {
      allowed: false,
      reason:
        'This date is cancelled on the academic calendar. Attendance cannot be marked.',
    };
  }
  if (!input.isWorkingDay) {
    const title = input.eventTitles?.find((value) => value.trim());
    const label = title ? `${input.dayKind} (${title})` : input.dayKind;
    return {
      allowed: false,
      reason: `Attendance is closed because the academic calendar marks this date as ${label}.`,
    };
  }
  return { allowed: true, reason: null };
}
