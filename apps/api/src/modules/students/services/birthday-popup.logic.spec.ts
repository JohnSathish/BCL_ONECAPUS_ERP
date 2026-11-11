import {
  birthdayOccursToday,
  istBirthdayDateKey,
  observesLeapDayOn,
} from './birthday-popup.logic';

describe('birthday popup date', () => {
  it('matches the day and month and ignores the birth year', () => {
    const dob = new Date(Date.UTC(2005, 6, 15));
    expect(
      birthdayOccursToday(dob, new Date('2027-07-15T08:00:00+05:30')),
    ).toBe(true);
    expect(
      birthdayOccursToday(dob, new Date('2027-07-16T08:00:00+05:30')),
    ).toBe(false);
  });

  it('uses India time when the device clock is on another timezone', () => {
    const dob = new Date(Date.UTC(2005, 6, 15));
    expect(birthdayOccursToday(dob, new Date('2027-07-14T20:00:00Z'))).toBe(
      true,
    );
    expect(birthdayOccursToday(dob, new Date('2027-07-15T20:00:00Z'))).toBe(
      false,
    );
  });

  it('observes 29 February on 28 February in a non-leap year', () => {
    const dob = new Date(Date.UTC(2004, 1, 29));
    expect(observesLeapDayOn(new Date('2027-02-28T10:00:00+05:30'))).toBe(true);
    expect(
      birthdayOccursToday(dob, new Date('2027-02-28T10:00:00+05:30')),
    ).toBe(true);
    expect(
      birthdayOccursToday(dob, new Date('2028-02-29T10:00:00+05:30')),
    ).toBe(true);
    expect(
      birthdayOccursToday(dob, new Date('2027-03-01T10:00:00+05:30')),
    ).toBe(false);
  });

  it('does not treat a missing date as a birthday', () => {
    expect(birthdayOccursToday(null)).toBe(false);
    expect(birthdayOccursToday(new Date('invalid'))).toBe(false);
  });

  it('keys the celebration by the IST date so next year is a new popup', () => {
    expect(istBirthdayDateKey(new Date('2026-11-11T02:00:00Z'))).toBe(
      '2026-11-11',
    );
    expect(istBirthdayDateKey(new Date('2027-11-10T20:00:00Z'))).toBe(
      '2027-11-11',
    );
  });
});
