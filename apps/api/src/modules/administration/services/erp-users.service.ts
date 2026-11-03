import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import {
  canAccessAdminPortal,
  isSuperAdmin,
} from '../../../common/permissions/permission-registry';
import { PasswordPolicyService } from '../../../common/security/password-policy.service';
import { PrismaService } from '../../../database/prisma.service';
import { LoginAttemptService } from '../../auth/login-attempt.service';
import { AdminAuditHelper } from '../admin-audit.helper';
import {
  ERP_ADMINISTRATOR_ROLE_SLUGS,
  erpRoleProblem,
  erpUsernameProblem,
  escalationProblem,
  isRoleOfferedForErp,
  nextErpAccountCode,
  normalizeErpUsername,
} from '../domain/erp-users.logic';
import type {
  CreateErpUserDto,
  ErpUserResetPasswordDto,
  ListErpUsersQueryDto,
  UpdateErpUserDto,
} from '../dto/erp-users.dto';
import { UserProvisioningService } from './user-provisioning.service';

const ACCOUNT_INCLUDE = {
  department: { select: { id: true, name: true, code: true } },
  createdBy: { select: { id: true, displayName: true, email: true } },
  user: {
    include: {
      roles: {
        where: { deletedAt: null },
        include: { role: { select: { id: true, slug: true, name: true } } },
      },
    },
  },
} satisfies Prisma.ErpUserAccountInclude;

type AccountWithUser = Prisma.ErpUserAccountGetPayload<{
  include: typeof ACCOUNT_INCLUDE;
}>;

type Actor = Pick<JwtUser, 'sub' | 'roles' | 'permissions'>;

@Injectable()
export class ErpUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditHelper,
    private readonly passwordPolicy: PasswordPolicyService,
    private readonly provisioning: UserProvisioningService,
    private readonly loginAttempts: LoginAttemptService,
  ) {}

  async summary(tenantId: string) {
    const base = { tenantId, user: { deletedAt: null } };
    const now = new Date();
    const [total, active, inactive, locked, pending, administrators, live] =
      await Promise.all([
        this.prisma.erpUserAccount.count({ where: base }),
        this.prisma.erpUserAccount.count({
          where: {
            tenantId,
            user: { deletedAt: null, isActive: true, accountStatus: 'active' },
          },
        }),
        this.prisma.erpUserAccount.count({
          where: {
            tenantId,
            user: {
              deletedAt: null,
              OR: [{ isActive: false }, { accountStatus: 'inactive' }],
            },
          },
        }),
        this.prisma.erpUserAccount.count({
          where: {
            tenantId,
            user: { deletedAt: null, isActive: true, accountStatus: 'locked' },
          },
        }),
        this.prisma.erpUserAccount.count({
          where: {
            tenantId,
            user: {
              deletedAt: null,
              isActive: true,
              accountStatus: 'active',
              lastLoginAt: null,
            },
          },
        }),
        this.prisma.erpUserAccount.count({
          where: {
            tenantId,
            user: {
              deletedAt: null,
              roles: {
                some: {
                  deletedAt: null,
                  role: { slug: { in: [...ERP_ADMINISTRATOR_ROLE_SLUGS] } },
                },
              },
            },
          },
        }),
        this.prisma.refreshSession.findMany({
          where: {
            tenantId,
            revokedAt: null,
            expiresAt: { gt: now },
            user: { deletedAt: null, erpAccount: { isNot: null } },
          },
          distinct: ['userId'],
          select: { userId: true },
        }),
      ]);
    return {
      total,
      active,
      inactive,
      locked,
      pendingActivation: pending,
      administrators,
      signedIn: live.length,
    };
  }

  async options(tenantId: string, actor: Actor) {
    const [roles, departments, designations, permissions] = await Promise.all([
      this.prisma.role.findMany({
        where: { tenantId, deletedAt: null },
        include: { permissions: { include: { permission: true } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.department.findMany({
        where: { tenantId, deletedAt: null, status: 'ACTIVE' },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.designation.findMany({
        where: { tenantId, isActive: true },
        select: { label: true },
        orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
      }),
      this.prisma.permission.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          slug: true,
          resource: true,
          action: true,
          description: true,
        },
        orderBy: [{ resource: 'asc' }, { action: 'asc' }],
      }),
    ]);

    const actorIsSuper = isSuperAdmin(actor.roles);
    return {
      roles: roles
        .filter((r) => isRoleOfferedForErp(r.slug))
        .map((r) => {
          const perms = r.permissions.map((p) => p.permission.slug);
          const superRole = isSuperAdmin([r.slug]);
          return {
            slug: r.slug,
            name: r.name,
            description: r.description,
            isSystem: r.isSystem,
            permissionCount: perms.length,
            opensErp: canAccessAdminPortal([r.slug], perms),
            isAdministrator: ERP_ADMINISTRATOR_ROLE_SLUGS.has(r.slug),
            assignable: actorIsSuper || !superRole,
          };
        }),
      departments,
      designations: [...new Set(designations.map((d) => d.label))],
      permissions,
      actorIsSuperAdmin: actorIsSuper,
    };
  }

  async list(tenantId: string, query: ListErpUsersQueryDto) {
    const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(query.limit ?? '25', 10) || 25),
    );
    const userWhere: Prisma.UserWhereInput[] = [{ deletedAt: null }];
    const status = (query.status ?? '').toLowerCase();
    if (status === 'active') {
      userWhere.push({ isActive: true, accountStatus: 'active' });
    } else if (status === 'inactive') {
      userWhere.push({
        OR: [{ isActive: false }, { accountStatus: 'inactive' }],
      });
    } else if (status === 'locked') {
      userWhere.push({ isActive: true, accountStatus: 'locked' });
    } else if (status === 'pending') {
      userWhere.push({
        isActive: true,
        accountStatus: 'active',
        lastLoginAt: null,
      });
    }
    if (query.role) {
      userWhere.push({
        roles: { some: { deletedAt: null, role: { slug: query.role } } },
      });
    }

    const where: Prisma.ErpUserAccountWhereInput = {
      tenantId,
      user: { AND: userWhere },
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.erpAccess === 'enabled'
        ? { erpAccessEnabled: true }
        : query.erpAccess === 'disabled'
          ? { erpAccessEnabled: false }
          : {}),
    };
    const term = query.search?.trim();
    if (term) {
      where.OR = [
        { accountCode: { contains: term, mode: 'insensitive' } },
        { employeeId: { contains: term, mode: 'insensitive' } },
        { designation: { contains: term, mode: 'insensitive' } },
        { department: { name: { contains: term, mode: 'insensitive' } } },
        { user: { displayName: { contains: term, mode: 'insensitive' } } },
        { user: { email: { contains: term, mode: 'insensitive' } } },
        { user: { username: { contains: term, mode: 'insensitive' } } },
        { user: { phone: { contains: term } } },
      ];
    }

    const dir = query.sortDir === 'asc' ? 'asc' : 'desc';
    const orderBy: Prisma.ErpUserAccountOrderByWithRelationInput =
      query.sortBy === 'name'
        ? { user: { displayName: dir } }
        : query.sortBy === 'username'
          ? { user: { username: dir } }
          : query.sortBy === 'email'
            ? { user: { email: dir } }
            : query.sortBy === 'lastLoginAt'
              ? { user: { lastLoginAt: { sort: dir, nulls: 'last' } } }
              : query.sortBy === 'accountCode'
                ? { accountCode: dir }
                : { createdAt: dir };

    const [total, rows] = await Promise.all([
      this.prisma.erpUserAccount.count({ where }),
      this.prisma.erpUserAccount.findMany({
        where,
        include: ACCOUNT_INCLUDE,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      items: rows.map((row) => this.toRow(row)),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getOne(tenantId: string, userId: string) {
    const account = await this.findAccount(tenantId, userId);
    const now = new Date();
    const [grants, denyCount, sessions, logins, activity] = await Promise.all([
      this.prisma.userPermission.findMany({
        where: { userId, effect: 'grant' },
        include: { permission: { select: { slug: true } } },
      }),
      this.prisma.userPermission.count({ where: { userId, effect: 'deny' } }),
      this.prisma.refreshSession.findMany({
        where: { userId, revokedAt: null, expiresAt: { gt: now } },
        select: {
          id: true,
          createdAt: true,
          expiresAt: true,
          ipAddress: true,
          userAgent: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.authLoginEvent.findMany({
        where: { tenantId, userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          outcome: true,
          reason: true,
          method: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
        },
      }),
      this.prisma.auditLog.findMany({
        where: { tenantId, entityId: userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { user: { select: { displayName: true, email: true } } },
      }),
    ]);
    return {
      ...this.toRow(account),
      extraPermissions: grants.map((g) => g.permission.slug),
      deniedPermissionCount: denyCount,
      liveSessions: sessions,
      recentLogins: logins,
      activity: activity.map((a) => ({
        id: a.id,
        action: a.action,
        createdAt: a.createdAt,
        actor: a.user?.displayName || a.user?.email || null,
        metadata: a.metadata,
      })),
    };
  }

  async loginHistory(
    tenantId: string,
    userId: string,
    pageRaw?: string,
    limitRaw?: string,
  ) {
    await this.findAccount(tenantId, userId);
    const page = Math.max(1, parseInt(pageRaw ?? '1', 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(limitRaw ?? '25', 10) || 25),
    );
    const where = { tenantId, userId };
    const [total, items] = await Promise.all([
      this.prisma.authLoginEvent.count({ where }),
      this.prisma.authLoginEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          outcome: true,
          reason: true,
          method: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
        },
      }),
    ]);
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async create(tenantId: string, dto: CreateErpUserDto, actor: Actor) {
    const email = dto.email.trim().toLowerCase();
    const username = normalizeErpUsername(dto.username);
    const usernameProblem = erpUsernameProblem(username);
    if (usernameProblem) throw new BadRequestException(usernameProblem);
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException(
        'Password and Confirm Password do not match.',
      );
    }
    const rules = await this.passwordPolicy.getRules(tenantId);
    this.passwordPolicy.validatePlaintext(dto.password, rules);

    await this.assertEmailFree(tenantId, email);
    await this.assertUsernameFree(tenantId, username);
    const employeeId = dto.employeeId?.trim() || null;
    if (employeeId) await this.assertEmployeeIdFree(tenantId, employeeId);
    if (dto.departmentId)
      await this.assertDepartment(tenantId, dto.departmentId);

    const { role, permissionIds } = await this.resolveAccess(
      tenantId,
      actor,
      dto.roleSlug,
      dto.extraPermissions ?? [],
    );

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const now = new Date();
    const status = dto.accountStatus === 'inactive' ? 'inactive' : 'active';

    const userId = await this.withAccountCodeRetry(async () =>
      this.prisma.$transaction(async (tx) => {
        const codes = await tx.erpUserAccount.findMany({
          where: { tenantId },
          select: { accountCode: true },
        });
        const user = await tx.user.create({
          data: {
            tenantId,
            email,
            username,
            phone: dto.mobile?.trim() || null,
            displayName: dto.fullName.trim(),
            passwordHash,
            emailVerifiedAt: now,
            isActive: status === 'active',
            accountStatus: status,
            passwordChangedAt: now,
            mustResetPassword: dto.forcePasswordChange,
          },
        });
        await tx.userRole.create({
          data: {
            userId: user.id,
            roleId: role.id,
            departmentId: role.slug === 'hod' ? dto.departmentId || null : null,
          },
        });
        for (const permissionId of permissionIds) {
          await tx.userPermission.create({
            data: { userId: user.id, permissionId, effect: 'grant' },
          });
        }
        await tx.passwordHistory.create({
          data: { userId: user.id, passwordHash },
        });
        await tx.erpUserAccount.create({
          data: {
            tenantId,
            userId: user.id,
            accountCode: nextErpAccountCode(codes.map((c) => c.accountCode)),
            employeeId,
            departmentId: dto.departmentId || null,
            designation: dto.designation?.trim() || null,
            erpAccessEnabled: dto.erpAccessEnabled,
            deactivatedAt: status === 'inactive' ? now : null,
            createdById: actor.sub,
          },
        });
        return user.id;
      }),
    );

    await this.audit.log({
      tenantId,
      userId: actor.sub,
      module: 'administration',
      action: 'erp_user.created',
      entityType: 'user',
      entityId: userId,
      metadata: {
        username,
        email,
        role: role.slug,
        extraPermissions: dto.extraPermissions ?? [],
        accountStatus: status,
        erpAccessEnabled: dto.erpAccessEnabled,
        forcePasswordChange: dto.forcePasswordChange,
      },
    });
    return this.getOne(tenantId, userId);
  }

  async update(
    tenantId: string,
    userId: string,
    dto: UpdateErpUserDto,
    actor: Actor,
  ) {
    const account = await this.findAccount(tenantId, userId);
    this.assertMayManage(account, actor);
    const user = account.user;
    const changes: Record<string, { from: unknown; to: unknown }> = {};

    const userData: Prisma.UserUpdateInput = {};
    if (
      dto.fullName !== undefined &&
      dto.fullName.trim() !== user.displayName
    ) {
      userData.displayName = dto.fullName.trim();
      changes.fullName = { from: user.displayName, to: dto.fullName.trim() };
    }
    if (dto.email !== undefined) {
      const email = dto.email.trim().toLowerCase();
      if (email !== user.email) {
        await this.assertEmailFree(tenantId, email, userId);
        userData.email = email;
        changes.email = { from: user.email, to: email };
      }
    }
    if (dto.username !== undefined) {
      const username = normalizeErpUsername(dto.username);
      const problem = erpUsernameProblem(username);
      if (problem) throw new BadRequestException(problem);
      if (username !== user.username) {
        await this.assertUsernameFree(tenantId, username, userId);
        userData.username = username;
        changes.username = { from: user.username, to: username };
      }
    }
    if (dto.mobile !== undefined) {
      const phone = dto.mobile.trim() || null;
      if (phone !== user.phone) {
        userData.phone = phone;
        changes.mobile = { from: user.phone, to: phone };
      }
    }

    const accountData: Prisma.ErpUserAccountUpdateInput = {};
    if (dto.employeeId !== undefined) {
      const employeeId = dto.employeeId.trim() || null;
      if (employeeId !== account.employeeId) {
        if (employeeId)
          await this.assertEmployeeIdFree(tenantId, employeeId, userId);
        accountData.employeeId = employeeId;
        changes.employeeId = { from: account.employeeId, to: employeeId };
      }
    }
    if (dto.departmentId !== undefined) {
      const departmentId = dto.departmentId.trim() || null;
      if (departmentId !== account.departmentId) {
        if (departmentId) await this.assertDepartment(tenantId, departmentId);
        accountData.department = departmentId
          ? { connect: { id: departmentId } }
          : { disconnect: true };
        changes.department = { from: account.departmentId, to: departmentId };
      }
    }
    if (dto.designation !== undefined) {
      const designation = dto.designation.trim() || null;
      if (designation !== account.designation) {
        accountData.designation = designation;
        changes.designation = { from: account.designation, to: designation };
      }
    }

    const currentRole = user.roles[0]?.role ?? null;
    const currentGrants = await this.prisma.userPermission.findMany({
      where: { userId, effect: 'grant' },
      include: { permission: { select: { slug: true } } },
    });
    const currentGrantSlugs = currentGrants
      .map((g) => g.permission.slug)
      .sort();
    const nextRoleSlug = dto.roleSlug ?? currentRole?.slug;
    const nextGrantSlugs = [
      ...new Set(dto.extraPermissions ?? currentGrantSlugs),
    ].sort();
    const roleChanged = Boolean(
      dto.roleSlug && dto.roleSlug !== currentRole?.slug,
    );
    const grantsChanged =
      dto.extraPermissions !== undefined &&
      nextGrantSlugs.join('|') !== currentGrantSlugs.join('|');

    let resolved: Awaited<ReturnType<ErpUsersService['resolveAccess']>> | null =
      null;
    if (roleChanged || grantsChanged) {
      if (!nextRoleSlug) throw new BadRequestException('Assign a role.');
      resolved = await this.resolveAccess(
        tenantId,
        actor,
        nextRoleSlug,
        nextGrantSlugs,
      );
    }

    const accessChanged =
      dto.erpAccessEnabled !== undefined &&
      dto.erpAccessEnabled !== account.erpAccessEnabled;
    if (accessChanged) {
      if (!dto.erpAccessEnabled && userId === actor.sub) {
        throw new BadRequestException(
          'You cannot turn off your own ERP access.',
        );
      }
      accountData.erpAccessEnabled = dto.erpAccessEnabled;
    }

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(userData).length) {
        await tx.user.update({ where: { id: userId }, data: userData });
      }
      if (Object.keys(accountData).length) {
        await tx.erpUserAccount.update({
          where: { userId },
          data: accountData,
        });
      }
      if (resolved && roleChanged) {
        await tx.userRole.updateMany({
          where: { userId, deletedAt: null },
          data: { deletedAt: new Date() },
        });
        const departmentId =
          dto.departmentId !== undefined
            ? dto.departmentId.trim() || null
            : account.departmentId;
        await tx.userRole.create({
          data: {
            userId,
            roleId: resolved.role.id,
            departmentId: resolved.role.slug === 'hod' ? departmentId : null,
          },
        });
      }
      if (resolved && grantsChanged) {
        await tx.userPermission.deleteMany({
          where: { userId, effect: 'grant' },
        });
        for (const permissionId of resolved.permissionIds) {
          await tx.userPermission.upsert({
            where: { userId_permissionId: { userId, permissionId } },
            create: { userId, permissionId, effect: 'grant' },
            update: { effect: 'grant' },
          });
        }
      }
    });

    const revoke =
      roleChanged || grantsChanged || (accessChanged && !dto.erpAccessEnabled);
    if (revoke) await this.revokeAll(userId);

    if (Object.keys(changes).length) {
      await this.log(tenantId, actor, userId, 'erp_user.updated', { changes });
    }
    if (roleChanged) {
      await this.log(tenantId, actor, userId, 'erp_user.role_changed', {
        from: currentRole?.slug ?? null,
        to: nextRoleSlug,
      });
    }
    if (grantsChanged) {
      await this.log(tenantId, actor, userId, 'erp_user.permissions_changed', {
        added: nextGrantSlugs.filter((s) => !currentGrantSlugs.includes(s)),
        removed: currentGrantSlugs.filter((s) => !nextGrantSlugs.includes(s)),
      });
    }
    if (accessChanged) {
      await this.log(
        tenantId,
        actor,
        userId,
        dto.erpAccessEnabled
          ? 'erp_user.erp_access_enabled'
          : 'erp_user.erp_access_disabled',
      );
    }
    return this.getOne(tenantId, userId);
  }

  async activate(tenantId: string, userId: string, actor: Actor) {
    const account = await this.findAccount(tenantId, userId);
    this.assertMayManage(account, actor);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { isActive: true, accountStatus: 'active' },
      }),
      this.prisma.erpUserAccount.update({
        where: { userId },
        data: { deactivatedAt: null, lockedAt: null },
      }),
    ]);
    await this.log(tenantId, actor, userId, 'erp_user.activated');
    return this.getOne(tenantId, userId);
  }

  async deactivate(tenantId: string, userId: string, actor: Actor) {
    const account = await this.findAccount(tenantId, userId);
    this.assertMayManage(account, actor);
    if (userId === actor.sub) {
      throw new BadRequestException('You cannot deactivate your own account.');
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { isActive: false, accountStatus: 'inactive' },
      }),
      this.prisma.erpUserAccount.update({
        where: { userId },
        data: { deactivatedAt: new Date() },
      }),
    ]);
    const revoked = await this.revokeAll(userId);
    await this.log(tenantId, actor, userId, 'erp_user.deactivated', {
      sessionsRevoked: revoked,
    });
    return this.getOne(tenantId, userId);
  }

  async lock(tenantId: string, userId: string, actor: Actor) {
    const account = await this.findAccount(tenantId, userId);
    this.assertMayManage(account, actor);
    if (userId === actor.sub) {
      throw new BadRequestException('You cannot lock your own account.');
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { isActive: true, accountStatus: 'locked' },
      }),
      this.prisma.erpUserAccount.update({
        where: { userId },
        data: { lockedAt: new Date() },
      }),
    ]);
    const revoked = await this.revokeAll(userId);
    await this.log(tenantId, actor, userId, 'erp_user.locked', {
      sessionsRevoked: revoked,
    });
    return this.getOne(tenantId, userId);
  }

  async unlock(tenantId: string, userId: string, actor: Actor) {
    const account = await this.findAccount(tenantId, userId);
    this.assertMayManage(account, actor);
    const { cleared } = await this.loginAttempts.unlockForUser(
      tenantId,
      userId,
    );
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { isActive: true, accountStatus: 'active' },
      }),
      this.prisma.erpUserAccount.update({
        where: { userId },
        data: { lockedAt: null },
      }),
    ]);
    await this.log(tenantId, actor, userId, 'erp_user.unlocked', {
      clearedFailedAttempts: cleared,
    });
    return this.getOne(tenantId, userId);
  }

  async resetPassword(
    tenantId: string,
    userId: string,
    dto: ErpUserResetPasswordDto,
    actor: Actor,
  ) {
    const account = await this.findAccount(tenantId, userId);
    this.assertMayManage(account, actor);
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException(
        'Password and Confirm Password do not match.',
      );
    }
    await this.provisioning.resetPassword(tenantId, userId, {
      newPassword: dto.newPassword,
      forceReset: dto.forcePasswordChange,
      actorUserId: actor.sub,
    });
    await this.log(tenantId, actor, userId, 'erp_user.password_reset', {
      forcePasswordChange: dto.forcePasswordChange,
    });
    return { success: true };
  }

  async forcePasswordChange(tenantId: string, userId: string, actor: Actor) {
    const account = await this.findAccount(tenantId, userId);
    this.assertMayManage(account, actor);
    await this.prisma.user.update({
      where: { id: userId },
      data: { mustResetPassword: true },
    });
    const revoked = await this.revokeAll(userId);
    await this.log(tenantId, actor, userId, 'erp_user.force_password_change', {
      sessionsRevoked: revoked,
    });
    return { success: true };
  }

  async revokeSessions(tenantId: string, userId: string, actor: Actor) {
    const account = await this.findAccount(tenantId, userId);
    this.assertMayManage(account, actor);
    const revoked = await this.revokeAll(userId);
    await this.log(tenantId, actor, userId, 'erp_user.sessions_revoked', {
      sessionsRevoked: revoked,
    });
    return { success: true, revoked };
  }

  private toRow(account: AccountWithUser) {
    const user = account.user;
    const role = user.roles[0]?.role ?? null;
    const status =
      !user.isActive || user.accountStatus === 'inactive'
        ? 'inactive'
        : user.accountStatus;
    return {
      id: user.id,
      accountCode: account.accountCode,
      name: user.displayName || user.email.split('@')[0],
      username: user.username,
      email: user.email,
      mobile: user.phone,
      employeeId: account.employeeId,
      department: account.department,
      designation: account.designation,
      role,
      isAdministrator: role
        ? ERP_ADMINISTRATOR_ROLE_SLUGS.has(role.slug)
        : false,
      status,
      pendingActivation: status === 'active' && !user.lastLoginAt,
      erpAccessEnabled: account.erpAccessEnabled,
      mustChangePassword: user.mustResetPassword,
      lastLoginAt: user.lastLoginAt,
      lockedAt: account.lockedAt,
      deactivatedAt: account.deactivatedAt,
      createdAt: account.createdAt,
      createdBy: account.createdBy
        ? account.createdBy.displayName || account.createdBy.email
        : null,
    };
  }

  private async findAccount(tenantId: string, userId: string) {
    const account = await this.prisma.erpUserAccount.findFirst({
      where: { tenantId, userId, user: { deletedAt: null } },
      include: ACCOUNT_INCLUDE,
    });
    if (!account) throw new NotFoundException('ERP user not found');
    return account;
  }

  /** A non-super-admin cannot change an account that holds a Super Admin role. */
  private assertMayManage(account: AccountWithUser, actor: Actor) {
    if (isSuperAdmin(actor.roles)) return;
    const targetRoles = account.user.roles.map((r) => r.role.slug);
    if (isSuperAdmin(targetRoles)) {
      throw new ForbiddenException(
        'Only a Super Admin can change a Super Admin ERP account.',
      );
    }
  }

  private async resolveAccess(
    tenantId: string,
    actor: Actor,
    roleSlug: string,
    extraPermissions: string[],
  ) {
    const role = await this.prisma.role.findFirst({
      where: { tenantId, slug: roleSlug, deletedAt: null },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) throw new BadRequestException('Choose a valid role.');

    const extras = [
      ...new Set(extraPermissions.map((s) => s.trim()).filter(Boolean)),
    ];
    const permissions = extras.length
      ? await this.prisma.permission.findMany({
          where: { slug: { in: extras }, deletedAt: null },
          select: { id: true, slug: true },
        })
      : [];
    if (permissions.length !== extras.length) {
      throw new BadRequestException(
        'One or more permissions are not recognised.',
      );
    }

    const rolePermissions = role.permissions.map((p) => p.permission.slug);
    const combined = [...new Set([...rolePermissions, ...extras])];
    const roleProblem = erpRoleProblem(role.slug, combined);
    if (roleProblem) throw new BadRequestException(roleProblem);

    const escalation = escalationProblem({
      actorRoles: actor.roles,
      actorPermissions: actor.permissions,
      targetRoleSlug: role.slug,
      targetPermissions: combined,
    });
    if (escalation) throw new ForbiddenException(escalation);

    return { role, permissionIds: permissions.map((p) => p.id) };
  }

  private async assertEmailFree(
    tenantId: string,
    email: string,
    exceptUserId?: string,
  ) {
    const existing = await this.prisma.user.findFirst({
      where: {
        tenantId,
        email,
        ...(exceptUserId ? { id: { not: exceptUserId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'This email is already used by another login (student, staff, parent or ERP). Use a separate official email for the ERP account.',
      );
    }
  }

  private async assertUsernameFree(
    tenantId: string,
    username: string,
    exceptUserId?: string,
  ) {
    const existing = await this.prisma.user.findFirst({
      where: {
        tenantId,
        username: { equals: username, mode: 'insensitive' },
        ...(exceptUserId ? { id: { not: exceptUserId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'This username is already taken. Choose another.',
      );
    }
  }

  private async assertEmployeeIdFree(
    tenantId: string,
    employeeId: string,
    exceptUserId?: string,
  ) {
    const existing = await this.prisma.erpUserAccount.findFirst({
      where: {
        tenantId,
        employeeId: { equals: employeeId, mode: 'insensitive' },
        ...(exceptUserId ? { userId: { not: exceptUserId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'Another ERP user already has this Employee ID.',
      );
    }
  }

  private async assertDepartment(tenantId: string, departmentId: string) {
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!department)
      throw new BadRequestException('Choose a valid department.');
  }

  private async withAccountCodeRetry<T>(run: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await run();
      } catch (error) {
        const target = (error as Prisma.PrismaClientKnownRequestError)?.meta
          ?.target;
        const fields = Array.isArray(target)
          ? target.join(',')
          : typeof target === 'string'
            ? target
            : '';
        const codeClash =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          (fields.includes('account_code') || fields.includes('accountCode'));
        if (!codeClash || attempt >= 4) throw error;
      }
    }
  }

  private async revokeAll(userId: string) {
    const { count } = await this.prisma.refreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return count;
  }

  private log(
    tenantId: string,
    actor: Actor,
    userId: string,
    action: string,
    metadata?: Record<string, unknown>,
  ) {
    return this.audit.log({
      tenantId,
      userId: actor.sub,
      module: 'administration',
      action,
      entityType: 'user',
      entityId: userId,
      metadata,
    });
  }
}
