import {
  preferredSchoolLoginUsername,
  schoolLoginCompacts,
} from './school-sis-login-lookup';

describe('schoolLoginCompacts', () => {
  it('treats SLS26-0108 and SLS2026-0108 as the same keys', () => {
    const short = schoolLoginCompacts('SLS26-0108');
    const long = schoolLoginCompacts('SLS2026-0108');
    expect(short).toEqual(expect.arrayContaining(['SLS260108', 'SLS20260108']));
    expect(long).toEqual(expect.arrayContaining(['SLS260108', 'SLS20260108']));
  });

  it('treats SLS/2026/0001 and SLS26-0001 as the same keys', () => {
    const admission = schoolLoginCompacts('SLS/2026/0001');
    const roll = schoolLoginCompacts('SLS26-0001');
    expect(admission).toEqual(
      expect.arrayContaining(['SLS20260001', 'SLS260001']),
    );
    expect(roll).toEqual(expect.arrayContaining(['SLS20260001', 'SLS260001']));
  });
});

describe('preferredSchoolLoginUsername', () => {
  it('prefers roll number then admission number', () => {
    expect(
      preferredSchoolLoginUsername({
        rollNumber: 'SLS26-0001',
        admissionNumber: 'SLS/2026/0001',
      }),
    ).toBe('SLS26-0001');
    expect(
      preferredSchoolLoginUsername({
        admissionNumber: 'SLS/2026/0001',
      }),
    ).toBe('SLS/2026/0001');
  });
});
