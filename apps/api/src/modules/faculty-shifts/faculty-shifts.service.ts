import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { JwtUser } from '../../common/decorators/current-user.decorator';

import { ShiftScopeService } from '../../common/services/shift-scope.service';

import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class FacultyShiftsService {
  constructor(
    private readonly prisma: PrismaService,

    private readonly shiftScope: ShiftScopeService,
  ) {}

  async listForShift(user: JwtUser, shiftId: string) {
    this.shiftScope.assertShiftAccess(
      this.shiftScope.resolveScope(user, shiftId),
      shiftId,
    );

    const rows = await this.prisma.staffShiftAssignment.findMany({
      where: { tenantId: user.tid, shiftId, active: true },
      include: {
        shift: { select: { id: true, code: true, name: true } },
        staffProfile: {
          include: {
            portalUser: { select: { email: true, isActive: true } },
            department: { select: { id: true, code: true, name: true } },
            designation: { select: { id: true, label: true } },
          },
        },
      },
      orderBy: [{ staffProfile: { fullName: 'asc' } }],
    });

    return rows.map((row) => ({
      id: row.id,
      shiftId: row.shiftId,
      isPrimary: row.isPrimary,
      active: row.active,
      hoursPerWeek: row.hoursPerWeek ? Number(row.hoursPerWeek) : null,
      shift: row.shift,
      staffProfileId: row.staffProfileId,
      fullName: row.staffProfile.fullName,
      shortCode: row.staffProfile.shortCode,
      employeeCode: row.staffProfile.employeeCode,
      email:
        row.staffProfile.email ?? row.staffProfile.portalUser?.email ?? null,
      staffType: row.staffProfile.staffType,
      status: row.staffProfile.status,
      department: row.staffProfile.department,
      designation: row.staffProfile.designation,
      portalActive: row.staffProfile.portalUser?.isActive ?? false,
    }));
  }

  async searchCandidates(
    user: JwtUser,
    shiftId: string,
    search?: string,
    limit = 20,
  ) {
    this.shiftScope.assertShiftAccess(
      this.shiftScope.resolveScope(user, shiftId),
      shiftId,
    );

    const assigned = await this.prisma.staffShiftAssignment.findMany({
      where: { tenantId: user.tid, shiftId, active: true },
      select: { staffProfileId: true },
    });
    const assignedIds = assigned.map((row) => row.staffProfileId);

    const q = search?.trim();
    const where = {
      tenantId: user.tid,
      deletedAt: null,
      status: 'ACTIVE' as const,
      ...(assignedIds.length ? { id: { notIn: assignedIds } } : {}),
      ...(q
        ? {
            OR: [
              { fullName: { contains: q, mode: 'insensitive' as const } },
              { employeeCode: { contains: q, mode: 'insensitive' as const } },
              { shortCode: { contains: q, mode: 'insensitive' as const } },
              { email: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.staffProfile.findMany({
      where,
      take: Math.min(Math.max(limit, 1), 50),
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        fullName: true,
        shortCode: true,
        employeeCode: true,
        staffType: true,
        department: { select: { id: true, name: true } },
        designation: { select: { id: true, label: true } },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      fullName: row.fullName,
      shortCode: row.shortCode,
      employeeCode: row.employeeCode,
      staffType: row.staffType,
      department: row.department,
      designation: row.designation,
    }));
  }

  async assign(
    user: JwtUser,

    staffProfileId: string,

    shiftId: string,

    hoursPerWeek?: number,
  ) {
    this.shiftScope.assertShiftAccess(
      this.shiftScope.resolveScope(user, shiftId),

      shiftId,
    );

    const staff = await this.prisma.staffProfile.findFirst({
      where: { id: staffProfileId, tenantId: user.tid, deletedAt: null },
    });

    if (!staff) throw new NotFoundException('Faculty not found');

    try {
      return await this.prisma.staffShiftAssignment.create({
        data: {
          tenantId: user.tid,

          staffProfileId,

          shiftId,

          hoursPerWeek,
        },
      });
    } catch {
      throw new ConflictException('Faculty already assigned to this shift');
    }
  }

  async unassign(user: JwtUser, staffProfileId: string, shiftId: string) {
    this.shiftScope.assertShiftAccess(
      this.shiftScope.resolveScope(user, shiftId),

      shiftId,
    );

    const row = await this.prisma.staffShiftAssignment.findFirst({
      where: { staffProfileId, shiftId, tenantId: user.tid },
    });

    if (!row) throw new NotFoundException('Assignment not found');

    await this.prisma.staffShiftAssignment.delete({ where: { id: row.id } });

    return { ok: true };
  }

  async assertFacultyTeachesShift(
    tenantId: string,

    staffProfileId: string,

    shiftId: string,

    allowBypass = false,
  ) {
    if (allowBypass) return;

    const mapping = await this.prisma.staffShiftAssignment.findFirst({
      where: { tenantId, staffProfileId, shiftId, active: true },
    });

    if (!mapping) {
      throw new BadRequestException(
        'Faculty is not assigned to teach in this shift',
      );
    }
  }
}
