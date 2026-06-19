import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { ChallengeService } from './challenge.service';
import type { AuthSessionResponse, AuthUserPayload } from './auth.types';
import { LoginAttemptService } from './login-attempt.service';
import { PermissionResolverService } from '../../common/permissions/permission-resolver.service';
import type { DataScope } from '../../common/permissions/permission-resolver.service';
import { isSuperAdmin } from '../../common/permissions/permission-registry';

type ShiftScope = {
  shiftIds: string[];
  primaryShiftId?: string;
  allShifts: boolean;
};

type IssueTokensOptions = {
  familyId?: string;
  rememberMe?: boolean;
  previousSessionId?: string;
  meta?: {
    userAgent?: string;
    ipAddress?: string;
    clientType?: string;
    appType?: string;
    appVersion?: string;
    deviceId?: string;
    deviceLabel?: string;
  };
  impersonatedBy?: string;
  impersonationSessionId?: string;
  skipRefreshSession?: boolean;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly challenge: ChallengeService,
    private readonly loginAttempts: LoginAttemptService,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  parseTtlSeconds(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl);
    if (!match) return 1200;
    const value = Number(match[1]);
    const unit = match[2];
    if (unit === 's') return value;
    if (unit === 'm') return value * 60;
    if (unit === 'h') return value * 3600;
    return value * 86400;
  }

  private resolveRefreshTtlSeconds(rememberMe?: boolean): number {
    const ttl = rememberMe
      ? this.config.get<string>('JWT_REFRESH_TTL_REMEMBER', '30d')
      : this.config.get<string>('JWT_REFRESH_TTL', '7d');
    return this.parseTtlSeconds(ttl);
  }

  private async resolveShiftScope(
    userId: string,
    roles: string[],
  ): Promise<ShiftScope> {
    if (isSuperAdmin(roles)) {
      return {
        shiftIds: [],
        primaryShiftId: undefined,
        allShifts: true,
      };
    }

    const [assignments, roleScopes] = await Promise.all([
      this.prisma.userShiftAssignment.findMany({
        where: { userId },
        select: { shiftId: true, isPrimary: true },
      }),
      this.prisma.userRole.findMany({
        where: { userId, deletedAt: null, shiftId: { not: null } },
        select: { shiftId: true },
      }),
    ]);

    const shiftIds = [
      ...new Set([
        ...assignments.map((a) => a.shiftId),
        ...roleScopes.map((r) => r.shiftId!).filter(Boolean),
      ]),
    ];
    const primary =
      assignments.find((a) => a.isPrimary)?.shiftId ?? shiftIds[0];

    return { shiftIds, primaryShiftId: primary, allShifts: false };
  }

  private async resolveUserPermissions(userId: string, roles: string[] = []) {
    return this.permissionResolver.resolveForUser(userId, roles);
  }

  private buildUserPayload(
    user: { id: string; email: string; tenantId: string },
    tenantSlug: string,
    roles: string[],
    permissions: string[],
    shiftScope: ShiftScope,
    dataScope: DataScope,
    impersonation?: { adminUserId: string; sessionId: string },
  ): AuthUserPayload {
    return {
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
      tenantSlug,
      roles,
      permissions,
      shiftIds: shiftScope.shiftIds,
      primaryShiftId: shiftScope.primaryShiftId,
      allShifts: shiftScope.allShifts,
      dataScope,
      impersonatedBy: impersonation?.adminUserId,
      impersonationSessionId: impersonation?.sessionId,
      isImpersonating: !!impersonation,
    };
  }

  private async issueTokens(
    user: { id: string; email: string; tenantId: string },
    tenantSlug: string,
    roles: string[],
    permissions: string[],
    shiftScope: ShiftScope,
    dataScope: DataScope,
    options: IssueTokensOptions = {},
  ): Promise<AuthSessionResponse> {
    const familyId = options.familyId ?? randomUUID();
    const jti = randomUUID();
    const refreshPlain = randomBytes(48).toString('base64url');
    const refreshMaxAgeSeconds = this.resolveRefreshTtlSeconds(
      options.rememberMe,
    );
    const accessTtl = options.skipRefreshSession
      ? '1800s'
      : this.config.get<string>('JWT_ACCESS_TTL', '1200s');
    const accessExpiresIn = this.parseTtlSeconds(accessTtl);

    const refreshExpiresAt = new Date(Date.now() + refreshMaxAgeSeconds * 1000);

    if (!options.skipRefreshSession) {
      await this.prisma.$transaction(async (tx) => {
        const newSession = await tx.refreshSession.create({
          data: {
            tenantId: user.tenantId,
            userId: user.id,
            familyId,
            jti,
            hashedToken: this.hashToken(refreshPlain),
            expiresAt: refreshExpiresAt,
            userAgent: options.meta?.userAgent,
            ipAddress: options.meta?.ipAddress,
            metadata: {
              clientType: options.meta?.clientType,
              appType: options.meta?.appType,
              appVersion: options.meta?.appVersion,
              deviceId: options.meta?.deviceId,
              deviceLabel: options.meta?.deviceLabel,
            },
          },
        });

        if (options.previousSessionId) {
          await tx.refreshSession.updateMany({
            where: { id: options.previousSessionId, revokedAt: null },
            data: {
              revokedAt: new Date(),
              replacedById: newSession.id,
            },
          });
        }
      });
    }

    const accessToken = await this.jwt.signAsync(
      {
        sub: user.id,
        tid: user.tenantId,
        email: user.email,
        roles,
        permissions,
        shiftIds: shiftScope.shiftIds,
        primaryShiftId: shiftScope.primaryShiftId,
        allShifts: shiftScope.allShifts,
        dataScope,
        sid: options.skipRefreshSession ? undefined : jti,
        impersonatedBy: options.impersonatedBy,
        impersonationSessionId: options.impersonationSessionId,
      },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: accessExpiresIn,
      },
    );

    const expiresAt = new Date(
      Date.now() + accessExpiresIn * 1000,
    ).toISOString();

    const impersonation =
      options.impersonatedBy && options.impersonationSessionId
        ? {
            adminUserId: options.impersonatedBy,
            sessionId: options.impersonationSessionId,
          }
        : undefined;

    return {
      accessToken,
      expiresIn: accessExpiresIn,
      expiresAt,
      refreshToken: options.skipRefreshSession ? '' : refreshPlain,
      refreshMaxAgeSeconds: options.skipRefreshSession
        ? 0
        : refreshMaxAgeSeconds,
      user: this.buildUserPayload(
        user,
        tenantSlug,
        roles,
        permissions,
        shiftScope,
        dataScope,
        impersonation,
      ),
    };
  }

  async revokeSessionFamily(familyId: string): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllSessionsForUser(userId: string): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async issueSessionForUser(
    tenantId: string,
    userId: string,
    meta?: { userAgent?: string; ipAddress?: string },
    rememberMe?: boolean,
    extra?: { applicationId?: string; readOnly?: boolean },
  ): Promise<AuthSessionResponse> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null, isActive: true },
      include: {
        roles: { where: { deletedAt: null }, include: { role: true } },
      },
    });
    if (!user) throw new UnauthorizedException('User not found');

    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId, deletedAt: null, status: 'active' },
    });
    if (!tenant) throw new UnauthorizedException('Tenant not found');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const roles = user.roles.map((r) => r.role.slug);
    const resolved = await this.resolveUserPermissions(user.id, roles);
    const shiftScope = await this.resolveShiftScope(user.id, roles);

    const session = await this.issueTokens(
      user,
      tenant.slug,
      roles,
      resolved.permissions,
      shiftScope,
      resolved.dataScope,
      { rememberMe, meta },
    );

    if (extra?.applicationId) {
      (session.user as Record<string, unknown>).applicationId =
        extra.applicationId;
      (session.user as Record<string, unknown>).readOnly =
        extra.readOnly ?? false;
    }

    return session;
  }

  async login(
    tenantId: string,
    email: string,
    password: string,
    challengeToken: string,
    challengeAnswer: number,
    meta?: {
      userAgent?: string;
      ipAddress?: string;
      clientType?: string;
      appType?: string;
      appVersion?: string;
      deviceId?: string;
    },
    rememberMe?: boolean,
  ): Promise<AuthSessionResponse> {
    const ip = meta?.ipAddress ?? 'unknown';
    const normalizedEmail = email.trim().toLowerCase();
    await this.loginAttempts.assertNotLocked(tenantId, ip, normalizedEmail);

    if (!this.challenge.verify(challengeToken, challengeAnswer)) {
      throw new BadRequestException(
        'Invalid verification answer. Solve the equation shown on the form (use the refresh button if it changed).',
      );
    }

    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId, deletedAt: null, status: 'active' },
    });
    if (!tenant) throw new UnauthorizedException('Invalid credentials');

    const user = await this.prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
        email: normalizedEmail,
        deletedAt: null,
        isActive: true,
      },
      include: {
        roles: {
          where: { deletedAt: null },
          include: { role: true },
        },
      },
    });
    if (!user) {
      await this.loginAttempts.recordFailure(tenantId, ip, normalizedEmail);
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      await this.loginAttempts.recordFailure(tenantId, ip, normalizedEmail);
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.loginAttempts.resetOnSuccess(tenantId, ip, normalizedEmail);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const roles = user.roles.map((r) => r.role.slug);
    const resolved = await this.resolveUserPermissions(user.id, roles);
    const shiftScope = await this.resolveShiftScope(user.id, roles);
    const session = await this.issueTokens(
      user,
      tenant.slug,
      roles,
      resolved.permissions,
      shiftScope,
      resolved.dataScope,
      { rememberMe, meta },
    );

    await this.prisma.auditLog.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        module: 'auth',
        action: 'auth.login',
        entityType: 'user',
        entityId: user.id,
        metadata: { ipAddress: ip },
      },
    });

    return session;
  }

  async refresh(
    refreshToken: string,
    meta?: {
      userAgent?: string;
      ipAddress?: string;
      clientType?: string;
      appType?: string;
      appVersion?: string;
    },
  ): Promise<AuthSessionResponse> {
    const hashed = this.hashToken(refreshToken);

    const activeSession = await this.prisma.refreshSession.findFirst({
      where: {
        hashedToken: hashed,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          include: {
            roles: {
              where: { deletedAt: null },
              include: { role: true },
            },
          },
        },
      },
    });

    if (activeSession) {
      if (!activeSession.user.isActive || activeSession.user.deletedAt) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const tenant = await this.prisma.tenant.findFirst({
        where: {
          id: activeSession.tenantId,
          deletedAt: null,
          status: 'active',
        },
      });
      if (!tenant) throw new UnauthorizedException('Invalid refresh token');

      const roles = activeSession.user.roles.map((r) => r.role.slug);
      const resolved = await this.resolveUserPermissions(
        activeSession.user.id,
        roles,
      );
      const shiftScope = await this.resolveShiftScope(
        activeSession.user.id,
        roles,
      );

      return this.issueTokens(
        activeSession.user,
        tenant.slug,
        roles,
        resolved.permissions,
        shiftScope,
        resolved.dataScope,
        {
          familyId: activeSession.familyId,
          previousSessionId: activeSession.id,
          meta,
        },
      );
    }

    const revokedSession = await this.prisma.refreshSession.findFirst({
      where: {
        hashedToken: hashed,
        revokedAt: { not: null },
      },
      include: {
        user: {
          include: {
            roles: {
              where: { deletedAt: null },
              include: { role: true },
            },
          },
        },
      },
    });

    if (revokedSession) {
      const graceMs = Number(this.config.get('REFRESH_REUSE_GRACE_MS', 10_000));
      const revokedRecently =
        revokedSession.replacedById &&
        revokedSession.revokedAt &&
        Date.now() - revokedSession.revokedAt.getTime() <= graceMs;
      if (
        revokedRecently &&
        revokedSession.user.isActive &&
        !revokedSession.user.deletedAt
      ) {
        const tenant = await this.prisma.tenant.findFirst({
          where: {
            id: revokedSession.tenantId,
            deletedAt: null,
            status: 'active',
          },
        });
        if (tenant) {
          const roles = revokedSession.user.roles.map((r) => r.role.slug);
          const resolved = await this.resolveUserPermissions(
            revokedSession.user.id,
            roles,
          );
          const shiftScope = await this.resolveShiftScope(
            revokedSession.user.id,
            roles,
          );
          return this.issueTokens(
            revokedSession.user,
            tenant.slug,
            roles,
            resolved.permissions,
            shiftScope,
            resolved.dataScope,
            {
              familyId: revokedSession.familyId,
              previousSessionId: revokedSession.replacedById ?? undefined,
              meta,
            },
          );
        }
      }
      await this.revokeSessionFamily(revokedSession.familyId);
    }

    throw new UnauthorizedException('Invalid refresh token');
  }

  async logout(refreshToken: string | undefined) {
    if (!refreshToken) return { success: true };
    const hashed = this.hashToken(refreshToken);
    await this.prisma.refreshSession.updateMany({
      where: { hashedToken: hashed, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  async requestPasswordReset(tenantId: string, email: string) {
    const user = await this.prisma.user.findFirst({
      where: { tenantId, email, deletedAt: null },
    });
    if (!user) return { accepted: true };

    const token = randomBytes(32).toString('base64url');
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: 'auth.password_reset_requested',
        entityType: 'user',
        entityId: user.id,
        metadata: { tokenPreview: token.slice(0, 8) },
      },
    });

    return { accepted: true, resetToken: token };
  }

  async resetPassword(token: string, newPassword: string) {
    void token;
    void newPassword;
    return {
      success: true,
      tokenPreview: token.slice(0, 8),
      note: 'Email provider stub',
    };
  }

  async resetPasswordAndRevokeSessions(
    userId: string,
    newPassword: string,
  ): Promise<{ success: true }> {
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    await this.revokeAllSessionsForUser(userId);
    return { success: true };
  }

  verifyEmail(token: string) {
    return { success: true, tokenPreview: token.slice(0, 8) };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) throw new UnauthorizedException('User not found');

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException(
        'New password must differ from current password',
      );
    }

    await this.resetPasswordAndRevokeSessions(userId, newPassword);
    return {
      success: true,
      message: 'Password updated. Please sign in again.',
    };
  }

  /** Public JSON body — refresh token travels via HttpOnly cookie on web; included in body for mobile */
  toPublicSession(
    session: AuthSessionResponse,
    options?: { includeRefreshToken?: boolean },
  ) {
    if (options?.includeRefreshToken) return session;
    const {
      refreshToken: _rt,
      refreshMaxAgeSeconds: _ma,
      ...publicBody
    } = session;
    return publicBody;
  }

  async startImpersonation(
    tenantId: string,
    adminUserId: string,
    targetUserId: string,
    meta?: { userAgent?: string; ipAddress?: string },
  ) {
    if (adminUserId === targetUserId) {
      throw new BadRequestException('Cannot impersonate yourself');
    }

    const [admin, target, tenant] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id: adminUserId, tenantId, deletedAt: null, isActive: true },
      }),
      this.prisma.user.findFirst({
        where: { id: targetUserId, tenantId, deletedAt: null },
        include: {
          roles: { where: { deletedAt: null }, include: { role: true } },
        },
      }),
      this.prisma.tenant.findFirst({
        where: { id: tenantId, deletedAt: null },
      }),
    ]);

    if (!admin || !target || !tenant) {
      throw new UnauthorizedException('Invalid impersonation target');
    }

    const session = await this.prisma.impersonationSession.create({
      data: {
        tenantId,
        adminUserId,
        targetUserId,
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      },
    });

    const roles = target.roles.map((r) => r.role.slug);
    const resolved = await this.resolveUserPermissions(target.id, roles);
    const shiftScope = await this.resolveShiftScope(target.id, roles);

    const tokens = await this.issueTokens(
      target,
      tenant.slug,
      roles,
      resolved.permissions,
      shiftScope,
      resolved.dataScope,
      {
        skipRefreshSession: true,
        impersonatedBy: adminUserId,
        impersonationSessionId: session.id,
        meta,
      },
    );

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: adminUserId,
        module: 'administration',
        action: 'user.impersonation_started',
        entityType: 'user',
        entityId: targetUserId,
        metadata: { impersonationSessionId: session.id },
      },
    });

    return this.toPublicSession(tokens);
  }

  async endImpersonation(
    tenantId: string,
    actorUserId: string,
    impersonationSessionId: string | undefined,
    meta?: { userAgent?: string; ipAddress?: string },
  ) {
    if (!impersonationSessionId) {
      return { success: true };
    }

    const impSession = await this.prisma.impersonationSession.findFirst({
      where: { id: impersonationSessionId, tenantId, endedAt: null },
    });
    if (impSession) {
      await this.prisma.impersonationSession.update({
        where: { id: impSession.id },
        data: { endedAt: new Date() },
      });
      await this.prisma.auditLog.create({
        data: {
          tenantId,
          userId: impSession.adminUserId,
          module: 'administration',
          action: 'user.impersonation_ended',
          entityType: 'user',
          entityId: impSession.targetUserId,
          metadata: { impersonationSessionId },
        },
      });
    }

    return { success: true, actorUserId, meta };
  }

  async refreshPermissions(
    userId: string,
    meta?: { userAgent?: string; ipAddress?: string },
  ): Promise<AuthSessionResponse> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null, isActive: true },
      include: {
        tenant: true,
        roles: {
          where: { deletedAt: null },
          include: { role: true },
        },
      },
    });
    if (!user) throw new UnauthorizedException('User not found');

    const roles = user.roles.map((r) => r.role.slug);
    const resolved = await this.resolveUserPermissions(user.id, roles);
    const shiftScope = await this.resolveShiftScope(user.id, roles);

    return this.issueTokens(
      user,
      user.tenant.slug,
      roles,
      resolved.permissions,
      shiftScope,
      resolved.dataScope,
      { skipRefreshSession: true, meta },
    );
  }
}
