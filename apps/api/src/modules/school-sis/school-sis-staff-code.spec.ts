import {
  nextSchoolStaffEmployeeCode,
  schoolStaffCodePrefix,
} from './school-sis-staff-code';

describe('school staff employee codes', () => {
  it('uses SLS-TCH for teaching staff', () => {
    expect(schoolStaffCodePrefix('TEACHING')).toBe('SLS-TCH');
    expect(nextSchoolStaffEmployeeCode([], 'TEACHING')).toBe('SLS-TCH-001');
  });

  it('uses SLS-NTC for non-teaching staff', () => {
    expect(schoolStaffCodePrefix('NON_TEACHING')).toBe('SLS-NTC');
    expect(nextSchoolStaffEmployeeCode([], 'NON_TEACHING')).toBe('SLS-NTC-001');
  });

  it('increments the highest existing number of the same prefix', () => {
    expect(
      nextSchoolStaffEmployeeCode(
        ['SLS-TCH-001', 'SLS-TCH-004', 'SLS-NTC-002', 'SLS-T-001'],
        'TEACHING',
      ),
    ).toBe('SLS-TCH-005');
    expect(
      nextSchoolStaffEmployeeCode(
        ['SLS-NTC-009', 'SLS-TCH-012'],
        'NON_TEACHING',
      ),
    ).toBe('SLS-NTC-010');
  });
});
