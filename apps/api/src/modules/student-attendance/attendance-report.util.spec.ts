import {
  classifyAttendanceSession,
  countPlannerDays,
  foldEntries,
  percentageFromFold,
} from './attendance-report.util';
import {
  dayTemplateShouldRun,
  sessionMarkingAllowed,
} from './attendance-day.util';

const skip = {
  weekendHolidayHandling: 'SKIP_NON_WORKING' as const,
  isWorkingDay: false,
  createsAttendanceSession: false,
  dayKind: 'HOLIDAY',
  eventTitles: ['Wangala'],
  forceRun: false,
  dayCancelled: false,
  relocated: false,
};

describe('attendance day gate', () => {
  it('closes a holiday and keeps a compensatory class open', () => {
    expect(sessionMarkingAllowed(skip).allowed).toBe(false);
    expect(dayTemplateShouldRun(skip)).toBe(false);
    expect(
      sessionMarkingAllowed({ ...skip, createsAttendanceSession: true })
        .allowed,
    ).toBe(true);
    expect(
      dayTemplateShouldRun({
        ...skip,
        relocated: true,
        createsAttendanceSession: false,
      }),
    ).toBe(false);
    expect(sessionMarkingAllowed({ ...skip, relocated: true }).allowed).toBe(
      true,
    );
  });
});

describe('attendance report math', () => {
  it('uses conducted classes, not calendar working days', () => {
    const fold = foldEntries([
      { sessionId: '1', status: 'P' },
      { sessionId: '2', status: 'P' },
      { sessionId: '3', status: 'P' },
      { sessionId: '4', status: 'A' },
    ]);
    expect(percentageFromFold(fold)).toBe(75);
    expect(fold.conducted).toBe(4);
  });

  it('keeps leave and on-duty visible and counts them under the college rule', () => {
    const fold = foldEntries([
      { sessionId: '1', status: 'P' },
      { sessionId: '2', status: 'L' },
      { sessionId: '3', status: 'OD' },
      { sessionId: '4', status: 'ML' },
      { sessionId: '5', status: 'A' },
    ]);
    expect(fold.attended).toBe(1);
    expect(fold.leave).toBe(2);
    expect(fold.duty).toBe(1);
    expect(fold.absent).toBe(1);
    expect(percentageFromFold(fold)).toBe(60);
  });

  it('does not let a holiday or cancelled class change the percentage', () => {
    expect(
      classifyAttendanceSession({
        sessionStatus: 'MARKED',
        blockedCalendarDay: true,
        relocatedOrForced: false,
      }),
    ).toBe('excluded');
    expect(
      classifyAttendanceSession({
        sessionStatus: 'CANCELLED',
        blockedCalendarDay: false,
        relocatedOrForced: false,
      }),
    ).toBe('cancelled');
    expect(
      classifyAttendanceSession({
        sessionStatus: 'MARKED',
        blockedCalendarDay: true,
        relocatedOrForced: true,
      }),
    ).toBe('conducted');
  });

  it('counts a student once when the same class is repeated', () => {
    const fold = foldEntries([
      { sessionId: '1', status: 'P' },
      { sessionId: '1', status: 'A' },
    ]);
    expect(fold.conducted).toBe(1);
    expect(fold.attended).toBe(1);
    expect(percentageFromFold(fold)).toBe(100);
  });

  it('counts planner working days, holidays, and special classes', () => {
    expect(
      countPlannerDays([
        {
          isWorkingDay: true,
          createsAttendanceSession: false,
          dayKind: 'WORKING',
        },
        {
          isWorkingDay: false,
          createsAttendanceSession: false,
          dayKind: 'HOLIDAY',
        },
        {
          isWorkingDay: false,
          createsAttendanceSession: false,
          dayKind: 'WEEKEND',
        },
        {
          isWorkingDay: false,
          createsAttendanceSession: true,
          dayKind: 'HOLIDAY_CLASS',
        },
      ]),
    ).toEqual({
      workingDays: 2,
      holidays: 1,
      weekends: 1,
      specialWorkingDays: 1,
      calendarDays: 4,
    });
  });
});
