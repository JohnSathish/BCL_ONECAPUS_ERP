import { eventAppliesToShift } from './academic-calendar.types';

describe('eventAppliesToShift', () => {
  const dayExam = {
    shiftId: null,
    title: 'FYUGP 2nd Internal Assessment October 2026 · Day',
  };
  const morningExam = {
    shiftId: null,
    title: 'FYUGP 2nd Internal Assessment October 2026 · Morning',
  };
  const holiday = { shiftId: null, title: 'College holiday' };

  it('keeps the Day exam and drops the Morning exam on Day Shift', () => {
    expect(eventAppliesToShift(dayExam, 'day-id', 'Day Shift')).toBe(true);
    expect(eventAppliesToShift(morningExam, 'day-id', 'Day Shift')).toBe(false);
    expect(eventAppliesToShift(holiday, 'day-id', 'Day Shift')).toBe(true);
  });

  it('keeps the Morning exam on Morning Shift', () => {
    expect(
      eventAppliesToShift(morningExam, 'morning-id', 'Morning Shift'),
    ).toBe(true);
    expect(eventAppliesToShift(dayExam, 'morning-id', 'Morning Shift')).toBe(
      false,
    );
  });

  it('prefers a stored shift id over the title', () => {
    expect(
      eventAppliesToShift(
        { shiftId: 'day-id', title: 'FYUGP 2nd IA · Morning' },
        'day-id',
        'Day Shift',
      ),
    ).toBe(true);
    expect(
      eventAppliesToShift(
        { shiftId: 'morning-id', title: 'FYUGP 2nd IA · Day' },
        'day-id',
        'Day Shift',
      ),
    ).toBe(false);
  });
});
