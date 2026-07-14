import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { JwtUser } from '../../common/decorators/current-user.decorator';

import { ShiftScopeService } from '../../common/services/shift-scope.service';

import { PrismaService } from '../../database/prisma.service';

type ShiftChip = { id: string; code: string; name: string; isPrimary: boolean };

@Injectable()
export class FacultyShiftsService {
  constructor(
    private readonly prisma: PrismaService,

    private readonly shiftScope: ShiftScopeService,
  ) {}

  private async assignedShiftsForStaff(
    tenantId: string,
    staffProfileIds: string[],
  ): Promise<Map<string, ShiftChip[]>> {
    if (!staffProfileIds.length) return new Map();
    const rows = await this.prisma.staffShiftAssignment.findMany({
      where: {
        tenantId,
        staffProfileId: { in: staffProfileIds },
        active: true,
      },
      include: {
        shift: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ isPrimary: 'desc' }, { shift: { sortOrder: 'asc' } }],
    });
    const map = new Map<string, ShiftChip[]>();
    for (const row of rows) {
      const list = map.get(row.staffProfileId) ?? [];
      list.push({
        id: row.shift.id,
        code: row.shift.code,
        name: row.shift.name,
        isPrimary: row.isPrimary,
      });
      map.set(row.staffProfileId, list);
    }
    return map;
  }

  async listForShift(
    user: JwtUser,
    shiftId: string,
    opts?: { page?: number; limit?: number; search?: string },
  ) {
    this.shiftScope.assertShiftAccess(
      this.shiftScope.resolveScope(user, shiftId),
      shiftId,
    );

    const page = Math.max(1, opts?.page ?? 1);
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
    const q = opts?.search?.trim();

    const where = {
      tenantId: user.tid,
      shiftId,
      active: true,
      ...(q
        ? {
            staffProfile: {
              OR: [
                { fullName: { contains: q, mode: 'insensitive' as const } },
                { employeeCode: { contains: q, mode: 'insensitive' as const } },
                { shortCode: { contains: q, mode: 'insensitive' as const } },
                { email: { contains: q, mode: 'insensitive' as const } },
              ],
            },
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.staffShiftAssignment.count({ where }),
      this.prisma.staffShiftAssignment.findMany({
        where,
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
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const assignedMap = await this.assignedShiftsForStaff(
      user.tid,
      rows.map((r) => r.staffProfileId),
    );

    const data = rows.map((row) => {
      const assignedShifts = assignedMap.get(row.staffProfileId) ?? [
        {
          id: row.shift.id,
          code: row.shift.code,
          name: row.shift.name,
          isPrimary: row.isPrimary,
        },
      ];
      return {
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
        assignedShifts,
        assignedShiftIds: assignedShifts.map((s) => s.id),
        assignedShiftNames: assignedShifts.map((s) => s.name),
        teachesMultipleShifts: assignedShifts.length > 1,
      };
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
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

    const assignedMap = await this.assignedShiftsForStaff(
      user.tid,
      rows.map((r) => r.id),
    );

    return rows.map((row) => {
      const assignedShifts = assignedMap.get(row.id) ?? [];
      return {
        id: row.id,
        fullName: row.fullName,
        shortCode: row.shortCode,
        employeeCode: row.employeeCode,
        staffType: row.staffType,
        department: row.department,
        designation: row.designation,
        assignedShifts,
        assignedShiftIds: assignedShifts.map((s) => s.id),
        assignedShiftNames: assignedShifts.map((s) => s.name),
        teachesMultipleShifts: assignedShifts.length > 1,
      };
    });
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
