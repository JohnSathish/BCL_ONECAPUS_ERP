import { resolveStudentFullName } from './attendance-display.util';

describe('resolveStudentFullName', () => {
  it('uses the profile name when it is present', () => {
    expect(
      resolveStudentFullName({
        masterProfile: { fullName: 'Agnel Marak' },
        user: { displayName: 'Login Name' },
      }),
    ).toBe('Agnel Marak');
  });

  it('uses the login name when the profile name is blank', () => {
    expect(
      resolveStudentFullName({
        masterProfile: { fullName: '   ' },
        user: { displayName: 'Albinson Sangma' },
        rollNumber: 'BA24-002',
      }),
    ).toBe('Albinson Sangma');
  });

  it('uses the roll number when neither name is stored', () => {
    expect(
      resolveStudentFullName({
        masterProfile: null,
        user: { displayName: '' },
        rollNumber: 'BA24-003',
      }),
    ).toBe('BA24-003');
  });
});
