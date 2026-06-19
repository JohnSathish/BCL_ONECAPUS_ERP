import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { authenticator } from 'otplib';
import { PrismaService } from '../../../database/prisma.service';
import { FieldEncryptionService } from '../../../common/crypto/field-encryption.service';
import { CacheService } from '../../../shared/cache/cache.service';

export const MFA_ENFORCED_ROLE_SLUGS = [
  'super-admin',
  'principal',
  'accountant',
  'examination-cell',
] as const;

@Injectable()
export class MfaService {
  private readonly log = new Logger(MfaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: FieldEncryptionService,
    private readonly cache: CacheService,
  ) {
    authenticator.options = { window: 1 };
  }

  async status(userId: string) {
    const secret = await this.prisma.userMfaSecret.findUnique({
      where: { userId },
    });
    return {
      enabled: Boolean(secret?.verifiedAt),
      pendingSetup: Boolean(secret && !secret.verifiedAt),
    };
  }

  async setup(userId: string, email: string) {
    const plainSecret = authenticator.generateSecret();
    const encrypted = this.encryption.encrypt(plainSecret)!;
    await this.prisma.userMfaSecret.upsert({
      where: { userId },
      create: { userId, encryptedSecret: encrypted },
      update: { encryptedSecret: encrypted, verifiedAt: null },
    });
    const otpauth = authenticator.keyuri(email, 'OneCampus ERP', plainSecret);
    return { otpauthUrl: otpauth, secret: plainSecret };
  }

  async verifySetup(userId: string, code: string) {
    const secret = await this.prisma.userMfaSecret.findUnique({
      where: { userId },
    });
    if (!secret) throw new BadRequestException('MFA setup not started');
    const plain = this.encryption.decrypt(secret.encryptedSecret);
    if (!plain || !authenticator.verify({ token: code, secret: plain })) {
      throw new BadRequestException('Invalid authenticator code');
    }
    await this.prisma.$transaction([
      this.prisma.userMfaSecret.update({
        where: { userId },
        data: { verifiedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { mfaEnabled: true },
      }),
    ]);
    const recovery = await this.issueRecoveryCodes(userId);
    return { enabled: true, recoveryCodes: recovery };
  }

  async disable(userId: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) throw new UnauthorizedException('User not found');
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid password');

    await this.prisma.$transaction([
      this.prisma.userMfaRecoveryCode.deleteMany({ where: { userId } }),
      this.prisma.userMfaSecret.deleteMany({ where: { userId } }),
      this.prisma.user.update({
        where: { id: userId },
        data: { mfaEnabled: false },
      }),
    ]);
    return { disabled: true };
  }

  async isRequiredForUser(
    tenantId: string,
    _userId: string,
    roleSlugs: string[],
  ): Promise<boolean> {
    try {
      const settings = await this.prisma.tenantSecuritySettings.findUnique({
        where: { tenantId },
      });
      if (!settings?.mfaEnforced) return false;

      const enforcedRoles = (settings.mfaEnforcedRoles as string[] | null) ?? [
        ...MFA_ENFORCED_ROLE_SLUGS,
      ];
      return roleSlugs.some((r) => enforcedRoles.includes(r));
    } catch (err) {
      this.log.warn(
        `MFA settings unavailable (${(err as Error).message}); treating as not required`,
      );
      return false;
    }
  }

  async userHasVerifiedMfa(userId: string): Promise<boolean> {
    try {
      const row = await this.prisma.userMfaSecret.findUnique({
        where: { userId },
      });
      return Boolean(row?.verifiedAt);
    } catch (err) {
      this.log.warn(
        `MFA secret lookup failed (${(err as Error).message}); treating as not verified`,
      );
      return false;
    }
  }

  async createPendingLoginToken(
    userId: string,
    tenantId: string,
    extra?: {
      rememberMe?: boolean;
      meta?: Record<string, unknown>;
    },
  ) {
    const token = randomUUID();
    await this.cache.set(
      `mfa:login:${token}`,
      { userId, tenantId, rememberMe: extra?.rememberMe, meta: extra?.meta },
      600,
    );
    return token;
  }

  async resolvePendingLogin(token: string) {
    return this.cache.get<{
      userId: string;
      tenantId: string;
      rememberMe?: boolean;
      meta?: Record<string, unknown>;
    }>(`mfa:login:${token}`);
  }

  async clearPendingLogin(token: string) {
    await this.cache.del(`mfa:login:${token}`);
  }

  async verifyTotp(userId: string, code: string): Promise<boolean> {
    const secret = await this.prisma.userMfaSecret.findUnique({
      where: { userId },
    });
    if (!secret?.verifiedAt) return false;
    const plain = this.encryption.decrypt(secret.encryptedSecret);
    if (!plain) return false;
    return authenticator.verify({ token: code, secret: plain });
  }

  async verifyRecoveryCode(userId: string, code: string): Promise<boolean> {
    const normalized = code.trim().toUpperCase();
    const rows = await this.prisma.userMfaRecoveryCode.findMany({
      where: { userId, usedAt: null },
    });
    for (const row of rows) {
      if (await bcrypt.compare(normalized, row.codeHash)) {
        await this.prisma.userMfaRecoveryCode.update({
          where: { id: row.id },
          data: { usedAt: new Date() },
        });
        return true;
      }
    }
    return false;
  }

  async sendEmailOtp(userId: string, email: string) {
    const key = `mfa:email:${userId}`;
    const sends = (await this.cache.get<number>(`${key}:sends`)) ?? 0;
    if (sends >= 3) {
      throw new BadRequestException('Too many OTP requests. Try again later.');
    }
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await this.cache.set(`${key}:code`, otp, 600);
    await this.cache.set(`${key}:sends`, sends + 1, 900);
    await this.cache.set(`${key}:attempts`, 0, 600);
    await this.prisma.auditLog.create({
      data: {
        tenantId: (
          await this.prisma.user.findUniqueOrThrow({
            where: { id: userId },
            select: { tenantId: true },
          })
        ).tenantId,
        userId,
        module: 'auth',
        action: 'mfa.email_otp_sent',
        entityType: 'user',
        entityId: userId,
        metadata: { emailPreview: email.replace(/(.{2}).+(@.+)/, '$1***$2') },
      },
    });
    if (process.env.NODE_ENV !== 'production') {
      return { sent: true, devOtp: otp };
    }
    return { sent: true };
  }

  async verifyEmailOtp(userId: string, code: string): Promise<boolean> {
    const key = `mfa:email:${userId}`;
    const attempts = (await this.cache.get<number>(`${key}:attempts`)) ?? 0;
    if (attempts >= 3) {
      throw new BadRequestException('Too many OTP attempts');
    }
    await this.cache.set(`${key}:attempts`, attempts + 1, 600);
    const stored = await this.cache.get<string>(`${key}:code`);
    return stored === code.trim();
  }

  private async issueRecoveryCodes(userId: string) {
    await this.prisma.userMfaRecoveryCode.deleteMany({ where: { userId } });
    const codes: string[] = [];
    for (let i = 0; i < 8; i++) {
      const code = randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
      const codeHash = await bcrypt.hash(code, 10);
      await this.prisma.userMfaRecoveryCode.create({
        data: { userId, codeHash },
      });
    }
    return codes;
  }

  hashForStorage(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }
}
