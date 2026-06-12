import { Injectable } from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import type { KioskScanDto } from '../dto/front-office.dto';
import { FrontOfficeGatePassesService } from './front-office-gate-passes.service';

@Injectable()
export class FrontOfficeKioskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gatePasses: FrontOfficeGatePassesService,
  ) {}

  async status(tenantId: string) {
    const [visitorsInside, activePasses, checkedInToday] = await Promise.all([
      this.prisma.frontOfficeGatePass.count({
        where: { tenantId, status: 'CHECKED_IN' },
      }),
      this.prisma.frontOfficeGatePass.count({
        where: {
          tenantId,
          status: { in: ['ACTIVE', 'CHECKED_IN'] },
          validUntil: { gte: new Date() },
        },
      }),
      this.prisma.frontOfficeGatePass.count({
        where: {
          tenantId,
          checkInAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
    ]);

    const recent = await this.prisma.frontOfficeGatePass.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });

    return { visitorsInside, activePasses, checkedInToday, recent };
  }

  async scan(user: JwtUser, dto: KioskScanDto) {
    const pass = await this.gatePasses.lookupByScan(user.tid, dto.code);
    let action: 'CHECK_IN' | 'CHECK_OUT' | 'NONE' = 'NONE';

    if (pass.status === 'ACTIVE') action = 'CHECK_IN';
    else if (pass.status === 'CHECKED_IN') action = 'CHECK_OUT';

    if (dto.autoCheckIn && action === 'CHECK_IN') {
      const updated = await this.gatePasses.checkIn(user, pass.id);
      return {
        pass: updated,
        action: 'CHECKED_IN' as const,
        message: `${updated.visitorName} checked in`,
      };
    }
    if (dto.autoCheckIn && action === 'CHECK_OUT') {
      const updated = await this.gatePasses.checkOut(user, pass.id);
      return {
        pass: updated,
        action: 'CHECKED_OUT' as const,
        message: `${updated.visitorName} checked out`,
      };
    }

    return {
      pass,
      action,
      message: `Pass ${pass.passNumber} — ${pass.status}`,
    };
  }
}
