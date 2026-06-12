import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  ACCOMMODATION_COMPONENT_CODES,
  CHARGE_TYPE_TO_COMPONENT,
} from '../constants';

export type AccommodationDeductionLine = {
  code: string;
  name: string;
  amount: number;
  componentId?: string;
  sortOrder: number;
};

@Injectable()
export class AccommodationPayrollBridgeService {
  constructor(private readonly prisma: PrismaService) {}

  async getDeductionsForStaff(
    tenantId: string,
    staffProfileId: string,
    month: number,
    year: number,
  ): Promise<AccommodationDeductionLine[]> {
    const occupancy = await this.prisma.quarterOccupancy.findFirst({
      where: {
        tenantId,
        staffProfileId,
        status: 'ACTIVE',
        payrollDeductionEnabled: true,
      },
      include: { quarter: true },
    });
    if (!occupancy) return [];

    const proration = this.prorationFactor(
      occupancy.allottedAt,
      occupancy.vacatedAt,
      month,
      year,
    );
    if (proration <= 0) return [];

    const components = await this.prisma.paySalaryComponent.findMany({
      where: {
        tenantId,
        code: { in: Object.values(ACCOMMODATION_COMPONENT_CODES) },
        deletedAt: null,
        isActive: true,
      },
    });
    const compMap = new Map(components.map((c) => [c.code, c]));

    const lines: AccommodationDeductionLine[] = [];
    const baseCharges = [
      {
        code: ACCOMMODATION_COMPONENT_CODES.QUARTER_RENT,
        amount: Number(occupancy.monthlyRent),
      },
      {
        code: ACCOMMODATION_COMPONENT_CODES.ACCOM_WATER,
        amount: Number(occupancy.waterCharge),
      },
      {
        code: ACCOMMODATION_COMPONENT_CODES.ACCOM_ELECTRICITY,
        amount: Number(occupancy.electricityCharge),
      },
      {
        code: ACCOMMODATION_COMPONENT_CODES.ACCOM_MAINTENANCE,
        amount: Number(occupancy.maintenanceCharge),
      },
      {
        code: ACCOMMODATION_COMPONENT_CODES.ACCOM_INTERNET,
        amount: Number(occupancy.internetCharge),
      },
    ];

    for (const bc of baseCharges) {
      if (bc.amount <= 0) continue;
      const comp = compMap.get(bc.code);
      lines.push({
        code: bc.code,
        name: comp?.name ?? bc.code,
        amount: Math.round(bc.amount * proration * 100) / 100,
        componentId: comp?.id,
        sortOrder: comp?.sortOrder ?? 120,
      });
    }

    const monthlyCharges = await this.prisma.quarterMonthlyCharge.findMany({
      where: {
        tenantId,
        staffProfileId,
        billingMonth: month,
        billingYear: year,
        status: 'PENDING',
      },
    });

    const extraByCode = new Map<string, number>();
    for (const ch of monthlyCharges) {
      const code =
        CHARGE_TYPE_TO_COMPONENT[ch.chargeType] ??
        ACCOMMODATION_COMPONENT_CODES.ACCOM_MAINTENANCE;
      extraByCode.set(code, (extraByCode.get(code) ?? 0) + Number(ch.amount));
    }

    for (const [code, amount] of extraByCode) {
      const existing = lines.find((l) => l.code === code);
      if (existing) {
        existing.amount = Math.round((existing.amount + amount) * 100) / 100;
      } else {
        const comp = compMap.get(code);
        lines.push({
          code,
          name: comp?.name ?? code,
          amount: Math.round(amount * 100) / 100,
          componentId: comp?.id,
          sortOrder: comp?.sortOrder ?? 120,
        });
      }
    }

    return lines.filter((l) => l.amount > 0);
  }

  async markChargesRecovered(
    tenantId: string,
    staffProfileId: string,
    month: number,
    year: number,
    payrollRunId: string,
    payslipId: string,
  ) {
    await this.prisma.quarterMonthlyCharge.updateMany({
      where: {
        tenantId,
        staffProfileId,
        billingMonth: month,
        billingYear: year,
        status: 'PENDING',
      },
      data: { status: 'RECOVERED', payrollRunId, payslipId },
    });
  }

  private prorationFactor(
    allottedAt: Date,
    vacatedAt: Date | null,
    month: number,
    year: number,
  ): number {
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0);
    const start = allottedAt > periodStart ? allottedAt : periodStart;
    const end = vacatedAt && vacatedAt < periodEnd ? vacatedAt : periodEnd;
    if (end < start) return 0;
    const daysInMonth = periodEnd.getDate();
    const occupiedDays =
      Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
    return Math.min(1, Math.max(0, occupiedDays / daysInMonth));
  }
}
