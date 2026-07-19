import {
  isSyntheticStudentEmail,
  isTemporaryStudentLoginEmail,
  resolveStudentContactEmail,
} from './student-credentials.util';

describe('student login email helpers', () => {
  it('treats @students.local and @student.* as temporary', () => {
    expect(isTemporaryStudentLoginEmail('ba25895@students.local')).toBe(true);
    expect(
      isTemporaryStudentLoginEmail('ba25895@student.donboscocollege.ac.in'),
    ).toBe(true);
    expect(isSyntheticStudentEmail('ba25895@students.local')).toBe(true);
    expect(
      isSyntheticStudentEmail('ba25895@student.donboscocollege.ac.in'),
    ).toBe(false);
  });

  it('does not treat personal emails as temporary', () => {
    expect(isTemporaryStudentLoginEmail('student@gmail.com')).toBe(false);
    expect(isTemporaryStudentLoginEmail('benisha@donboscocollege.ac.in')).toBe(
      false,
    );
  });

  it('prefers personal profile email over temporary login', () => {
    expect(
      resolveStudentContactEmail(
        'benisha@gmail.com',
        'ba25895@student.donboscocollege.ac.in',
      ),
    ).toBe('benisha@gmail.com');
  });
});
