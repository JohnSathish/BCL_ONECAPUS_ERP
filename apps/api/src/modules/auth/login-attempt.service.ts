import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;

const LOCK_MESSAGE =
  'Account locked due to too many failed attempts. Try again in 15 minutes or contact your administrator.';

@Injectable()
export class LoginAttemptService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeKey(value: string) {
    return value.trim().toLowerCase();
  }

  async assertNotLocked(tenantId: string, ipAddress: string, email: string) {
    const normalizedEmail = this.normalizeKey(email);
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
      throw new HttpException(LOCK_MESSAGE, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  async recordFailure(tenantId: string, ipAddress: string, email: string) {
    const normalizedEmail = this.normalizeKey(email);
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
      try {
        await this.prisma.authLoginEvent.create({
          data: {
            tenantId,
            identifier: normalizedEmail,
            method: 'password',
            outcome: 'lockout',
            reason: 'max_failures',
            ipAddress,
            metadata: { failedCount },
          },
        });
      } catch {
        // ignore
      }
      throw new HttpException(LOCK_MESSAGE, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  async resetOnSuccess(tenantId: string, ipAddress: string, email: string) {
    const normalizedEmail = this.normalizeKey(email);
    await this.prisma.loginAttempt.deleteMany({
      where: { tenantId, ipAddress, email: normalizedEmail },
    });
  }

  /** Clear lockouts for every identifier tied to a portal user (all IPs). */
  async unlockForUser(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
      select: {
        email: true,
        username: true,
        student: {
          select: {
            rollNumber: true,
            enrollmentNumber: true,
            universityRollNumber: true,
            admissionNumber: true,
            applicationNumber: true,
          },
        },
      },
    });
    if (!user) return { cleared: 0 };

    const identifiers = [
      user.email,
      user.username,
      user.student?.rollNumber,
      user.student?.enrollmentNumber,
      user.student?.universityRollNumber,
      user.student?.admissionNumber,
      user.student?.applicationNumber,
    ]
      .filter((v): v is string => Boolean(v?.trim()))
      .map((v) => this.normalizeKey(v));

    const unique = [...new Set(identifiers)];
    if (!unique.length) return { cleared: 0 };

    const result = await this.prisma.loginAttempt.deleteMany({
      where: {
        tenantId,
        email: { in: unique },
      },
    });

    return { cleared: result.count };
  }
}
