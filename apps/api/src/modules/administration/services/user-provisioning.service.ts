import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../../database/prisma.service';
import { AdminAuditHelper } from '../admin-audit.helper';
import { PasswordPolicyService } from '../../../common/security/password-policy.service';
import { UsernameGenerationService } from './username-generation.service';

export type ProvisionUserInput = {
  tenantId: string;
  email: string;
  roleSlugs: string[];
  password?: string;
  username?: string;
  phone?: string;
  displayName?: string;
  accountStatus?: string;
  shiftId?: string;
  campusId?: string;
  mustResetPassword?: boolean;
  userTypeForUsername?: string;
  programmeCode?: string;
  actorUserId?: string;
};

@Injectable()
export class UserProvisioningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usernameGen: UsernameGenerationService,
    private readonly audit: AdminAuditHelper,
    private readonly passwordPolicy: PasswordPolicyService,
  ) {}

  generatePassword(length = 12): string {
    const chars =
      'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
    const bytes = randomBytes(length);
    return Array.from(bytes, (b) => chars[b % chars.length]).join('');
  }

  async provisionUser(input: ProvisionUserInput) {
    const email = input.email.trim().toLowerCase();
    if (!email) throw new BadRequestException('Email is required');

    const existing = await this.prisma.user.findFirst({
      where: { tenantId: input.tenantId, email, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const plainPassword = input.password ?? this.generatePassword();
    const passwordHash = await bcrypt.hash(plainPassword, 12);
    const now = new Date();

    let username = input.username?.trim() || null;
    if (!username && input.userTypeForUsername) {
      username = await this.usernameGen.generate(
        input.tenantId,
        input.userTypeForUsername,
        input.programmeCode,
      );
    }

    const roles = await this.prisma.role.findMany({
      where: {
        tenantId: input.tenantId,
        slug: { in: input.roleSlugs },
        deletedAt: null,
      },
    });
    if (roles.length !== input.roleSlugs.length) {
      throw new BadRequestException('One or more roles are invalid');
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          tenantId: input.tenantId,
          email,
          username,
          phone: input.phone?.trim() || null,
          displayName: input.displayName?.trim() || null,
          passwordHash,
          emailVerifiedAt: now,
          isActive: (input.accountStatus ?? 'active') === 'active',
          accountStatus: input.accountStatus ?? 'active',
          passwordChangedAt: now,
          mustResetPassword: input.mustResetPassword ?? true,
        },
      });

      for (const role of roles) {
        await tx.userRole.create({
          data: {
            userId: created.id,
            roleId: role.id,
            shiftId: input.shiftId,
            campusId: input.campusId,
          },
        });
      }

      if (input.shiftId) {
        await tx.userShiftAssignment.upsert({
          where: {
            userId_shiftId: { userId: created.id, shiftId: input.shiftId },
          },
          create: {
            userId: created.id,
            shiftId: input.shiftId,
            isPrimary: true,
          },
          update: { isPrimary: true },
        });
      }

      await tx.passwordHistory.create({
        data: { userId: created.id, passwordHash },
      });

      return created;
    });

    await this.audit.log({
      tenantId: input.tenantId,
      userId: input.actorUserId,
      module: 'administration',
      action: 'user.created',
      entityType: 'user',
      entityId: user.id,
      metadata: { email, roleSlugs: input.roleSlugs },
    });

    return { user, plainPassword };
  }

  async ensureUserWithRoles(
    tenantId: string,
    email: string,
    roleSlugs: string[],
    options: {
      password?: string;
      passwordHash?: string;
      accountStatus?: string;
      mustResetPassword?: boolean;
      shiftId?: string;
      campusId?: string;
      userTypeForUsername?: string;
      programmeCode?: string;
      displayName?: string;
      phone?: string;
      username?: string;
    } = {},
  ) {
    const normalized = email.trim().toLowerCase();
    let user = await this.prisma.user.findFirst({
      where: { tenantId, email: normalized, deletedAt: null },
    });

    let plainPassword: string | undefined;
    if (!user) {
      const result = await this.provisionUser({
        tenantId,
        email: normalized,
        roleSlugs,
        password: options.password,
        accountStatus: options.accountStatus ?? 'active',
        mustResetPassword: options.mustResetPassword,
        shiftId: options.shiftId,
        campusId: options.campusId,
        userTypeForUsername: options.userTypeForUsername,
        programmeCode: options.programmeCode,
        displayName: options.displayName,
        phone: options.phone,
        username: options.username,
      });
      user = result.user;
      plainPassword = result.plainPassword;
    } else {
      if (options.passwordHash || options.password) {
        const hash =
          options.passwordHash ?? (await bcrypt.hash(options.password!, 12));
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            passwordHash: hash,
            isActive: true,
            deletedAt: null,
            accountStatus: options.accountStatus ?? user.accountStatus,
            displayName: options.displayName ?? user.displayName,
            phone: options.phone ?? user.phone,
            username: options.username ?? user.username,
          },
        });
      }
      await this.attachRoles(
        tenantId,
        user.id,
        roleSlugs,
        options.shiftId,
        options.campusId,
      );
    }

    return { user, plainPassword };
  }

  async attachRoles(
    tenantId: string,
    userId: string,
    roleSlugs: string[],
    shiftId?: string,
    campusId?: string,
  ) {
    const roles = await this.prisma.role.findMany({
      where: { tenantId, slug: { in: roleSlugs }, deletedAt: null },
    });
    for (const role of roles) {
      const existing = await this.prisma.userRole.findFirst({
        where: { userId, roleId: role.id, deletedAt: null },
      });
      if (!existing) {
        await this.prisma.userRole.create({
          data: { userId, roleId: role.id, shiftId, campusId },
        });
      }
    }
  }

  async resetPassword(
    tenantId: string,
    userId: string,
    options: {
      forceReset?: boolean;
      newPassword?: string;
      actorUserId?: string;
    } = {},
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found');

    const settings = await this.prisma.tenantSecuritySettings.findUnique({
      where: { tenantId },
    });
    const historyCount = settings?.passwordHistoryCount ?? 5;

    const plainPassword = options.newPassword ?? this.generatePassword();
    if (options.newPassword) {
      await this.passwordPolicy.validateForUser(
        tenantId,
        userId,
        plainPassword,
      );
    }
    const passwordHash = await bcrypt.hash(plainPassword, 12);

    const history = await this.prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: historyCount,
    });
    for (const h of history) {
      if (await bcrypt.compare(plainPassword, h.passwordHash)) {
        throw new BadRequestException('Password was used recently');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          passwordChangedAt: new Date(),
          mustResetPassword: options.forceReset ?? true,
        },
      });
      await tx.passwordHistory.create({ data: { userId, passwordHash } });
      const allHistory = await tx.passwordHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: historyCount,
      });
      if (allHistory.length) {
        await tx.passwordHistory.deleteMany({
          where: { id: { in: allHistory.map((h) => h.id) } },
        });
      }
    });

    await this.audit.log({
      tenantId,
      userId: options.actorUserId,
      module: 'administration',
      action: 'user.password_reset',
      entityType: 'user',
      entityId: userId,
    });

    return { plainPassword };
  }

  generateCredentials(userType: string) {
    return {
      password: this.generatePassword(),
      userType,
    };
  }
}
