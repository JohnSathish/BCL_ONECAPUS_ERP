import { resolveLoginHintFromRoles } from './login-hint.util';

describe('resolveLoginHintFromRoles', () => {
  it('maps student role to Student Account', () => {
    expect(resolveLoginHintFromRoles(['student'])).toMatchObject({
      kind: 'student',
      label: 'Student Account',
    });
  });

  it('maps faculty role to Faculty Account', () => {
    expect(resolveLoginHintFromRoles(['faculty'])).toMatchObject({
      kind: 'faculty',
      label: 'Faculty Account',
    });
  });

  it('maps staff role to Staff Account', () => {
    expect(resolveLoginHintFromRoles(['staff'])).toMatchObject({
      kind: 'staff',
      label: 'Staff Account',
    });
  });

  it('maps admin roles to Admin Account', () => {
    expect(resolveLoginHintFromRoles(['college-admin'])).toMatchObject({
      kind: 'admin',
      label: 'Admin Account',
    });
  });

  it('prefers admin over student when both are present', () => {
    expect(
      resolveLoginHintFromRoles(['student', 'college-admin']),
    ).toMatchObject({
      kind: 'admin',
      label: 'Admin Account',
    });
  });
});
