import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SCHOOL_SIS_PERMISSION_MANAGE } from './school-sis.constants';
import { SUPER_ROLE_SLUGS } from './school-sis-iam.catalog';
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
    const staff = await this.prisma.schoolPersonAccount.findFirst({
      where: { tenantId, userId, personType: 'STAFF', staffId: { not: null } },
    });
    if (staff?.staffId) {
      const assigned = await this.prisma.schoolClassTeacherAssignment.findMany({
        where: { tenantId, staffId: staff.staffId, deletedAt: null },
        select: { sectionId: true },
      });
      fromScope.push(...assigned.map((a) => a.sectionId));
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
}
