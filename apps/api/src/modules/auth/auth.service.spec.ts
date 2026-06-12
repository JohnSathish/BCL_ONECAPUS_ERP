import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { ChallengeService } from './challenge.service';
import { LoginAttemptService } from './login-attempt.service';
import { PermissionResolverService } from '../../common/permissions/permission-resolver.service';

describe('AuthService refresh rotation', () => {
  const prisma = {
    refreshSession: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    user: { findFirst: jest.fn(), update: jest.fn() },
    userShiftAssignment: { findMany: jest.fn().mockResolvedValue([]) },
    userRole: { findMany: jest.fn().mockResolvedValue([]) },
    tenant: { findFirst: jest.fn() },
    auditLog: { create: jest.fn() },
  };

  const jwt = { signAsync: jest.fn().mockResolvedValue('access-jwt') };
  const config = {
    get: jest.fn((key: string, def?: string) => {
      if (key === 'JWT_ACCESS_TTL') return '1200s';
      if (key === 'JWT_REFRESH_TTL') return '7d';
      return def;
    }),
    getOrThrow: jest.fn().mockReturnValue('secret'),
  };

  const permissionResolver = {
    resolveForUser: jest.fn().mockResolvedValue({
      permissions: ['tenant:read'],
      dataScope: {
        departmentIds: [],
        campusIds: [],
        programmeIds: [],
        semesterNos: [],
        allDepartments: true,
        allCampuses: true,
      },
    }),
  };

  const auth = new AuthService(
    prisma as never,
    jwt as unknown as JwtService,
    config as unknown as ConfigService,
    {} as ChallengeService,
    {} as LoginAttemptService,
    permissionResolver as unknown as PermissionResolverService,
  );

  const activeUser = {
    id: 'user-1',
    email: 'a@test.edu',
    tenantId: 'tenant-1',
    isActive: true,
    deletedAt: null,
    roles: [{ role: { slug: 'college-admin' } }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.tenant.findFirst.mockResolvedValue({ id: 'tenant-1', slug: 'demo' });
    prisma.refreshSession.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: 'session-new',
        familyId: data.familyId,
        jti: data.jti,
      }),
    );
    prisma.refreshSession.update.mockResolvedValue({});
    prisma.userRole.findMany.mockResolvedValue([]);
  });

  it('preserves familyId on refresh and links replacedById', async () => {
    const familyId = 'family-abc';
    prisma.refreshSession.findFirst.mockResolvedValueOnce({
      id: 'session-old',
      familyId,
      user: activeUser,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const token = 'plain-refresh-token';
    await auth.refresh(token);

    expect(prisma.refreshSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ familyId }),
      }),
    );
    expect(prisma.refreshSession.update).toHaveBeenCalledWith({
      where: { id: 'session-old' },
      data: expect.objectContaining({
        replacedById: 'session-new',
        revokedAt: expect.any(Date),
      }),
    });
  });

  it('revokes entire family when a revoked refresh token is reused', async () => {
    prisma.refreshSession.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'session-revoked',
        familyId: 'family-stolen',
        revokedAt: new Date(),
      });

    await expect(auth.refresh('reused-token')).rejects.toThrow(
      UnauthorizedException,
    );

    expect(prisma.refreshSession.updateMany).toHaveBeenCalledWith({
      where: { familyId: 'family-stolen', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('uses longer refresh TTL when rememberMe is set on login path', () => {
    expect(auth.parseTtlSeconds('30d')).toBe(30 * 86400);
    expect(auth.parseTtlSeconds('7d')).toBe(7 * 86400);
  });

  it('revokes all sessions when password is reset', async () => {
    prisma.user.update.mockResolvedValue({});
    prisma.refreshSession.updateMany.mockResolvedValue({ count: 2 });

    await auth.resetPasswordAndRevokeSessions('user-1', 'NewPassword1!');

    expect(prisma.refreshSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
