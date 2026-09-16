import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { LoginDeviceMeta } from '../auth/auth.service';
import { AuthService } from '../auth/auth.service';
import { LoginAttemptService } from '../auth/login-attempt.service';
import { PrismaService } from '../../database/prisma.service';
import { SchoolSisService } from '../school-sis/school-sis.service';
import { SchoolSisLicenseService } from '../school-sis/school-sis-license.service';
import { SCHOOL_MOBILE_DEFAULT_PASSWORD } from './school-mobile.constants';

function compactId(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[\s\-_.]/g, '');
}

@Injectable()
export class SchoolMobileAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly loginAttempts: LoginAttemptService,
    private readonly sis: SchoolSisService,
    private readonly licenses: SchoolSisLicenseService,
  ) {}

  async login(
    tenantId: string,
    identifier: string,
    password: string,
    meta?: LoginDeviceMeta,
  ) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const ip = meta?.ipAddress ?? 'mobile';
    const trimmed = identifier.trim();
    if (!trimmed || !password) {
      throw new UnauthorizedException(
        'Enter your admission or roll number and password.',
      );
    }
    await this.loginAttempts.assertNotLocked(tenantId, ip, trimmed);

    const userId = await this.resolveUserId(tenantId, trimmed);
    if (!userId) {
      const failure = await this.loginAttempts.recordFailure(
        tenantId,
        ip,
        trimmed,
      );
      throw new UnauthorizedException(failure.message);
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null, isActive: true },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid admission number or password.');
    }

    const isStudent = await this.isStudentAccount(tenantId, user.id);
    let valid = await bcrypt.compare(password, user.passwordHash);
    const typedDefault = password === SCHOOL_MOBILE_DEFAULT_PASSWORD;
    if (!valid && isStudent && typedDefault) {
      valid = true;
    }
    if (!valid) {
      const failure = await this.loginAttempts.recordFailure(
        tenantId,
        ip,
        trimmed,
      );
      throw new UnauthorizedException(failure.message);
    }

    const mustResetPassword =
      Boolean(user.mustResetPassword) || (isStudent && typedDefault);

    if (mustResetPassword && !user.mustResetPassword) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { mustResetPassword: true },
      });
    }

    await this.loginAttempts.resetOnSuccess(tenantId, ip, trimmed);
    const session = await this.auth.issueRememberedSessionForUser(
      user.id,
      tenantId,
      { ...meta, clientType: 'mobile' },
      { mustResetPassword },
    );
    return {
      ...this.auth.toPublicSession(session, { includeRefreshToken: true }),
      license: await this.licenses.publicStatus(tenantId),
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
    if (!user) throw new UnauthorizedException('User not found');
    const currentOk =
      (await bcrypt.compare(currentPassword, user.passwordHash)) ||
      currentPassword === SCHOOL_MOBILE_DEFAULT_PASSWORD;
    if (!currentOk) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException(
        'Choose a new password that is different from the current one.',
      );
    }
    if (newPassword === SCHOOL_MOBILE_DEFAULT_PASSWORD) {
      throw new BadRequestException(
        'Please choose a personal password, not the school default.',
      );
    }
    await this.auth.resetPasswordAndRevokeSessions(
      userId,
      newPassword,
      tenantId,
    );
    const session = await this.auth.issueRememberedSessionForUser(
      userId,
      tenantId,
      { ...meta, clientType: 'mobile' },
      { mustResetPassword: false },
    );
    return this.auth.toPublicSession(session, { includeRefreshToken: true });
  }

  private async isStudentAccount(tenantId: string, userId: string) {
    const account = await this.prisma.schoolPersonAccount.findFirst({
      where: { tenantId, userId, personType: 'STUDENT' },
    });
    return Boolean(account);
  }

  private async resolveUserId(
    tenantId: string,
    identifier: string,
  ): Promise<string | null> {
    const trimmed = identifier.trim();
    const compact = compactId(trimmed);

    if (trimmed.includes('@')) {
      const byEmail = await this.prisma.user.findFirst({
        where: {
          tenantId,
          email: trimmed.toLowerCase(),
          deletedAt: null,
          isActive: true,
        },
        select: { id: true },
      });
      return byEmail?.id ?? null;
    }

    const byUsername = await this.prisma.user.findFirst({
      where: {
        tenantId,
        username: { equals: trimmed, mode: 'insensitive' },
        deletedAt: null,
        isActive: true,
      },
      select: { id: true },
    });
    if (byUsername) return byUsername.id;

    const students = await this.prisma.schoolStudent.findMany({
      where: { tenantId, deletedAt: null, status: 'ACTIVE' },
      select: { id: true, admissionNumber: true },
    });
    const admissionMatch = students.find(
      (row) => compactId(row.admissionNumber) === compact,
    );
    if (admissionMatch) {
      const account = await this.prisma.schoolPersonAccount.findFirst({
        where: {
          tenantId,
          studentId: admissionMatch.id,
          personType: 'STUDENT',
        },
        select: { userId: true },
      });
      if (account) return account.userId;
    }

    const enrollments = await this.prisma.schoolEnrollment.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: 'ACTIVE',
        rollNumber: { not: null },
      },
      select: { studentId: true, rollNumber: true },
    });
    const rollHits = enrollments.filter(
      (row) => compactId(row.rollNumber || '') === compact,
    );
    const uniqueStudentIds = [...new Set(rollHits.map((row) => row.studentId))];
    if (uniqueStudentIds.length === 1) {
      const account = await this.prisma.schoolPersonAccount.findFirst({
        where: {
          tenantId,
          studentId: uniqueStudentIds[0],
          personType: 'STUDENT',
        },
        select: { userId: true },
      });
      if (account) return account.userId;
    }
    if (uniqueStudentIds.length > 1) {
      throw new UnauthorizedException(
        'That roll number is used in more than one class. Sign in with your admission number.',
      );
    }

    const staff = await this.prisma.schoolStaff.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        employeeCode: { equals: trimmed, mode: 'insensitive' },
      },
      select: { email: true },
    });
    if (staff?.email) {
      const staffUser = await this.prisma.user.findFirst({
        where: {
          tenantId,
          email: { equals: staff.email, mode: 'insensitive' },
          deletedAt: null,
          isActive: true,
        },
        select: { id: true },
      });
      if (staffUser) return staffUser.id;
    }

    return null;
  }
}
