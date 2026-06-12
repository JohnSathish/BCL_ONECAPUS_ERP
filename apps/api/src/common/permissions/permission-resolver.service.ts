import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { isSuperAdmin } from './permission-registry';

export type DataScope = {
  departmentIds: string[];
  campusIds: string[];
  programmeIds: string[];
  semesterNos: number[];
  allDepartments: boolean;
  allCampuses: boolean;
};

export type ResolvedPermissions = {
  permissions: string[];
  dataScope: DataScope;
};

@Injectable()
export class PermissionResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveForUser(
    userId: string,
    roleSlugs: string[],
  ): Promise<ResolvedPermissions> {
    const [userRoles, userOverrides, staffProfile] = await Promise.all([
      this.prisma.userRole.findMany({
        where: { userId, deletedAt: null },
        include: {
          role: {
            include: {
              permissions: { include: { permission: true } },
            },
          },
        },
      }),
      this.prisma.userPermission.findMany({
        where: { userId },
        include: { permission: true },
      }),
      this.prisma.staffProfile.findFirst({
        where: { portalUserId: userId, deletedAt: null },
        select: { departmentId: true },
      }),
    ]);

    const slugs = new Set<string>();
    for (const ur of userRoles) {
      for (const rp of ur.role.permissions) {
        slugs.add(rp.permission.slug);
      }
    }

    for (const override of userOverrides) {
      if (override.effect === 'grant') slugs.add(override.permission.slug);
      else if (override.effect === 'deny')
        slugs.delete(override.permission.slug);
    }

    const departmentIds = new Set<string>();
    const campusIds = new Set<string>();
    const programmeIds = new Set<string>();
    const semesterNos = new Set<number>();

    let allDepartments =
      isSuperAdmin(roleSlugs) || roleSlugs.includes('college-admin');
    let allCampuses = allDepartments;

    for (const ur of userRoles) {
      if (ur.departmentId) departmentIds.add(ur.departmentId);
      if (ur.campusId) campusIds.add(ur.campusId);
      if (ur.programmeId) programmeIds.add(ur.programmeId);
      if (ur.semesterNo != null) semesterNos.add(ur.semesterNo);
    }

    if (roleSlugs.includes('hod') && staffProfile?.departmentId) {
      departmentIds.add(staffProfile.departmentId);
      allDepartments = false;
    }

    if (departmentIds.size === 0 && !roleSlugs.includes('hod')) {
      allDepartments = allDepartments || isSuperAdmin(roleSlugs);
    }

    return {
      permissions: [...slugs],
      dataScope: {
        departmentIds: [...departmentIds],
        campusIds: [...campusIds],
        programmeIds: [...programmeIds],
        semesterNos: [...semesterNos],
        allDepartments: allDepartments && departmentIds.size === 0,
        allCampuses: allCampuses && campusIds.size === 0,
      },
    };
  }
}
