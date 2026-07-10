import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  CreateBudgetDto,
  CreateExpenseDto,
  ExpenseListQueryDto,
  UpdateBudgetDto,
  UpdateExpenseDto,
} from '../dto/accounting.dto';
import { AccountingSettingsService } from './accounting-settings.service';
import { AutoVoucherService } from './auto-voucher.service';
import { FinancialYearService } from './financial-year.service';

@Injectable()
export class ExpenseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financialYear: FinancialYearService,
    private readonly settings: AccountingSettingsService,
    private readonly autoVoucher: AutoVoucherService,
  ) {}

  async list(tenantId: string, query: ExpenseListQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 25, 100);
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.vendorId ? { vendorId: query.vendorId } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.accountingExpense.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
        include: {
          vendor: true,
          ledgerAccount: true,
        },
      }),
      this.prisma.accountingExpense.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async create(tenantId: string, dto: CreateExpenseDto, createdById?: string) {
    const fy = await this.financialYear.assertActiveOpen(tenantId);
    const expenseNo = await this.nextExpenseNo(tenantId);

    return this.prisma.accountingExpense.create({
      data: {
        tenantId,
        expenseNo,
        vendorId: dto.vendorId,
        ledgerAccountId: dto.ledgerAccountId,
        departmentId: dto.departmentId,
        financialYearId: fy.id,
        expenseDate: new Date(dto.expenseDate),
        amount: dto.amount,
        gstAmount: dto.gstAmount ?? 0,
        description: dto.description,
        billNo: dto.billNo,
        createdById,
        status: 'DRAFT',
      },
      include: { vendor: true, ledgerAccount: true },
    });
  }

  async approve(tenantId: string, id: string, approvedById?: string) {
    await this.financialYear.assertActiveOpen(tenantId);
    const expense = await this.prisma.accountingExpense.findFirst({
      where: { tenantId, id },
      include: { vendor: true, ledgerAccount: true },
    });
    if (!expense) throw new NotFoundException('Expense not found');
    if (expense.status !== 'DRAFT') {
      throw new BadRequestException('Only draft expenses can be approved');
    }

    const settings = await this.settings.getSettings(tenantId);
    const creditLedgerId =
      settings.defaultBankLedgerId ?? settings.defaultCashLedgerId;
    if (!creditLedgerId) {
      throw new BadRequestException('Configure default bank/cash ledger first');
    }

    const amount = Number(expense.amount);
    const voucher = await this.autoVoucher.postBalanced({
      tenantId,
      voucherTypeCode: 'PAYMENT',
      voucherDate: expense.expenseDate,
      narration: expense.description ?? `Expense ${expense.expenseNo}`,
      referenceNo: expense.billNo ?? expense.expenseNo,
      postedById: approvedById,
      metadata: { expenseId: expense.id, vendorId: expense.vendorId },
      lines: [
        {
          ledgerAccountId: expense.ledgerAccountId,
          entryType: 'DEBIT',
          amount,
        },
        {
          ledgerAccountId: creditLedgerId,
          entryType: 'CREDIT',
          amount,
        },
      ],
    });

    return this.prisma.accountingExpense.update({
      where: { id },
      data: {
        status: 'POSTED',
        approvedById,
        approvedAt: new Date(),
        voucherId: voucher.id,
      },
      include: { vendor: true, ledgerAccount: true, voucher: true },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateExpenseDto) {
    await this.financialYear.assertActiveOpen(tenantId);
    const expense = await this.prisma.accountingExpense.findFirst({
      where: { tenantId, id },
    });
    if (!expense) throw new NotFoundException('Expense not found');
    if (expense.status !== 'DRAFT') {
      throw new BadRequestException('Only draft expenses can be edited');
    }

    return this.prisma.accountingExpense.update({
      where: { id },
      data: {
        ...(dto.vendorId !== undefined ? { vendorId: dto.vendorId } : {}),
        ...(dto.ledgerAccountId !== undefined
          ? { ledgerAccountId: dto.ledgerAccountId }
          : {}),
        ...(dto.departmentId !== undefined
          ? { departmentId: dto.departmentId }
          : {}),
        ...(dto.expenseDate !== undefined
          ? { expenseDate: new Date(dto.expenseDate) }
          : {}),
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.gstAmount !== undefined ? { gstAmount: dto.gstAmount } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.billNo !== undefined ? { billNo: dto.billNo } : {}),
      },
      include: { vendor: true, ledgerAccount: true },
    });
  }

  private async nextExpenseNo(tenantId: string) {
    const count = await this.prisma.accountingExpense.count({
      where: { tenantId },
    });
    return `EXP-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
  }
}

@Injectable()
export class BudgetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financialYear: FinancialYearService,
  ) {}

  async list(tenantId: string, financialYearId?: string) {
    const where = {
      tenantId,
      ...(financialYearId ? { financialYearId } : {}),
    };
    const budgets = await this.prisma.accountingBudget.findMany({
      where,
      include: { ledgerAccount: true, financialYear: true },
      orderBy: { createdAt: 'desc' },
    });

    const enriched = await Promise.all(
      budgets.map(async (budget) => {
        const spentAgg = await this.prisma.accountingLedgerPosting.aggregate({
          where: {
            tenantId,
            ledgerAccountId: budget.ledgerAccountId,
            financialYearId: budget.financialYearId,
            entryType: 'DEBIT',
          },
          _sum: { amount: true },
        });
        const spent = Number(spentAgg._sum.amount ?? 0);
        const allocated = Number(budget.allocatedAmount);
        return {
          ...budget,
          spent,
          remaining: allocated - spent,
          utilizationPct:
            allocated > 0 ? Math.round((spent / allocated) * 1000) / 10 : 0,
        };
      }),
    );

    return enriched;
  }

  async create(tenantId: string, dto: CreateBudgetDto) {
    await this.financialYear.assertYearOpen(tenantId, dto.financialYearId);
    return this.prisma.accountingBudget.create({
      data: {
        tenantId,
        financialYearId: dto.financialYearId,
        departmentId: dto.departmentId,
        ledgerAccountId: dto.ledgerAccountId,
        allocatedAmount: dto.allocatedAmount,
        notes: dto.notes,
      },
      include: { ledgerAccount: true, financialYear: true },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateBudgetDto) {
    const budget = await this.prisma.accountingBudget.findFirst({
      where: { tenantId, id },
    });
    if (!budget) throw new NotFoundException('Budget line not found');

    if (dto.financialYearId) {
      await this.financialYear.assertYearOpen(tenantId, dto.financialYearId);
    } else {
      await this.financialYear.assertYearOpen(tenantId, budget.financialYearId);
    }

    return this.prisma.accountingBudget.update({
      where: { id },
      data: {
        ...(dto.financialYearId !== undefined
          ? { financialYearId: dto.financialYearId }
          : {}),
        ...(dto.departmentId !== undefined
          ? { departmentId: dto.departmentId }
          : {}),
        ...(dto.ledgerAccountId !== undefined
          ? { ledgerAccountId: dto.ledgerAccountId }
          : {}),
        ...(dto.allocatedAmount !== undefined
          ? { allocatedAmount: dto.allocatedAmount }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
      include: { ledgerAccount: true, financialYear: true },
    });
  }
}
