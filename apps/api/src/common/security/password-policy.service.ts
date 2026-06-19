import { BadRequestException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';

const DEFAULT_MIN_LENGTH = 8;
const DEFAULT_MAX_LENGTH = 128;
const DEFAULT_HISTORY = 5;

export type PasswordPolicyRules = {
  minLength: number;
  maxLength: number;
  requireUpper: boolean;
  requireLower: boolean;
  requireNumber: boolean;
  requireSpecial: boolean;
  historyCount: number;
};

@Injectable()
export class PasswordPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async getRules(tenantId: string): Promise<PasswordPolicyRules> {
    const settings = await this.prisma.tenantSecuritySettings.findUnique({
      where: { tenantId },
    });
    const minLength = Math.max(
      DEFAULT_MIN_LENGTH,
      Math.min(12, settings?.minPasswordLength ?? DEFAULT_MIN_LENGTH),
    );
    return {
      minLength,
      maxLength: DEFAULT_MAX_LENGTH,
      requireUpper: true,
      requireLower: true,
      requireNumber: true,
      requireSpecial: true,
      historyCount: settings?.passwordHistoryCount ?? DEFAULT_HISTORY,
    };
  }

  validatePlaintext(password: string, rules: PasswordPolicyRules): void {
    if (password.length < rules.minLength) {
      throw new BadRequestException(
        `Password must be at least ${rules.minLength} characters`,
      );
    }
    if (password.length > rules.maxLength) {
      throw new BadRequestException(
        `Password must be at most ${rules.maxLength} characters`,
      );
    }
    if (rules.requireUpper && !/[A-Z]/.test(password)) {
      throw new BadRequestException(
        'Password must include an uppercase letter',
      );
    }
    if (rules.requireLower && !/[a-z]/.test(password)) {
      throw new BadRequestException('Password must include a lowercase letter');
    }
    if (rules.requireNumber && !/[0-9]/.test(password)) {
      throw new BadRequestException('Password must include a number');
    }
    if (rules.requireSpecial && !/[^A-Za-z0-9]/.test(password)) {
      throw new BadRequestException(
        'Password must include a special character',
      );
    }
  }

  async assertNotInHistory(
    userId: string,
    plainPassword: string,
    historyCount: number,
  ): Promise<void> {
    const history = await this.prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: historyCount,
    });
    for (const h of history) {
      if (await bcrypt.compare(plainPassword, h.passwordHash)) {
        throw new BadRequestException('Password was used recently');
      }
    }
  }

  async validateForUser(
    tenantId: string,
    userId: string,
    plainPassword: string,
  ): Promise<void> {
    const rules = await this.getRules(tenantId);
    this.validatePlaintext(plainPassword, rules);
    await this.assertNotInHistory(userId, plainPassword, rules.historyCount);
  }

  async recordHistory(
    userId: string,
    passwordHash: string,
    historyCount: number,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.passwordHistory.create({ data: { userId, passwordHash } });
      const all = await tx.passwordHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: historyCount,
      });
      if (all.length) {
        await tx.passwordHistory.deleteMany({
          where: { id: { in: all.map((h) => h.id) } },
        });
      }
    });
  }
}
