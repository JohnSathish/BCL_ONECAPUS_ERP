import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 5 * 60 * 1000;

@Injectable()
export class LoginAttemptService {
  constructor(private readonly prisma: PrismaService) {}

  async assertNotLocked(tenantId: string, ipAddress: string, email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const record = await this.prisma.loginAttempt.findUnique({
      where: {
        tenantId_ipAddress_email: {
          tenantId,
          ipAddress,
          email: normalizedEmail,
        },
      },
    });

    if (record?.lockedUntil && record.lockedUntil > new Date()) {
      throw new HttpException(
        'Too many attempts. Try again in a few minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async recordFailure(tenantId: string, ipAddress: string, email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const now = new Date();
    const existing = await this.prisma.loginAttempt.findUnique({
      where: {
        tenantId_ipAddress_email: {
          tenantId,
          ipAddress,
          email: normalizedEmail,
        },
      },
    });

    const windowExpired =
      !existing || now.getTime() - existing.lastAttemptAt.getTime() > WINDOW_MS;

    const failedCount = windowExpired ? 1 : existing.failedCount + 1;
    const lockedUntil =
      failedCount >= MAX_FAILURES ? new Date(now.getTime() + LOCK_MS) : null;

    await this.prisma.loginAttempt.upsert({
      where: {
        tenantId_ipAddress_email: {
          tenantId,
          ipAddress,
          email: normalizedEmail,
        },
      },
      create: {
        tenantId,
        ipAddress,
        email: normalizedEmail,
        failedCount,
        lockedUntil,
        lastAttemptAt: now,
      },
      update: {
        failedCount,
        lockedUntil,
        lastAttemptAt: now,
      },
    });

    if (lockedUntil && lockedUntil > now) {
      throw new HttpException(
        'Too many attempts. Try again in a few minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async resetOnSuccess(tenantId: string, ipAddress: string, email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    await this.prisma.loginAttempt.deleteMany({
      where: { tenantId, ipAddress, email: normalizedEmail },
    });
  }
}
