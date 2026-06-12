import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { usesSalaryDeduction } from '../constants';

@Injectable()
export class LoansDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(tenantId: string) {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const activeLoans = await this.prisma.staffLoan.findMany({
      where: { tenantId, status: { in: ['ACTIVE', 'PAUSED'] } },
      include: {
        staffProfile: { select: { department: { select: { name: true } } } },
        loanTypeConfig: { select: { name: true, code: true } },
      },
    });

    const closedThisMonth = await this.prisma.staffLoan.count({
      where: {
        tenantId,
        status: { in: ['CLOSED', 'COMPLETED'] },
        closedAt: {
          gte: new Date(year, month - 1, 1),
          lt: new Date(year, month, 1),
        },
      },
    });

    const monthTx = await this.prisma.staffLoanTransaction.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        paymentDate: {
          gte: new Date(year, month - 1, 1),
          lt: new Date(year, month, 1),
        },
      },
    });

    const totalIssuedAgg = await this.prisma.staffLoan.aggregate({
      where: { tenantId },
      _sum: { principalAmount: true },
    });
    const totalIssued = Number(totalIssuedAgg._sum.principalAmount ?? 0);

    const outstanding = activeLoans.reduce(
      (s, l) => s + Number(l.balanceAmount),
      0,
    );
    const monthlyCollection = monthTx.reduce((s, t) => s + Number(t.amount), 0);

    const byType = new Map<
      string,
      { type: string; count: number; outstanding: number }
    >();
    for (const l of activeLoans) {
      const key = l.loanTypeConfig?.name ?? l.loanType;
      const cur = byType.get(key) ?? { type: key, count: 0, outstanding: 0 };
      cur.count += 1;
      cur.outstanding += Number(l.balanceAmount);
      byType.set(key, cur);
    }

    const byDept = new Map<
      string,
      { department: string; count: number; outstanding: number }
    >();
    for (const l of activeLoans) {
      const dept = l.staffProfile.department?.name ?? 'Unassigned';
      const cur = byDept.get(dept) ?? {
        department: dept,
        count: 0,
        outstanding: 0,
      };
      cur.count += 1;
      cur.outstanding += Number(l.balanceAmount);
      byDept.set(dept, cur);
    }

    const recentPayments = await this.prisma.staffLoanTransaction.findMany({
      where: { tenantId, status: 'ACTIVE' },
      include: {
        staffLoan: {
          include: {
            staffProfile: { select: { fullName: true, employeeCode: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const overdue = activeLoans.filter(
      (l) =>
        !l.paused &&
        l.expectedCloseDate &&
        l.expectedCloseDate < now &&
        Number(l.balanceAmount) > 0,
    ).length;

    const closingThisMonth = activeLoans.filter((l) => {
      if (!l.expectedCloseDate) return false;
      const d = l.expectedCloseDate;
      return d.getMonth() + 1 === month && d.getFullYear() === year;
    }).length;

    const recoveryTrend: Array<{
      month: number;
      year: number;
      amount: number;
    }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, month - 1 - i, 1);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
      const txs = await this.prisma.staffLoanTransaction.findMany({
        where: {
          tenantId,
          status: 'ACTIVE',
          paymentDate: { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) },
        },
      });
      recoveryTrend.push({
        month: m,
        year: y,
        amount: txs.reduce((s, t) => s + Number(t.amount), 0),
      });
    }

    return {
      totalActiveLoans: activeLoans.length,
      totalLoanAmountIssued: totalIssued,
      outstandingBalance: outstanding,
      monthlyCollection,
      overdueLoans: overdue,
      loansClosingThisMonth: closingThisMonth,
      closedThisMonth,
      loanDistributionByType: Array.from(byType.values()),
      departmentWise: Array.from(byDept.values()).sort(
        (a, b) => b.outstanding - a.outstanding,
      ),
      monthlyRecoveryTrend: recoveryTrend,
      recentPayments: recentPayments.map((t) => ({
        id: t.id,
        amount: Number(t.amount),
        transactionType: t.transactionType,
        paymentDate: t.paymentDate,
        staffName: t.staffLoan.staffProfile.fullName,
        employeeCode: t.staffLoan.staffProfile.employeeCode,
        loanNumber: t.staffLoan.loanNumber,
      })),
      salaryDeductionLoans: activeLoans.filter((l) =>
        usesSalaryDeduction(l.repaymentMethod),
      ).length,
      cashCollectionLoans: activeLoans.filter((l) =>
        ['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE'].includes(l.repaymentMethod),
      ).length,
    };
  }
}
