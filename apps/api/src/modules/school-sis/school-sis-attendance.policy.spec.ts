import {
  DEFAULT_ATTENDANCE_POLICY,
  mergeAttendancePolicy,
  policyFromSettingsRow,
} from './school-sis-attendance.policy';

describe('school attendance policy', () => {
  it('fills defaults for an empty policy blob', () => {
    expect(mergeAttendancePolicy({})).toEqual(DEFAULT_ATTENDANCE_POLICY);
    expect(mergeAttendancePolicy(undefined).correctionWindowDays).toBe(7);
  });

  it('keeps administrator-configured weights and lock mode', () => {
    const policy = mergeAttendancePolicy({
      lateWeight: 0.5,
      lockMode: 'AFTER_SUBMIT',
      lockAfterDays: 2,
      goodPercent: 88,
    });
    expect(policy.lateWeight).toBe(0.5);
    expect(policy.lockMode).toBe('AFTER_SUBMIT');
    expect(policy.lockAfterDays).toBe(2);
    expect(policy.goodPercent).toBe(88);
  });

  it('rejects unknown lock modes', () => {
    expect(mergeAttendancePolicy({ lockMode: 'NEVER' }).lockMode).toBe(
      'AFTER_DAYS',
    );
  });

  it('honours legacy lateCountsPresent when the JSON still has the default late weight', () => {
    expect(
      policyFromSettingsRow({ lateCountsPresent: false, policy: {} })
        .lateWeight,
    ).toBe(0);
  });
});
