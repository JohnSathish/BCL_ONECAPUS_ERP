import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { MONTHLY_DEMAND_TYPE } from '../constants/monthly-fee.constants';
import { FeeFinanceSettingsService } from './fee-finance-settings.service';
import { FeeLedgerService } from './fee-ledger.service';
import { StudentFeeSummaryService } from './student-fee-summary.service';

@Injectable()
export class FeeFineEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: FeeFinanceSettingsService,
    private readonly ledger: FeeLedgerService,
    private readonly feeSummary: StudentFeeSummaryService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  /**
   * Remove outstanding late fines (e.g. when late fees are disabled in settings).
   * Reduces balance by the fine amount and posts a ledger credit waiver.
   */
  async clearOutstandingFines(tenantId: string, studentId?: string) {
    const demands = await this.db().studentFeeDemand.findMany({
      where: {
        tenantId,
        ...(studentId ? { studentId } : {}),
        fineAmount: { gt: 0 },
        status: { in: ['PUBLISHED', 'LOCKED', 'PARTIALLY_PAID'] },
      },
    });

    let updated = 0;
    const touchedStudents = new Set<string>();

    for (const demand of demands) {
      const fine = Number(demand.fineAmount ?? 0);
      if (fine <= 0) continue;

      const balance = Number(demand.balanceAmount ?? 0);
      const credit = Math.min(fine, Math.max(0, balance));
      const newBalance = Math.max(0, balance - credit);

      await this.db().studentFeeDemand.update({
        where: { id: demand.id },
        data: {
          fineAmount: 0,
          balanceAmount: newBalance,
        },
      });

      if (credit > 0) {
        await this.ledger.post({
          tenantId,
          studentId: demand.studentId,
          demandId: demand.id,
          entryType: 'REVERSAL',
          creditAmount: credit,
          referenceType: 'FINE_WAIVER',
          referenceId: demand.id,
          description: 'Late fee waived — late fees disabled in fee settings',
        });
      }

      updated += 1;
      touchedStudents.add(demand.studentId);
    }

    await Promise.all(
      [...touchedStudents].map((id) =>
        this.feeSummary.touchAfterPayment(tenantId, id),
      ),
    );

    return { updated, students: touchedStudents.size };
  }

  async accrueForTenant(tenantId: string) {
    const config = await this.settings.get(tenantId);
    if (!config.lateFeeEnabled || Number(config.lateFeeAmount) === 0) {
      // Keep balances aligned with policy when late fees are turned off.
      return this.clearOutstandingFines(tenantId);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const graceMs = (Number(config.lateFeeGraceDays) || 0) * 86400000;

    const demands = await this.db().studentFeeDemand.findMany({
      where: {
        tenantId,
        demandType: MONTHLY_DEMAND_TYPE,
        status: { in: ['PUBLISHED', 'LOCKED', 'PARTIALLY_PAID'] },
        balanceAmount: { gt: 0 },
        dueDate: { lt: today },
      },
    });

    let updated = 0;
    const touchedStudents = new Set<string>();
    for (const demand of demands) {
      const due = new Date(demand.dueDate);
      const daysLate = Math.floor(
        (today.getTime() - due.getTime() - graceMs) / 86400000,
      );
      if (daysLate <= 0) continue;

      const mode = String(config.lateFeeMode ?? 'PER_DAY').toUpperCase();
      const rate = Number(config.lateFeeAmount) || 10;
      let newFine = 0;
      if (mode === 'PER_DAY') newFine = daysLate * rate;
      else if (mode === 'PER_MONTH') newFine = rate;
      else newFine = rate;

      const prevFine = Number(demand.fineAmount ?? 0);
      if (newFine <= prevFine) continue;

      const delta = newFine - prevFine;
      const newBalance = Number(demand.balanceAmount) + delta;

      await this.db().studentFeeDemand.update({
        where: { id: demand.id },
        data: { fineAmount: newFine, balanceAmount: newBalance },
      });

      await this.ledger.post({
        tenantId,
        studentId: demand.studentId,
        demandId: demand.id,
        entryType: 'FINE',
        debitAmount: delta,
        referenceType: 'FINE',
        referenceId: demand.id,
        description: `Late fee — ${daysLate} day(s) overdue`,
      });
      updated += 1;
      touchedStudents.add(demand.studentId);
    }
    await Promise.all(
      [...touchedStudents].map((studentId) =>
        this.feeSummary.touchAfterPayment(tenantId, studentId),
      ),
    );
    return { updated };
  }
}
