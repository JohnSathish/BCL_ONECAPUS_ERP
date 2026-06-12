import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UserProvisioningService } from '../administration/services/user-provisioning.service';

@Injectable()
export class ShiftAssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provisioning: UserProvisioningService,
  ) {}

  async listForShift(tenantId: string, shiftId: string) {
    await this.assertShift(tenantId, shiftId);
    return this.prisma.userShiftAssignment.findMany({
      where: { shiftId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            isActive: true,
            roles: {
              where: { deletedAt: null },
              include: { role: { select: { slug: true, name: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async assign(
    tenantId: string,
    shiftId: string,
    userId: string,
    isPrimary = false,
  ) {
    await this.assertShift(tenantId, shiftId);
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found');

    try {
      if (isPrimary) {
        await this.prisma.userShiftAssignment.updateMany({
          where: { userId },
          data: { isPrimary: false },
        });
      }
      return await this.prisma.userShiftAssignment.create({
        data: { userId, shiftId, isPrimary },
        include: {
          user: { select: { id: true, email: true } },
        },
      });
    } catch {
      throw new ConflictException('User is already assigned to this shift');
    }
  }

  async listAdminCandidates(tenantId: string, search?: string) {
    const term = search?.trim();
    return this.prisma.user.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(term
          ? { email: { contains: term, mode: 'insensitive' as const } }
          : {}),
      },
      select: {
        id: true,
        email: true,
        isActive: true,
        shiftAssignments: {
          select: {
            shiftId: true,
            isPrimary: true,
            shift: { select: { id: true, name: true, code: true } },
          },
        },
        roles: {
          where: { deletedAt: null },
          include: { role: { select: { slug: true, name: true } } },
        },
      },
      orderBy: { email: 'asc' },
      take: 50,
    });
  }

  async assignByEmail(
    tenantId: string,
    shiftId: string,
    email: string,
    options: {
      isPrimary?: boolean;
      createIfMissing?: boolean;
      password?: string;
    } = {},
  ) {
    const normalized = email.trim().toLowerCase();
    let user = await this.prisma.user.findFirst({
      where: { tenantId, email: normalized, deletedAt: null },
    });

    if (!user) {
      if (!options.createIfMissing) {
        throw new NotFoundException(
          'No user with this email. Enable "Create new user" and set a password.',
        );
      }
      if (!options.password || options.password.length < 8) {
        throw new BadRequestException(
          'Password is required (min 8 characters) when creating a new user.',
        );
      }
      const result = await this.provisioning.ensureUserWithRoles(
        tenantId,
        normalized,
        ['shift-admin'],
        { password: options.password, mustResetPassword: true },
      );
      user = result.user;
    } else {
      await this.ensureShiftAdminRole(tenantId, user.id);
    }

    return this.assign(tenantId, shiftId, user.id, options.isPrimary ?? false);
  }

  async unassign(tenantId: string, shiftId: string, userId: string) {
    await this.assertShift(tenantId, shiftId);
    const row = await this.prisma.userShiftAssignment.findFirst({
      where: { userId, shiftId },
    });
    if (!row) throw new NotFoundException('Assignment not found');
    await this.prisma.userShiftAssignment.delete({ where: { id: row.id } });
    return { ok: true };
  }

  private async ensureShiftAdminRole(tenantId: string, userId: string) {
    const role = await this.prisma.role.findFirst({
      where: { tenantId, slug: 'shift-admin', deletedAt: null },
    });
    if (!role) {
      throw new NotFoundException(
        'shift-admin role is not configured for this tenant',
      );
    }
    const existing = await this.prisma.userRole.findFirst({
      where: { userId, roleId: role.id, deletedAt: null },
    });
    if (!existing) {
      await this.prisma.userRole.create({
        data: { userId, roleId: role.id },
      });
    }
  }

  private async assertShift(tenantId: string, shiftId: string) {
    const shift = await this.prisma.shift.findFirst({
      where: { id: shiftId, tenantId, deletedAt: null },
    });
    if (!shift) throw new NotFoundException('Shift not found');
    return shift;
  }
}
