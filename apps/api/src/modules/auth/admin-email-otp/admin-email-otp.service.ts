import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { CommunicationEmailService } from '../../communication/services/communication-email.service';
import { isSchoolSisTenant } from '../../school-sis/school-sis-login-lookup';
import type { LoginDeviceMeta } from '../auth.service';
import {
  OTP_MAX_ATTEMPTS,
  OTP_MAX_SENDS,
  OTP_SEND_WINDOW_MS,
  OTP_TTL_MS,
  TRUSTED_DEVICE_MS,
  accountRequiresAdminEmailOtp,
  buildAdminOtpMessage,
  checkOtpCode,
  describeClientDevice,
  generateOtpCode,
  hashOtpCode,
  maskEmail,
  otpHashesMatch,
  resendAllowed,
  selectOtpChannel,
} from './admin-email-otp.policy';

export type AdminEmailOtpChallengeResponse = {
  emailOtpRequired: true;
  challengeId: string;
  maskedEmail: string;
  expiresAt: string;
  resendAvailableAt: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
};

type LoginMeta = LoginDeviceMeta & { rememberMe?: boolean };

@Injectable()
export class AdminEmailOtpService {
  private readonly log = new Logger(AdminEmailOtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly email: CommunicationEmailService,
  ) {}

  /**
   * Returns a challenge when this college admin must verify a new device.
   * Returns null when login should continue with the existing session rules.
   */
  async prepareLogin(input: {
    tenantId: string;
    tenantName: string;
    userId: string;
    email: string;
    displayName?: string | null;
    roles: string[];
    trustToken?: string;
    rememberMe?: boolean;
    meta?: LoginDeviceMeta;
  }): Promise<AdminEmailOtpChallengeResponse | null> {
    const schoolTenant = await isSchoolSisTenant(this.prisma, input.tenantId);
    const trusted = await this.trustTokenIsValid(
      input.tenantId,
      input.userId,
      input.trustToken,
      input.meta?.ipAddress,
    );
    const decision = accountRequiresAdminEmailOtp({
      roles: input.roles,
      schoolTenant,
      trustedDevice: trusted,
    });
    if (decision === 'skip') return null;

    const channel = selectOtpChannel({ audience: 'admin' });
    if (channel !== 'email') return null;

    const destination = input.email?.trim().toLowerCase() ?? '';
    if (!destination.includes('@')) {
      throw new ForbiddenException(
        'This admin account has no registered email address. Add one before signing in.',
      );
    }

    await this.assertSendBudget(input.userId);
    const challenge = await this.issueChallenge({
      tenantId: input.tenantId,
      userId: input.userId,
      rememberMe: Boolean(input.rememberMe),
      meta: input.meta,
    });
    try {
      await this.deliverEmail({
        tenantId: input.tenantId,
        userId: input.userId,
        challengeId: challenge.id,
        code: challenge.code,
        to: destination,
        collegeName: input.tenantName,
        displayName: input.displayName,
      });
    } catch (err) {
      await this.prisma.adminEmailOtpChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() },
      });
      throw err;
    }
    return this.toPublicChallenge(
      challenge.id,
      destination,
      challenge.expiresAt,
      challenge.sentAt,
    );
  }

  async resend(challengeId: string) {
    const row = await this.prisma.adminEmailOtpChallenge.findUnique({
      where: { id: challengeId },
    });
    const now = new Date();
    const decision = resendAllowed({
      exists: Boolean(row),
      consumed: Boolean(row?.consumedAt),
      createdAt: row?.createdAt ?? now,
      lastSentAt: row?.lastSentAt ?? now,
      sendCount: row?.sendCount ?? OTP_MAX_SENDS,
      now,
    });
    if (!decision.ok || !row) {
      throw new BadRequestException(
        decision.ok
          ? 'This verification session has ended. Sign in again.'
          : decision.reason,
      );
    }

    const user = await this.prisma.user.findFirst({
      where: {
        id: row.userId,
        tenantId: row.tenantId,
        deletedAt: null,
        isActive: true,
      },
      select: { email: true, displayName: true },
    });
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: row.tenantId, deletedAt: null },
      select: { name: true },
    });
    const destination = user?.email?.trim().toLowerCase() ?? '';
    if (!destination.includes('@')) {
      throw new ForbiddenException(
        'This admin account has no registered email address. Add one before signing in.',
      );
    }

    const code = generateOtpCode();
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS);
    await this.prisma.adminEmailOtpChallenge.update({
      where: { id: row.id },
      data: {
        codeHash: hashOtpCode(code, row.id, this.pepper()),
        expiresAt,
        lastSentAt: now,
        sendCount: { increment: 1 },
        attemptCount: 0,
      },
    });
    try {
      await this.deliverEmail({
        tenantId: row.tenantId,
        userId: row.userId,
        challengeId: row.id,
        code,
        to: destination,
        collegeName: tenant?.name ?? 'Bosco Connect',
        displayName: user?.displayName,
      });
    } catch (err) {
      await this.prisma.adminEmailOtpChallenge.update({
        where: { id: row.id },
        data: { consumedAt: new Date() },
      });
      throw err;
    }
    return this.toPublicChallenge(row.id, destination, expiresAt, now);
  }

  async verify(challengeId: string, code: string) {
    const row = await this.prisma.adminEmailOtpChallenge.findUnique({
      where: { id: challengeId },
    });
    const now = new Date();
    const presented = hashOtpCode(code, challengeId, this.pepper());
    const verdict = checkOtpCode({
      exists: Boolean(row),
      consumed: Boolean(row?.consumedAt),
      expiresAt: row?.expiresAt ?? now,
      attemptCount: row?.attemptCount ?? 0,
      hashesMatch: row ? otpHashesMatch(row.codeHash, presented) : false,
      now,
    });

    if (verdict.ok && row) {
      await this.assertAdmin(row.tenantId, row.userId);
    }

    if (!verdict.ok || !row) {
      if (verdict.ok === false && verdict.reason === 'mismatch' && row) {
        const updated = await this.prisma.adminEmailOtpChallenge.update({
          where: { id: row.id },
          data: { attemptCount: { increment: 1 } },
          select: { attemptCount: true },
        });
        if (updated.attemptCount >= OTP_MAX_ATTEMPTS) {
          throw new BadRequestException(
            'Too many incorrect codes. Sign in again to request a new one.',
          );
        }
        throw new BadRequestException(
          'That verification code is incorrect. Check the email and try again.',
        );
      }
      throw new BadRequestException(
        this.failureMessage(verdict.ok ? 'missing' : verdict.reason),
      );
    }

    const consumed = await this.prisma.adminEmailOtpChallenge.updateMany({
      where: {
        id: row.id,
        consumedAt: null,
        expiresAt: { gt: now },
        attemptCount: { lt: OTP_MAX_ATTEMPTS },
        codeHash: presented,
      },
      data: { consumedAt: now },
    });
    if (consumed.count !== 1) {
      throw new BadRequestException(
        'That verification code can no longer be used. Sign in again.',
      );
    }

    const meta = (row.loginMeta ?? {}) as LoginMeta;
    return {
      userId: row.userId,
      tenantId: row.tenantId,
      rememberMe: row.rememberMe,
      meta,
    };
  }

  async trustCurrentDevice(input: {
    tenantId: string;
    userId: string;
    userAgent?: string;
    ipAddress?: string;
  }) {
    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    await this.prisma.adminTrustedDevice.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        tokenHash: this.hashTrustToken(token),
        label: describeClientDevice(input.userAgent),
        userAgent: input.userAgent?.slice(0, 300) ?? null,
        lastIp: input.ipAddress?.slice(0, 64) ?? null,
        lastUsedAt: now,
        expiresAt: new Date(now.getTime() + TRUSTED_DEVICE_MS),
      },
    });
    return token;
  }

  async listTrustedDevices(
    tenantId: string,
    userId: string,
    currentToken?: string,
  ) {
    await this.assertAdmin(tenantId, userId);
    const currentHash = currentToken ? this.hashTrustToken(currentToken) : null;
    const rows = await this.prisma.adminTrustedDevice.findMany({
      where: {
        tenantId,
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastUsedAt: 'desc' },
      select: {
        id: true,
        label: true,
        lastIp: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
        tokenHash: true,
      },
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        label: row.label,
        lastIp: row.lastIp,
        createdAt: row.createdAt.toISOString(),
        lastUsedAt: row.lastUsedAt.toISOString(),
        expiresAt: row.expiresAt.toISOString(),
        current: currentHash !== null && row.tokenHash === currentHash,
      })),
    };
  }

  async revokeTrustedDevice(
    tenantId: string,
    userId: string,
    deviceId: string,
  ) {
    await this.assertAdmin(tenantId, userId);
    const result = await this.prisma.adminTrustedDevice.updateMany({
      where: { id: deviceId, tenantId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count !== 1) {
      throw new BadRequestException('That trusted device was not found.');
    }
    return { revoked: true };
  }

  async revokeAllTrustedDevices(tenantId: string, userId: string) {
    await this.assertAdmin(tenantId, userId);
    await this.prisma.adminTrustedDevice.updateMany({
      where: { tenantId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { revoked: true };
  }

  private async trustTokenIsValid(
    tenantId: string,
    userId: string,
    token: string | undefined,
    ipAddress?: string,
  ) {
    if (!token || token.length < 20) return false;
    const row = await this.prisma.adminTrustedDevice.findFirst({
      where: {
        tenantId,
        userId,
        tokenHash: this.hashTrustToken(token),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (!row) return false;
    await this.prisma.adminTrustedDevice.update({
      where: { id: row.id },
      data: {
        lastUsedAt: new Date(),
        ...(ipAddress ? { lastIp: ipAddress.slice(0, 64) } : {}),
      },
    });
    return true;
  }

  private async assertSendBudget(userId: string) {
    const since = new Date(Date.now() - OTP_SEND_WINDOW_MS);
    const recent = await this.prisma.adminEmailOtpChallenge.aggregate({
      where: { userId, createdAt: { gte: since } },
      _sum: { sendCount: true },
    });
    if ((recent._sum.sendCount ?? 0) >= OTP_MAX_SENDS) {
      throw new BadRequestException(
        'Too many verification emails were requested. Wait about 15 minutes, then sign in again.',
      );
    }
  }

  private async issueChallenge(input: {
    tenantId: string;
    userId: string;
    rememberMe: boolean;
    meta?: LoginDeviceMeta;
  }) {
    const now = new Date();
    await this.prisma.adminEmailOtpChallenge.updateMany({
      where: { userId: input.userId, consumedAt: null },
      data: { consumedAt: now },
    });
    const id = randomUUID();
    const code = generateOtpCode();
    const loginMeta = Object.fromEntries(
      Object.entries({ ...(input.meta ?? {}) }).filter(
        ([key, value]) => key !== 'adminTrustToken' && value !== undefined,
      ),
    );
    await this.prisma.adminEmailOtpChallenge.create({
      data: {
        id,
        tenantId: input.tenantId,
        userId: input.userId,
        codeHash: hashOtpCode(code, id, this.pepper()),
        channel: 'email',
        expiresAt: new Date(now.getTime() + OTP_TTL_MS),
        lastSentAt: now,
        sendCount: 1,
        rememberMe: input.rememberMe,
        loginMeta: loginMeta as Prisma.InputJsonValue,
      },
    });
    return {
      id,
      code,
      expiresAt: new Date(now.getTime() + OTP_TTL_MS),
      sentAt: now,
    };
  }

  private async deliverEmail(input: {
    tenantId: string;
    userId: string;
    challengeId: string;
    code: string;
    to: string;
    collegeName: string;
    displayName?: string | null;
  }) {
    const message = buildAdminOtpMessage({
      code: input.code,
      collegeName: input.collegeName,
      displayName: input.displayName,
    });
    const result = await this.email.send({
      to: input.to,
      subject: message.subject,
      text: message.text,
    });
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: input.tenantId,
          userId: input.userId,
          module: 'auth',
          action: 'auth.admin_email_otp_sent',
          entityType: 'user',
          entityId: input.userId,
          metadata: {
            channel: 'email',
            emailPreview: maskEmail(input.to),
            delivered: result.ok,
          },
        },
      });
    } catch (err) {
      this.log.warn(
        `Admin verification audit was not saved (${(err as Error).message})`,
      );
    }
    if (!result.ok) {
      this.log.warn(
        `Admin verification email was not accepted (${result.error ?? 'send failed'})`,
      );
      throw new BadRequestException(
        'The verification email could not be sent. Try again in a minute.',
      );
    }
    this.log.log(`Admin verification email queued for ${maskEmail(input.to)}`);
  }

  private toPublicChallenge(
    challengeId: string,
    email: string,
    expiresAt: Date,
    sentAt: Date,
  ): AdminEmailOtpChallengeResponse {
    const resendAt = new Date(sentAt.getTime() + 60_000);
    return {
      emailOtpRequired: true,
      challengeId,
      maskedEmail: maskEmail(email),
      expiresAt: expiresAt.toISOString(),
      resendAvailableAt: resendAt.toISOString(),
      expiresInSeconds: Math.max(
        0,
        Math.ceil((expiresAt.getTime() - Date.now()) / 1000),
      ),
      resendAfterSeconds: 60,
    };
  }

  private async assertAdmin(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null, isActive: true },
      select: {
        roles: {
          where: { deletedAt: null },
          select: { role: { select: { slug: true } } },
        },
      },
    });
    const roles = user?.roles.map((row) => row.role.slug) ?? [];
    if (
      accountRequiresAdminEmailOtp({
        roles,
        schoolTenant: false,
        trustedDevice: false,
      }) !== 'challenge'
    ) {
      throw new ForbiddenException(
        'Email verification applies to admin accounts only.',
      );
    }
  }

  private failureMessage(
    reason: 'missing' | 'used' | 'expired' | 'locked' | 'mismatch',
  ) {
    if (reason === 'expired') {
      return 'That verification code has expired. Request a new code or sign in again.';
    }
    if (reason === 'locked') {
      return 'Too many incorrect codes. Sign in again to request a new one.';
    }
    if (reason === 'mismatch') {
      return 'That verification code is incorrect. Check the email and try again.';
    }
    return 'This verification session has ended. Sign in again.';
  }

  private pepper() {
    const pepper =
      this.config.get<string>('OTP_HASH_PEPPER') ||
      this.config.get<string>('JWT_ACCESS_SECRET');
    if (!pepper) {
      throw new ForbiddenException('Verification is not configured.');
    }
    return pepper;
  }

  private hashTrustToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
