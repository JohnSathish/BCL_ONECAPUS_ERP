import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { SchoolSisService } from './school-sis.service';
import { SchoolSisAccessService } from './school-sis-access.service';
import { AuthService } from '../auth/auth.service';
import type { JwtUser } from '../../common/decorators/current-user.decorator';

function sha(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function makeCode() {
  const raw = randomBytes(5)
    .toString('base64url')
    .replace(/[^A-Za-z0-9]/g, 'X')
    .toUpperCase()
    .slice(0, 8);
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

@Injectable()
export class SchoolSisAccountSecurityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sis: SchoolSisService,
    private readonly access: SchoolSisAccessService,
    private readonly auth: AuthService,
  ) {}

  async settings(tenantId: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    return this.prisma.schoolAuthSettings.upsert({
      where: { tenantId },
      update: {},
      create: { tenantId },
    });
  }

  async saveSettings(
    tenantId: string,
    actor: JwtUser,
    body: Record<string, number | boolean>,
  ) {
    this.access.assert(actor, 'users.update', 'users:manage');
    const current = await this.settings(tenantId);
    return this.prisma.schoolAuthSettings.update({
      where: { id: current.id },
      data: {
        maxLoginAttempts: Number(
          body.maxLoginAttempts ?? current.maxLoginAttempts,
        ),
        lockMinutes: Number(body.lockMinutes ?? current.lockMinutes),
        otpTtlSeconds: Number(body.otpTtlSeconds ?? current.otpTtlSeconds),
        otpResendSeconds: Number(
          body.otpResendSeconds ?? current.otpResendSeconds,
        ),
        maxOtpAttempts: Number(body.maxOtpAttempts ?? current.maxOtpAttempts),
        activationCodeHours: Number(
          body.activationCodeHours ?? current.activationCodeHours,
        ),
        passwordMinLength: Number(
          body.passwordMinLength ?? current.passwordMinLength,
        ),
        historyCount: Number(body.historyCount ?? current.historyCount),
        maxSessions: Number(body.maxSessions ?? current.maxSessions),
        otpEnabled:
          body.otpEnabled === undefined
            ? current.otpEnabled
            : Boolean(body.otpEnabled),
        activationCodeEnabled:
          body.activationCodeEnabled === undefined
            ? current.activationCodeEnabled
            : Boolean(body.activationCodeEnabled),
      },
    });
  }

  async listStudents(
    tenantId: string,
    q?: string,
    status?: string,
    sectionId?: string,
  ) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const year = await this.sis.currentYear(tenantId);
    const students = await this.prisma.schoolStudent.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(q
          ? {
              OR: [
                { fullName: { contains: q, mode: 'insensitive' } },
                { admissionNumber: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(sectionId
          ? {
              enrollments: {
                some: { academicYearId: year.id, sectionId, deletedAt: null },
              },
            }
          : {}),
      },
      include: {
        personAccounts: { where: { personType: 'STUDENT' }, take: 1 },
        enrollments: {
          where: { academicYearId: year.id, deletedAt: null },
          include: { section: { include: { grade: true } } },
          take: 1,
        },
      },
      orderBy: { fullName: 'asc' },
      take: 200,
    });
    const userIds = students
      .map((s) => s.personAccounts[0]?.userId)
      .filter(Boolean) as string[];
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            isActive: true,
            mustResetPassword: true,
            lastLoginAt: true,
            passwordChangedAt: true,
          },
        })
      : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    const locks = userIds.length
      ? await this.prisma.schoolAuthLock.findMany({
          where: { tenantId, userId: { in: userIds } },
        })
      : [];
    const lockBy = new Map(locks.map((l) => [l.userId, l]));
    const rows = students.map((s) => {
      const user = s.personAccounts[0]
        ? byId.get(s.personAccounts[0].userId)
        : null;
      const lock = user ? lockBy.get(user.id) : null;
      const locked = Boolean(
        lock?.lockedUntil && lock.lockedUntil > new Date(),
      );
      const accountStatus = !user
        ? 'NOT_ACTIVATED'
        : !user.isActive
          ? 'DISABLED'
          : locked
            ? 'LOCKED'
            : user.mustResetPassword
              ? 'NOT_ACTIVATED'
              : 'ACTIVE';
      return {
        studentId: s.id,
        userId: user?.id ?? null,
        fullName: s.fullName,
        admissionNumber: s.admissionNumber,
        classLabel: s.enrollments[0]
          ? `${s.enrollments[0].section.grade.name} ${s.enrollments[0].section.name}`
          : null,
        accountStatus,
        lastLoginAt: user?.lastLoginAt ?? null,
        activatedAt: user?.mustResetPassword ? null : user?.passwordChangedAt,
      };
    });
    return status ? rows.filter((r) => r.accountStatus === status) : rows;
  }

  async issueCode(tenantId: string, actor: JwtUser, userId: string) {
    this.access.assert(actor, 'users.update', 'users:manage');
    const settings = await this.settings(tenantId);
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found');
    const code = makeCode();
    const account = await this.prisma.schoolPersonAccount.findFirst({
      where: { tenantId, userId, personType: 'STUDENT' },
    });
    await this.prisma.schoolActivationCode.create({
      data: {
        tenantId,
        userId,
        studentId: account?.studentId ?? null,
        codeHash: sha(`${tenantId}:${code.replace(/-/g, '')}`),
        expiresAt: new Date(
          Date.now() + settings.activationCodeHours * 60 * 60_000,
        ),
        issuedById: actor.sub,
      },
    });
    await this.prisma.schoolAuthEvent.create({
      data: {
        tenantId,
        userId,
        event: 'ACTIVATION_STARTED',
        reason: 'admin_code',
      },
    });
    return {
      code,
      expiresAt: new Date(
        Date.now() + settings.activationCodeHours * 60 * 60_000,
      ),
      notice: 'Show this code once. It will not be stored in plain text.',
    };
  }

  async bulkCodes(tenantId: string, actor: JwtUser, sectionId: string) {
    this.access.assert(actor, 'users.create', 'users:manage');
    const year = await this.sis.currentYear(tenantId);
    const enrollments = await this.prisma.schoolEnrollment.findMany({
      where: {
        tenantId,
        sectionId,
        academicYearId: year.id,
        deletedAt: null,
        status: 'ACTIVE',
      },
      include: {
        student: {
          include: { personAccounts: { where: { personType: 'STUDENT' } } },
        },
        section: { include: { grade: true } },
      },
    });
    const sheets: Array<{
      fullName: string;
      admissionNumber: string;
      classLabel: string;
      code: string;
    }> = [];
    for (const row of enrollments) {
      const userId = row.student.personAccounts[0]?.userId;
      if (!userId) continue;
      const issued = await this.issueCode(tenantId, actor, userId);
      sheets.push({
        fullName: row.student.fullName,
        admissionNumber: row.student.admissionNumber,
        classLabel: `${row.section.grade.name} ${row.section.name}`,
        code: issued.code,
      });
    }
    return { year: year.name, count: sheets.length, sheets };
  }

  async unlock(tenantId: string, actor: JwtUser, userId: string) {
    this.access.assert(actor, 'users.update', 'users:manage');
    await this.prisma.schoolAuthLock.deleteMany({
      where: { tenantId, userId },
    });
    await this.prisma.user.updateMany({
      where: { id: userId, tenantId },
      data: { isActive: true, accountStatus: 'active' },
    });
    await this.prisma.schoolAuthEvent.create({
      data: { tenantId, userId, event: 'ACCOUNT_UNLOCKED' },
    });
    return { ok: true };
  }

  async disable(tenantId: string, actor: JwtUser, userId: string) {
    this.access.assert(actor, 'users.update', 'users:manage');
    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false, accountStatus: 'disabled' },
    });
    await this.auth.revokeAllSessionsForUser(userId);
    return { ok: true };
  }

  async revokeSessions(tenantId: string, actor: JwtUser, userId: string) {
    this.access.assert(actor, 'users.update', 'users:manage');
    await this.auth.revokeAllSessionsForUser(userId);
    await this.prisma.schoolAuthEvent.create({
      data: { tenantId, userId, event: 'SESSION_REVOKED', reason: 'admin' },
    });
    return { ok: true };
  }

  async resetPassword(tenantId: string, actor: JwtUser, userId: string) {
    this.access.assert(actor, 'users.update', 'users:manage');
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found');
    const passwordHash = await bcrypt.hash(randomBytes(24).toString('hex'), 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustResetPassword: true,
        accountStatus: 'active',
      },
    });
    await this.auth.revokeAllSessionsForUser(userId);
    await this.prisma.schoolAuthEvent.create({
      data: { tenantId, userId, event: 'PASSWORD_RESET', reason: 'admin' },
    });
    const code = await this.issueCode(tenantId, actor, userId);
    return {
      ok: true,
      ...code,
      notice:
        'Password was cleared. Give the student this one-time activation code. It will not be stored in plain text.',
    };
  }

  async events(tenantId: string, userId?: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    return this.prisma.schoolAuthEvent.findMany({
      where: { tenantId, ...(userId ? { userId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
