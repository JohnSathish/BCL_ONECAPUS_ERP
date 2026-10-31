import { parseDateOnly } from '../../academic-calendar/academic-calendar.types';
import {
  addCalendarDays,
  addWorkingDays,
  collegeDateIso,
  endOfCollegeDate,
  fineFromOverdueDays,
  isLoanDayClosed,
  overdueWorkingDays,
  renewalPeriodDays,
  type LoanDayRules,
} from './library-loan-calendar.logic';

const ISSUE = '2026-11-02';
const sundayRules: LoanDayRules = {
  excludeWeekends: true,
  excludeHolidays: true,
  weekendDays: [0],
};

function sunday(iso: string): boolean {
  return parseDateOnly(iso).getUTCDay() === 0;
}

describe('library loan calendar', () => {
  it('knows 2 November 2026 is a Monday and does not count the issue date', () => {
    expect(parseDateOnly(ISSUE).getUTCDay()).toBe(1);
    expect(addWorkingDays(ISSUE, 1, () => false)).toBe('2026-11-03');
    expect(addWorkingDays(ISSUE, 14, () => false)).toBe(
      addCalendarDays(ISSUE, 14),
    );
  });

  it('issues 14 working days that cross Sundays', () => {
    const due = addWorkingDays(ISSUE, 14, sunday);
    expect(due).toBe('2026-11-18');
    expect(due).not.toBe(addCalendarDays(ISSUE, 14));
  });

  it('issues across several college holidays and Sundays', () => {
    const holidays = new Set(['2026-11-04', '2026-11-05']);
    const due = addWorkingDays(ISSUE, 14, (iso) =>
      isLoanDayClosed(iso, sundayRules, holidays),
    );
    expect(due).toBe('2026-11-20');
  });

  it('counts a Sunday that is also a college holiday once', () => {
    const sundayHoliday = new Set(['2026-11-08', '2026-11-08']);
    expect(sundayHoliday.size).toBe(1);
    const withOverlap = addWorkingDays(ISSUE, 14, (iso) =>
      isLoanDayClosed(iso, sundayRules, sundayHoliday),
    );
    const sundaysOnly = addWorkingDays(ISSUE, 14, sunday);
    expect(withOverlap).toBe(sundaysOnly);
    expect(withOverlap).toBe('2026-11-18');
  });

  it('renews across Sundays and holidays without adding calendar days', () => {
    const currentDue = '2026-11-18';
    const holidays = new Set(['2026-11-26', '2026-11-27']);
    const renewed = addWorkingDays(currentDue, 14, (iso) =>
      isLoanDayClosed(iso, sundayRules, holidays),
    );
    expect(renewed).toBe('2026-12-07');
    expect(renewed).not.toBe(addCalendarDays(currentDue, 14));
    expect(renewalPeriodDays(14, null)).toBe(14);
    expect(renewalPeriodDays(30, 7)).toBe(7);
  });

  it('counts a return after the due date in working days only', () => {
    const due = '2026-11-06';
    expect(parseDateOnly(due).getUTCDay()).toBe(5);
    expect(overdueWorkingDays(due, due, 0, sunday)).toBe(0);
    expect(overdueWorkingDays(due, '2026-11-08', 0, sunday)).toBe(1);
    expect(overdueWorkingDays(due, '2026-11-09', 0, sunday)).toBe(2);
  });

  it('charges a fine only for overdue working days', () => {
    const due = '2026-11-18';
    const holidays = new Set(['2026-11-19', '2026-11-20']);
    const closed = (iso: string) => isLoanDayClosed(iso, sundayRules, holidays);
    const days = overdueWorkingDays(due, '2026-11-22', 0, closed);
    expect(days).toBe(1);
    expect(fineFromOverdueDays(days, 5, 100)).toBe(5);
    expect(overdueWorkingDays(due, '2026-11-23', 0, closed)).toBe(2);
    expect(overdueWorkingDays(due, '2026-11-23', 1, closed)).toBe(1);
    expect(fineFromOverdueDays(0, 5, 100)).toBe(0);
  });

  it('keeps a saved due date when a holiday is added later', () => {
    const savedDue = '2026-11-18';
    const before = overdueWorkingDays(savedDue, '2026-11-20', 0, sunday);
    const afterHolidayAdded = overdueWorkingDays(
      savedDue,
      '2026-11-20',
      0,
      (iso) => sunday(iso) || iso === '2026-11-19',
    );
    expect(savedDue).toBe('2026-11-18');
    expect(before).toBe(2);
    expect(afterHolidayAdded).toBe(1);
    expect(addWorkingDays(ISSUE, 14, sunday)).toBe(savedDue);
    expect(
      addWorkingDays(ISSUE, 14, (iso) => sunday(iso) || iso === '2026-11-04'),
    ).not.toBe(savedDue);
  });

  it('uses a different period for students, staff, and faculty', () => {
    const student = addWorkingDays(ISSUE, 14, sunday);
    const staff = addWorkingDays(ISSUE, 21, sunday);
    const faculty = addWorkingDays(ISSUE, 30, sunday);
    expect(student).toBe('2026-11-18');
    expect(staff).toBe('2026-11-26');
    expect(faculty).toBe('2026-12-07');
  });

  it('stores the due date at the end of the college day', () => {
    const due = endOfCollegeDate('2026-11-18');
    expect(collegeDateIso(due)).toBe('2026-11-18');
    expect(collegeDateIso(new Date(due.getTime() + 1))).toBe('2026-11-19');
  });
});
