import { ConflictException } from '@nestjs/common';
import { StaffCollegeLoginSyncService } from './staff-college-login-sync.service';

function staffRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'staff-1',
    tenantId: 'tenant-1',
    fullName: 'Kaushik Paul',
    email: 'kaushik.cs@donboscocollege.ac.in',
    publicEmail: null,
    personalEmail: null,
    portalUserId: 'user-1',
    portalUser: {
      id: 'user-1',
      email: 'kaushikpaul345@gmail.com',
      username: 'kaushikpaul345@gmail.com',
      deletedAt: null,
    },
    ...overrides,
  };
}

describe('StaffCollegeLoginSyncService', () => {
  function setup(staff: ReturnType<typeof staffRow> | null) {
    const tx = {
      user: { update: jest.fn().mockResolvedValue({}) },
      staffProfile: { update: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      staffProfile: {
        findMany: jest.fn().mockResolvedValue(staff ? [{ id: staff.id }] : []),
        findFirst: jest.fn().mockResolvedValue(staff),
      },
      user: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<void>) =>
        fn(tx),
      ),
    };
    const service = new StaffCollegeLoginSyncService(prisma as never);
    return { service, prisma, tx };
  }

  it('sets the portal login to the official college email and keeps the personal address', async () => {
    const { service, tx } = setup(staffRow());

    const result = await service.syncStaffPortalLogin('staff-1');

    expect(result).toEqual({
      status: 'updated',
      email: 'kaushik.cs@donboscocollege.ac.in',
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        email: 'kaushik.cs@donboscocollege.ac.in',
        username: 'kaushik.cs@donboscocollege.ac.in',
      },
    });
    expect(tx.staffProfile.update).toHaveBeenCalledWith({
      where: { id: 'staff-1' },
      data: { personalEmail: 'kaushikpaul345@gmail.com' },
    });
  });

  it('uses the public college email when the profile email is still personal', async () => {
    const { service, tx } = setup(
      staffRow({
        email: 'kaushikpaul345@gmail.com',
        publicEmail: 'Kaushik.CS@DonBoscoCollege.ac.in',
      }),
    );

    const result = await service.syncStaffPortalLogin('staff-1');

    expect(result.status).toBe('updated');
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'kaushik.cs@donboscocollege.ac.in',
        }),
      }),
    );
  });

  it('leaves a personal login unchanged when no official college email is stored', async () => {
    const { service, tx } = setup(
      staffRow({
        email: 'kaushikpaul345@gmail.com',
        publicEmail: null,
        portalUser: {
          id: 'user-1',
          email: 'kaushikpaul345@gmail.com',
          username: 'kaushikpaul345@gmail.com',
          deletedAt: null,
        },
      }),
    );

    const result = await service.syncStaffPortalLogin('staff-1');

    expect(result).toEqual({ status: 'skipped' });
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('does not overwrite a login that already matches the college email', async () => {
    const { service, tx } = setup(
      staffRow({
        portalUser: {
          id: 'user-1',
          email: 'kaushik.cs@donboscocollege.ac.in',
          username: 'KAUSHIK',
          deletedAt: null,
        },
      }),
    );

    const result = await service.syncStaffPortalLogin('staff-1');

    expect(result.status).toBe('unchanged');
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('skips a college email that already belongs to another login', async () => {
    const { service, prisma, tx } = setup(staffRow());
    prisma.user.findFirst.mockResolvedValueOnce({ id: 'user-2' });

    const result = await service.syncStaffPortalLogin('staff-1');

    expect(result.status).toBe('conflict');
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('reports the conflict when a profile save must not continue', async () => {
    const { service, prisma } = setup(staffRow());
    prisma.user.findFirst.mockResolvedValueOnce({ id: 'user-2' });

    await expect(
      service.syncStaffPortalLogin('staff-1', { strict: true }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
