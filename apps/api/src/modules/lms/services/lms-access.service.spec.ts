import { LmsAccessService } from './lms-access.service';

describe('LmsAccessService', () => {
  it('grants admin LMS when user has lms:manage', () => {
    const prisma = {} as never;
    const svc = new LmsAccessService(prisma);
    expect(
      svc.hasAdminLms({
        sub: 'u1',
        tid: 't1',
        email: 'a@test.edu',
        roles: [],
        permissions: ['lms:manage'],
      }),
    ).toBe(true);
  });
});
