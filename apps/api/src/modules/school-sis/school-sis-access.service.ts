import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SCHOOL_SIS_PERMISSION_MANAGE } from './school-sis.constants';
import { SUPER_ROLE_SLUGS } from './school-sis-iam.catalog';
import { resolveSchoolStaffIdForUser } from './school-sis-staff-lookup';
import type { JwtUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class SchoolSisAccessService {
  constructor(private readonly prisma: PrismaService) {}

  has(user: JwtUser, ...need: string[]) {
    const p = user.permissions ?? [];
    if (p.includes('*') || p.includes(SCHOOL_SIS_PERMISSION_MANAGE))
      return true;
    return need.some((n) => p.includes(n));
  }

  assert(user: JwtUser, ...need: string[]) {
    if (!this.has(user, ...need)) {
      throw new ForbiddenException(
        'You do not have permission for this action',
      );
    }
  }

  isSuper(user: JwtUser) {
    const roles = user.roles ?? [];
    return this.has(user, '*') || roles.some((r) => SUPER_ROLE_SLUGS.has(r));
  }

  async assertCanManageUser(actor: JwtUser, targetUserId: string) {
    if (
      actor.sub === targetUserId &&
      !this.has(actor, 'users.update', 'users:manage')
    ) {
      throw new ForbiddenException('Cannot change this account');
    }
    const roles = await this.prisma.userRole.findMany({
      where: { userId: targetUserId, deletedAt: null },
      include: { role: true },
    });
    const targetSuper = roles.some((r) => SUPER_ROLE_SLUGS.has(r.role.slug));
    if (targetSuper && !this.isSuper(actor)) {
      throw new ForbiddenException(
        'Ordinary administrators cannot modify a Super Admin',
      );
    }
  }

  async sectionIdsForUser(
    tenantId: string,
    userId: string,
  ): Promise<string[] | null> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      include: {
        roles: { where: { deletedAt: null }, include: { role: true } },
      },
    });
    if (!user) return [];
    const slugs = user.roles.map((r) => r.role.slug);
    if (
      slugs.some(
        (s) =>
          SUPER_ROLE_SLUGS.has(s) || s === 'principal' || s === 'school-admin',
      )
    ) {
      return null;
    }
    const scopes = await this.prisma.schoolUserScope.findMany({
      where: { tenantId, userId, sectionId: { not: null } },
      select: { sectionId: true },
    });
    const fromScope = scopes.map((s) => s.sectionId!).filter(Boolean);
    const staffId = await resolveSchoolStaffIdForUser(this.prisma, tenantId, {
      sub: userId,
    });
    if (staffId) {
      const assigned = await this.prisma.schoolClassTeacherAssignment.findMany({
        where: { tenantId, staffId, deletedAt: null },
        select: { sectionId: true },
      });
      fromScope.push(...assigned.map((a) => a.sectionId));
      const subjects =
        await this.prisma.schoolSubjectTeacherAssignment.findMany({
          where: { tenantId, staffId, deletedAt: null },
          select: { sectionId: true },
        });
      fromScope.push(...subjects.map((a) => a.sectionId));
      const since = new Date();
      since.setUTCDate(since.getUTCDate() - 1);
      const subs = await this.prisma.schoolAttendanceSubstitute.findMany({
        where: { tenantId, staffId, date: { gte: since } },
        select: { sectionId: true },
      });
      fromScope.push(...subs.map((a) => a.sectionId));
      const year = await this.prisma.schoolAcademicYear.findFirst({
        where: { tenantId, deletedAt: null, status: 'CURRENT' },
        select: { id: true },
      });
      if (year) {
        const plans = await this.prisma.schoolTimetablePlan.findMany({
          where: { tenantId, academicYearId: year.id },
          select: { id: true },
        });
        if (plans.length) {
          const slots = await this.prisma.schoolTimetableSlot.findMany({
            where: {
              tenantId,
              staffId,
              planId: { in: plans.map((plan) => plan.id) },
            },
            select: { sectionId: true },
            distinct: ['sectionId'],
          });
          fromScope.push(...slots.map((slot) => slot.sectionId));
        }
      }
    }
    return [...new Set(fromScope)];
  }

  async assertSectionAccess(
    tenantId: string,
    user: JwtUser,
    sectionId: string,
  ) {
    if (this.has(user, SCHOOL_SIS_PERMISSION_MANAGE)) return;
    const ids = await this.sectionIdsForUser(tenantId, user.sub);
    if (ids === null) return;
    if (!ids.includes(sectionId)) {
      throw new ForbiddenException(
        'This record is outside your assigned classes',
      );
    }
  }

  async assertStudentAttendanceAccess(
    tenantId: string,
    user: JwtUser,
    studentId: string,
  ) {
    if (this.has(user, SCHOOL_SIS_PERMISSION_MANAGE) || this.isSuper(user))
      return;
    const perms = user.permissions ?? [];
    if (
      perms.includes('school-mobile:parent') ||
      perms.includes('school-mobile:student')
    ) {
      const account = await this.prisma.schoolPersonAccount.findFirst({
        where: {
          tenantId,
          userId: user.sub,
          personType: { in: ['GUARDIAN', 'STUDENT'] },
        },
      });
      if (account?.personType === 'STUDENT' && account.studentId === studentId)
        return;
      if (account?.guardianId) {
        const link = await this.prisma.schoolStudentGuardian.findFirst({
          where: { guardianId: account.guardianId, studentId },
        });
        if (link) return;
      }
      throw new ForbiddenException('You can only view your own attendance');
    }
    const enroll = await this.prisma.schoolEnrollment.findFirst({
      where: { tenantId, studentId, status: 'ACTIVE', deletedAt: null },
      select: { sectionId: true },
    });
    if (!enroll) throw new ForbiddenException('Student is not enrolled');
    await this.assertSectionAccess(tenantId, user, enroll.sectionId);
  }
}
