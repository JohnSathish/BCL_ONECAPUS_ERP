import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { MONTHLY_DEMAND_TYPE } from '../constants/monthly-fee.constants';
import { isFeeCycleTriggerSemester } from '../constants/fee-cycle.constants';
import { FeeFinanceSettingsService } from './fee-finance-settings.service';

export type FeeEnforcementContext =
  | 'HALL_TICKET'
  | 'REGISTRATION'
  | 'EXAM_REGISTRATION';

@Injectable()
export class FeeEnforcementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: FeeFinanceSettingsService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async checkFeesClear(
    tenantId: string,
    studentId: string,
    context: FeeEnforcementContext,
  ) {
    const config = await this.settings.get(tenantId);
    if (context === 'HALL_TICKET' && !config.blockHallTicketOnDue) {
      return { blocked: false, outstandingAmount: 0, reasons: [] };
    }
    if (context === 'REGISTRATION' && !config.blockRegistrationOnDue) {
      return { blocked: false, outstandingAmount: 0, reasons: [] };
    }

    const reasons: string[] = [];
    let outstandingAmount = 0;

    const standing = await this.db().studentAcademicStanding.findUnique({
      where: { studentId },
      select: { currentSemesterSequence: true },
    });
    const sem = standing?.currentSemesterSequence ?? 1;

    if (isFeeCycleTriggerSemester(sem) || sem === 1) {
      const cycleStart = sem % 2 === 0 ? sem - 1 : sem;
      const cycle = await this.db().academicFeeCycle.findFirst({
        where: {
          tenantId,
          deletedAt: null,
          status: 'ACTIVE',
          startSemester: cycleStart,
        },
      });
      if (cycle) {
        const admissionDemand = await this.db().studentFeeDemand.findFirst({
          where: {
            tenantId,
            studentId,
            feeCycleId: cycle.id,
            status: { notIn: ['CANCELLED', 'ROLLED_BACK'] },
          },
        });
        if (admissionDemand && Number(admissionDemand.balanceAmount) > 0) {
          const amt = Number(admissionDemand.balanceAmount);
          outstandingAmount += amt;
          reasons.push(
            `Admission & Session fee (${cycle.name}): ₹${amt} outstanding`,
          );
        } else if (!admissionDemand) {
          reasons.push(
            `Admission & Session fee (${cycle.name}) not yet generated/paid`,
          );
          outstandingAmount += Number(cycle.totalAmount);
        }
      }
    }

    const monthlyDue = await this.db().studentFeeDemand.findMany({
      where: {
        tenantId,
        studentId,
        demandType: MONTHLY_DEMAND_TYPE,
        status: { in: ['PUBLISHED', 'LOCKED', 'PARTIALLY_PAID'] },
        balanceAmount: { gt: 0 },
      },
      orderBy: { billingPeriod: 'asc' },
    });

    for (const d of monthlyDue) {
      const amt = Number(d.balanceAmount);
      outstandingAmount += amt;
      reasons.push(`Monthly fee ${d.billingPeriod}: ₹${amt} outstanding`);
    }

    const examDue = await this.db().studentFeeDemand.findMany({
      where: {
        tenantId,
        studentId,
        demandType: 'EXAM_FEE',
        balanceAmount: { gt: 0 },
        status: { notIn: ['CANCELLED', 'ROLLED_BACK'] },
      },
    });
    for (const d of examDue) {
      const amt = Number(d.balanceAmount);
      outstandingAmount += amt;
      reasons.push(`Exam fee: ₹${amt} outstanding`);
    }

    return {
      blocked: reasons.length > 0,
      outstandingAmount,
      reasons,
      context,
    };
  }

  async assertFeesClear(
    tenantId: string,
    studentId: string,
    context: FeeEnforcementContext,
  ) {
    return this.checkFeesClear(tenantId, studentId, context);
  }
}
