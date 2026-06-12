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

    return this.prisma.staffShiftAssignment.findMany({
      where: { tenantId: user.tid, shiftId },

      include: {
        staffProfile: {
          include: {
            portalUser: { select: { email: true } },
          },
        },
      },
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
