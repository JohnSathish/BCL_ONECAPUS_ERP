import {
  addCalendarDays,
  birthdayChannels,
  birthdayVariables,
  classifyWish,
  istDayBounds,
  monthDayPairs,
  normalizeBirthdayTemplate,
  normalizeSendTime,
} from './birthday-calendar';

describe('birthday calendar', () => {
  it('keeps a 30-day window inside the calendar, including the year boundary', () => {
    const pairs = monthDayPairs({ year: 2026, month: 12, day: 28 }, 7);
    expect(pairs).toEqual(
      expect.arrayContaining([
        { month: 12, day: 28 },
        { month: 1, day: 1 },
        { month: 1, day: 3 },
      ]),
    );
    expect(addCalendarDays({ year: 2026, month: 12, day: 31 }, 1)).toEqual({
      year: 2027,
      month: 1,
      day: 1,
    });
  });

  it('includes 29 February birthdays on 28 February in a non-leap year', () => {
    const pairs = monthDayPairs({ year: 2026, month: 2, day: 28 }, 1);
    expect(pairs).toEqual([
      { month: 2, day: 28 },
      { month: 2, day: 29 },
    ]);
  });

  it('stores a push wish in the in-app inbox channel as well', () => {
    expect(birthdayChannels(['PUSH'])).toEqual(
      expect.arrayContaining(['PUSH', 'IN_APP']),
    );
    expect(birthdayChannels(['EMAIL'])).toEqual(['EMAIL']);
  });

  it('maps the greeting placeholders the office types', () => {
    const rendered = normalizeBirthdayTemplate(
      'Happy Birthday, {name} from {college_name} ({department})',
    );
    expect(rendered).toBe(
      'Happy Birthday, {{name}} from {{college_name}} ({{department}})',
    );
    expect(
      birthdayVariables({
        fullName: 'Aisha',
        department: 'English',
        collegeName: 'Don Bosco College, Tura',
      }).name,
    ).toBe('Aisha');
  });

  it('classifies delivery without hiding a confirmed wish', () => {
    expect(
      classifyWish({ when: 'TODAY', hasTrigger: true, delivery: 'SUCCESS' }),
    ).toBe('SENT');
    expect(
      classifyWish({ when: 'TODAY', hasTrigger: false, delivery: 'NONE' }),
    ).toBe('PENDING');
    expect(
      classifyWish({ when: 'FUTURE', hasTrigger: false, delivery: 'NONE' }),
    ).toBe('UPCOMING');
    expect(
      classifyWish({ when: 'TODAY', hasTrigger: true, delivery: 'FAILED' }),
    ).toBe('FAILED');
  });

  it('bounds an IST day in UTC', () => {
    const { start, end } = istDayBounds('2026-11-11');
    expect(start.toISOString()).toBe('2026-11-10T18:30:00.000Z');
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
    expect(normalizeSendTime('8:00')).toBe('08:00');
    expect(normalizeSendTime('25:00')).toBeNull();
  });
});
