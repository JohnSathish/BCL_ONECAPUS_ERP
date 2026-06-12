import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { CreateMonthlyChargeDto } from '../dto/accommodation.dto';
import { AccommodationAuditService } from './accommodation-audit.service';

@Injectable()
export class QuarterChargesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AccommodationAuditService,
  ) {}

  list(
    tenantId: string,
    query: {
      month?: number;
      year?: number;
      status?: string;
      staffProfileId?: string;
    },
  ) {
    return this.prisma.quarterMonthlyCharge.findMany({
      where: {
        tenantId,
        ...(query.month ? { billingMonth: query.month } : {}),
        ...(query.year ? { billingYear: query.year } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.staffProfileId
          ? { staffProfileId: query.staffProfileId }
          : {}),
      },
      include: {
        quarter: { select: { code: true, quarterNumber: true } },
        staffProfile: { select: { fullName: true, employeeCode: true } },
      },
      orderBy: [
        { billingYear: 'desc' },
        { billingMonth: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async create(user: JwtUser, dto: CreateMonthlyChargeDto) {
    const [quarter, staff] = await Promise.all([
      this.prisma.staffQuarter.findFirst({
        where: { id: dto.quarterId, tenantId: user.tid, deletedAt: null },
      }),
      this.prisma.staffProfile.findFirst({
        where: { id: dto.staffProfileId, tenantId: user.tid, deletedAt: null },
      }),
    ]);
    if (!quarter) throw new NotFoundException('Quarter not found');
    if (!staff) throw new NotFoundException('Staff member not found');

    const occupancy = await this.prisma.quarterOccupancy.findFirst({
      where: {
        tenantId: user.tid,
        quarterId: dto.quarterId,
        staffProfileId: dto.staffProfileId,
        status: 'ACTIVE',
      },
    });
    if (!occupancy) {
      throw new BadRequestException(
        'No active occupancy for this staff and quarter',
      );
    }

    const charge = await this.prisma.quarterMonthlyCharge.create({
      data: {
        tenantId: user.tid,
        quarterId: dto.quarterId,
        staffProfileId: dto.staffProfileId,
        occupancyId: occupancy.id,
        chargeType: dto.chargeType,
        billingMonth: dto.billingMonth,
        billingYear: dto.billingYear,
        amount: dto.amount,
        remarks: dto.remarks?.trim() || null,
        createdById: user.sub,
      },
      include: {
        quarter: { select: { code: true, quarterNumber: true } },
        staffProfile: { select: { fullName: true, employeeCode: true } },
      },
    });

    await this.audit.log(
      user.tid,
      'CHARGE',
      charge.id,
      'CHARGE_ADDED',
      user.sub,
      null,
      charge,
    );
    return charge;
  }

  async remove(user: JwtUser, id: string) {
    const charge = await this.prisma.quarterMonthlyCharge.findFirst({
      where: { id, tenantId: user.tid },
    });
    if (!charge) throw new NotFoundException('Charge not found');
    if (charge.status === 'RECOVERED') {
      throw new BadRequestException(
        'Cannot remove a charge already recovered in payroll',
      );
    }
    await this.prisma.quarterMonthlyCharge.delete({ where: { id } });
    await this.audit.log(
      user.tid,
      'CHARGE',
      id,
      'CHARGE_REMOVED',
      user.sub,
      charge,
      null,
    );
    return { deleted: true };
  }
}
