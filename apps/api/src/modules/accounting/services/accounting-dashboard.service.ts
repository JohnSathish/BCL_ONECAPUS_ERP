import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AccountingBootstrapService } from './accounting-bootstrap.service';
import { FinancialYearService } from './financial-year.service';

@Injectable()
export class AccountingDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bootstrap: AccountingBootstrapService,
    private readonly financialYear: FinancialYearService,
  ) {}

  async summary(tenantId: string) {
    return this.overview(tenantId);
  }

  async overview(tenantId: string) {
    await this.bootstrap.ensureTenantSetup(tenantId);
    const fy = await this.financialYear.getActive(tenantId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const incomeGroupIds = await this.groupIdsByNature(tenantId, 'INCOME');
    const expenseGroupIds = await this.groupIdsByNature(tenantId, 'EXPENSE');
    const liabilityGroupIds = await this.groupIdsByNature(
      tenantId,
      'LIABILITY',
    );
    const assetGroupIds = await this.groupIdsByNature(tenantId, 'ASSET');

    const [
      cashLedgers,
      bankLedgers,
      receivableLedgers,
      payableLedgers,
      budgets,
      todayPayments,
      yesterdayPayments,
      feeDemands,
      draftExpenses,
      draftVouchers,
      vendorDraftExpenses,
      openRecos,
      recentPostings,
    ] = await Promise.all([
      this.prisma.accountingLedgerAccount.findMany({
        where: { tenantId, isCash: true, isActive: true },
      }),
      this.prisma.accountingLedgerAccount.findMany({
        where: { tenantId, isBank: true, isActive: true },
      }),
      this.prisma.accountingLedgerAccount.findMany({
        where: {
          tenantId,
          isActive: true,
          groupId: { in: assetGroupIds },
          OR: [
            { code: { contains: 'RECEIV', mode: 'insensitive' } },
            { name: { contains: 'receiv', mode: 'insensitive' } },
          ],
        },
      }),
      this.prisma.accountingLedgerAccount.findMany({
        where: { tenantId, isActive: true, groupId: { in: liabilityGroupIds } },
      }),
      this.prisma.accountingBudget.findMany({
        where: { tenantId, financialYearId: fy.id },
        include: { ledgerAccount: true },
      }),
      this.prisma.paymentTransaction.findMany({
        where: {
          tenantId,
          status: 'SUCCESS',
          paidAt: { gte: today, lt: tomorrow },
        },
      }),
      this.prisma.paymentTransaction.findMany({
        where: {
          tenantId,
          status: 'SUCCESS',
          paidAt: { gte: yesterday, lt: today },
        },
      }),
      this.prisma.studentFeeDemand.findMany({
        where: { tenantId },
        select: { studentId: true, balanceAmount: true },
      }),
      this.prisma.accountingExpense.count({
        where: { tenantId, status: 'DRAFT' },
      }),
      this.prisma.accountingVoucher.count({
        where: { tenantId, status: 'DRAFT' },
      }),
      this.prisma.accountingExpense.count({
        where: { tenantId, status: 'DRAFT', vendorId: { not: null } },
      }),
      this.prisma.accountingBankReconciliation.findMany({
        where: { tenantId, status: 'DRAFT' },
        include: { lines: true },
      }),
      this.prisma.accountingLedgerPosting.findMany({
        where: { tenantId },
        orderBy: [{ voucherDate: 'desc' }, { createdAt: 'desc' }],
        take: 12,
        include: {
          ledgerAccount: true,
          voucher: { include: { voucherType: true } },
        },
      }),
    ]);

    const [
      todayIncome,
      todayExpense,
      monthIncome,
      monthExpense,
      todayExpenseLines,
      monthTrend,
      feeTrend,
      expenseDistribution,
    ] = await Promise.all([
      this.sumNaturePostings(tenantId, incomeGroupIds, today, tomorrow),
      this.sumNaturePostings(tenantId, expenseGroupIds, today, tomorrow),
      this.sumNaturePostings(tenantId, incomeGroupIds, monthStart, tomorrow),
      this.sumNaturePostings(tenantId, expenseGroupIds, monthStart, tomorrow),
      this.expenseLinesToday(tenantId, expenseGroupIds, today, tomorrow),
      this.monthlyIncomeExpenseTrend(
        tenantId,
        incomeGroupIds,
        expenseGroupIds,
        6,
      ),
      this.monthlyFeeTrend(tenantId, 6),
      this.expenseDistribution(tenantId, expenseGroupIds, monthStart, tomorrow),
    ]);

    const cashInHand = cashLedgers.reduce(
      (sum, l) => sum + Number(l.currentBalance),
      0,
    );
    const bankBalance = bankLedgers.reduce(
      (sum, l) => sum + Number(l.currentBalance),
      0,
    );
    const totalReceivables = receivableLedgers.reduce(
      (sum, l) => sum + Math.max(Number(l.currentBalance), 0),
      0,
    );
    const totalPayables = payableLedgers.reduce(
      (sum, l) => sum + Math.abs(Number(l.currentBalance)),
      0,
    );

    const todayCollection = todayPayments.reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );
    const yesterdayCollection = yesterdayPayments.reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );
    const todayCollectionChangePct =
      yesterdayCollection > 0
        ? Math.round(
            ((todayCollection - yesterdayCollection) / yesterdayCollection) *
              1000,
          ) / 10
        : todayCollection > 0
          ? 100
          : 0;

    const studentsPaidToday = new Set(todayPayments.map((p) => p.studentId))
      .size;
    const pendingFee = feeDemands.reduce(
      (sum, d) => sum + Number(d.balanceAmount),
      0,
    );
    const defaulters = new Set(
      feeDemands
        .filter((d) => Number(d.balanceAmount) > 0)
        .map((d) => d.studentId),
    ).size;

    const cashPosition = await this.dayBookSummary(
      tenantId,
      cashLedgers.map((l) => l.id),
      today,
      tomorrow,
    );
    const bankPosition = await this.dayBookSummary(
      tenantId,
      bankLedgers.map((l) => l.id),
      today,
      tomorrow,
    );

    const departmentBudgets = await this.budgetUtilizationRows(
      tenantId,
      fy.id,
      budgets,
    );

    const budgetUtilization = departmentBudgets.length
      ? Math.round(
          (departmentBudgets.reduce((s, b) => s + b.utilizationPct, 0) /
            departmentBudgets.length) *
            10,
        ) / 10
      : 0;
    const budgetsExceeded = departmentBudgets.filter(
      (b) => b.utilizationPct >= 100,
    ).length;

    let matchedLines = 0;
    let unmatchedLines = 0;
    for (const reco of openRecos) {
      for (const line of reco.lines) {
        if (line.matchStatus === 'MATCHED') matchedLines += 1;
        else if (line.matchStatus === 'UNMATCHED') unmatchedLines += 1;
      }
    }

    const journalDrafts = await this.prisma.accountingVoucher.count({
      where: {
        tenantId,
        status: 'DRAFT',
        voucherType: { code: 'JOURNAL' },
      },
    });

    const alerts = this.buildAlerts({
      cashInHand,
      departmentBudgets,
      defaulters,
      draftExpenses,
      draftVouchers,
    });

    const recentTransactions = recentPostings.map((posting) => ({
      id: posting.id,
      time: posting.createdAt,
      voucherNo: posting.voucher.voucherNo,
      voucherType: posting.voucher.voucherType.code,
      ledgerName: posting.ledgerAccount.name,
      debit: posting.entryType === 'DEBIT' ? Number(posting.amount) : 0,
      credit: posting.entryType === 'CREDIT' ? Number(posting.amount) : 0,
      narration: posting.narration ?? posting.voucher.narration,
    }));

    return {
      financialYear: fy,
      summary: {
        todayCollection,
        todayCollectionChangePct,
        cashInHand,
        bankBalance,
        todayExpenses: todayExpense,
        outstandingReceivables: totalReceivables,
        outstandingPayables: totalPayables,
        budgetUtilization,
        financialYearLabel: fy.label,
      },
      charts: {
        incomeVsExpense: monthTrend,
        feeCollectionTrend: feeTrend,
        expenseDistribution,
      },
      cashPosition: {
        cash: cashPosition,
        bank: bankPosition,
      },
      feeCollection: {
        totalCollectedToday: todayCollection,
        studentsPaidToday,
        pendingFee,
        defaulters,
      },
      todayExpenses: todayExpenseLines,
      departmentBudgets,
      bankReconciliation: {
        pendingSessions: openRecos.length,
        matched: matchedLines,
        unmatched: unmatchedLines,
      },
      approvalQueue: {
        expenseApproval: draftExpenses,
        voucherApproval: draftVouchers,
        vendorBills: vendorDraftExpenses,
        journalApproval: journalDrafts,
      },
      alerts,
      recentTransactions,
      todayIncome,
      todayExpense,
      cashInHand,
      bankBalance,
      totalReceivables,
      totalPayables,
      monthIncome,
      monthExpense,
      fundBalance: cashInHand + bankBalance,
      budgetUtilization,
      budgetsExceeded,
      pendingApprovals: draftVouchers + draftExpenses,
      pendingApprovalsCount: draftVouchers + draftExpenses,
    };
  }

  private async dayBookSummary(
    tenantId: string,
    ledgerIds: string[],
    fromDate: Date,
    toDate: Date,
  ) {
    if (!ledgerIds.length) {
      return {
        openingBalance: 0,
        receipts: 0,
        payments: 0,
        closingBalance: 0,
      };
    }

    const ledgers = await this.prisma.accountingLedgerAccount.findMany({
      where: { id: { in: ledgerIds } },
    });
    const openingBalance = ledgers.reduce(
      (sum, l) => sum + Number(l.openingBalance),
      0,
    );

    const priorAgg = await this.prisma.accountingLedgerPosting.groupBy({
      by: ['entryType'],
      where: {
        tenantId,
        ledgerAccountId: { in: ledgerIds },
        voucherDate: { lt: fromDate },
      },
      _sum: { amount: true },
    });

    let priorNet = openingBalance;
    for (const row of priorAgg) {
      const amount = Number(row._sum.amount ?? 0);
      if (row.entryType === 'DEBIT') priorNet += amount;
      else priorNet -= amount;
    }

    const todayAgg = await this.prisma.accountingLedgerPosting.groupBy({
      by: ['entryType'],
      where: {
        tenantId,
        ledgerAccountId: { in: ledgerIds },
        voucherDate: { gte: fromDate, lt: toDate },
      },
      _sum: { amount: true },
    });

    let receipts = 0;
    let payments = 0;
    for (const row of todayAgg) {
      const amount = Number(row._sum.amount ?? 0);
      if (row.entryType === 'DEBIT') receipts += amount;
      else payments += amount;
    }

    return {
      openingBalance: Math.round(priorNet * 100) / 100,
      receipts: Math.round(receipts * 100) / 100,
      payments: Math.round(payments * 100) / 100,
      closingBalance: Math.round((priorNet + receipts - payments) * 100) / 100,
    };
  }

  private async expenseLinesToday(
    tenantId: string,
    expenseGroupIds: string[],
    from: Date,
    to: Date,
  ) {
    if (!expenseGroupIds.length) return [];

    const ledgers = await this.prisma.accountingLedgerAccount.findMany({
      where: { tenantId, groupId: { in: expenseGroupIds }, isActive: true },
    });

    const rows: Array<{ name: string; amount: number }> = [];
    for (const ledger of ledgers) {
      const agg = await this.prisma.accountingLedgerPosting.aggregate({
        where: {
          tenantId,
          ledgerAccountId: ledger.id,
          entryType: 'DEBIT',
          voucherDate: { gte: from, lt: to },
        },
        _sum: { amount: true },
      });
      const amount = Number(agg._sum.amount ?? 0);
      if (amount <= 0) continue;
      rows.push({ name: ledger.name, amount });
    }

    return rows.sort((a, b) => b.amount - a.amount).slice(0, 8);
  }

  private async monthlyIncomeExpenseTrend(
    tenantId: string,
    incomeGroupIds: string[],
    expenseGroupIds: string[],
    months: number,
  ) {
    const incomeLedgerIds = await this.ledgerIdsForGroups(
      tenantId,
      incomeGroupIds,
    );
    const expenseLedgerIds = await this.ledgerIdsForGroups(
      tenantId,
      expenseGroupIds,
    );
    const today = new Date();
    const points: Array<{ label: string; income: number; expense: number }> =
      [];

    for (let i = months - 1; i >= 0; i -= 1) {
      const start = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const end = new Date(today.getFullYear(), today.getMonth() - i + 1, 1);
      const label = start.toLocaleDateString('en-IN', {
        month: 'short',
      });

      const [incomeAgg, expenseAgg] = await Promise.all([
        incomeLedgerIds.length
          ? this.prisma.accountingLedgerPosting.aggregate({
              where: {
                tenantId,
                ledgerAccountId: { in: incomeLedgerIds },
                voucherDate: { gte: start, lt: end },
              },
              _sum: { amount: true },
            })
          : Promise.resolve({ _sum: { amount: 0 } }),
        expenseLedgerIds.length
          ? this.prisma.accountingLedgerPosting.aggregate({
              where: {
                tenantId,
                ledgerAccountId: { in: expenseLedgerIds },
                voucherDate: { gte: start, lt: end },
              },
              _sum: { amount: true },
            })
          : Promise.resolve({ _sum: { amount: 0 } }),
      ]);

      points.push({
        label,
        income: Number(incomeAgg._sum.amount ?? 0),
        expense: Number(expenseAgg._sum.amount ?? 0),
      });
    }

    return points;
  }

  private async monthlyFeeTrend(tenantId: string, months: number) {
    const today = new Date();
    const points: Array<{ label: string; amount: number }> = [];

    for (let i = months - 1; i >= 0; i -= 1) {
      const start = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const end = new Date(today.getFullYear(), today.getMonth() - i + 1, 1);
      const label = start.toLocaleDateString('en-IN', { month: 'short' });

      const agg = await this.prisma.paymentTransaction.aggregate({
        where: {
          tenantId,
          status: 'SUCCESS',
          paidAt: { gte: start, lt: end },
        },
        _sum: { amount: true },
      });

      points.push({
        label,
        amount: Number(agg._sum.amount ?? 0),
      });
    }

    return points;
  }

  private async expenseDistribution(
    tenantId: string,
    expenseGroupIds: string[],
    from: Date,
    to: Date,
  ) {
    const lines = await this.expenseLinesToday(
      tenantId,
      expenseGroupIds,
      from,
      to,
    );
    const monthLines =
      lines.length > 0
        ? lines
        : await this.expenseLinesForPeriod(tenantId, expenseGroupIds, from, to);

    const total = monthLines.reduce((sum, row) => sum + row.amount, 0) || 1;
    return monthLines.slice(0, 6).map((row) => ({
      label: row.name,
      value: row.amount,
      pct: Math.round((row.amount / total) * 1000) / 10,
    }));
  }

  private async expenseLinesForPeriod(
    tenantId: string,
    expenseGroupIds: string[],
    from: Date,
    to: Date,
  ) {
    if (!expenseGroupIds.length) return [];
    const ledgers = await this.prisma.accountingLedgerAccount.findMany({
      where: { tenantId, groupId: { in: expenseGroupIds }, isActive: true },
    });
    const rows: Array<{ name: string; amount: number }> = [];
    for (const ledger of ledgers) {
      const agg = await this.prisma.accountingLedgerPosting.aggregate({
        where: {
          tenantId,
          ledgerAccountId: ledger.id,
          entryType: 'DEBIT',
          voucherDate: { gte: from, lt: to },
        },
        _sum: { amount: true },
      });
      const amount = Number(agg._sum.amount ?? 0);
      if (amount <= 0) continue;
      rows.push({ name: ledger.name, amount });
    }
    return rows.sort((a, b) => b.amount - a.amount);
  }

  private async budgetUtilizationRows(
    tenantId: string,
    financialYearId: string,
    budgets: Array<{
      id: string;
      departmentId: string | null;
      ledgerAccountId: string;
      allocatedAmount: unknown;
      notes: string | null;
      ledgerAccount: { name: string };
    }>,
  ) {
    const departmentIds = budgets
      .map((b) => b.departmentId)
      .filter((id): id is string => Boolean(id));
    const departments = departmentIds.length
      ? await this.prisma.department.findMany({
          where: { tenantId, id: { in: departmentIds } },
        })
      : [];
    const deptMap = new Map(departments.map((d) => [d.id, d.name]));

    const rows = await Promise.all(
      budgets.map(async (budget) => {
        const spentAgg = await this.prisma.accountingLedgerPosting.aggregate({
          where: {
            tenantId,
            ledgerAccountId: budget.ledgerAccountId,
            financialYearId,
            entryType: 'DEBIT',
          },
          _sum: { amount: true },
        });
        const spent = Number(spentAgg._sum.amount ?? 0);
        const allocated = Number(budget.allocatedAmount);
        const utilizationPct =
          allocated > 0 ? Math.round((spent / allocated) * 1000) / 10 : 0;

        return {
          id: budget.id,
          name:
            (budget.departmentId && deptMap.get(budget.departmentId)) ||
            budget.notes ||
            budget.ledgerAccount.name,
          allocated,
          spent,
          utilizationPct,
        };
      }),
    );

    return rows.sort((a, b) => b.utilizationPct - a.utilizationPct).slice(0, 8);
  }

  private buildAlerts(input: {
    cashInHand: number;
    departmentBudgets: Array<{ name: string; utilizationPct: number }>;
    defaulters: number;
    draftExpenses: number;
    draftVouchers: number;
  }) {
    const alerts: Array<{ level: string; title: string; message: string }> = [];

    for (const budget of input.departmentBudgets) {
      if (budget.utilizationPct >= 90) {
        alerts.push({
          level: 'warning',
          title: `${budget.name} budget almost exhausted`,
          message: `${budget.utilizationPct}% of allocated budget used`,
        });
      }
    }

    if (input.cashInHand < 50000) {
      alerts.push({
        level: 'error',
        title: 'Cash balance below threshold',
        message: `Cash in hand is below ₹50,000`,
      });
    }

    if (input.defaulters > 0) {
      alerts.push({
        level: 'info',
        title: `${input.defaulters} students with pending fees`,
        message: 'Review fee defaulters in Fee Management',
      });
    }

    if (input.draftExpenses > 0) {
      alerts.push({
        level: 'warning',
        title: `${input.draftExpenses} expenses awaiting approval`,
        message: 'Approve and post pending expense bills',
      });
    }

    if (input.draftVouchers > 0) {
      alerts.push({
        level: 'info',
        title: `${input.draftVouchers} draft vouchers pending`,
        message: 'Post vouchers to update the general ledger',
      });
    }

    return alerts.slice(0, 6);
  }

  private async ledgerIdsForGroups(tenantId: string, groupIds: string[]) {
    if (!groupIds.length) return [];
    const ledgers = await this.prisma.accountingLedgerAccount.findMany({
      where: { tenantId, groupId: { in: groupIds }, isActive: true },
      select: { id: true },
    });
    return ledgers.map((l) => l.id);
  }

  private async groupIdsByNature(tenantId: string, nature: string) {
    const groups = await this.prisma.accountingAccountGroup.findMany({
      where: { tenantId, nature, isActive: true },
      select: { id: true },
    });
    return groups.map((g) => g.id);
  }

  private async sumNaturePostings(
    tenantId: string,
    groupIds: string[],
    from: Date,
    to: Date,
  ) {
    if (!groupIds.length) return 0;
    const ledgerIds = await this.ledgerIdsForGroups(tenantId, groupIds);
    if (!ledgerIds.length) return 0;

    const agg = await this.prisma.accountingLedgerPosting.aggregate({
      where: {
        tenantId,
        ledgerAccountId: { in: ledgerIds },
        voucherDate: { gte: from, lt: to },
      },
      _sum: { amount: true },
    });

    return Number(agg._sum.amount ?? 0);
  }
}
