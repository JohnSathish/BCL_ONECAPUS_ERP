import { resolveSchoolStaffIdForUser } from './school-sis-staff-lookup';

function prismaMock(overrides: Record<string, unknown> = {}) {
  return {
    schoolPersonAccount: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    user: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    schoolStaff: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    ...overrides,
  };
}

const user = { sub: 'user-1', email: 'staff.slstch004@portal.stlukestura.in' };

describe('resolveSchoolStaffIdForUser', () => {
  it('uses the person-account link first', async () => {
    const prisma = prismaMock();
    prisma.schoolPersonAccount.findFirst.mockResolvedValue({
      staffId: 'staff-linked',
    });
    await expect(
      resolveSchoolStaffIdForUser(prisma as never, 't1', user),
    ).resolves.toBe('staff-linked');
    expect(prisma.schoolStaff.findFirst).not.toHaveBeenCalled();
  });

  it('matches employee code when staff email is empty', async () => {
    const prisma = prismaMock();
    prisma.user.findFirst.mockResolvedValue({
      email: user.email,
      username: 'SLS-TCH-004',
      displayName: 'Irene S. Sangma',
    });
    prisma.schoolStaff.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'staff-irene' });
    await expect(
      resolveSchoolStaffIdForUser(prisma as never, 't1', user),
    ).resolves.toBe('staff-irene');
  });

  it('matches a unique staff full name as last resort', async () => {
    const prisma = prismaMock();
    prisma.user.findFirst.mockResolvedValue({
      email: user.email,
      username: 'irene.office',
      displayName: 'Irene S. Sangma',
    });
    prisma.schoolStaff.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'staff-irene' }]);
    await expect(
      resolveSchoolStaffIdForUser(prisma as never, 't1', user),
    ).resolves.toBe('staff-irene');
  });

  it('returns null when nothing matches', async () => {
    const prisma = prismaMock();
    await expect(
      resolveSchoolStaffIdForUser(prisma as never, 't1', user),
    ).resolves.toBeNull();
  });
});
