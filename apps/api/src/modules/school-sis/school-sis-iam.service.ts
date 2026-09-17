import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SchoolSisService } from './school-sis.service';
import { SchoolSisAccessService } from './school-sis-access.service';
import { AuthService } from '../auth/auth.service';
import { UserProvisioningService } from '../administration/services/user-provisioning.service';
import { AdminAuditHelper } from '../administration/admin-audit.helper';
import { PermissionResolverService } from '../../common/permissions/permission-resolver.service';
import {
  SCHOOL_DEFAULT_ROLES,
  SCHOOL_IAM_ALL_SLUGS,
  SCHOOL_IAM_MODULES,
  SUPER_ROLE_SLUGS,
} from './school-sis-iam.catalog';
import { SCHOOL_PORTAL_DEFAULT_PASSWORD } from './school-sis.constants';
import {
  preferredSchoolLoginUsername,
  compactSchoolLoginId,
} from './school-sis-login-lookup';
import type { JwtUser } from '../../common/decorators/current-user.decorator';

function sha(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class SchoolSisIamService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sis: SchoolSisService,
    private readonly access: SchoolSisAccessService,
    private readonly auth: AuthService,
    private readonly provisioning: UserProvisioningService,
    private readonly audit: AdminAuditHelper,
    private readonly resolver: PermissionResolverService,
  ) {}

  async onModuleInit() {
    await this.ensurePermissionRows();
  }

  catalog() {
    return {
      modules: SCHOOL_IAM_MODULES,
      roles: SCHOOL_DEFAULT_ROLES.map(({ permissions: _p, ...r }) => r),
    };
  }

  async ensurePermissionRows() {
    for (const slug of SCHOOL_IAM_ALL_SLUGS) {
      const [resource, ...rest] = slug.split(/[.:]/);
      const action = rest.join('.') || 'access';
      await this.prisma.permission.upsert({
        where: { slug },
        update: {},
        create: { slug, resource, action, description: slug },
      });
    }
  }

  async ensureDefaultRoles(tenantId: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    await this.ensurePermissionRows();
    const bySlug = new Map(
      (
        await this.prisma.permission.findMany({
          where: { slug: { in: SCHOOL_IAM_ALL_SLUGS } },
        })
      ).map((p) => [p.slug, p]),
    );
    for (const def of SCHOOL_DEFAULT_ROLES) {
      const role = await this.prisma.role.upsert({
        where: { tenantId_slug: { tenantId, slug: def.slug } },
        update: { name: def.name, description: def.description },
        create: {
          tenantId,
          slug: def.slug,
          name: def.name,
          description: def.description,
          isSystem: def.isSystem ?? false,
        },
      });
      for (const slug of def.permissions) {
        const perm = bySlug.get(slug);
        if (!perm) continue;
        await this.prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: { roleId: role.id, permissionId: perm.id },
          },
          update: {},
          create: { roleId: role.id, permissionId: perm.id },
        });
      }
    }
    return this.listRoles(tenantId);
  }

  private async log(
    tenantId: string,
    actorId: string | undefined,
    action: string,
    entityId?: string,
    metadata?: Record<string, unknown>,
  ) {
    await this.audit.log({
      tenantId,
      userId: actorId,
      module: 'school-iam',
      action,
      entityType: 'user',
      entityId,
      metadata,
    });
  }

  private async alert(
    tenantId: string,
    kind: string,
    message: string,
    severity: string,
    userId?: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    await this.prisma.schoolIamAlert.create({
      data: {
        tenantId,
        kind,
        message,
        severity,
        userId,
        metadataJson: metadata ?? {},
      },
    });
  }

  async dashboard(tenantId: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const since = new Date(Date.now() - 90 * 86400000);
    const [
      total,
      active,
      invited,
      suspended,
      locked,
      disabled,
      mfaOn,
      sessions,
      pendingInvites,
      failedLogins,
      inactive90,
    ] = await Promise.all([
      this.prisma.user.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.user.count({
        where: {
          tenantId,
          deletedAt: null,
          isActive: true,
          accountStatus: 'active',
        },
      }),
      this.prisma.user.count({
        where: { tenantId, deletedAt: null, accountStatus: 'invited' },
      }),
      this.prisma.user.count({
        where: { tenantId, deletedAt: null, accountStatus: 'suspended' },
      }),
      this.prisma.user.count({
        where: { tenantId, deletedAt: null, accountStatus: 'locked' },
      }),
      this.prisma.user.count({
        where: {
          tenantId,
          deletedAt: null,
          accountStatus: { in: ['disabled', 'inactive'] },
        },
      }),
      this.prisma.user.count({
        where: { tenantId, deletedAt: null, mfaEnabled: true },
      }),
      this.prisma.refreshSession.count({
        where: { tenantId, revokedAt: null, expiresAt: { gt: new Date() } },
      }),
      this.prisma.schoolIamInvitation.count({
        where: { tenantId, status: 'PENDING' },
      }),
      this.prisma.authLoginEvent.count({
        where: {
          tenantId,
          outcome: 'FAILED',
          createdAt: { gte: new Date(Date.now() - 86400000) },
        },
      }),
      this.prisma.user.count({
        where: {
          tenantId,
          deletedAt: null,
          isActive: true,
          OR: [{ lastLoginAt: null }, { lastLoginAt: { lt: since } }],
        },
      }),
    ]);
    const byRole = await this.prisma.role.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        _count: { select: { userRoles: { where: { deletedAt: null } } } },
      },
      orderBy: { name: 'asc' },
    });
    return {
      kpis: {
        total,
        active,
        invited: invited + pendingInvites,
        suspended,
        locked,
        disabled,
        mfaOn,
        sessions,
        failedLogins,
        inactive90,
      },
      byRole: byRole.map((r) => ({
        slug: r.slug,
        name: r.name,
        users: r._count.userRoles,
      })),
    };
  }

  async listUsers(
    tenantId: string,
    q: {
      search?: string;
      status?: string;
      role?: string;
      mfa?: string;
      page?: number;
      limit?: number;
    },
  ) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(100, Math.max(10, q.limit ?? 25));
    const where: Prisma.UserWhereInput = { tenantId, deletedAt: null };
    if (q.status === 'active')
      Object.assign(where, { isActive: true, accountStatus: 'active' });
    else if (q.status) where.accountStatus = q.status;
    if (q.mfa === 'yes') where.mfaEnabled = true;
    if (q.mfa === 'no') where.mfaEnabled = false;
    if (q.role)
      where.roles = { some: { deletedAt: null, role: { slug: q.role } } };
    if (q.search?.trim()) {
      const term = q.search.trim();
      where.OR = [
        { email: { contains: term, mode: 'insensitive' } },
        { username: { contains: term, mode: 'insensitive' } },
        { displayName: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
      ];
    }
    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          roles: { where: { deletedAt: null }, include: { role: true } },
        },
      }),
    ]);
    const links = await this.prisma.schoolPersonAccount.findMany({
      where: { tenantId, userId: { in: rows.map((r) => r.id) } },
      include: {
        student: {
          select: {
            admissionNumber: true,
            enrollments: {
              where: {
                deletedAt: null,
                status: 'ACTIVE',
                rollNumber: { not: null },
              },
              orderBy: { updatedAt: 'desc' },
              take: 1,
              select: { rollNumber: true },
            },
          },
        },
        staff: { select: { employeeCode: true } },
      },
    });
    const loginByUser = new Map(
      links.map((l) => [
        l.userId,
        {
          admissionNumber: l.student?.admissionNumber ?? null,
          rollNumber: l.student?.enrollments[0]?.rollNumber ?? null,
          employeeCode: l.staff?.employeeCode ?? null,
        },
      ]),
    );
    return {
      total,
      page,
      limit,
      items: rows.map((u) => {
        const login = loginByUser.get(u.id);
        return {
          ...this.serializeUser(u),
          admissionNumber: login?.admissionNumber ?? null,
          rollNumber: login?.rollNumber ?? null,
          employeeCode: login?.employeeCode ?? null,
        };
      }),
    };
  }

  async getUser(tenantId: string, id: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        roles: { where: { deletedAt: null }, include: { role: true } },
        userPermissions: { include: { permission: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const links = await this.prisma.schoolPersonAccount.findMany({
      where: { tenantId, userId: id },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            admissionNumber: true,
            enrollments: {
              where: {
                deletedAt: null,
                status: 'ACTIVE',
                rollNumber: { not: null },
              },
              orderBy: { updatedAt: 'desc' },
              take: 1,
              select: { rollNumber: true },
            },
          },
        },
        guardian: { select: { id: true, fullName: true, phone: true } },
        staff: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            department: true,
          },
        },
      },
    });
    const scopes = await this.prisma.schoolUserScope.findMany({
      where: { tenantId, userId: id },
    });
    const resolved = await this.resolver.resolveForUser(
      id,
      user.roles.map((r) => r.role.slug),
    );
    const sessions = await this.prisma.refreshSession.findMany({
      where: {
        tenantId,
        userId: id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const logins = await this.prisma.authLoginEvent.findMany({
      where: { tenantId, userId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const audits = await this.prisma.auditLog.findMany({
      where: { tenantId, OR: [{ userId: id }, { entityId: id }] },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return {
      ...this.serializeUser(user),
      admissionNumber:
        links.find((l) => l.student)?.student?.admissionNumber ?? null,
      rollNumber:
        links.find((l) => l.student)?.student?.enrollments[0]?.rollNumber ??
        null,
      employeeCode: links.find((l) => l.staff)?.staff?.employeeCode ?? null,
      directPermissions: user.userPermissions.map((p) => ({
        slug: p.permission.slug,
        effect: p.effect,
      })),
      effectivePermissions: resolved.permissions,
      why: this.explainAccess(user, resolved.permissions),
      links,
      scopes,
      sessions: sessions.map((s) => ({
        id: s.id,
        ip: s.ipAddress,
        userAgent: s.userAgent,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
      })),
      logins,
      audits,
    };
  }

  private explainAccess(
    user: { roles: { role: { name: string; slug: string } }[] },
    perms: string[],
  ) {
    return user.roles.map((r) => ({
      role: r.role.name,
      slug: r.role.slug,
      note: `Access is granted through the ${r.role.name} role plus any direct grants. Effective permission count: ${perms.length}.`,
    }));
  }

  async createUser(
    tenantId: string,
    actor: JwtUser,
    body: {
      email: string;
      displayName: string;
      username?: string;
      phone?: string;
      roleSlugs: string[];
      password?: string;
      accountStatus?: string;
      staffId?: string;
      studentId?: string;
      guardianId?: string;
      sectionIds?: string[];
      mustResetPassword?: boolean;
      invite?: boolean;
    },
  ) {
    await this.sis.assertSecondarySisTenant(tenantId);
    this.access.assert(actor, 'users.create', 'users:manage', 'users.invite');
    await this.ensureDefaultRoles(tenantId);
    const created = await this.provisioning.provisionUser({
      tenantId,
      email: body.email,
      displayName: body.displayName,
      username: body.username,
      phone: body.phone,
      roleSlugs: body.roleSlugs,
      password: body.password,
      accountStatus: body.invite ? 'invited' : (body.accountStatus ?? 'active'),
      mustResetPassword: body.mustResetPassword ?? true,
      actorUserId: actor.sub,
    });
    await this.applyLinks(tenantId, created.user.id, body);
    if (body.sectionIds?.length) {
      await this.setScopes(tenantId, created.user.id, body.sectionIds);
    }
    let inviteToken: string | undefined;
    if (body.invite) {
      inviteToken = await this.createInvite(
        tenantId,
        created.user.id,
        body.email,
        body.roleSlugs[0],
        actor.sub,
      );
    }
    await this.log(tenantId, actor.sub, 'user.created', created.user.id, {
      email: body.email,
    });
    return { ...created, inviteToken };
  }

  async updateUser(
    tenantId: string,
    actor: JwtUser,
    id: string,
    body: {
      displayName?: string;
      phone?: string;
      username?: string;
      isActive?: boolean;
      staffId?: string | null;
      studentId?: string | null;
      guardianId?: string | null;
      sectionIds?: string[];
    },
  ) {
    await this.sis.assertSecondarySisTenant(tenantId);
    this.access.assert(actor, 'users.update', 'users:manage');
    await this.access.assertCanManageUser(actor, id);
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        displayName: body.displayName,
        phone: body.phone,
        username: body.username,
        isActive: body.isActive,
      },
    });
    if (
      body.staffId !== undefined ||
      body.studentId !== undefined ||
      body.guardianId !== undefined
    ) {
      await this.applyLinks(tenantId, id, body);
    }
    if (body.sectionIds) await this.setScopes(tenantId, id, body.sectionIds);
    await this.log(tenantId, actor.sub, 'user.updated', id);
    return this.serializeUser(user);
  }

  async setStatus(
    tenantId: string,
    actor: JwtUser,
    id: string,
    status: string,
  ) {
    await this.sis.assertSecondarySisTenant(tenantId);
    this.access.assert(actor, 'users.update', 'users:manage');
    await this.access.assertCanManageUser(actor, id);
    const allowed = [
      'active',
      'invited',
      'pending',
      'suspended',
      'locked',
      'disabled',
    ];
    if (!allowed.includes(status))
      throw new BadRequestException('Invalid status');
    const isActive = status === 'active';
    await this.prisma.user.update({
      where: { id },
      data: { accountStatus: status, isActive },
    });
    if (!isActive) {
      await this.auth.revokeAllSessionsForUser(id);
    }
    await this.log(tenantId, actor.sub, `user.status.${status}`, id);
    if (status === 'suspended') {
      await this.alert(
        tenantId,
        'ACCOUNT_SUSPENDED',
        'Account suspended',
        'WARN',
        id,
      );
    }
    return { ok: true };
  }

  async softDelete(tenantId: string, actor: JwtUser, id: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    this.access.assert(actor, 'users.delete', 'users:manage');
    await this.access.assertCanManageUser(actor, id);
    if (actor.sub === id)
      throw new BadRequestException('Cannot delete your own account');
    await this.prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
        accountStatus: 'disabled',
      },
    });
    await this.auth.revokeAllSessionsForUser(id);
    await this.log(tenantId, actor.sub, 'user.soft_deleted', id);
    return { ok: true };
  }

  async resetPassword(
    tenantId: string,
    actor: JwtUser,
    id: string,
    forceChange: boolean,
    options: { password?: string; generate?: boolean } = {},
  ) {
    await this.sis.assertSecondarySisTenant(tenantId);
    this.access.assert(actor, 'users.update', 'users:manage');
    await this.access.assertCanManageUser(actor, id);
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { id: true, username: true, displayName: true, email: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const custom = options.password?.trim();
    if (custom && custom.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    const temporaryPassword = custom
      ? custom
      : options.generate
        ? `Sl.${randomBytes(5)
            .toString('base64url')
            .replace(/[^a-zA-Z0-9]/g, 'x')
            .slice(0, 8)}9A`
        : SCHOOL_PORTAL_DEFAULT_PASSWORD;
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          passwordHash,
          passwordChangedAt: new Date(),
          mustResetPassword: forceChange !== false,
        },
      });
      await tx.passwordHistory.create({ data: { userId: id, passwordHash } });
    });
    await this.auth.revokeAllSessionsForUser(id);
    await this.log(tenantId, actor.sub, 'user.password_reset', id, {
      forceChange,
      generated: Boolean(options.generate),
    });
    return {
      ok: true,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      temporaryPassword,
      generatedPassword: temporaryPassword,
      plainPassword: temporaryPassword,
      mustChange: forceChange !== false,
      defaultUsed: !custom && !options.generate,
    };
  }

  async assignRoles(
    tenantId: string,
    actor: JwtUser,
    id: string,
    roleSlugs: string[],
  ) {
    await this.sis.assertSecondarySisTenant(tenantId);
    this.access.assert(actor, 'roles.update', 'rbac:manage', 'users:manage');
    await this.access.assertCanManageUser(actor, id);
    if (
      roleSlugs.some((s) => SUPER_ROLE_SLUGS.has(s)) &&
      !this.access.isSuper(actor)
    ) {
      throw new BadRequestException('Cannot assign Super Admin');
    }
    const roles = await this.prisma.role.findMany({
      where: { tenantId, slug: { in: roleSlugs }, deletedAt: null },
    });
    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.updateMany({
        where: { userId: id, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      for (const role of roles) {
        await tx.userRole.create({ data: { userId: id, roleId: role.id } });
      }
    });
    await this.log(tenantId, actor.sub, 'user.roles_changed', id, {
      roleSlugs,
    });
    await this.alert(
      tenantId,
      'ROLE_CHANGED',
      'User roles updated',
      'INFO',
      id,
      { roleSlugs },
    );
    return this.getUser(tenantId, id);
  }

  async setDirectPermissions(
    tenantId: string,
    actor: JwtUser,
    id: string,
    items: { slug: string; effect: 'grant' | 'deny' }[],
  ) {
    await this.sis.assertSecondarySisTenant(tenantId);
    this.access.assert(actor, 'roles.update', 'rbac:manage', 'users:manage');
    await this.access.assertCanManageUser(actor, id);
    const perms = await this.prisma.permission.findMany({
      where: { slug: { in: items.map((i) => i.slug) } },
    });
    const map = new Map(perms.map((p) => [p.slug, p.id]));
    await this.prisma.$transaction(async (tx) => {
      await tx.userPermission.deleteMany({ where: { userId: id } });
      for (const item of items) {
        const permissionId = map.get(item.slug);
        if (!permissionId) continue;
        await tx.userPermission.create({
          data: { userId: id, permissionId, effect: item.effect },
        });
      }
    });
    await this.log(tenantId, actor.sub, 'user.direct_permissions', id);
    return this.getUser(tenantId, id);
  }

  async bulk(
    tenantId: string,
    actor: JwtUser,
    ids: string[],
    action: string,
    roleSlug?: string,
  ) {
    this.access.assert(actor, 'users.update', 'users:manage');
    for (const id of ids) {
      if (action === 'activate')
        await this.setStatus(tenantId, actor, id, 'active');
      else if (action === 'suspend')
        await this.setStatus(tenantId, actor, id, 'suspended');
      else if (action === 'disable')
        await this.setStatus(tenantId, actor, id, 'disabled');
      else if (action === 'logout')
        await this.auth.revokeAllSessionsForUser(id);
      else if (action === 'assign-role' && roleSlug)
        await this.assignRoles(tenantId, actor, id, [roleSlug]);
      else if (action === 'reset-password')
        await this.resetPassword(tenantId, actor, id, true);
    }
    return { ok: true, count: ids.length };
  }

  async importUsers(
    tenantId: string,
    actor: JwtUser,
    rows: Array<{
      fullName: string;
      email: string;
      username?: string;
      mobile?: string;
      employeeId?: string;
      role?: string;
      status?: string;
    }>,
    confirm = false,
  ) {
    this.access.assert(actor, 'users.create', 'users:manage');
    const errors: { row: number; message: string }[] = [];
    const preview: typeof rows = [];
    const roleSlugs = new Set(
      (
        await this.prisma.role.findMany({
          where: { tenantId, deletedAt: null },
          select: { slug: true },
        })
      ).map((r) => r.slug),
    );
    rows.forEach((row, i) => {
      const n = i + 2;
      if (!row.email?.includes('@'))
        errors.push({ row: n, message: 'Invalid email' });
      if (!row.fullName?.trim())
        errors.push({ row: n, message: 'Full name required' });
      if (row.role && !roleSlugs.has(row.role))
        errors.push({ row: n, message: 'Role not found' });
      preview.push(row);
    });
    if (errors.length) return { ok: false, errors, preview };
    if (!confirm) return { ok: true, errors: [], preview, ready: true };
    const created: string[] = [];
    for (const row of rows) {
      try {
        const r = await this.createUser(tenantId, actor, {
          email: row.email,
          displayName: row.fullName,
          username: row.username,
          phone: row.mobile,
          roleSlugs: [row.role || 'office-staff'],
          accountStatus: row.status || 'active',
        });
        created.push(r.user.id);
      } catch (e) {
        errors.push({
          row: created.length + 2,
          message: e instanceof Error ? e.message : 'Failed',
        });
      }
    }
    if (created.length >= 10) {
      await this.alert(
        tenantId,
        'MASS_CREATE',
        `Bulk created ${created.length} users`,
        'WARN',
        actor.sub,
      );
    }
    return { ok: errors.length === 0, created: created.length, errors };
  }

  async directoryPreview(tenantId: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const [studentsTotal, studentsMissing, staffTotal, staffMissing] =
      await Promise.all([
        this.prisma.schoolStudent.count({
          where: { tenantId, deletedAt: null, status: 'ACTIVE' },
        }),
        this.prisma.schoolStudent.count({
          where: {
            tenantId,
            deletedAt: null,
            status: 'ACTIVE',
            personAccounts: { none: { personType: 'STUDENT' } },
          },
        }),
        this.prisma.schoolStaff.count({
          where: { tenantId, deletedAt: null, status: 'ACTIVE' },
        }),
        this.prisma.schoolStaff.count({
          where: {
            tenantId,
            deletedAt: null,
            status: 'ACTIVE',
            personAccounts: { none: { personType: 'STAFF' } },
          },
        }),
      ]);
    return {
      defaultPassword: SCHOOL_PORTAL_DEFAULT_PASSWORD,
      studentsTotal,
      studentsMissing,
      staffTotal,
      staffMissing,
    };
  }

  async provisionDirectory(
    tenantId: string,
    actor: JwtUser,
    body: {
      confirm?: boolean;
      includeStudents?: boolean;
      includeStaff?: boolean;
      password?: string;
      limit?: number;
    },
  ) {
    this.access.assert(actor, 'users.create', 'users:manage');
    const hasPortalRole = await this.prisma.role.findFirst({
      where: { tenantId, slug: 'school-student', deletedAt: null },
      select: { id: true },
    });
    if (!hasPortalRole) await this.ensureDefaultRoles(tenantId);
    const preview = await this.directoryPreview(tenantId);
    if (!body.confirm) return { ...preview, ready: true };

    const password = body.password?.trim() || SCHOOL_PORTAL_DEFAULT_PASSWORD;
    const limit = Math.min(Math.max(body.limit ?? 40, 1), 80);
    const passwordHash = await bcrypt.hash(password, 12);
    const created: string[] = [];
    const linked: string[] = [];
    const skipped: string[] = [];
    const failed: { name: string; error: string }[] = [];

    const roles = await this.prisma.role.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, slug: true },
    });
    const roleIdBySlug = new Map(roles.map((r) => [r.slug, r.id]));
    const existing = await this.prisma.user.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, email: true, username: true },
    });
    const emailToUser = new Map(
      existing.map((u) => [u.email.toLowerCase(), u.id] as const),
    );
    const usedUsernames = new Set(
      existing.map((u) => (u.username ?? '').toLowerCase()).filter(Boolean),
    );

    type WorkItem = {
      name: string;
      email: string;
      username: string;
      phone?: string | null;
      roleSlug: string;
      staffId?: string;
      studentId?: string;
    };
    const queue: WorkItem[] = [];

    if (body.includeStaff !== false) {
      const staff = await this.prisma.schoolStaff.findMany({
        where: {
          tenantId,
          deletedAt: null,
          status: 'ACTIVE',
          personAccounts: { none: { personType: 'STAFF' } },
        },
        take: limit,
        orderBy: { fullName: 'asc' },
        select: {
          id: true,
          fullName: true,
          employeeCode: true,
          email: true,
          phone: true,
          staffType: true,
          designation: true,
          department: true,
        },
      });
      for (const row of staff) {
        queue.push({
          name: row.fullName,
          email: this.portalEmail('staff', row.employeeCode, row.email),
          username: row.employeeCode,
          phone: row.phone,
          roleSlug: this.staffPortalRole(row),
          staffId: row.id,
        });
      }
    }

    if (queue.length < limit && body.includeStudents !== false) {
      const students = await this.prisma.schoolStudent.findMany({
        where: {
          tenantId,
          deletedAt: null,
          status: 'ACTIVE',
          personAccounts: { none: { personType: 'STUDENT' } },
        },
        take: limit - queue.length,
        orderBy: { fullName: 'asc' },
        select: {
          id: true,
          fullName: true,
          admissionNumber: true,
          email: true,
          phone: true,
          enrollments: {
            where: {
              deletedAt: null,
              status: 'ACTIVE',
              rollNumber: { not: null },
            },
            orderBy: { updatedAt: 'desc' },
            take: 1,
            select: { rollNumber: true },
          },
        },
      });
      for (const row of students) {
        queue.push({
          name: row.fullName,
          email: this.portalEmail('student', row.admissionNumber, row.email),
          username: preferredSchoolLoginUsername({
            rollNumber: row.enrollments[0]?.rollNumber,
            admissionNumber: row.admissionNumber,
          }),
          phone: row.phone,
          roleSlug: 'school-student',
          studentId: row.id,
        });
      }
    }

    for (const row of queue) {
      try {
        const result = await this.createDirectoryAccountFast(tenantId, {
          displayName: row.name,
          email: row.email,
          username: row.username,
          phone: row.phone,
          roleId:
            roleIdBySlug.get(row.roleSlug) ??
            roleIdBySlug.get(row.staffId ? 'office-staff' : 'school-student'),
          passwordHash,
          staffId: row.staffId,
          studentId: row.studentId,
          emailToUser,
          usedUsernames,
        });
        if (result === 'created') created.push(row.email);
        else if (result === 'linked') linked.push(row.email);
        else skipped.push(row.email);
      } catch (e) {
        failed.push({
          name: row.name,
          error: e instanceof Error ? e.message : 'Failed',
        });
      }
    }

    const leftover = await this.directoryPreview(tenantId);
    const remaining =
      (body.includeStaff !== false ? leftover.staffMissing : 0) +
      (body.includeStudents !== false ? leftover.studentsMissing : 0);
    const synced = await this.syncLoginIdentifiers(tenantId);

    await this.log(
      tenantId,
      actor.sub,
      'users.directory_provisioned',
      actor.sub,
      {
        created: created.length,
        linked: linked.length,
        failed: failed.length,
        remaining,
        usernamesSynced: synced.updated,
      },
    );
    return {
      ok: failed.length === 0,
      defaultPassword: password,
      created: created.length,
      linked: linked.length,
      skipped: skipped.length,
      remaining,
      done: remaining === 0,
      failed,
      usernamesSynced: synced.updated,
    };
  }

  private async createDirectoryAccountFast(
    tenantId: string,
    input: {
      displayName: string;
      email: string;
      username: string;
      phone?: string | null;
      roleId?: string;
      passwordHash: string;
      staffId?: string;
      studentId?: string;
      emailToUser: Map<string, string>;
      usedUsernames: Set<string>;
    },
  ): Promise<'created' | 'linked' | 'skipped'> {
    const email = input.email.trim().toLowerCase();
    const existingId = input.emailToUser.get(email);
    if (existingId) {
      await this.applyLinks(tenantId, existingId, {
        staffId: input.staffId,
        studentId: input.studentId,
      });
      return 'linked';
    }
    if (!input.roleId) {
      throw new BadRequestException('School portal role is missing');
    }
    const username = this.nextUnusedUsername(
      input.username,
      input.usedUsernames,
    );
    const now = new Date();
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          tenantId,
          email,
          username,
          phone: input.phone?.trim() || null,
          displayName: input.displayName.trim(),
          passwordHash: input.passwordHash,
          emailVerifiedAt: now,
          isActive: true,
          accountStatus: 'active',
          passwordChangedAt: now,
          mustResetPassword: true,
        },
      });
      await tx.userRole.create({
        data: { userId: created.id, roleId: input.roleId! },
      });
      await tx.passwordHistory.create({
        data: { userId: created.id, passwordHash: input.passwordHash },
      });
      if (input.staffId) {
        await tx.schoolPersonAccount.create({
          data: {
            tenantId,
            userId: created.id,
            personType: 'STAFF',
            staffId: input.staffId,
          },
        });
      }
      if (input.studentId) {
        await tx.schoolPersonAccount.create({
          data: {
            tenantId,
            userId: created.id,
            personType: 'STUDENT',
            studentId: input.studentId,
          },
        });
      }
      return created;
    });
    input.emailToUser.set(email, user.id);
    return 'created';
  }

  private nextUnusedUsername(preferred: string, used: Set<string>) {
    const base =
      preferred.replace(/[^a-zA-Z0-9._/-]/g, '').slice(0, 40) ||
      `u${Date.now().toString(36)}`;
    let candidate = base;
    let n = 1;
    while (used.has(candidate.toLowerCase())) {
      candidate = `${base}${n}`;
      n += 1;
    }
    used.add(candidate.toLowerCase());
    return candidate;
  }

  private staffPortalRole(row: {
    staffType: string;
    designation: string | null;
    department: string | null;
  }) {
    const blob =
      `${row.designation ?? ''} ${row.department ?? ''}`.toLowerCase();
    if (/librar/.test(blob)) return 'librarian';
    if (/account|cashier/.test(blob)) return 'accountant';
    if (/transport/.test(blob)) return 'transport-manager';
    if (/hr|human resource/.test(blob)) return 'hr-manager';
    if (row.staffType === 'TEACHING') return 'teacher';
    return 'office-staff';
  }

  private portalEmail(kind: string, code: string, email?: string | null) {
    const real = email?.trim().toLowerCase();
    if (real && real.includes('@')) return real;
    const slug = code.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || kind;
    return `${kind}.${slug}@portal.stlukestura.in`;
  }

  private async uniqueUsername(tenantId: string, preferred: string) {
    const base =
      preferred.replace(/[^a-zA-Z0-9._/-]/g, '').slice(0, 40) ||
      `u${Date.now().toString(36)}`;
    let candidate = base;
    let n = 1;
    while (
      await this.prisma.user.findFirst({
        where: { tenantId, username: candidate, deletedAt: null },
        select: { id: true },
      })
    ) {
      candidate = `${base}${n}`;
      n += 1;
    }
    return candidate;
  }

  async syncLoginIdentifiers(tenantId: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const accounts = await this.prisma.schoolPersonAccount.findMany({
      where: { tenantId },
      include: {
        student: {
          select: {
            admissionNumber: true,
            enrollments: {
              where: {
                deletedAt: null,
                status: 'ACTIVE',
                rollNumber: { not: null },
              },
              orderBy: { updatedAt: 'desc' },
              take: 1,
              select: { rollNumber: true },
            },
          },
        },
        staff: { select: { employeeCode: true } },
      },
    });
    const users = await this.prisma.user.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, username: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    const used = new Set(
      users.map((u) => (u.username ?? '').toLowerCase()).filter(Boolean),
    );
    let updated = 0;
    for (const acc of accounts) {
      const user = byId.get(acc.userId);
      if (!user) continue;
      const preferred = preferredSchoolLoginUsername({
        rollNumber: acc.student?.enrollments[0]?.rollNumber,
        admissionNumber: acc.student?.admissionNumber,
        employeeCode: acc.staff?.employeeCode,
      });
      if (!preferred) continue;
      if (
        compactSchoolLoginId(user.username ?? '') ===
        compactSchoolLoginId(preferred)
      ) {
        continue;
      }
      used.delete((user.username ?? '').toLowerCase());
      let candidate = preferred;
      let n = 1;
      while (used.has(candidate.toLowerCase())) {
        candidate = `${preferred}${n}`;
        n += 1;
      }
      used.add(candidate.toLowerCase());
      await this.prisma.user.update({
        where: { id: user.id },
        data: { username: candidate },
      });
      user.username = candidate;
      updated += 1;
    }
    return { ok: true, updated, total: accounts.length };
  }

  private async upsertDirectoryUser(
    tenantId: string,
    actor: JwtUser,
    input: {
      displayName: string;
      email: string;
      username: string;
      phone?: string;
      roleSlugs: string[];
      password: string;
      staffId?: string;
      studentId?: string;
    },
  ): Promise<'created' | 'linked' | 'skipped'> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.prisma.user.findFirst({
      where: { tenantId, email, deletedAt: null },
    });
    if (existing) {
      await this.applyLinks(tenantId, existing.id, {
        staffId: input.staffId,
        studentId: input.studentId,
      });
      return 'linked';
    }
    const username = await this.uniqueUsername(tenantId, input.username);
    await this.createUser(tenantId, actor, {
      email,
      displayName: input.displayName,
      username,
      phone: input.phone,
      roleSlugs: input.roleSlugs,
      password: input.password,
      accountStatus: 'active',
      mustResetPassword: true,
      invite: false,
      staffId: input.staffId,
      studentId: input.studentId,
    });
    return 'created';
  }

  async listRoles(tenantId: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
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
      permissions: r.permissions.map((p) => p.permission.slug),
    }));
  }

  async saveRole(
    tenantId: string,
    actor: JwtUser,
    body: {
      id?: string;
      name: string;
      slug?: string;
      description?: string;
      permissions: string[];
    },
  ) {
    this.access.assert(actor, 'roles.update', 'roles.create', 'rbac:manage');
    const slug = (body.slug || body.name)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-');
    if (SUPER_ROLE_SLUGS.has(slug) && !this.access.isSuper(actor)) {
      throw new ForbiddenException(
        'Ordinary administrators cannot modify Super Admin',
      );
    }
    const role = body.id
      ? await this.prisma.role.update({
          where: { id: body.id },
          data: { name: body.name, description: body.description },
        })
      : await this.prisma.role.create({
          data: {
            tenantId,
            slug,
            name: body.name,
            description: body.description,
            isSystem: false,
          },
        });
    const perms = await this.prisma.permission.findMany({
      where: { slug: { in: body.permissions } },
    });
    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
      if (perms.length) {
        await tx.rolePermission.createMany({
          data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
        });
      }
    });
    await this.log(
      tenantId,
      actor.sub,
      body.id ? 'role.updated' : 'role.created',
      role.id,
    );
    return this.listRoles(tenantId);
  }

  async cloneRole(tenantId: string, actor: JwtUser, id: string) {
    const roles = await this.listRoles(tenantId);
    const src = roles.find((r) => r.id === id);
    if (!src) throw new NotFoundException('Role not found');
    return this.saveRole(tenantId, actor, {
      name: `${src.name} copy`,
      slug: `${src.slug}-copy-${Date.now().toString(36)}`,
      description: src.description ?? undefined,
      permissions: src.permissions,
    });
  }

  async deactivateRole(tenantId: string, actor: JwtUser, id: string) {
    this.access.assert(actor, 'roles.delete', 'rbac:manage');
    const role = await this.prisma.role.findFirst({ where: { id, tenantId } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem)
      throw new BadRequestException('System roles cannot be deleted');
    const users = await this.prisma.userRole.count({
      where: { roleId: id, deletedAt: null },
    });
    if (users > 0)
      throw new BadRequestException(
        'Cannot delete a role that is still assigned to users',
      );
    await this.prisma.role.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.log(tenantId, actor.sub, 'role.deactivated', id);
    return { ok: true };
  }

  async invite(
    tenantId: string,
    actor: JwtUser,
    body: { name: string; email: string; role: string },
  ) {
    return this.createUser(tenantId, actor, {
      displayName: body.name,
      email: body.email,
      roleSlugs: [body.role],
      invite: true,
    });
  }

  async listInvites(tenantId: string) {
    return this.prisma.schoolIamInvitation.findMany({
      where: { tenantId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async revokeInvite(tenantId: string, actor: JwtUser, id: string) {
    await this.prisma.schoolIamInvitation.update({
      where: { id },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });
    await this.log(tenantId, actor.sub, 'invite.revoked', id);
    return { ok: true };
  }

  async resendInvite(tenantId: string, actor: JwtUser, id: string) {
    const row = await this.prisma.schoolIamInvitation.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Invitation not found');
    const token = await this.createInvite(
      tenantId,
      row.userId,
      row.email,
      row.roleSlug ?? undefined,
      actor.sub,
    );
    return { token };
  }

  async acceptInvite(tenantId: string, token: string, password: string) {
    const tokenHash = sha(token);
    const row = await this.prisma.schoolIamInvitation.findFirst({
      where: { tenantId, tokenHash, status: 'PENDING' },
    });
    if (!row || row.expiresAt < new Date())
      throw new BadRequestException('Invitation expired or invalid');
    const passwordHash = await bcrypt.hash(password, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: row.userId },
        data: {
          passwordHash,
          accountStatus: 'active',
          isActive: true,
          mustResetPassword: false,
          passwordChangedAt: new Date(),
          emailVerifiedAt: new Date(),
        },
      }),
      this.prisma.schoolIamInvitation.update({
        where: { id: row.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      }),
    ]);
    return { ok: true };
  }

  async sessions(tenantId: string, userId?: string) {
    return this.prisma.refreshSession.findMany({
      where: {
        tenantId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        ...(userId ? { userId } : {}),
      },
      include: { user: { select: { displayName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async revokeSession(tenantId: string, actor: JwtUser, sessionId: string) {
    this.access.assert(
      actor,
      'users.update',
      'users:manage',
      'security.audit.view',
    );
    await this.prisma.refreshSession.updateMany({
      where: { id: sessionId, tenantId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.log(tenantId, actor.sub, 'session.revoked', sessionId);
    return { ok: true };
  }

  async loginHistory(tenantId: string, userId?: string) {
    return this.prisma.authLoginEvent.findMany({
      where: { tenantId, ...(userId ? { userId } : {}) },
      include: { user: { select: { displayName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async audits(tenantId: string) {
    return this.prisma.auditLog.findMany({
      where: { tenantId, module: { in: ['school-iam', 'administration'] } },
      include: { user: { select: { displayName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async alerts(tenantId: string) {
    return this.prisma.schoolIamAlert.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async review(
    tenantId: string,
    actor: JwtUser,
    userId: string,
    decision: string,
    note?: string,
  ) {
    this.access.assert(actor, 'users.update', 'users:manage');
    await this.prisma.schoolIamAccessReview.create({
      data: { tenantId, userId, decision, note, reviewedBy: actor.sub },
    });
    if (decision === 'suspend')
      await this.setStatus(tenantId, actor, userId, 'suspended');
    if (decision === 'disable')
      await this.setStatus(tenantId, actor, userId, 'disabled');
    return { ok: true };
  }

  async impersonate(
    tenantId: string,
    actor: JwtUser,
    targetId: string,
    reason: string,
    meta: { ip?: string; ua?: string },
  ) {
    this.access.assert(actor, 'users.impersonate', 'users:impersonate');
    if (!this.access.isSuper(actor)) {
      throw new BadRequestException('Only Super Admin may impersonate');
    }
    if (!reason?.trim()) throw new BadRequestException('Reason is required');
    await this.access.assertCanManageUser(actor, targetId);
    const tokens = await this.auth.startImpersonation(
      tenantId,
      actor.sub,
      targetId,
      {
        userAgent: meta.ua,
        ipAddress: meta.ip,
      },
    );
    await this.log(tenantId, actor.sub, 'user.impersonate', targetId, {
      reason,
    });
    await this.alert(
      tenantId,
      'IMPERSONATION',
      `Impersonation started: ${reason}`,
      'WARN',
      targetId,
    );
    return tokens;
  }

  async testAccess(
    tenantId: string,
    actor: JwtUser,
    userId: string,
    permission: string,
  ) {
    this.access.assert(actor, 'users.view', 'users:read');
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      include: {
        roles: { where: { deletedAt: null }, include: { role: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const resolved = await this.resolver.resolveForUser(
      userId,
      user.roles.map((r) => r.role.slug),
    );
    const allowed =
      resolved.permissions.includes('*') ||
      resolved.permissions.includes('school-sis:manage') ||
      resolved.permissions.includes(permission);
    return {
      permission,
      allowed,
      explanation: allowed
        ? `Granted via roles [${user.roles.map((r) => r.role.name).join(', ')}] or a direct grant.`
        : 'Denied by default. No matching role or direct permission.',
      effective: resolved.permissions,
    };
  }

  async securitySettings(tenantId: string) {
    return this.prisma.tenantSecuritySettings.upsert({
      where: { tenantId },
      create: { tenantId },
      update: {},
    });
  }

  async saveSecuritySettings(
    tenantId: string,
    actor: JwtUser,
    patch: Partial<{
      minPasswordLength: number;
      mfaEnforced: boolean;
      passwordExpiryDays: number | null;
      sessionTimeoutMinutes: number;
    }>,
  ) {
    this.access.assert(actor, 'users.update', 'users:manage');
    return this.prisma.tenantSecuritySettings.upsert({
      where: { tenantId },
      create: { tenantId, ...patch },
      update: patch,
    });
  }

  async linkOptions(tenantId: string, q: string) {
    const term = q.trim();
    if (term.length < 2) return { staff: [], students: [], guardians: [] };
    const [staff, students, guardians] = await Promise.all([
      this.prisma.schoolStaff.findMany({
        where: {
          tenantId,
          deletedAt: null,
          OR: [
            { fullName: { contains: term, mode: 'insensitive' } },
            { employeeCode: { contains: term, mode: 'insensitive' } },
            { email: { contains: term, mode: 'insensitive' } },
          ],
        },
        take: 15,
        select: {
          id: true,
          fullName: true,
          employeeCode: true,
          email: true,
          phone: true,
          staffType: true,
        },
      }),
      this.prisma.schoolStudent.findMany({
        where: {
          tenantId,
          deletedAt: null,
          OR: [
            { fullName: { contains: term, mode: 'insensitive' } },
            { admissionNumber: { contains: term, mode: 'insensitive' } },
          ],
        },
        take: 15,
        select: {
          id: true,
          fullName: true,
          admissionNumber: true,
          email: true,
          phone: true,
          enrollments: {
            where: {
              deletedAt: null,
              status: 'ACTIVE',
              rollNumber: { not: null },
            },
            orderBy: { updatedAt: 'desc' },
            take: 1,
            select: { rollNumber: true },
          },
        },
      }),
      this.prisma.schoolGuardian.findMany({
        where: {
          tenantId,
          deletedAt: null,
          OR: [
            { fullName: { contains: term, mode: 'insensitive' } },
            { phone: { contains: term } },
          ],
        },
        take: 15,
        select: { id: true, fullName: true, phone: true },
      }),
    ]);
    return {
      staff,
      students: students.map((s) => ({
        id: s.id,
        fullName: s.fullName,
        admissionNumber: s.admissionNumber,
        rollNumber: s.enrollments[0]?.rollNumber ?? null,
        email: s.email,
        phone: s.phone,
      })),
      guardians,
    };
  }

  private async createInvite(
    tenantId: string,
    userId: string,
    email: string,
    roleSlug: string | undefined,
    createdBy?: string,
  ) {
    const token = randomBytes(32).toString('hex');
    await this.prisma.schoolIamInvitation.updateMany({
      where: { tenantId, userId, status: 'PENDING' },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });
    await this.prisma.schoolIamInvitation.create({
      data: {
        tenantId,
        userId,
        email,
        roleSlug,
        tokenHash: sha(token),
        expiresAt: new Date(Date.now() + 7 * 86400000),
        createdBy,
      },
    });
    return token;
  }

  private async applyLinks(
    tenantId: string,
    userId: string,
    body: {
      staffId?: string | null;
      studentId?: string | null;
      guardianId?: string | null;
    },
  ) {
    if (body.staffId) {
      await this.prisma.schoolPersonAccount.upsert({
        where: {
          tenantId_userId_personType: { tenantId, userId, personType: 'STAFF' },
        },
        update: { staffId: body.staffId },
        create: {
          tenantId,
          userId,
          personType: 'STAFF',
          staffId: body.staffId,
        },
      });
    }
    if (body.studentId) {
      await this.prisma.schoolPersonAccount.upsert({
        where: {
          tenantId_userId_personType: {
            tenantId,
            userId,
            personType: 'STUDENT',
          },
        },
        update: { studentId: body.studentId },
        create: {
          tenantId,
          userId,
          personType: 'STUDENT',
          studentId: body.studentId,
        },
      });
    }
    if (body.guardianId) {
      await this.prisma.schoolPersonAccount.upsert({
        where: {
          tenantId_userId_personType: {
            tenantId,
            userId,
            personType: 'PARENT',
          },
        },
        update: { guardianId: body.guardianId },
        create: {
          tenantId,
          userId,
          personType: 'PARENT',
          guardianId: body.guardianId,
        },
      });
    }
  }

  private async setScopes(
    tenantId: string,
    userId: string,
    sectionIds: string[],
  ) {
    await this.prisma.schoolUserScope.deleteMany({
      where: { tenantId, userId },
    });
    if (!sectionIds.length) return;
    await this.prisma.schoolUserScope.createMany({
      data: sectionIds.map((sectionId) => ({
        tenantId,
        userId,
        sectionId,
        kind: 'ASSIGNED_CLASS',
      })),
    });
  }

  private serializeUser(u: {
    id: string;
    email: string;
    username: string | null;
    phone: string | null;
    displayName: string | null;
    isActive: boolean;
    accountStatus: string;
    lastLoginAt: Date | null;
    mfaEnabled: boolean;
    mustResetPassword: boolean;
    createdAt: Date;
    passwordChangedAt: Date | null;
    roles?: { role: { slug: string; name: string } }[];
  }) {
    return {
      id: u.id,
      email: u.email,
      username: u.username,
      phone: u.phone,
      displayName: u.displayName,
      isActive: u.isActive,
      accountStatus: u.accountStatus,
      lastLoginAt: u.lastLoginAt,
      mfaEnabled: u.mfaEnabled,
      mustResetPassword: u.mustResetPassword,
      createdAt: u.createdAt,
      passwordChangedAt: u.passwordChangedAt,
      roles: (u.roles ?? []).map((r) => ({
        slug: r.role.slug,
        name: r.role.name,
      })),
    };
  }
}
