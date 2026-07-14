import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
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
import { PasswordPolicyService } from '../../common/security/password-policy.service';
import { AccessDeviceService } from '../administration/services/access-device.service';
import { SecurityNotifyService } from '../administration/services/security-notify.service';
import { SuspiciousLoginService } from '../administration/services/suspicious-login.service';
import { MfaService } from './mfa/mfa.service';
import { resolveLoginHintFromRoles } from './login-hint.util';
import {
  compactStudentId,
  resolveStudentDefaultPassword,
  studentIdsMatch,
} from '../students/student-credentials.util';

type ShiftScope = {
  shiftIds: string[];
  primaryShiftId?: string;
  allShifts: boolean;
};

export type LoginDeviceMeta = {
  userAgent?: string;
  ipAddress?: string;
  clientType?: string;
  deviceType?: string;
  appType?: string;
  appVersion?: string;
  deviceId?: string;
  deviceLabel?: string;
  deviceModel?: string;
  manufacturer?: string;
  brand?: string;
  platform?: string;
  osVersion?: string;
  browserName?: string;
  browserVersion?: string;
  screenResolution?: string;
  language?: string;
  timeZone?: string;
  country?: string;
  accessDeviceId?: string;
  lastActivityAt?: string;
  isNewDevice?: boolean;
};

type IssueTokensOptions = {
  familyId?: string;
  rememberMe?: boolean;
  previousSessionId?: string;
  meta?: LoginDeviceMeta;
  impersonatedBy?: string;
  impersonationSessionId?: string;
  skipRefreshSession?: boolean;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly challenge: ChallengeService,
    private readonly loginAttempts: LoginAttemptService,
    private readonly permissionResolver: PermissionResolverService,
    private readonly passwordPolicy: PasswordPolicyService,
    private readonly mfa: MfaService,
    private readonly accessDevices: AccessDeviceService,
    private readonly suspiciousLogin: SuspiciousLoginService,
    private readonly securityNotify: SecurityNotifyService,
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

  private async resolveSecuritySessionPolicy(tenantId: string) {
    const settings = await this.prisma.tenantSecuritySettings.findUnique({
      where: { tenantId },
    });
    return {
      sessionTimeoutSeconds: Math.max(
        5 * 60,
        (settings?.sessionTimeoutMinutes ?? 480) * 60,
      ),
      passwordExpiryDays: settings?.passwordExpiryDays ?? null,
      maxConcurrentSessions: settings?.maxConcurrentSessions ?? null,
    };
  }

  private async isPasswordExpired(
    tenantId: string,
    passwordChangedAt: Date | null | undefined,
  ): Promise<boolean> {
    const { passwordExpiryDays } =
      await this.resolveSecuritySessionPolicy(tenantId);
    if (!passwordExpiryDays || passwordExpiryDays <= 0) return false;
    const changed = passwordChangedAt ?? new Date(0);
    const ageMs = Date.now() - changed.getTime();
    return ageMs > passwordExpiryDays * 24 * 60 * 60 * 1000;
  }

  private async recordLoginEvent(input: {
    tenantId: string;
    userId?: string | null;
    identifier: string;
    method: string;
    outcome: 'success' | 'failure' | 'lockout';
    reason?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }) {
    try {
      await this.prisma.authLoginEvent.create({
        data: {
          tenantId: input.tenantId,
          userId: input.userId ?? null,
          identifier: input.identifier,
          method: input.method,
          outcome: input.outcome,
          reason: input.reason,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          metadata: (input.metadata ?? {}) as object,
        },
      });
    } catch {
      // Non-blocking: login must not fail because audit insert failed.
    }
  }

  private async enforceConcurrentSessionCap(
    tenantId: string,
    userId: string,
    maxConcurrentSessions: number | null,
    excludeSessionId?: string,
  ) {
    if (!maxConcurrentSessions || maxConcurrentSessions < 1) return;
    const now = new Date();
    const active = await this.prisma.refreshSession.findMany({
      where: {
        tenantId,
        userId,
        revokedAt: null,
        expiresAt: { gt: now },
        ...(excludeSessionId ? { id: { not: excludeSessionId } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    const overflow = active.length - (maxConcurrentSessions - 1);
    if (overflow <= 0) return;
    const revokeIds = active.slice(0, overflow).map((s) => s.id);
    await this.prisma.refreshSession.updateMany({
      where: { id: { in: revokeIds } },
      data: { revokedAt: now },
    });
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

  /**
   * Persist + return mustResetPassword when the account is still on a temporary
   * password (explicit flag, default Student@123, or roll/enrollment as password).
   */
  private async ensureMustResetPassword(
    userId: string,
    input: { mustResetPassword?: boolean | null; password: string },
  ): Promise<boolean> {
    if (input.mustResetPassword) return true;

    const password = input.password;
    let force = password === 'Student@123';

    if (!force) {
      const student = await this.prisma.student.findFirst({
        where: { userId, deletedAt: null },
        select: { rollNumber: true, enrollmentNumber: true },
      });
      force = Boolean(
        studentIdsMatch(password, student?.rollNumber) ||
        studentIdsMatch(password, student?.enrollmentNumber),
      );
    }

    if (!force) return false;

    await this.prisma.user.update({
      where: { id: userId },
      data: { mustResetPassword: true },
    });
    return true;
  }

  /**
   * Accept roll/enrollment as first-login password even when the stored hash
   * is still the legacy Student@123 (or another bootstrap hash) while
   * mustResetPassword is set — then re-sync the hash to the canonical roll.
   */
  private async tryStudentBootstrapPassword(
    user: {
      id: string;
      passwordHash: string;
      mustResetPassword?: boolean | null;
    },
    password: string,
  ): Promise<{ canonical: string } | null> {
    const student = await this.prisma.student.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: { rollNumber: true, enrollmentNumber: true },
    });
    if (!student) return null;

    const canonical = resolveStudentDefaultPassword({
      rollNumber: student.rollNumber,
      enrollmentNumber: student.enrollmentNumber,
    });
    const typedMatchesBootstrap =
      studentIdsMatch(password, student.rollNumber) ||
      studentIdsMatch(password, student.enrollmentNumber) ||
      password.trim() === 'Student@123';

    if (!typedMatchesBootstrap) return null;

    const stillOnLegacyDefault = await bcrypt.compare(
      'Student@123',
      user.passwordHash,
    );
    const stillOnRollHash =
      (student.rollNumber &&
        (await bcrypt.compare(student.rollNumber.trim(), user.passwordHash))) ||
      (student.enrollmentNumber &&
        (await bcrypt.compare(
          student.enrollmentNumber.trim(),
          user.passwordHash,
        )));

    // Only bootstrap when admin flagged reset, or account is still on a known temp hash.
    if (!user.mustResetPassword && !stillOnLegacyDefault && !stillOnRollHash) {
      return null;
    }

    const passwordHash = await bcrypt.hash(canonical, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustResetPassword: true },
    });
    return { canonical };
  }

  private buildUserPayload(
    user: {
      id: string;
      email: string;
      tenantId: string;
      mustResetPassword?: boolean | null;
      displayName?: string | null;
    },
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
      displayName: user.displayName ?? undefined,
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
      mustResetPassword: user.mustResetPassword ?? false,
    };
  }

  private async issueTokens(
    user: {
      id: string;
      email: string;
      tenantId: string;
      mustResetPassword?: boolean | null;
      displayName?: string | null;
    },
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
    const policy = await this.resolveSecuritySessionPolicy(user.tenantId);
    let refreshMaxAgeSeconds = this.resolveRefreshTtlSeconds(
      options.rememberMe,
    );
    if (!options.rememberMe) {
      refreshMaxAgeSeconds = Math.min(
        refreshMaxAgeSeconds,
        policy.sessionTimeoutSeconds,
      );
    }
    const accessTtl = options.skipRefreshSession
      ? '1800s'
      : this.config.get<string>('JWT_ACCESS_TTL', '1200s');
    let accessExpiresIn = this.parseTtlSeconds(accessTtl);
    accessExpiresIn = Math.min(accessExpiresIn, policy.sessionTimeoutSeconds);

    const refreshExpiresAt = new Date(Date.now() + refreshMaxAgeSeconds * 1000);

    if (!options.skipRefreshSession) {
      await this.enforceConcurrentSessionCap(
        user.tenantId,
        user.id,
        policy.maxConcurrentSessions,
        options.previousSessionId,
      );

      let accessDeviceId: string | undefined;
      let clientType =
        options.meta?.clientType ?? (options.meta?.appType ? 'ANDROID' : 'WEB');
      const lastActivityAt = new Date().toISOString();

      if (options.meta?.deviceId || options.meta?.userAgent) {
        try {
          await this.accessDevices.assertNotBlocked(
            user.tenantId,
            user.id,
            options.meta?.deviceId,
            options.meta?.userAgent,
          );
          const securitySettings =
            await this.prisma.tenantSecuritySettings.findUnique({
              where: { tenantId: user.tenantId },
            });
          const captured = await this.accessDevices.upsertFromLogin({
            tenantId: user.tenantId,
            userId: user.id,
            deviceId: options.meta?.deviceId,
            clientType,
            deviceType: options.meta?.deviceType,
            appType: options.meta?.appType,
            appVersion: options.meta?.appVersion,
            deviceLabel: options.meta?.deviceLabel,
            deviceModel: options.meta?.deviceModel,
            manufacturer: options.meta?.manufacturer,
            brand: options.meta?.brand,
            platform: options.meta?.platform,
            osVersion: options.meta?.osVersion,
            browserName: options.meta?.browserName,
            browserVersion: options.meta?.browserVersion,
            screenResolution: options.meta?.screenResolution,
            language: options.meta?.language,
            timeZone: options.meta?.timeZone,
            userAgent: options.meta?.userAgent,
            ipAddress: options.meta?.ipAddress,
            countryHint: options.meta?.country,
            geoLookupEnabled: securitySettings?.geoLookupEnabled !== false,
          });
          accessDeviceId = captured.device.id;
          clientType = captured.device.clientType || clientType;
          if (options.meta) {
            options.meta.accessDeviceId = accessDeviceId;
            options.meta.lastActivityAt = lastActivityAt;
            options.meta.clientType = clientType;
            options.meta.country =
              options.meta.country ?? captured.device.lastCountry ?? undefined;
            options.meta.browserName =
              options.meta.browserName ??
              captured.device.browserName ??
              undefined;
            options.meta.isNewDevice = captured.isNew;
          }
        } catch (err) {
          if (err instanceof ForbiddenException) throw err;
          this.logger.debug(
            `Device upsert skipped: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }

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
              clientType,
              appType: options.meta?.appType,
              appVersion: options.meta?.appVersion,
              deviceId: options.meta?.deviceId,
              deviceLabel: options.meta?.deviceLabel,
              rememberMe: Boolean(options.rememberMe),
              accessDeviceId: accessDeviceId ?? null,
              lastActivityAt,
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

  private async resolveLoginUser(tenantId: string, loginId: string) {
    const include = {
      roles: {
        where: { deletedAt: null },
        include: { role: true },
      },
    } as const;

    const trimmed = loginId.trim();
    if (trimmed.includes('@')) {
      return this.prisma.user.findFirst({
        where: {
          tenantId,
          email: trimmed.toLowerCase(),
          deletedAt: null,
          isActive: true,
        },
        include,
      });
    }

    const key = trimmed.toUpperCase();
    const byUsername = await this.prisma.user.findFirst({
      where: {
        tenantId,
        username: { equals: trimmed, mode: 'insensitive' },
        deletedAt: null,
        isActive: true,
      },
      include,
    });
    if (byUsername) return byUsername;

    const student = await this.prisma.student.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { rollNumber: { equals: trimmed, mode: 'insensitive' } },
          { enrollmentNumber: { equals: trimmed, mode: 'insensitive' } },
          { universityRollNumber: { equals: trimmed, mode: 'insensitive' } },
          {
            universityRegistrationNumber: {
              equals: trimmed,
              mode: 'insensitive',
            },
          },
        ],
      },
      select: { userId: true },
    });
    if (student?.userId) {
      return this.prisma.user.findFirst({
        where: {
          id: student.userId,
          tenantId,
          deletedAt: null,
          isActive: true,
        },
        include,
      });
    }

    // Tolerant match: BA25-888 ≈ BA25888 (hyphen/space/underscore differences).
    const compact = compactStudentId(trimmed);
    if (compact.length >= 4) {
      const compactHits = await this.prisma.$queryRaw<
        Array<{ user_id: string }>
      >`
        SELECT s.user_id
        FROM academic.students s
        WHERE s.tenant_id = ${tenantId}::uuid
          AND s.deleted_at IS NULL
          AND (
            upper(regexp_replace(coalesce(s.roll_number, ''), '[\s\-_.]', '', 'g')) = ${compact}
            OR upper(regexp_replace(coalesce(s.enrollment_number, ''), '[\s\-_.]', '', 'g')) = ${compact}
            OR upper(regexp_replace(coalesce(s.university_roll_number, ''), '[\s\-_.]', '', 'g')) = ${compact}
            OR upper(regexp_replace(coalesce(s.university_registration_number, ''), '[\s\-_.]', '', 'g')) = ${compact}
          )
        LIMIT 1
      `;
      const compactUserId = compactHits[0]?.user_id;
      if (compactUserId) {
        return this.prisma.user.findFirst({
          where: {
            id: compactUserId,
            tenantId,
            deletedAt: null,
            isActive: true,
          },
          include,
        });
      }
    }

    const staff = await this.prisma.staffProfile.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { employeeCode: { equals: key, mode: 'insensitive' } },
          { mobile: trimmed },
          { email: { equals: trimmed, mode: 'insensitive' } },
        ],
      },
      select: { portalUserId: true },
    });
    if (staff?.portalUserId) {
      const staffUser = await this.prisma.user.findFirst({
        where: {
          id: staff.portalUserId,
          tenantId,
          deletedAt: null,
          isActive: true,
        },
        include,
      });
      if (staffUser) return staffUser;
    }

    const profile = await this.prisma.studentProfile.findFirst({
      where: {
        tenantId,
        mobileNumber: trimmed,
      },
      select: { student: { select: { userId: true } } },
    });
    if (profile?.student?.userId) {
      return this.prisma.user.findFirst({
        where: {
          id: profile.student.userId,
          tenantId,
          deletedAt: null,
          isActive: true,
        },
        include,
      });
    }

    return this.prisma.user.findFirst({
      where: {
        tenantId,
        email: trimmed.toLowerCase(),
        deletedAt: null,
        isActive: true,
      },
      include,
    });
  }

  async getLoginHint(tenantId: string, loginId: string) {
    const trimmed = loginId?.trim();
    if (!trimmed) return { recognized: false as const };

    const user = await this.resolveLoginUser(tenantId, trimmed);
    if (!user) return { recognized: false as const };

    const roleCodes = (user.roles ?? [])
      .map((entry) => entry.role?.slug)
      .filter((slug): slug is string => Boolean(slug));
    const hint = resolveLoginHintFromRoles(roleCodes);
    if (!hint) return { recognized: false as const };

    return { recognized: true as const, ...hint };
  }

  async login(
    tenantId: string,
    loginId: string,
    password: string,
    challengeToken: string,
    challengeAnswer: number,
    meta?: LoginDeviceMeta,
    rememberMe?: boolean,
  ): Promise<AuthSessionResponse> {
    const ip = meta?.ipAddress ?? 'unknown';
    const trimmed = loginId.trim();
    const normalizedEmail = trimmed.includes('@')
      ? trimmed.toLowerCase()
      : trimmed;
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

    const user = await this.resolveLoginUser(tenant.id, trimmed);
    if (!user) {
      const failure = await this.loginAttempts.recordFailure(
        tenantId,
        ip,
        normalizedEmail,
      );
      await this.recordLoginEvent({
        tenantId,
        identifier: normalizedEmail,
        method: 'password',
        outcome: 'failure',
        reason: 'unknown_user',
        ipAddress: ip,
        userAgent: meta?.userAgent,
      });
      throw new UnauthorizedException(failure.message);
    }

    let valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      const bootstrap = await this.tryStudentBootstrapPassword(user, password);
      if (bootstrap) {
        valid = true;
        user.mustResetPassword = true;
      }
    }
    if (!valid) {
      const failure = await this.loginAttempts.recordFailure(
        tenantId,
        ip,
        normalizedEmail,
      );
      await this.recordLoginEvent({
        tenantId,
        userId: user.id,
        identifier: normalizedEmail,
        method: 'password',
        outcome: 'failure',
        reason: 'bad_password',
        ipAddress: ip,
        userAgent: meta?.userAgent,
      });
      throw new UnauthorizedException(failure.message);
    }

    if (user.accountStatus && user.accountStatus !== 'active') {
      const status = String(user.accountStatus).toLowerCase();
      throw new UnauthorizedException(
        status === 'locked' || status === 'blocked' || status === 'suspended'
          ? 'Your account has been restricted. Please contact your college administrator for help.'
          : 'Your account is not active yet. Please contact your college administrator.',
      );
    }

    await this.loginAttempts.resetOnSuccess(tenantId, ip, normalizedEmail);

    // Force change when still on a known temporary / first-login password.
    let mustResetPassword = await this.ensureMustResetPassword(user.id, {
      mustResetPassword: user.mustResetPassword,
      password,
    });
    if (
      !mustResetPassword &&
      (await this.isPasswordExpired(tenant.id, user.passwordChangedAt))
    ) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { mustResetPassword: true },
      });
      mustResetPassword = true;
    }
    const userForSession = { ...user, mustResetPassword };

    const roles = user.roles.map((r) => r.role.slug);
    const mfaRequired =
      user.mfaEnabled ||
      (await this.mfa.isRequiredForUser(tenant.id, user.id, roles));
    if (mfaRequired && (await this.mfa.userHasVerifiedMfa(user.id))) {
      const mfaToken = await this.mfa.createPendingLoginToken(
        user.id,
        tenant.id,
        { rememberMe, meta },
      );
      return {
        mfaRequired: true,
        mfaToken,
        accessToken: '',
        expiresIn: 0,
        expiresAt: new Date().toISOString(),
        refreshToken: '',
        refreshMaxAgeSeconds: 0,
        user: this.buildUserPayload(
          userForSession,
          tenant.slug,
          roles,
          [],
          { shiftIds: [], allShifts: false },
          {
            departmentIds: [],
            campusIds: [],
            programmeIds: [],
            semesterNos: [],
            allDepartments: false,
            allCampuses: false,
          },
        ),
      };
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    if (meta?.deviceId || meta?.userAgent) {
      await this.accessDevices.assertNotBlocked(
        tenant.id,
        user.id,
        meta?.deviceId,
        meta?.userAgent,
      );
    }

    const resolved = await this.resolveUserPermissions(user.id, roles);
    const shiftScope = await this.resolveShiftScope(user.id, roles);
    const session = await this.issueTokens(
      userForSession,
      tenant.slug,
      roles,
      resolved.permissions,
      shiftScope,
      resolved.dataScope,
      { rememberMe, meta },
    );

    const suspiciousFlags = await this.suspiciousLogin.evaluate(
      tenant.id,
      user.id,
      {
        accessDeviceId: meta?.accessDeviceId,
        isNewDevice: meta?.isNewDevice,
        country: meta?.country,
        browserName: meta?.browserName,
        clientType: meta?.clientType,
        ipAddress: meta?.ipAddress,
      },
    );

    await this.prisma.auditLog.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        module: 'auth',
        action: 'auth.login',
        entityType: 'user',
        entityId: user.id,
        metadata: {
          method: 'password',
          ipAddress: ip,
          country: meta?.country,
          accessDeviceId: meta?.accessDeviceId ?? null,
          suspiciousFlags,
        },
      },
    });

    await this.recordLoginEvent({
      tenantId: tenant.id,
      userId: user.id,
      identifier: normalizedEmail,
      method: 'password',
      outcome: 'success',
      ipAddress: ip,
      userAgent: meta?.userAgent,
      metadata: {
        clientType: meta?.clientType ?? null,
        appType: meta?.appType ?? null,
        accessDeviceId: meta?.accessDeviceId ?? null,
        country: meta?.country ?? null,
        suspiciousFlags,
      },
    });

    if (suspiciousFlags.includes('NEW_DEVICE')) {
      const settings = await this.prisma.tenantSecuritySettings.findUnique({
        where: { tenantId: tenant.id },
      });
      if (settings?.alertOnNewDevice !== false) {
        await this.securityNotify.notify({
          tenantId: tenant.id,
          userId: user.id,
          templateCode: 'SECURITY_NEW_DEVICE',
          triggerKey: `security.new_device.${meta?.accessDeviceId ?? user.id}.${Date.now()}`,
          entityType: 'access_device',
          entityId: String(meta?.accessDeviceId ?? user.id),
          variables: {
            device_name: meta?.deviceLabel ?? meta?.deviceModel ?? 'New device',
            location: [meta?.country].filter(Boolean).join(', ') || 'Unknown',
            login_at: new Date().toISOString(),
          },
          enabled:
            settings?.notifyEmailOnSecurity !== false ||
            settings?.notifyPushOnSecurity !== false,
        });
      }
    }

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
    unlockMethod?: 'biometric_unlock',
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

      const sessionMeta = (activeSession.metadata ?? {}) as Record<
        string,
        unknown
      >;
      const rememberMe = Boolean(sessionMeta.rememberMe);

      const session = await this.issueTokens(
        activeSession.user,
        tenant.slug,
        roles,
        resolved.permissions,
        shiftScope,
        resolved.dataScope,
        {
          familyId: activeSession.familyId,
          previousSessionId: activeSession.id,
          rememberMe,
          meta,
        },
      );

      if (unlockMethod === 'biometric_unlock') {
        await this.prisma.auditLog.create({
          data: {
            tenantId: tenant.id,
            userId: activeSession.user.id,
            module: 'auth',
            action: 'auth.login',
            entityType: 'user',
            entityId: activeSession.user.id,
            metadata: {
              method: 'biometric_unlock',
              ipAddress: meta?.ipAddress,
            },
          },
        });
        await this.recordLoginEvent({
          tenantId: tenant.id,
          userId: activeSession.user.id,
          identifier: activeSession.user.email,
          method: 'biometric_unlock',
          outcome: 'success',
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
        });
      }

      return session;
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
              rememberMe: Boolean(
                (revokedSession.metadata as Record<string, unknown> | null)
                  ?.rememberMe,
              ),
              meta,
            },
          );
        }
      }
      await this.revokeSessionFamily(revokedSession.familyId);
    }

    throw new UnauthorizedException('Invalid refresh token');
  }

  async logout(
    refreshToken: string | undefined,
    meta?: { userId?: string; tenantId?: string; ipAddress?: string },
  ) {
    if (!refreshToken) return { success: true };
    const hashed = this.hashToken(refreshToken);
    const session = await this.prisma.refreshSession.findFirst({
      where: { hashedToken: hashed, revokedAt: null },
    });
    await this.prisma.refreshSession.updateMany({
      where: { hashedToken: hashed, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (session) {
      await this.prisma.auditLog.create({
        data: {
          tenantId: session.tenantId,
          userId: session.userId,
          module: 'auth',
          action: 'auth.logout',
          entityType: 'user',
          entityId: session.userId,
          metadata: { ipAddress: meta?.ipAddress },
        },
      });
    }
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
    tenantId?: string,
  ): Promise<{ success: true }> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) throw new UnauthorizedException('User not found');
    if (tenantId ?? user.tenantId) {
      await this.passwordPolicy.validateForUser(
        tenantId ?? user.tenantId,
        userId,
        newPassword,
      );
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    const rules = await this.passwordPolicy.getRules(user.tenantId);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
        mustResetPassword: false,
      },
    });
    await this.passwordPolicy.recordHistory(
      userId,
      passwordHash,
      rules.historyCount,
    );
    await this.revokeAllSessionsForUser(userId);
    return { success: true };
  }

  async completeMfaLogin(
    userId: string,
    tenantId: string,
    rememberMe?: boolean,
    meta?: IssueTokensOptions['meta'],
  ) {
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

    await this.prisma.auditLog.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        module: 'auth',
        action: 'auth.login',
        entityType: 'user',
        entityId: user.id,
        metadata: { mfa: true, ipAddress: meta?.ipAddress },
      },
    });

    return session;
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
    await this.securityNotify.notify({
      tenantId: user.tenantId,
      userId,
      templateCode: 'SECURITY_PASSWORD_CHANGED',
      triggerKey: `security.password_changed.${userId}.${Date.now()}`,
      entityType: 'user',
      entityId: userId,
      variables: {
        changed_at: new Date().toISOString(),
      },
    });
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

  /**
   * Issue a full session for QR / RFID / device biometric unlock
   * without password or MFA (caller already authenticated the subject).
   */
  async loginWithAlternateMethod(
    tenantId: string,
    userId: string,
    method: 'qr' | 'rfid' | 'biometric_unlock',
    meta?: {
      userAgent?: string;
      ipAddress?: string;
      clientType?: string;
      appType?: string;
      appVersion?: string;
      deviceId?: string;
      deviceLabel?: string;
      country?: string;
    },
  ): Promise<AuthSessionResponse> {
    const [user, tenant] = await Promise.all([
      this.prisma.user.findFirst({
        where: {
          id: userId,
          tenantId,
          deletedAt: null,
          isActive: true,
        },
        include: {
          roles: {
            where: { deletedAt: null },
            include: { role: true },
          },
        },
      }),
      this.prisma.tenant.findFirst({
        where: { id: tenantId, deletedAt: null, status: 'active' },
      }),
    ]);

    if (!user || !tenant) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.accountStatus && user.accountStatus !== 'active') {
      throw new UnauthorizedException('Account is not active');
    }

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
      { meta },
    );

    await this.prisma.auditLog.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        module: 'auth',
        action: 'auth.login',
        entityType: 'user',
        entityId: user.id,
        metadata: {
          method,
          ipAddress: meta?.ipAddress,
          country: meta?.country,
          clientType: meta?.clientType,
        },
      },
    });

    await this.prisma.authLoginEvent.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        identifier: user.email,
        method,
        outcome: 'success',
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
        metadata: {
          method,
          clientType: meta?.clientType,
          appType: meta?.appType,
        },
      },
    });

    return session;
  }
}
