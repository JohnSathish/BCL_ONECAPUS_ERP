import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import {
  CreatePensionEnrollmentDto,
  RecordPensionAccrualDto,
} from '../dto/pension.dto';

@Injectable()
export class PensionService {
  constructor(private readonly prisma: PrismaService) {}

  listEnrollments(tenantId: string, staffProfileId?: string) {
    return this.prisma.staffPensionEnrollment.findMany({
      where: {
        tenantId,
        ...(staffProfileId ? { staffProfileId } : {}),
      },
      include: {
        staffProfile: {
          select: {
            fullName: true,
            employeeCode: true,
            retirementDate: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { enrollmentDate: 'desc' },
    });
  }

  enroll(user: JwtUser, dto: CreatePensionEnrollmentDto) {
    return this.prisma.staffPensionEnrollment.upsert({
      where: {
        tenantId_staffProfileId_schemeType: {
          tenantId: user.tid,
          staffProfileId: dto.staffProfileId,
          schemeType: dto.schemeType,
        },
      },
      create: {
        tenantId: user.tid,
        staffProfileId: dto.staffProfileId,
        schemeType: dto.schemeType,
        enrollmentDate: new Date(dto.enrollmentDate),
        lastDrawnBasic: dto.lastDrawnBasic,
        familyPensionEligible: dto.familyPensionEligible ?? false,
      },
      update: {
        lastDrawnBasic: dto.lastDrawnBasic,
        familyPensionEligible: dto.familyPensionEligible,
        status: 'ACTIVE',
      },
    });
  }

  listLedger(tenantId: string, staffProfileId?: string, year?: number) {
    return this.prisma.pensionLedgerEntry.findMany({
      where: {
        tenantId,
        ...(staffProfileId ? { staffProfileId } : {}),
        ...(year ? { year } : {}),
      },
      include: {
        staffProfile: { select: { fullName: true, employeeCode: true } },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  recordAccrual(user: JwtUser, dto: RecordPensionAccrualDto) {
    return this.prisma.pensionLedgerEntry.create({
      data: {
        tenantId: user.tid,
        staffProfileId: dto.staffProfileId,
        month: dto.month,
        year: dto.year,
        accrualAmount: dto.accrualAmount,
        employerShare: dto.employerShare ?? 0,
        employeeShare: dto.employeeShare ?? 0,
        notes: dto.notes,
      },
    });
  }

  async projection(tenantId: string, staffProfileId: string) {
    const staff = await this.prisma.staffProfile.findFirst({
      where: { id: staffProfileId, tenantId, deletedAt: null },
      include: { payAssignments: { where: { status: 'ACTIVE' }, take: 1 } },
    });
    if (!staff) throw new NotFoundException('Staff not found');

    const enrollment = await this.prisma.staffPensionEnrollment.findFirst({
      where: { tenantId, staffProfileId, status: 'ACTIVE' },
    });

    const basic = Number(
      staff.payAssignments[0]?.basicPay ?? staff.basicPay ?? 0,
    );
    const ledger = await this.prisma.pensionLedgerEntry.findMany({
      where: { tenantId, staffProfileId },
    });
    const totalAccrued = ledger.reduce(
      (s, e) => s + Number(e.accrualAmount),
      0,
    );

    const retirementDate = staff.retirementDate;
    const monthsToRetirement = retirementDate
      ? Math.max(
          0,
          Math.ceil(
            (retirementDate.getTime() - Date.now()) / (30 * 24 * 3600 * 1000),
          ),
        )
      : null;

    const monthlyAccrual = basic * 0.1;
    const projectedTotal =
      totalAccrued +
      (monthsToRetirement != null ? monthlyAccrual * monthsToRetirement : 0);

    return {
      staff: {
        fullName: staff.fullName,
        employeeCode: staff.employeeCode,
        retirementDate: staff.retirementDate,
      },
      enrollment,
      currentBasic: basic,
      totalAccrued,
      monthlyAccrualEstimate: Math.round(monthlyAccrual),
      monthsToRetirement,
      projectedTotal: Math.round(projectedTotal),
      ledgerCount: ledger.length,
    };
  }

  dashboardStats(tenantId: string) {
    const now = new Date();
    const oneYear = new Date(now);
    oneYear.setFullYear(oneYear.getFullYear() + 1);

    return Promise.all([
      this.prisma.staffPensionEnrollment.count({
        where: { tenantId, status: 'ACTIVE' },
      }),
      this.prisma.staffProfile.count({
        where: {
          tenantId,
          deletedAt: null,
          status: 'ACTIVE',
          retirementDate: { lte: oneYear, gte: now },
        },
      }),
      this.prisma.pensionLedgerEntry.aggregate({
        where: { tenantId, year: now.getFullYear() },
        _sum: { accrualAmount: true },
      }),
    ]).then(([enrolled, retiringSoon, ytdAccrual]) => ({
      enrolled,
      retiringSoon,
      ytdAccrual: Number(ytdAccrual._sum.accrualAmount ?? 0),
    }));
  }
}
