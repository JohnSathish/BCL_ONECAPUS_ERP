import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AdminAuditHelper } from '../admin-audit.helper';
import type {
  BulkResetPasswordDto,
  BulkUserActionDto,
  CreateUserDto,
  ListUsersQueryDto,
  UpdateUserDto,
} from '../dto/users.dto';
import { UserProvisioningService } from './user-provisioning.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provisioning: UserProvisioningService,
    private readonly audit: AdminAuditHelper,
  ) {}

  async getSummary(tenantId: string) {
    const [total, active, inactive, pending, suspended, blocked] =
      await Promise.all([
        this.prisma.user.count({ where: { tenantId, deletedAt: null } }),
        this.prisma.user.count({
          where: {
            tenantId,
            deletedAt: null,
            accountStatus: 'active',
            isActive: true,
          },
        }),
        this.prisma.user.count({
          where: {
            tenantId,
            deletedAt: null,
            OR: [{ isActive: false }, { accountStatus: 'inactive' }],
          },
        }),
        this.prisma.user.count({
          where: { tenantId, deletedAt: null, accountStatus: 'pending' },
        }),
        this.prisma.user.count({
          where: { tenantId, deletedAt: null, accountStatus: 'suspended' },
        }),
        this.prisma.user.count({
          where: { tenantId, deletedAt: null, accountStatus: 'blocked' },
        }),
      ]);
    return { total, active, inactive, pending, suspended, blocked };
  }

  async list(tenantId: string, query: ListUsersQueryDto) {
    const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(query.limit ?? '25', 10) || 25),
    );
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy ?? 'createdAt';
    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';

    const where: Prisma.UserWhereInput = {
      tenantId,
      deletedAt: null,
    };

    if (query.status) {
      where.accountStatus = query.status;
    }
    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { email: { contains: term, mode: 'insensitive' } },
        { username: { contains: term, mode: 'insensitive' } },
        { displayName: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
        {
          student: {
            masterProfile: {
              fullName: { contains: term, mode: 'insensitive' },
            },
          },
        },
      ];
    }
    if (query.role) {
      where.roles = {
        some: { deletedAt: null, role: { slug: query.role } },
      };
    }
    if (query.shiftId) {
      where.shiftAssignments = { some: { shiftId: query.shiftId } };
    }
    if (query.campusId) {
      where.OR = [
        ...(where.OR ?? []),
        { student: { campusId: query.campusId } },
        { roles: { some: { campusId: query.campusId, deletedAt: null } } },
      ];
    }
    if (query.departmentId) {
      where.OR = [
        ...(where.OR ?? []),
        { student: { departmentId: query.departmentId } },
        { staffProfile: { departmentId: query.departmentId } },
      ];
    }
    if (query.programVersionId) {
      where.student = { programVersionId: query.programVersionId };
    }

    const orderBy: Prisma.UserOrderByWithRelationInput =
      sortBy === 'email'
        ? { email: sortDir }
        : sortBy === 'lastLoginAt'
          ? { lastLoginAt: sortDir }
          : { createdAt: sortDir };

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          roles: {
            where: { deletedAt: null },
            include: { role: { select: { id: true, slug: true, name: true } } },
          },
          shiftAssignments: {
            include: {
              shift: { select: { id: true, name: true, code: true } },
            },
          },
          student: {
            include: {
              masterProfile: { select: { fullName: true, mobileNumber: true } },
              department: { select: { id: true, name: true, code: true } },
              programVersion: {
                select: {
                  id: true,
                  program: { select: { name: true, code: true } },
                },
              },
            },
          },
          staffProfile: {
            include: {
              department: { select: { id: true, name: true, code: true } },
            },
          },
        },
      }),
    ]);

    const items = users.map((u) => this.mapUserRow(u));
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  private mapUserRow(u: {
    id: string;
    email: string;
    username: string | null;
    phone: string | null;
    displayName: string | null;
    accountStatus: string;
    isActive: boolean;
    mfaEnabled: boolean;
    lastLoginAt: Date | null;
    mustResetPassword: boolean;
    createdAt: Date;
    roles: { role: { id: string; slug: string; name: string } }[];
    shiftAssignments: {
      isPrimary: boolean;
      shift: { id: string; name: string; code: string } | null;
    }[];
    student: {
      masterProfile: { fullName: string; mobileNumber: string | null } | null;
      department: { id: string; name: string; code: string } | null;
      programVersion: {
        program: { name: string; code: string };
      } | null;
    } | null;
    staffProfile: {
      department: { id: string; name: string; code: string } | null;
    } | null;
  }) {
    const name =
      u.displayName ??
      u.student?.masterProfile?.fullName ??
      u.email.split('@')[0];
    const mobile = u.phone ?? u.student?.masterProfile?.mobileNumber ?? null;
    const department =
      u.student?.department ?? u.staffProfile?.department ?? null;
    const primaryShift =
      u.shiftAssignments.find((s) => s.isPrimary)?.shift ??
      u.shiftAssignments[0]?.shift ??
      null;
    const programme = u.student?.programVersion?.program ?? null;

    return {
      id: u.id,
      email: u.email,
      username: u.username,
      name,
      mobile,
      displayName: u.displayName,
      roles: u.roles.map((r) => r.role),
      department,
      shift: primaryShift,
      programme,
      accountStatus: u.accountStatus,
      isActive: u.isActive,
      mfaEnabled: u.mfaEnabled,
      lastLoginAt: u.lastLoginAt,
      mustResetPassword: u.mustResetPassword,
      hasStudentProfile: !!u.student,
      hasStaffProfile: !!u.staffProfile,
      createdAt: u.createdAt,
    };
  }

  async getById(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        roles: {
          where: { deletedAt: null },
          include: { role: true },
        },
        shiftAssignments: {
          include: { shift: true },
        },
        student: {
          include: {
            masterProfile: true,
            department: true,
            programVersion: { include: { program: true } },
          },
        },
        staffProfile: { include: { department: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return this.mapUserRow(user);
  }

  async create(tenantId: string, dto: CreateUserDto, actorUserId: string) {
    const result = await this.provisioning.provisionUser({
      tenantId,
      email: dto.email,
      roleSlugs: dto.roleSlugs,
      password: dto.password,
      username: dto.username,
      phone: dto.phone,
      displayName: dto.displayName,
      accountStatus: dto.accountStatus ?? 'active',
      shiftId: dto.shiftId,
      campusId: dto.campusId,
      actorUserId,
    });
    return {
      ...(await this.getById(tenantId, result.user.id)),
      generatedPassword: result.plainPassword,
    };
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateUserDto,
    actorUserId: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({
      where: { id },
      data: {
        email: dto.email?.trim().toLowerCase(),
        username: dto.username?.trim() || null,
        phone: dto.phone?.trim() || null,
        displayName: dto.displayName?.trim() || null,
        accountStatus: dto.accountStatus,
        mfaEnabled: dto.mfaEnabled,
        isActive: dto.accountStatus
          ? dto.accountStatus === 'active'
          : undefined,
      },
    });

    if (dto.roleSlugs?.length) {
      await this.prisma.userRole.updateMany({
        where: { userId: id, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      await this.provisioning.attachRoles(
        tenantId,
        id,
        dto.roleSlugs,
        dto.shiftId,
        dto.campusId,
      );
    }

    await this.audit.log({
      tenantId,
      userId: actorUserId,
      module: 'administration',
      action: 'user.updated',
      entityType: 'user',
      entityId: id,
    });

    return this.getById(tenantId, id);
  }

  async setStatus(
    tenantId: string,
    id: string,
    status: string,
    actorUserId: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({
      where: { id },
      data: {
        accountStatus: status,
        isActive: status === 'active',
      },
    });

    await this.audit.log({
      tenantId,
      userId: actorUserId,
      module: 'administration',
      action: `user.${status}`,
      entityType: 'user',
      entityId: id,
    });

    return this.getById(tenantId, id);
  }

  async resetPassword(
    tenantId: string,
    id: string,
    actorUserId: string,
    options: { newPassword?: string; forceReset?: boolean } = {},
  ) {
    const result = await this.provisioning.resetPassword(tenantId, id, {
      ...options,
      actorUserId,
    });
    return { success: true, generatedPassword: result.plainPassword };
  }

  async bulkResetPassword(
    tenantId: string,
    dto: BulkResetPasswordDto,
    actorUserId: string,
  ) {
    const results: { userId: string; generatedPassword: string }[] = [];
    for (const userId of dto.userIds) {
      const { plainPassword } = await this.provisioning.resetPassword(
        tenantId,
        userId,
        {
          forceReset: dto.forceReset,
          actorUserId,
        },
      );
      results.push({ userId, generatedPassword: plainPassword });
    }
    return { count: results.length, results };
  }

  async bulkActivate(
    tenantId: string,
    dto: BulkUserActionDto,
    actorUserId: string,
  ) {
    for (const userId of dto.userIds) {
      await this.setStatus(tenantId, userId, 'active', actorUserId);
    }
    return { count: dto.userIds.length };
  }

  async sendCredentials(tenantId: string, id: string, actorUserId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found');

    const { plainPassword } = await this.provisioning.resetPassword(
      tenantId,
      id,
      {
        forceReset: true,
        actorUserId,
      },
    );

    await this.audit.log({
      tenantId,
      userId: actorUserId,
      module: 'administration',
      action: 'user.credentials_sent',
      entityType: 'user',
      entityId: id,
      metadata: { email: user.email, note: 'Notification stub' },
    });

    return {
      accepted: true,
      email: user.email,
      generatedPassword: plainPassword,
      note: 'Email/SMS provider stub',
    };
  }

  async listActivationQueue(tenantId: string, query: ListUsersQueryDto) {
    return this.list(tenantId, {
      ...query,
      status: query.status ?? undefined,
    });
  }

  async listForActivation(tenantId: string, query: ListUsersQueryDto) {
    const statuses = query.status
      ? [query.status]
      : ['pending', 'suspended', 'blocked', 'inactive'];

    const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(query.limit ?? '25', 10) || 25),
    );
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      tenantId,
      deletedAt: null,
      OR: [{ accountStatus: { in: statuses } }, { isActive: false }],
    };

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.AND = [
        {
          OR: [
            { email: { contains: term, mode: 'insensitive' } },
            { username: { contains: term, mode: 'insensitive' } },
            { displayName: { contains: term, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          roles: {
            where: { deletedAt: null },
            include: { role: { select: { id: true, slug: true, name: true } } },
          },
          shiftAssignments: {
            include: {
              shift: { select: { id: true, name: true, code: true } },
            },
          },
          student: {
            include: {
              masterProfile: { select: { fullName: true, mobileNumber: true } },
              department: { select: { id: true, name: true, code: true } },
              programVersion: {
                select: { program: { select: { name: true, code: true } } },
              },
            },
          },
          staffProfile: {
            include: {
              department: { select: { id: true, name: true, code: true } },
            },
          },
        },
      }),
    ]);

    return {
      items: users.map((u) => this.mapUserRow(u)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
