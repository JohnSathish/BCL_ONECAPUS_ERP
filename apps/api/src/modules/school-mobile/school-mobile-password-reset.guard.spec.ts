import { ForbiddenException } from '@nestjs/common';
import {
  SchoolMobilePasswordResetGuard,
  schoolMobilePasswordResetAllowed,
} from './school-mobile-password-reset.guard';

function ctx(url: string, user?: { mustResetPassword?: boolean }) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ originalUrl: url, user }),
    }),
  } as never;
}

describe('schoolMobilePasswordResetAllowed', () => {
  it('allows every route when the account does not need a reset', () => {
    expect(
      schoolMobilePasswordResetAllowed('/api/v1/school-mobile/home', false),
    ).toBe(true);
  });

  it('allows token refresh while a reset is required', () => {
    expect(
      schoolMobilePasswordResetAllowed(
        '/api/v1/school-mobile/auth/refresh',
        true,
      ),
    ).toBe(true);
  });

  it('allows change-password and logout while a reset is required', () => {
    expect(
      schoolMobilePasswordResetAllowed(
        '/api/v1/school-mobile/change-password',
        true,
      ),
    ).toBe(true);
    expect(
      schoolMobilePasswordResetAllowed(
        '/api/v1/school-mobile/auth/logout',
        true,
      ),
    ).toBe(true);
  });

  it('blocks home and attendance while a reset is required', () => {
    expect(
      schoolMobilePasswordResetAllowed('/api/v1/school-mobile/home', true),
    ).toBe(false);
    expect(
      schoolMobilePasswordResetAllowed(
        '/api/v1/school-mobile/attendance/roster',
        true,
      ),
    ).toBe(false);
  });
});

describe('SchoolMobilePasswordResetGuard', () => {
  const guard = new SchoolMobilePasswordResetGuard();

  it('lets authenticated users through when the flag is clear', () => {
    expect(guard.canActivate(ctx('/api/v1/school-mobile/home', {}))).toBe(true);
  });

  it('blocks dashboard access until the temporary password is changed', () => {
    expect(() =>
      guard.canActivate(
        ctx('/api/v1/school-mobile/home', { mustResetPassword: true }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('still allows the change-password endpoint', () => {
    expect(
      guard.canActivate(
        ctx('/api/v1/school-mobile/change-password', {
          mustResetPassword: true,
        }),
      ),
    ).toBe(true);
  });
});
