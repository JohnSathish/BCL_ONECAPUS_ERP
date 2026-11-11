import { matchCanonicalDemoLogin } from './canonical-demo-login';

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
});
