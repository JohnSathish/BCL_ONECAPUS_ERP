import {
  attendancePercent,
  attendanceStatusLabel,
  bandForPercent,
  sessionNaturalKey,
  unitForStatus,
} from './school-sis-attendance.rules';

describe('school attendance percentage rules', () => {
  const settings = {
    lateCountsPresent: true,
    halfDayValue: 0.5,
    leaveCountsPresent: false,
    excusedCountsPresent: true,
  };

  it('does not use raw present/total when leave/half-day/late are configured', () => {
    const earned =
      unitForStatus('PRESENT', settings) +
      unitForStatus('LATE', settings) +
      unitForStatus('HALF_DAY', settings) +
      unitForStatus('LEAVE', settings) +
      unitForStatus('EXCUSED', settings) +
      unitForStatus('ABSENT', settings);
    expect(earned).toBe(1 + 1 + 0.5 + 0 + 1 + 0);
    expect(attendancePercent(earned, 6)).toBe(58.33);
  });

  it('counts leave toward percentage when the school enables it', () => {
    expect(
      unitForStatus('LEAVE', { ...settings, leaveCountsPresent: true }),
    ).toBe(1);
  });

  it('uses configurable warning bands', () => {
    expect(bandForPercent(90, 85, 75)).toBe('GREEN');
    expect(bandForPercent(80, 85, 75)).toBe('WARNING');
    expect(bandForPercent(70, 85, 75)).toBe('CRITICAL');
  });

  it('labels student attendance for the reports desk', () => {
    expect(attendanceStatusLabel(95, 85, 75)).toBe('Excellent');
    expect(attendanceStatusLabel(90, 85, 75)).toBe('Good');
    expect(attendanceStatusLabel(80, 85, 75)).toBe('Normal');
    expect(attendanceStatusLabel(75, 85, 75)).toBe('Warning');
  });

  it('builds a unique daily session key including period', () => {
    expect(
      sessionNaturalKey({
        academicYearId: 'y',
        date: '2026-09-16',
        sectionId: 's',
        mode: 'DAILY',
        periodKey: 'DAILY',
      }),
    ).toBe('y|2026-09-16|s|DAILY|DAILY');
  });
});
