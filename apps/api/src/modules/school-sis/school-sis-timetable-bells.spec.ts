import { istDayKey, istNowParts } from './school-sis-timetable-bells';

describe('IST calendar helpers', () => {
  it('uses Asia/Kolkata date, not UTC, before 5:30am IST', () => {
    const beforeDawnIst = new Date('2026-09-20T22:57:00.000Z');
    expect(istDayKey(beforeDawnIst)).toBe('2026-09-21');
    expect(beforeDawnIst.toISOString().slice(0, 10)).toBe('2026-09-20');
  });

  it('keeps the same calendar day after 5:30am IST', () => {
    const afternoonIst = new Date('2026-09-21T10:57:00.000Z');
    expect(istDayKey(afternoonIst)).toBe('2026-09-21');
  });

  it('reports Monday morning IST weekday and minutes', () => {
    const dawnIst = new Date('2026-09-20T22:57:00.000Z');
    expect(istNowParts(dawnIst)).toEqual({
      dayOfWeek: 1,
      minutes: 4 * 60 + 27,
    });
  });
});
