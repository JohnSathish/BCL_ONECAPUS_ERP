import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { PermissionResolverService } from '../../../common/permissions/permission-resolver.service';
import { WORKSPACE_TEMPLATES } from '../../../common/permissions/permission-registry';
import { AdminAuditHelper } from '../admin-audit.helper';
import type {
  ApplyWorkspaceTemplateDto,
  AssignUserRoleDto,
  CreateRoleDto,
  UpdateRoleDto,
  UpdateRolePermissionsDto,
  UpdateUserPermissionOverridesDto,
} from '../dto/rbac.dto';

@Injectable()
export class RbacService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditHelper,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async listRoles(tenantId: string) {
    const roles = await this.prisma.role.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { userRoles: { where: { deletedAt: null } } } },
      },
      orderBy: { name: 'asc' },
    });
    return roles.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      userCount: r._count.userRoles,
      permissions: r.permissions.map((p) => p.permission),
    }));
  }

  async listPermissions() {
    return this.prisma.permission.findMany({
      where: { deletedAt: null },
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    });
  }

  async createRole(tenantId: string, dto: CreateRoleDto, actorUserId: string) {
    const slug = dto.slug.trim().toLowerCase().replace(/\s+/g, '-');
    const existing = await this.prisma.role.findFirst({
      where: { tenantId, slug, deletedAt: null },
    });
    if (existing) throw new BadRequestException('Role slug already exists');

    const role = await this.prisma.role.create({
      data: {
        tenantId,
        slug,
        name: dto.name,
        description: dto.description,
        isSystem: false,
      },
    });

    await this.audit.log({
      tenantId,
      userId: actorUserId,
      module: 'administration',
      action: 'role.created',
      entityType: 'role',
      entityId: role.id,
    });

    return role;
  }

  async updateRole(
    tenantId: string,
    id: string,
    dto: UpdateRoleDto,
    actorUserId: string,
  ) {
    const role = await this.prisma.role.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!role) throw new NotFoundException('Role not found');

    const updated = await this.prisma.role.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
      },
    });

    await this.audit.log({
      tenantId,
      userId: actorUserId,
      module: 'administration',
      action: 'role.updated',
      entityType: 'role',
      entityId: id,
    });

    return updated;
  }

  async updateRolePermissions(
    tenantId: string,
    roleId: string,
    dto: UpdateRolePermissionsDto,
    actorUserId: string,
  ) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, tenantId, deletedAt: null },
    });
    if (!role) throw new NotFoundException('Role not found');

    const permissions = await this.prisma.permission.findMany({
      where: { id: { in: dto.permissionIds }, deletedAt: null },
    });
    if (permissions.length !== dto.permissionIds.length) {
      throw new BadRequestException('Invalid permission IDs');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      for (const perm of permissions) {
        await tx.rolePermission.create({
          data: { roleId, permissionId: perm.id },
        });
      }
    });

    await this.audit.log({
      tenantId,
      userId: actorUserId,
      module: 'administration',
      action: 'role.permissions_updated',
      entityType: 'role',
      entityId: roleId,
      metadata: { permissionCount: dto.permissionIds.length },
    });

    return this.listRoles(tenantId).then((roles) =>
      roles.find((r) => r.id === roleId),
    );
  }

  async applyWorkspaceTemplate(
    tenantId: string,
    roleId: string,
    dto: ApplyWorkspaceTemplateDto,
    actorUserId: string,
  ) {
    const template = WORKSPACE_TEMPLATES.find(
      (t) => t.slug === dto.templateSlug,
    );
    if (!template) throw new BadRequestException('Unknown workspace template');

    const permissions = await this.prisma.permission.findMany({
      where: { slug: { in: template.permissions }, deletedAt: null },
    });

    return this.updateRolePermissions(
      tenantId,
      roleId,
      { permissionIds: permissions.map((p) => p.id) },
      actorUserId,
    );
  }

  async getUserEffectivePermissions(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
      include: {
        roles: {
          where: { deletedAt: null },
          include: {
            role: {
              include: { permissions: { include: { permission: true } } },
            },
          },
        },
        userPermissions: { include: { permission: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const roleSlugs = user.roles.map((r) => r.role.slug);
    const resolved = await this.permissionResolver.resolveForUser(
      userId,
      roleSlugs,
    );

    return {
      userId,
      roles: user.roles.map((ur) => ({
        id: ur.id,
        roleId: ur.roleId,
        slug: ur.role.slug,
        name: ur.role.name,
        campusId: ur.campusId,
        shiftId: ur.shiftId,
        departmentId: ur.departmentId,
        programmeId: ur.programmeId,
        semesterNo: ur.semesterNo,
      })),
      overrides: user.userPermissions.map((o) => ({
        permissionId: o.permissionId,
        slug: o.permission.slug,
        effect: o.effect,
      })),
      effectivePermissions: resolved.permissions,
      dataScope: resolved.dataScope,
    };
  }

  async assignUserRole(
    tenantId: string,
    userId: string,
    dto: AssignUserRoleDto,
    actorUserId: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found');
    const role = await this.prisma.role.findFirst({
      where: { id: dto.roleId, tenantId, deletedAt: null },
    });
    if (!role) throw new NotFoundException('Role not found');

    const assignment = await this.prisma.userRole.create({
      data: {
        userId,
        roleId: dto.roleId,
        campusId: dto.campusId,
        shiftId: dto.shiftId,
        departmentId: dto.departmentId,
        programmeId: dto.programmeId,
        semesterNo: dto.semesterNo,
      },
    });

    await this.audit.log({
      tenantId,
      userId: actorUserId,
      module: 'administration',
      action: 'user.role_assigned',
      entityType: 'user',
      entityId: userId,
      metadata: { roleId: dto.roleId, assignmentId: assignment.id },
    });

    return assignment;
  }

  async updateUserPermissionOverrides(
    tenantId: string,
    userId: string,
    dto: UpdateUserPermissionOverridesDto,
    actorUserId: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.userPermission.deleteMany({ where: { userId } });
      for (const permissionId of dto.grantPermissionIds ?? []) {
        await tx.userPermission.create({
          data: { userId, permissionId, effect: 'grant' },
        });
      }
      for (const permissionId of dto.denyPermissionIds ?? []) {
        await tx.userPermission.create({
          data: { userId, permissionId, effect: 'deny' },
        });
      }
    });

    await this.audit.log({
      tenantId,
      userId: actorUserId,
      module: 'administration',
      action: 'user.permission_overrides_updated',
      entityType: 'user',
      entityId: userId,
    });

    return this.getUserEffectivePermissions(tenantId, userId);
  }

  listWorkspaceTemplates() {
    return WORKSPACE_TEMPLATES;
  }
}
