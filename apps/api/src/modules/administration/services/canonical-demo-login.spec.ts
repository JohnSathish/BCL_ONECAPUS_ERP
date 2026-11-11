import { istCalendar } from '../../communication/domain/birthday-calendar';
import {
  demoStudentBirthdayDate,
  matchCanonicalDemoLogin,
} from './canonical-demo-login';

describe('matchCanonicalDemoLogin', () => {
  it('accepts the published student and staff logins', () => {
    expect(
      matchCanonicalDemoLogin('demo-student', 'DemoStudent@2026')?.loginId,
    ).toBe('DEMO-STUDENT');
    expect(
      matchCanonicalDemoLogin(' DEMO-STAFF ', 'DemoStaff@2026')?.kind,
    ).toBe('STAFF');
  });

  it('rejects a different password', () => {
    expect(
      matchCanonicalDemoLogin('DEMO-STUDENT', 'wrong-password'),
    ).toBeNull();
  });

  it('sets the demo student birthday to today in India', () => {
    const dob = demoStudentBirthdayDate();
    const today = istCalendar();
    expect(dob.getUTCFullYear()).toBe(today.year);
    expect(dob.getUTCMonth() + 1).toBe(today.month);
    expect(dob.getUTCDate()).toBe(today.day);
  });
});
