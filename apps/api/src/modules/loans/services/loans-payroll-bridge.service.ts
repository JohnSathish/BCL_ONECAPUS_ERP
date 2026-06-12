import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../database/prisma.service';

import { usesSalaryDeduction } from '../constants';

import { LoansReceiptService } from './loans-receipt.service';

@Injectable()
export class LoansPayrollBridgeService {
  constructor(
    private readonly prisma: PrismaService,

    private readonly receipts: LoansReceiptService,
  ) {}

  /** Sum salary deductions across all active, non-paused loans for a staff member. */

  async getActiveDeduction(
    tenantId: string,

    staffProfileId: string,

    month: number,

    year: number,
  ): Promise<number> {
    const periodStart = new Date(year, month - 1, 1);

    const loans = await this.prisma.staffLoan.findMany({
      where: {
        tenantId,

        staffProfileId,

        status: 'ACTIVE',

        paused: false,

        balanceAmount: { gt: 0 },

        OR: [
          { repaymentStartDate: null },
          { repaymentStartDate: { lte: periodStart } },
        ],
      },
    });

    let total = 0;

    for (const loan of loans) {
      if (!usesSalaryDeduction(loan.repaymentMethod)) continue;

      const deduction = Number(
        loan.salaryDeductionAmount ?? loan.monthlyDeduction,
      );

      if (deduction <= 0) continue;

      total += Math.min(deduction, Number(loan.balanceAmount));
    }

    return total;
  }

  async markRecovered(
    tenantId: string,

    staffProfileId: string,

    month: number,

    year: number,

    payrollRunId: string,

    payslipId: string,
  ) {
    const periodStart = new Date(year, month - 1, 1);

    const paymentDate = new Date(year, month - 1, 1);

    const loans = await this.prisma.staffLoan.findMany({
      where: {
        tenantId,

        staffProfileId,

        status: 'ACTIVE',

        paused: false,

        balanceAmount: { gt: 0 },

        OR: [
          { repaymentStartDate: null },
          { repaymentStartDate: { lte: periodStart } },
        ],
      },
    });

    for (const loan of loans) {
      if (!usesSalaryDeduction(loan.repaymentMethod)) continue;

      const already = await this.prisma.staffLoanTransaction.findFirst({
        where: {
          tenantId,
          staffLoanId: loan.id,
          payrollRunId,
          status: 'ACTIVE',
        },
      });

      if (already) continue;

      const deduction = Number(
        loan.salaryDeductionAmount ?? loan.monthlyDeduction,
      );

      if (deduction <= 0) continue;

      const amount = Math.min(deduction, Number(loan.balanceAmount));

      if (amount <= 0) continue;

      const recoveredBefore = Number(loan.totalRecovered);

      const newBalance = Number(loan.balanceAmount) - amount;

      const newRecovered = recoveredBefore + amount;

      const closed = newBalance <= 0;

      const receiptNumber = `PAYROLL-${year}-${String(month).padStart(2, '0')}-${loan.loanNumber}`;

      await this.prisma.staffLoanTransaction.create({
        data: {
          tenantId,

          staffLoanId: loan.id,

          transactionType: 'SALARY_DEDUCTION',

          amount,

          paymentDate,

          receiptNumber,

          payrollRunId,

          payslipId,

          remarks: `Auto Payroll — ${month}/${year}`,

          recoveredBefore,

          recoveredAfter: newRecovered,

          outstandingAfter: Math.max(0, newBalance),

          status: 'ACTIVE',
        },
      });

      await this.prisma.staffLoan.update({
        where: { id: loan.id },

        data: {
          balanceAmount: Math.max(0, newBalance),

          totalRecovered: newRecovered,

          paidInstallments: loan.paidInstallments + 1,

          status: closed ? 'CLOSED' : 'ACTIVE',

          closedAt: closed ? new Date() : null,
        },
      });

      if (closed) {
        try {
          await this.receipts.generateClosureCertificate(tenantId, loan.id);
        } catch {
          // best-effort
        }
      }

      const inst = await this.prisma.staffLoanInstallment.findFirst({
        where: {
          tenantId,

          staffLoanId: loan.id,

          dueMonth: month,

          dueYear: year,

          status: 'PENDING',
        },
      });

      if (inst) {
        await this.prisma.staffLoanInstallment.update({
          where: { id: inst.id },

          data: {
            status: 'RECOVERED',

            recoveredAmount: amount,

            recoveredAt: new Date(),

            payrollRunId,

            payslipId,
          },
        });
      }
    }
  }

  async unmarkRecoveredForRun(tenantId: string, payrollRunId: string) {
    const txs = await this.prisma.staffLoanTransaction.findMany({
      where: {
        tenantId,

        payrollRunId,

        transactionType: 'SALARY_DEDUCTION',

        status: 'ACTIVE',
      },

      include: { staffLoan: true },
    });

    for (const tx of txs) {
      const amount = Number(tx.amount);

      const loan = tx.staffLoan;

      await this.prisma.staffLoanTransaction.update({
        where: { id: tx.id },

        data: {
          status: 'CANCELLED',

          cancelledAt: new Date(),

          cancellationReason: `Payroll run ${payrollRunId} reversed`,
        },
      });

      await this.prisma.staffLoan.update({
        where: { id: loan.id },

        data: {
          balanceAmount: Number(loan.balanceAmount) + amount,

          totalRecovered: Math.max(0, Number(loan.totalRecovered) - amount),

          paidInstallments: Math.max(0, loan.paidInstallments - 1),

          status: 'ACTIVE',

          closedAt: null,

          closureCertificateUrl: null,
        },
      });

      await this.prisma.staffLoanAuditLog.create({
        data: {
          tenantId,

          staffLoanId: loan.id,

          action: 'PAYROLL_DEDUCTION_REVERSED',

          oldValue: { transactionId: tx.id, amount, payrollRunId },

          newValue: { reason: 'Payroll run reopened' },
        },
      });
    }

    await this.prisma.staffLoanInstallment.updateMany({
      where: { tenantId, payrollRunId, status: 'RECOVERED' },

      data: {
        status: 'PENDING',

        recoveredAmount: 0,

        recoveredAt: null,

        payrollRunId: null,

        payslipId: null,
      },
    });
  }
}
