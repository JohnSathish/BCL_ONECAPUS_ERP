import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { BooksQueryDto } from '../dto/accounting.dto';
import { FinancialYearService } from './financial-year.service';
import { PostingService } from './posting.service';

type LedgerBalanceRow = {
  ledgerId: string;
  code: string;
  name: string;
  groupCode: string;
  groupName: string;
  nature: string;
  openingSigned: number;
  periodDebit: number;
  periodCredit: number;
  closingSigned: number;
  openingDebit: number;
  openingCredit: number;
  closingDebit: number;
  closingCredit: number;
};

@Injectable()
export class FinancialReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financialYear: FinancialYearService,
    private readonly posting: PostingService,
  ) {}

  async trialBalance(tenantId: string, query: BooksQueryDto) {
    const { fy, fromDate, toDate, rows } = await this.buildLedgerRows(
      tenantId,
      query,
    );

    const totals = rows.reduce(
      (acc, row) => ({
        openingDebit: acc.openingDebit + row.openingDebit,
        openingCredit: acc.openingCredit + row.openingCredit,
        periodDebit: acc.periodDebit + row.periodDebit,
        periodCredit: acc.periodCredit + row.periodCredit,
        closingDebit: acc.closingDebit + row.closingDebit,
        closingCredit: acc.closingCredit + row.closingCredit,
      }),
      {
        openingDebit: 0,
        openingCredit: 0,
        periodDebit: 0,
        periodCredit: 0,
        closingDebit: 0,
        closingCredit: 0,
      },
    );

    return {
      financialYear: fy,
      fromDate,
      toDate,
      rows: rows.filter(
        (row) =>
          row.openingDebit > 0 ||
          row.openingCredit > 0 ||
          row.periodDebit > 0 ||
          row.periodCredit > 0 ||
          row.closingDebit > 0 ||
          row.closingCredit > 0,
      ),
      totals,
    };
  }

  async profitAndLoss(tenantId: string, query: BooksQueryDto) {
    const { fy, fromDate, toDate, rows } = await this.buildLedgerRows(
      tenantId,
      query,
    );

    const incomeRows = this.groupPeriodMovement(
      rows.filter((row) => row.nature === 'INCOME'),
    );
    const expenseRows = this.groupPeriodMovement(
      rows.filter((row) => row.nature === 'EXPENSE'),
    );

    const totalIncome = incomeRows.reduce((sum, row) => sum + row.amount, 0);
    const totalExpenses = expenseRows.reduce((sum, row) => sum + row.amount, 0);
    const netProfit = Math.round((totalIncome - totalExpenses) * 100) / 100;

    return {
      financialYear: fy,
      fromDate,
      toDate,
      income: incomeRows,
      expenses: expenseRows,
      totalIncome,
      totalExpenses,
      netProfit,
      resultLabel: netProfit >= 0 ? 'Surplus' : 'Deficit',
    };
  }

  async balanceSheet(tenantId: string, query: BooksQueryDto) {
    const { fy, fromDate, toDate, rows } = await this.buildLedgerRows(
      tenantId,
      query,
    );
    const pl = await this.profitAndLoss(tenantId, query);

    const assets = this.groupByAccountGroup(
      rows.filter((row) => row.nature === 'ASSET'),
      'debit',
    );
    const liabilities = this.groupByAccountGroup(
      rows.filter((row) => row.nature === 'LIABILITY'),
      'credit',
    );

    const totalAssets = assets.reduce((sum, row) => sum + row.amount, 0);
    const totalLiabilities = liabilities.reduce(
      (sum, row) => sum + row.amount,
      0,
    );
    const surplus = pl.netProfit;
    const totalLiabilitiesAndSurplus =
      Math.round((totalLiabilities + surplus) * 100) / 100;

    return {
      financialYear: fy,
      fromDate,
      toDate,
      asAtDate: toDate,
      assets,
      liabilities,
      surplus,
      surplusLabel: pl.resultLabel,
      totalAssets,
      totalLiabilities,
      totalLiabilitiesAndSurplus,
      balanced: Math.abs(totalAssets - totalLiabilitiesAndSurplus) < 0.05,
    };
  }

  async insights(tenantId: string) {
    const fy = await this.financialYear.getActive(tenantId);
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [pl, topIncome, topExpense, monthTrend, alerts] = await Promise.all([
      this.profitAndLoss(tenantId, {
        financialYearId: fy.id,
        fromDate: fy.startDate.toISOString().slice(0, 10),
        toDate: today.toISOString().slice(0, 10),
      }),
      this.topLedgers(tenantId, 'INCOME', monthStart, today, 5),
      this.topLedgers(tenantId, 'EXPENSE', monthStart, today, 5),
      this.monthlyTrend(tenantId, fy.id, 6),
      this.buildAlerts(tenantId, fy.id),
    ]);

    return {
      financialYear: fy,
      netProfitYtd: pl.netProfit,
      resultLabel: pl.resultLabel,
      topIncome,
      topExpense,
      monthTrend,
      alerts,
    };
  }

  private async buildLedgerRows(tenantId: string, query: BooksQueryDto) {
    const { fy, fromDate, toDate } = await this.resolveDateRange(
      tenantId,
      query,
    );

    const ledgers = await this.prisma.accountingLedgerAccount.findMany({
      where: { tenantId, isActive: true },
      include: { group: true },
      orderBy: [{ group: { sortOrder: 'asc' } }, { code: 'asc' }],
    });

    if (!ledgers.length) {
      return { fy, fromDate, toDate, rows: [] as LedgerBalanceRow[] };
    }

    const ledgerIds = ledgers.map((ledger) => ledger.id);

    const [beforePostings, periodPostings] = await Promise.all([
      this.prisma.accountingLedgerPosting.groupBy({
        by: ['ledgerAccountId', 'entryType'],
        where: {
          tenantId,
          ledgerAccountId: { in: ledgerIds },
          voucherDate: { lt: fromDate },
        },
        _sum: { amount: true },
      }),
      this.prisma.accountingLedgerPosting.groupBy({
        by: ['ledgerAccountId', 'entryType'],
        where: {
          tenantId,
          ledgerAccountId: { in: ledgerIds },
          voucherDate: { gte: fromDate, lte: toDate },
        },
        _sum: { amount: true },
      }),
    ]);

    const beforeMap = new Map<string, { debit: number; credit: number }>();
    for (const row of beforePostings) {
      const current = beforeMap.get(row.ledgerAccountId) ?? {
        debit: 0,
        credit: 0,
      };
      if (row.entryType === 'DEBIT') {
        current.debit += Number(row._sum.amount ?? 0);
      } else {
        current.credit += Number(row._sum.amount ?? 0);
      }
      beforeMap.set(row.ledgerAccountId, current);
    }

    const periodMap = new Map<string, { debit: number; credit: number }>();
    for (const row of periodPostings) {
      const current = periodMap.get(row.ledgerAccountId) ?? {
        debit: 0,
        credit: 0,
      };
      if (row.entryType === 'DEBIT') {
        current.debit += Number(row._sum.amount ?? 0);
      } else {
        current.credit += Number(row._sum.amount ?? 0);
      }
      periodMap.set(row.ledgerAccountId, current);
    }

    const rows: LedgerBalanceRow[] = ledgers.map((ledger) => {
      const nature = ledger.group.nature;
      const before = beforeMap.get(ledger.id) ?? { debit: 0, credit: 0 };
      const period = periodMap.get(ledger.id) ?? { debit: 0, credit: 0 };

      const openingSigned =
        Number(ledger.openingBalance) +
        this.netMovement(nature, before.debit, before.credit);
      const closingSigned =
        openingSigned + this.netMovement(nature, period.debit, period.credit);

      const openingSplit = this.splitBalance(nature, openingSigned);
      const closingSplit = this.splitBalance(nature, closingSigned);

      return {
        ledgerId: ledger.id,
        code: ledger.code,
        name: ledger.name,
        groupCode: ledger.group.code,
        groupName: ledger.group.name,
        nature,
        openingSigned,
        periodDebit: period.debit,
        periodCredit: period.credit,
        closingSigned,
        openingDebit: openingSplit.debit,
        openingCredit: openingSplit.credit,
        closingDebit: closingSplit.debit,
        closingCredit: closingSplit.credit,
      };
    });

    return { fy, fromDate, toDate, rows };
  }

  private groupPeriodMovement(rows: LedgerBalanceRow[]) {
    const buckets = new Map<
      string,
      {
        groupCode: string;
        groupName: string;
        amount: number;
        ledgers: Array<{ code: string; name: string; amount: number }>;
      }
    >();

    for (const row of rows) {
      const amount = this.netMovement(
        row.nature,
        row.periodDebit,
        row.periodCredit,
      );
      if (amount <= 0) continue;

      const bucket = buckets.get(row.groupCode) ?? {
        groupCode: row.groupCode,
        groupName: row.groupName,
        amount: 0,
        ledgers: [],
      };
      bucket.amount += amount;
      bucket.ledgers.push({
        code: row.code,
        name: row.name,
        amount: Math.round(amount * 100) / 100,
      });
      buckets.set(row.groupCode, bucket);
    }

    return [...buckets.values()]
      .map((bucket) => ({
        ...bucket,
        amount: Math.round(bucket.amount * 100) / 100,
        ledgers: bucket.ledgers.sort((a, b) => b.amount - a.amount),
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  private groupByAccountGroup(
    rows: LedgerBalanceRow[],
    side: 'debit' | 'credit',
  ) {
    const buckets = new Map<
      string,
      {
        groupCode: string;
        groupName: string;
        amount: number;
        ledgers: Array<{ code: string; name: string; amount: number }>;
      }
    >();

    for (const row of rows) {
      const amount =
        side === 'debit'
          ? row.closingDebit || row.periodDebit
          : row.closingCredit || row.periodCredit;
      if (amount <= 0) continue;

      const bucket = buckets.get(row.groupCode) ?? {
        groupCode: row.groupCode,
        groupName: row.groupName,
        amount: 0,
        ledgers: [],
      };
      bucket.amount += amount;
      bucket.ledgers.push({
        code: row.code,
        name: row.name,
        amount: Math.round(amount * 100) / 100,
      });
      buckets.set(row.groupCode, bucket);
    }

    return [...buckets.values()]
      .map((bucket) => ({
        ...bucket,
        amount: Math.round(bucket.amount * 100) / 100,
        ledgers: bucket.ledgers.sort((a, b) => b.amount - a.amount),
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  private async topLedgers(
    tenantId: string,
    nature: string,
    fromDate: Date,
    toDate: Date,
    limit: number,
  ) {
    const groups = await this.prisma.accountingAccountGroup.findMany({
      where: { tenantId, nature, isActive: true },
      select: { id: true },
    });
    const groupIds = groups.map((group) => group.id);
    if (!groupIds.length) return [];

    const ledgers = await this.prisma.accountingLedgerAccount.findMany({
      where: { tenantId, groupId: { in: groupIds }, isActive: true },
      include: { group: true },
    });

    const totals = await Promise.all(
      ledgers.map(async (ledger) => {
        const agg = await this.prisma.accountingLedgerPosting.groupBy({
          by: ['entryType'],
          where: {
            tenantId,
            ledgerAccountId: ledger.id,
            voucherDate: { gte: fromDate, lte: toDate },
          },
          _sum: { amount: true },
        });
        let debit = 0;
        let credit = 0;
        for (const row of agg) {
          if (row.entryType === 'DEBIT') debit = Number(row._sum.amount ?? 0);
          else credit = Number(row._sum.amount ?? 0);
        }
        const amount = Math.abs(this.netMovement(nature, debit, credit));
        return {
          code: ledger.code,
          name: ledger.name,
          amount: Math.round(amount * 100) / 100,
        };
      }),
    );

    return totals
      .filter((row) => row.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, limit);
  }

  private async monthlyTrend(
    tenantId: string,
    financialYearId: string,
    months: number,
  ) {
    const incomeGroupIds = await this.groupIdsByNature(tenantId, 'INCOME');
    const expenseGroupIds = await this.groupIdsByNature(tenantId, 'EXPENSE');
    const incomeLedgerIds = await this.ledgerIdsForGroups(
      tenantId,
      incomeGroupIds,
    );
    const expenseLedgerIds = await this.ledgerIdsForGroups(
      tenantId,
      expenseGroupIds,
    );

    const today = new Date();
    const points: Array<{
      label: string;
      income: number;
      expense: number;
    }> = [];

    for (let i = months - 1; i >= 0; i -= 1) {
      const start = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const end = new Date(today.getFullYear(), today.getMonth() - i + 1, 1);
      const label = start.toLocaleDateString('en-IN', {
        month: 'short',
        year: '2-digit',
      });

      const [incomeAgg, expenseAgg] = await Promise.all([
        incomeLedgerIds.length
          ? this.prisma.accountingLedgerPosting.aggregate({
              where: {
                tenantId,
                financialYearId,
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
                financialYearId,
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

  private async buildAlerts(tenantId: string, financialYearId: string) {
    const [draftVouchers, failedIntegrations, openBankRecos, budgetsExceeded] =
      await Promise.all([
        this.prisma.accountingVoucher.count({
          where: { tenantId, status: 'DRAFT' },
        }),
        this.prisma.accountingIntegrationLog.count({
          where: { tenantId, status: 'FAILED' },
        }),
        this.prisma.accountingBankReconciliation.count({
          where: { tenantId, status: 'DRAFT' },
        }),
        this.countExceededBudgets(tenantId, financialYearId),
      ]);

    const alerts: Array<{ level: string; message: string; count: number }> = [];
    if (draftVouchers > 0) {
      alerts.push({
        level: 'warning',
        message: 'Draft vouchers pending posting',
        count: draftVouchers,
      });
    }
    if (failedIntegrations > 0) {
      alerts.push({
        level: 'error',
        message: 'GL integration failures',
        count: failedIntegrations,
      });
    }
    if (openBankRecos > 0) {
      alerts.push({
        level: 'info',
        message: 'Bank reconciliations in progress',
        count: openBankRecos,
      });
    }
    if (budgetsExceeded > 0) {
      alerts.push({
        level: 'warning',
        message: 'Budget lines exceeded',
        count: budgetsExceeded,
      });
    }
    return alerts;
  }

  private async countExceededBudgets(
    tenantId: string,
    financialYearId: string,
  ) {
    const budgets = await this.prisma.accountingBudget.findMany({
      where: { tenantId, financialYearId },
    });
    let exceeded = 0;
    for (const budget of budgets) {
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
      if (spent > Number(budget.allocatedAmount)) exceeded += 1;
    }
    return exceeded;
  }

  private async groupIdsByNature(tenantId: string, nature: string) {
    const groups = await this.prisma.accountingAccountGroup.findMany({
      where: { tenantId, nature, isActive: true },
      select: { id: true },
    });
    return groups.map((group) => group.id);
  }

  private async ledgerIdsForGroups(tenantId: string, groupIds: string[]) {
    if (!groupIds.length) return [];
    const ledgers = await this.prisma.accountingLedgerAccount.findMany({
      where: { tenantId, groupId: { in: groupIds }, isActive: true },
      select: { id: true },
    });
    return ledgers.map((ledger) => ledger.id);
  }

  private async resolveDateRange(tenantId: string, query: BooksQueryDto) {
    const fy = query.financialYearId
      ? await this.prisma.accountingFinancialYear.findFirst({
          where: { tenantId, id: query.financialYearId },
        })
      : await this.financialYear.getActive(tenantId);

    if (!fy) throw new NotFoundException('Financial year not found');

    const fromDate = query.fromDate ? new Date(query.fromDate) : fy.startDate;
    const toDate = query.toDate ? new Date(query.toDate) : fy.endDate;

    return { fy, fromDate, toDate };
  }

  private netMovement(nature: string, debit: number, credit: number) {
    const debitDelta = this.posting.balanceDelta(nature, 'DEBIT', debit);
    const creditDelta = this.posting.balanceDelta(nature, 'CREDIT', credit);
    return debitDelta + creditDelta;
  }

  private splitBalance(nature: string, signed: number) {
    const rounded = Math.round(signed * 100) / 100;
    if (Math.abs(rounded) < 0.005) return { debit: 0, credit: 0 };
    const abs = Math.abs(rounded);
    if (rounded >= 0) {
      if (nature === 'ASSET' || nature === 'EXPENSE') {
        return { debit: abs, credit: 0 };
      }
      return { debit: 0, credit: abs };
    }
    if (nature === 'ASSET' || nature === 'EXPENSE') {
      return { debit: 0, credit: abs };
    }
    return { debit: abs, credit: 0 };
  }
}
