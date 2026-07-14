import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/** Failed password attempts allowed before a temporary lock (per IP + identifier). */
const MAX_FAILURES = 8;
/** Failures older than this window no longer count toward the lock. */
const WINDOW_MS = 20 * 60 * 1000;
/** First lock duration — short enough for honest typos, long enough to slow bots. */
const LOCK_MS = 5 * 60 * 1000;
/** Escalated lock after repeated lockouts in the same window. */
const LOCK_ESCALATED_MS = 15 * 60 * 1000;

export type LoginFailureOutcome = {
  remaining: number;
  locked: boolean;
  retryAfterSeconds: number | null;
  message: string;
};

@Injectable()
export class LoginAttemptService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeKey(value: string) {
    return value.trim().toLowerCase();
  }

  private minutesLeft(until: Date, now = new Date()) {
    return Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 60_000));
  }

  private lockMessage(lockedUntil: Date, now = new Date()) {
    const minutes = this.minutesLeft(lockedUntil, now);
    return `For security, sign-in is temporarily paused for this account. Try again in about ${minutes} minute${minutes === 1 ? '' : 's'}, use Forgot password, or ask your college administrator to unlock you.`;
  }

  private failureMessage(remaining: number) {
    if (remaining <= 0) {
      return this.lockMessage(new Date(Date.now() + LOCK_MS));
    }
    if (remaining <= 2) {
      return `Incorrect username or password. ${remaining} attempt${remaining === 1 ? '' : 's'} left before a temporary lock. Double-check your details or use Forgot password.`;
    }
    return `Incorrect username or password. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before a temporary lock.`;
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

    const now = new Date();
    if (record?.lockedUntil && record.lockedUntil > now) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          errorCode: 'LOGIN_TEMPORARILY_LOCKED',
          message: this.lockMessage(record.lockedUntil, now),
          retryAfterSeconds: Math.ceil(
            (record.lockedUntil.getTime() - now.getTime()) / 1000,
          ),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async recordFailure(
    tenantId: string,
    ipAddress: string,
    email: string,
  ): Promise<LoginFailureOutcome> {
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
    const escalate =
      !windowExpired &&
      Boolean(existing?.lockedUntil) &&
      existing!.lockedUntil! <= now &&
      failedCount >= MAX_FAILURES;

    const lockDurationMs = escalate ? LOCK_ESCALATED_MS : LOCK_MS;
    const lockedUntil =
      failedCount >= MAX_FAILURES
        ? new Date(now.getTime() + lockDurationMs)
        : null;

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
            reason: escalate ? 'escalated_lockout' : 'max_failures',
            ipAddress,
            metadata: { failedCount, lockDurationMs },
          },
        });
      } catch {
        // ignore audit write failures
      }

      const message = this.lockMessage(lockedUntil, now);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          errorCode: 'LOGIN_TEMPORARILY_LOCKED',
          message,
          retryAfterSeconds: Math.ceil(
            (lockedUntil.getTime() - now.getTime()) / 1000,
          ),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const remaining = Math.max(0, MAX_FAILURES - failedCount);
    return {
      remaining,
      locked: false,
      retryAfterSeconds: null,
      message: this.failureMessage(remaining),
    };
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
