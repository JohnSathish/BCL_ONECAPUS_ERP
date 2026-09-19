import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes, randomInt } from 'crypto';
import * as bcrypt from 'bcrypt';
import type { LoginDeviceMeta } from '../auth/auth.service';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../../database/prisma.service';
import { SchoolSisService } from '../school-sis/school-sis.service';
import { SchoolSisLicenseService } from '../school-sis/school-sis-license.service';
import { SchoolSisSmsService } from '../school-sis/school-sis-sms.service';
import {
  isSchoolPlaceholderEmail,
  pickSchoolActivationContact,
  realSchoolEmail,
} from '../school-sis/school-sis-activation-contact';
import { resolveSchoolPortalUserId } from '../school-sis/school-sis-login-lookup';
import { SchoolWebMailService } from '../school-web/school-web-mail.service';
import { SCHOOL_MOBILE_DEFAULT_PASSWORD } from './school-mobile.constants';

const GENERIC_NEXT =
  'If the information is valid, you will be given the next verification step.';
const GENERIC_LOGIN = 'Invalid admission/roll number or password.';
const GENERIC_LOCKED = 'Too many attempts. Please try again later.';
const FORBIDDEN_PASSWORDS = [
  SCHOOL_MOBILE_DEFAULT_PASSWORD,
  'StLuke@2026',
  'StLuke@123',
  'password',
  'Password1',
  '12345678',
];

function sha(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

@Injectable()
export class SchoolMobileAccountAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly sis: SchoolSisService,
    private readonly licenses: SchoolSisLicenseService,
    private readonly sms: SchoolSisSmsService,
    private readonly mail: SchoolWebMailService,
  ) {}

  async settings(tenantId: string) {
    return this.prisma.schoolAuthSettings.upsert({
      where: { tenantId },
      update: {},
      create: { tenantId },
    });
  }

  async login(
    tenantId: string,
    identifier: string,
    password: string,
    meta?: LoginDeviceMeta,
  ) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const trimmed = identifier.trim();
    if (!trimmed || !password) {
      throw new UnauthorizedException(GENERIC_LOGIN);
    }
    if (meta?.ipAddress) {
      const recent = await this.prisma.schoolAuthEvent.count({
        where: {
          tenantId,
          event: 'LOGIN_FAILED',
          ipAddress: meta.ipAddress,
          createdAt: { gte: new Date(Date.now() - 10 * 60_000) },
        },
      });
      if (recent >= 25) {
        throw new HttpException(GENERIC_LOCKED, HttpStatus.TOO_MANY_REQUESTS);
      }
    }
    if (this.isForbiddenPassword(password)) {
      await this.recordEvent(tenantId, null, 'LOGIN_FAILED', {
        identifier: trimmed,
        reason: 'forbidden_password',
        ip: meta?.ipAddress,
        device: meta?.userAgent,
      });
      throw new UnauthorizedException(GENERIC_LOGIN);
    }

    const userId = await resolveSchoolPortalUserId(
      this.prisma,
      tenantId,
      trimmed,
    );
    await this.assertNotLocked(tenantId, userId, trimmed);

    if (!userId) {
      await this.failLock(tenantId, null, trimmed);
      throw new UnauthorizedException(GENERIC_LOGIN);
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
    });
    if (!user?.isActive || user.accountStatus === 'disabled') {
      await this.failLock(tenantId, userId, trimmed);
      throw new UnauthorizedException(GENERIC_LOGIN);
    }

    if (meta?.deviceId) {
      const blocked = await this.prisma.schoolMobileDevice.findFirst({
        where: { tenantId, deviceId: meta.deviceId, deviceStatus: 'BLOCKED' },
        select: { id: true },
      });
      if (blocked) {
        throw new UnauthorizedException('DEVICE_BLOCKED');
      }
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      await this.failLock(tenantId, userId, trimmed);
      await this.recordEvent(tenantId, userId, 'LOGIN_FAILED', {
        identifier: trimmed,
        reason: 'bad_password',
        ip: meta?.ipAddress,
        device: meta?.userAgent,
      });
      if (meta?.deviceId) {
        const device = await this.prisma.schoolMobileDevice.findFirst({
          where: { tenantId, deviceId: meta.deviceId },
        });
        if (device) {
          const failedAuthCount = device.failedAuthCount + 1;
          await this.prisma.schoolMobileDevice.update({
            where: { id: device.id },
            data: {
              failedAuthCount,
              flaggedAt: failedAuthCount >= 5 ? new Date() : device.flaggedAt,
              flagReason:
                failedAuthCount >= 5
                  ? 'Multiple failed login attempts'
                  : device.flagReason,
            },
          });
          if (failedAuthCount === 5) {
            await this.prisma.schoolDeviceSecurityEvent.create({
              data: {
                tenantId,
                deviceRowId: device.id,
                userId,
                eventType: 'MULTIPLE_FAILED_LOGIN',
                description:
                  '5 failed authentication attempts from this device',
                ipAddress: meta.ipAddress ?? null,
              },
            });
          }
        }
      }
      throw new UnauthorizedException(GENERIC_LOGIN);
    }

    const needsActivation = await this.needsActivation(tenantId, user);
    if (needsActivation) {
      await this.recordEvent(tenantId, userId, 'LOGIN_FAILED', {
        identifier: trimmed,
        reason: 'not_activated',
        ip: meta?.ipAddress,
      });
      throw new UnauthorizedException(GENERIC_LOGIN);
    }

    await this.clearLock(tenantId, userId);
    const firstLogin = !user.lastLoginAt;
    const session = await this.auth.issueRememberedSessionForUser(
      user.id,
      tenantId,
      { ...meta, clientType: 'mobile' },
      { mustResetPassword: false },
    );
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
    await this.recordEvent(tenantId, userId, 'LOGIN_SUCCESS', {
      identifier: trimmed,
      ip: meta?.ipAddress,
      device: meta?.userAgent,
    });
    if (meta?.deviceId) {
      await this.prisma.schoolMobileDevice.updateMany({
        where: {
          tenantId,
          deviceId: meta.deviceId,
          deviceStatus: { not: 'BLOCKED' },
        },
        data: {
          lastLoginAt: new Date(),
          lastActiveAt: new Date(),
          failedAuthCount: 0,
        },
      });
    }
    const license = await Promise.race([
      this.licenses.publicStatus(tenantId),
      new Promise((resolve) => setTimeout(() => resolve(null), 1500)),
    ]).catch(() => null);
    return {
      ...this.auth.toPublicSession(session, { includeRefreshToken: true }),
      firstLogin,
      license,
    };
  }

  async changePassword(
    tenantId: string,
    userId: string,
    currentPassword: string,
    newPassword: string,
    meta?: LoginDeviceMeta,
  ) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
    });
    if (!user) throw new UnauthorizedException('Please sign in again.');
    const currentOk = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!currentOk) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    await this.assertNewPassword(
      tenantId,
      userId,
      newPassword,
      currentPassword,
    );
    await this.auth.resetPasswordAndRevokeSessions(
      userId,
      newPassword,
      tenantId,
    );
    await this.recordEvent(tenantId, userId, 'PASSWORD_CHANGED', {
      ip: meta?.ipAddress,
    });
    const session = await this.auth.issueRememberedSessionForUser(
      userId,
      tenantId,
      { ...meta, clientType: 'mobile' },
      { mustResetPassword: false },
    );
    return this.auth.toPublicSession(session, { includeRefreshToken: true });
  }

  async startChallenge(
    tenantId: string,
    identifier: string,
    purpose: 'ACTIVATE' | 'RESET',
    ip?: string,
  ) {
    await this.sis.assertSecondarySisTenant(tenantId);
    await this.rateIp(tenantId, purpose, ip);
    const settings = await this.settings(tenantId);
    const userId = await resolveSchoolPortalUserId(
      this.prisma,
      tenantId,
      identifier.trim(),
    );
    const generic = {
      message: GENERIC_NEXT,
      challengeId: null as string | null,
    };

    if (!userId) {
      await this.recordEvent(tenantId, null, `${purpose}_STARTED`, {
        identifier,
        reason: 'unknown',
        ip,
      });
      return generic;
    }
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null, isActive: true },
    });
    if (!user) return generic;

    const activated = !(await this.needsActivation(tenantId, user));
    if (purpose === 'ACTIVATE' && activated) return generic;
    if (purpose === 'RESET' && !activated) return generic;

    const contact = await this.loadActivationContact(tenantId, user);
    const channel =
      contact && settings.otpEnabled
        ? contact.kind
        : settings.activationCodeEnabled
          ? 'CODE'
          : 'NONE';
    if (channel === 'NONE') return generic;

    const challenge = await this.prisma.schoolAuthChallenge.create({
      data: {
        tenantId,
        userId,
        purpose,
        channel,
        identifier: identifier.trim(),
        contactMasked: contact?.masked ?? null,
        contactKind: contact?.kind ?? null,
        expiresAt: new Date(Date.now() + 30 * 60_000),
        ipAddress: ip ?? null,
      },
    });
    await this.recordEvent(
      tenantId,
      userId,
      purpose === 'ACTIVATE' ? 'ACTIVATION_STARTED' : 'PASSWORD_RESET',
      { identifier, ip },
    );
    return {
      message: GENERIC_NEXT,
      challengeId: challenge.id,
      channel,
      masked: contact?.masked ?? null,
      contactKind: contact?.kind ?? null,
      codeFallback: settings.activationCodeEnabled,
      resendSeconds: settings.otpResendSeconds,
    };
  }

  async sendOtp(tenantId: string, challengeId: string, ip?: string) {
    const settings = await this.settings(tenantId);
    const row = await this.loadOpenChallenge(tenantId, challengeId);
    if (!row)
      return {
        message: GENERIC_NEXT,
        resendSeconds: settings.otpResendSeconds,
      };
    const user = await this.prisma.user.findFirst({
      where: { id: row.userId, tenantId, deletedAt: null },
    });
    const contact = user
      ? await this.loadActivationContact(tenantId, user)
      : null;
    const channel = contact?.kind ?? row.channel;
    if (!settings.otpEnabled || channel === 'CODE' || !contact) {
      return {
        message: GENERIC_NEXT,
        resendSeconds: settings.otpResendSeconds,
        channel: 'CODE',
        masked: contact?.masked ?? row.contactMasked,
      };
    }
    const recent = await this.prisma.schoolAuthChallenge.count({
      where: {
        tenantId,
        userId: row.userId,
        otpSentAt: { gte: new Date(Date.now() - 60 * 60_000) },
      },
    });
    if (recent >= settings.maxOtpSendsPerHour) {
      throw new HttpException(GENERIC_LOCKED, HttpStatus.TOO_MANY_REQUESTS);
    }
    if (
      row.otpSentAt &&
      Date.now() - row.otpSentAt.getTime() < settings.otpResendSeconds * 1000
    ) {
      const wait = Math.ceil(
        (settings.otpResendSeconds * 1000 -
          (Date.now() - row.otpSentAt.getTime())) /
          1000,
      );
      return {
        message: GENERIC_NEXT,
        resendSeconds: wait,
        masked: contact.masked,
        channel: contact.kind,
      };
    }
    const otp = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.schoolAuthChallenge.update({
      where: { id: row.id },
      data: {
        channel: contact.kind,
        contactMasked: contact.masked,
        contactKind: contact.kind,
        otpHash: sha(`${tenantId}:${otp}:${row.id}`),
        otpExpiresAt: new Date(Date.now() + settings.otpTtlSeconds * 1000),
        otpSentAt: new Date(),
        otpAttempts: 0,
        otpSendCount: { increment: 1 },
      },
    });
    try {
      if (contact.kind === 'SMS' && contact.mobile) {
        await this.sms.sendLoginOtp(tenantId, contact.mobile, otp);
      } else if (contact.kind === 'EMAIL' && contact.email) {
        await this.mail.sendLoginOtp(contact.email, otp);
      }
    } catch {
      /* OTP is still valid; office can use activation code */
    }
    await this.recordEvent(tenantId, row.userId, 'OTP_REQUESTED', {
      ip,
      reason: contact.kind,
    });
    return {
      message: GENERIC_NEXT,
      resendSeconds: settings.otpResendSeconds,
      masked: contact.masked,
      channel: contact.kind,
    };
  }

  async verifyOtp(tenantId: string, challengeId: string, otp: string) {
    const settings = await this.settings(tenantId);
    const row = await this.loadOpenChallenge(tenantId, challengeId);
    if (!row?.otpHash || !row.otpExpiresAt) {
      throw new BadRequestException(
        'Enter the verification code you received.',
      );
    }
    if (row.otpAttempts >= settings.maxOtpAttempts) {
      throw new HttpException(GENERIC_LOCKED, HttpStatus.TOO_MANY_REQUESTS);
    }
    if (row.otpExpiresAt < new Date()) {
      throw new BadRequestException(
        'That code has expired. Request a new one.',
      );
    }
    const ok = sha(`${tenantId}:${otp.trim()}:${row.id}`) === row.otpHash;
    await this.prisma.schoolAuthChallenge.update({
      where: { id: row.id },
      data: {
        otpAttempts: { increment: 1 },
        verifiedAt: ok ? new Date() : row.verifiedAt,
      },
    });
    if (!ok) {
      throw new BadRequestException('That verification code is not valid.');
    }
    await this.recordEvent(tenantId, row.userId, 'OTP_VERIFIED', {});
    return { ok: true, challengeId: row.id };
  }

  async verifyActivationCode(
    tenantId: string,
    challengeId: string,
    code: string,
  ) {
    const settings = await this.settings(tenantId);
    if (!settings.activationCodeEnabled) {
      throw new BadRequestException('Activation codes are not enabled.');
    }
    const row = await this.loadOpenChallenge(tenantId, challengeId);
    if (!row) throw new BadRequestException(GENERIC_NEXT);
    const hash = sha(`${tenantId}:${this.normalizeCode(code)}`);
    const match = await this.prisma.schoolActivationCode.findFirst({
      where: {
        tenantId,
        userId: row.userId,
        codeHash: hash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!match) {
      throw new BadRequestException('That activation code is not valid.');
    }
    await this.prisma.$transaction([
      this.prisma.schoolActivationCode.update({
        where: { id: match.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.schoolAuthChallenge.update({
        where: { id: row.id },
        data: { verifiedAt: new Date(), channel: 'CODE' },
      }),
    ]);
    return { ok: true, challengeId: row.id };
  }

  async setPasswordFromChallenge(
    tenantId: string,
    challengeId: string,
    newPassword: string,
    confirmPassword: string,
  ) {
    const row = await this.prisma.schoolAuthChallenge.findFirst({
      where: { id: challengeId, tenantId, consumedAt: null },
    });
    if (!row?.verifiedAt || row.expiresAt < new Date()) {
      throw new BadRequestException('Start verification again.');
    }
    if (newPassword !== confirmPassword) {
      throw new BadRequestException('Passwords do not match.');
    }
    const user = await this.prisma.user.findFirst({
      where: { id: row.userId, tenantId },
    });
    if (!user) throw new BadRequestException(GENERIC_NEXT);
    await this.assertNewPassword(
      tenantId,
      user.id,
      newPassword,
      row.identifier,
    );
    await this.auth.resetPasswordAndRevokeSessions(
      user.id,
      newPassword,
      tenantId,
    );
    await this.prisma.schoolAuthChallenge.update({
      where: { id: row.id },
      data: { consumedAt: new Date() },
    });
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        mustResetPassword: false,
        accountStatus: 'active',
        isActive: true,
      },
    });
    await this.recordEvent(
      tenantId,
      user.id,
      row.purpose === 'ACTIVATE' ? 'ACCOUNT_ACTIVATED' : 'PASSWORD_RESET',
      {},
    );
    return {
      ok: true,
      admissionHint: row.identifier,
      purpose: row.purpose,
    };
  }

  async sessions(tenantId: string, userId: string, currentRefresh?: string) {
    const rows = await this.prisma.refreshSession.findMany({
      where: {
        tenantId,
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });
    const currentHash = currentRefresh ? sha(currentRefresh) : null;
    return rows.map((row) => {
      const meta = (row.metadata ?? {}) as Record<string, unknown>;
      const label =
        (typeof meta.deviceLabel === 'string' && meta.deviceLabel) ||
        (typeof meta.platform === 'string' && meta.platform) ||
        (row.userAgent ? String(row.userAgent).slice(0, 80) : 'App');
      return {
        id: row.id,
        current: currentHash ? row.hashedToken === currentHash : false,
        lastActive: row.updatedAt,
        createdAt: row.createdAt,
        device: label,
        platform: typeof meta.platform === 'string' ? meta.platform : null,
      };
    });
  }

  async revokeSession(tenantId: string, userId: string, sessionId: string) {
    await this.prisma.refreshSession.updateMany({
      where: { id: sessionId, tenantId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.recordEvent(tenantId, userId, 'SESSION_REVOKED', {});
    return { ok: true };
  }

  async revokeOtherSessions(
    tenantId: string,
    userId: string,
    currentRefresh?: string,
  ) {
    const currentHash = currentRefresh ? sha(currentRefresh) : null;
    await this.prisma.refreshSession.updateMany({
      where: {
        tenantId,
        userId,
        revokedAt: null,
        ...(currentHash ? { hashedToken: { not: currentHash } } : {}),
      },
      data: { revokedAt: new Date() },
    });
    await this.recordEvent(tenantId, userId, 'SESSION_REVOKED', {
      reason: 'others',
    });
    return { ok: true };
  }

  async logout(tenantId: string, userId: string, refreshToken?: string) {
    if (refreshToken) {
      await this.prisma.refreshSession.updateMany({
        where: {
          tenantId,
          userId,
          hashedToken: sha(refreshToken),
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    }
    await this.recordEvent(tenantId, userId, 'LOGOUT', {});
    return { ok: true };
  }

  async logoutAll(tenantId: string, userId: string) {
    await this.auth.revokeAllSessionsForUser(userId);
    await this.recordEvent(tenantId, userId, 'SESSION_REVOKED', {
      reason: 'all',
    });
    return { ok: true };
  }

  private isForbiddenPassword(password: string) {
    const lower = password.trim().toLowerCase();
    return FORBIDDEN_PASSWORDS.some((p) => p.toLowerCase() === lower);
  }

  private async needsActivation(
    tenantId: string,
    user: {
      id: string;
      mustResetPassword: boolean;
      passwordChangedAt: Date | null;
    },
  ) {
    if (!user.mustResetPassword) return false;
    const student = await this.prisma.schoolPersonAccount.findFirst({
      where: { tenantId, userId: user.id, personType: 'STUDENT' },
    });
    return Boolean(student);
  }

  private async loadActivationContact(
    tenantId: string,
    user: { id: string; phone?: string | null; email?: string | null },
  ) {
    const link = await this.prisma.schoolPersonAccount.findFirst({
      where: { tenantId, userId: user.id, personType: 'STUDENT' },
      select: {
        student: { select: { phone: true, email: true } },
      },
    });
    const student = link?.student;
    if (student) {
      await this.syncLoginContactFromStudent(tenantId, user, student);
    }
    return pickSchoolActivationContact({
      studentPhone: student?.phone,
      studentEmail: student?.email,
      userPhone: user.phone,
      userEmail: user.email,
    });
  }

  private async syncLoginContactFromStudent(
    tenantId: string,
    user: { id: string; phone?: string | null; email?: string | null },
    student: { phone?: string | null; email?: string | null },
  ) {
    const data: { phone?: string | null; email?: string } = {};
    if (student.phone != null && student.phone !== (user.phone ?? '')) {
      data.phone = student.phone;
      user.phone = student.phone;
    }
    const nextEmail = realSchoolEmail(student.email);
    if (nextEmail && isSchoolPlaceholderEmail(user.email ?? '')) {
      const taken = await this.prisma.user.findFirst({
        where: {
          tenantId,
          email: nextEmail,
          deletedAt: null,
          NOT: { id: user.id },
        },
        select: { id: true },
      });
      if (!taken) {
        data.email = nextEmail;
        user.email = nextEmail;
      }
    }
    if (Object.keys(data).length === 0) return;
    await this.prisma.user.update({ where: { id: user.id }, data });
  }

  private async loadOpenChallenge(tenantId: string, challengeId: string) {
    return this.prisma.schoolAuthChallenge.findFirst({
      where: {
        id: challengeId,
        tenantId,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  }

  private normalizeCode(code: string) {
    return code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  }

  private async assertNewPassword(
    tenantId: string,
    userId: string,
    password: string,
    identifier: string,
  ) {
    const settings = await this.settings(tenantId);
    if (password.trim().length < settings.passwordMinLength) {
      throw new BadRequestException(
        `Use at least ${settings.passwordMinLength} characters.`,
      );
    }
    if (this.isForbiddenPassword(password)) {
      throw new BadRequestException('Choose a different password.');
    }
    const compactId = identifier.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
    if (
      compactId &&
      password
        .replace(/[^A-Za-z0-9]/g, '')
        .toLowerCase()
        .includes(compactId)
    ) {
      throw new BadRequestException(
        'Do not use your admission or roll number.',
      );
    }
    const history = await this.prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: settings.historyCount,
    });
    for (const row of history) {
      if (await bcrypt.compare(password, row.passwordHash)) {
        throw new BadRequestException('Do not reuse a recent password.');
      }
    }
  }

  private async rateIp(tenantId: string, purpose: string, ip?: string) {
    const since = new Date(Date.now() - 10 * 60_000);
    const count = await this.prisma.schoolAuthChallenge.count({
      where: {
        tenantId,
        purpose,
        createdAt: { gte: since },
        ...(ip ? { ipAddress: ip } : {}),
      },
    });
    if (count >= 20) {
      throw new HttpException(GENERIC_LOCKED, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private async assertNotLocked(
    tenantId: string,
    userId: string | null,
    identifier: string,
  ) {
    const settings = await this.settings(tenantId);
    const lock = userId
      ? await this.prisma.schoolAuthLock.findUnique({
          where: { tenantId_userId: { tenantId, userId } },
        })
      : await this.prisma.schoolAuthLock.findFirst({
          where: { tenantId, identifier: identifier.trim().toLowerCase() },
        });
    if (lock?.lockedUntil && lock.lockedUntil > new Date()) {
      await this.recordEvent(tenantId, userId, 'ACCOUNT_LOCKED', {
        identifier,
      });
      throw new HttpException(GENERIC_LOCKED, HttpStatus.TOO_MANY_REQUESTS);
    }
    if (
      lock?.lockedUntil &&
      lock.lockedUntil <= new Date() &&
      lock.failedCount >= settings.maxLoginAttempts
    ) {
      await this.prisma.schoolAuthLock.update({
        where: { id: lock.id },
        data: { failedCount: 0, lockedUntil: null },
      });
    }
  }

  private async failLock(
    tenantId: string,
    userId: string | null,
    identifier: string,
  ) {
    const settings = await this.settings(tenantId);
    if (!userId) return;
    const existing = await this.prisma.schoolAuthLock.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    });
    const failedCount = (existing?.failedCount ?? 0) + 1;
    const lockedUntil =
      failedCount >= settings.maxLoginAttempts
        ? new Date(Date.now() + settings.lockMinutes * 60_000)
        : null;
    await this.prisma.schoolAuthLock.upsert({
      where: { tenantId_userId: { tenantId, userId } },
      create: {
        tenantId,
        userId,
        identifier: identifier.trim().toLowerCase(),
        failedCount,
        lockedUntil,
        lastFailedAt: new Date(),
      },
      update: {
        failedCount,
        lockedUntil,
        lastFailedAt: new Date(),
        identifier: identifier.trim().toLowerCase(),
      },
    });
    if (lockedUntil) {
      await this.recordEvent(tenantId, userId, 'ACCOUNT_LOCKED', {
        identifier,
      });
    }
  }

  private async clearLock(tenantId: string, userId: string) {
    await this.prisma.schoolAuthLock.deleteMany({
      where: { tenantId, userId },
    });
  }

  private async recordEvent(
    tenantId: string,
    userId: string | null,
    event: string,
    extra: {
      identifier?: string;
      reason?: string;
      ip?: string | null;
      device?: string | null;
    },
  ) {
    await this.prisma.schoolAuthEvent.create({
      data: {
        tenantId,
        userId,
        event,
        identifier: extra.identifier?.slice(0, 80) ?? null,
        reason: extra.reason ?? null,
        ipAddress: extra.ip ?? null,
        device: extra.device?.slice(0, 160) ?? null,
      },
    });
  }
}
