import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SchoolSisService } from './school-sis.service';
import { SchoolReportEngineService } from './report-engine/report-engine.service';
import { SchoolSisAccountsPostingService } from './school-sis-accounts.posting.service';
import {
  ACCT_PAYMENT_MODES,
  ACCT_VOUCHER_TYPES,
  type AcctVoucherType,
} from './school-sis-accounts.catalog';
import {
  add,
  maskAccountNumber,
  money,
  zero,
} from './school-sis-accounts.money';
import type {
  AcctAccountDto,
  AcctApprovalRuleDto,
  AcctAssetDto,
  AcctBankDto,
  AcctBankImportDto,
  AcctBillDto,
  AcctBudgetDto,
  AcctCashCloseDto,
  AcctGatewaySettleDto,
  AcctTaxConfigDto,
  AcctVendorDto,
  AcctVoucherDto,
} from './dto/school-accounts.dto';

const POSTED = { status: 'POSTED' as const };

@Injectable()
export class SchoolSisAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sis: SchoolSisService,
    private readonly posting: SchoolSisAccountsPostingService,
    private readonly reports: SchoolReportEngineService,
  ) {}

  async bootstrap(tenantId: string) {
    const fy = await this.posting.ensureBooks(tenantId);
    return {
      financialYear: fy,
      voucherTypes: ACCT_VOUCHER_TYPES,
      paymentModes: ACCT_PAYMENT_MODES,
    };
  }

  async dashboard(tenantId: string, view = 'accountant') {
    const fy = await this.posting.ensureBooks(tenantId);
    const posted = {
      tenantId,
      financialYearId: fy.id,
      ...POSTED,
    };
    const vouchers = await this.prisma.schoolAcctVoucher.findMany({
      where: posted,
      include: { lines: { include: { account: true } } },
    });
    let income = zero();
    let expense = zero();
    let cash = zero();
    let bank = zero();
    let feeRecv = zero();
    let vendorPay = zero();
    let salaryPay = zero();
    const monthMap = new Map<string, { income: number; expense: number }>();
    for (const v of vouchers) {
      const mk = String(v.voucherDate).slice(0, 7);
      const bucket = monthMap.get(mk) ?? { income: 0, expense: 0 };
      for (const line of v.lines) {
        const d = money(line.debit);
        const c = money(line.credit);
        if (line.account.systemKey === 'CASH') cash = add(cash, d.sub(c));
        if (
          line.account.systemKey === 'BANK' ||
          line.account.systemKey === 'UPI'
        ) {
          bank = add(bank, d.sub(c));
        }
        if (line.account.systemKey === 'FEE_RECEIVABLE')
          feeRecv = add(feeRecv, d.sub(c));
        if (line.account.systemKey === 'VENDOR_PAYABLE')
          vendorPay = add(vendorPay, c.sub(d));
        if (line.account.systemKey === 'SALARY_PAYABLE')
          salaryPay = add(salaryPay, c.sub(d));
        if (line.account.type === 'INCOME') {
          income = add(income, c.sub(d));
          bucket.income += Number(c.sub(d).toFixed(2));
        }
        if (line.account.type === 'EXPENSE') {
          expense = add(expense, d.sub(c));
          bucket.expense += Number(d.sub(c).toFixed(2));
        }
      }
      monthMap.set(mk, bucket);
    }
    const start = new Date();
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    const monthVouchers = vouchers.filter((v) => v.voucherDate >= start);
    const incomeMonth = sumType(monthVouchers, 'INCOME');
    const expenseMonth = sumType(monthVouchers, 'EXPENSE');
    const pending = await this.prisma.schoolAcctVoucher.count({
      where: { tenantId, status: { in: ['DRAFT', 'SUBMITTED'] } },
    });
    const unreconciled = await this.prisma.schoolAcctBankStmtLine.count({
      where: { tenantId, status: 'UNMATCHED' },
    });
    const overdueBills = await this.prisma.schoolAcctVendorBill.count({
      where: {
        tenantId,
        status: { in: ['PAYABLE', 'APPROVED'] },
        dueDate: { lt: new Date() },
      },
    });
    const recent = await this.prisma.schoolAcctVoucher.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: {
        id: true,
        voucherNo: true,
        voucherType: true,
        narration: true,
        totalDebit: true,
        status: true,
        voucherDate: true,
      },
    });
    const surplus = income.sub(expense);
    const alerts = [
      pending ? `${pending} expenses awaiting approval` : null,
      unreconciled ? `₹${unreconciled} unreconciled bank rows` : null,
      overdueBills ? `${overdueBills} vendor bills overdue` : null,
    ].filter(Boolean);
    return {
      view,
      fy: fy.code,
      summary: {
        income: n(income),
        expenses: n(expense),
        surplus: n(surplus),
        cash: n(cash),
        bank: n(bank),
        available: n(add(cash, bank)),
        feeReceivable: n(feeRecv),
        vendorPayable: n(vendorPay),
        salaryPayable: n(salaryPay),
        incomeMonth: n(incomeMonth),
        expenseMonth: n(expenseMonth),
        pendingApprovals: pending,
        unreconciled,
      },
      monthly: [...monthMap.entries()].sort().map(([month, v]) => ({
        month,
        ...v,
      })),
      alerts,
      recent,
    };
  }

  async chart(tenantId: string) {
    await this.posting.ensureBooks(tenantId);
    return this.prisma.schoolAcctAccount.findMany({
      where: { tenantId },
      orderBy: { code: 'asc' },
    });
  }

  async saveAccount(tenantId: string, dto: AcctAccountDto, id?: string) {
    await this.posting.ensureBooks(tenantId);
    if (id) {
      const row = await this.prisma.schoolAcctAccount.findFirst({
        where: { id, tenantId },
      });
      if (!row) throw new NotFoundException('Account not found');
      if (row.isSystem && dto.code !== row.code) {
        throw new BadRequestException('System account codes cannot be changed');
      }
      return this.prisma.schoolAcctAccount.update({
        where: { id },
        data: {
          name: dto.name,
          moduleKey: dto.moduleKey ?? row.moduleKey,
          openingBalance: dto.openingBalance
            ? money(dto.openingBalance)
            : row.openingBalance,
          openingSide: dto.openingSide ?? row.openingSide,
          parentId: dto.parentId ?? row.parentId,
        },
      });
    }
    return this.prisma.schoolAcctAccount.create({
      data: {
        tenantId,
        code: dto.code,
        name: dto.name,
        type: dto.type,
        parentId: dto.parentId ?? null,
        moduleKey: dto.moduleKey ?? null,
        openingBalance: money(dto.openingBalance ?? 0),
        openingSide: dto.openingSide ?? 'DEBIT',
      },
    });
  }

  async setAccountActive(tenantId: string, id: string, active: boolean) {
    const row = await this.prisma.schoolAcctAccount.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Account not found');
    return this.prisma.schoolAcctAccount.update({
      where: { id },
      data: { active },
    });
  }

  async vouchers(
    tenantId: string,
    q: {
      type?: string;
      status?: string;
      from?: string;
      to?: string;
      search?: string;
      createdBy?: string;
    },
  ) {
    await this.posting.ensureBooks(tenantId);
    return this.prisma.schoolAcctVoucher.findMany({
      where: {
        tenantId,
        voucherType: q.type || undefined,
        status: q.status || undefined,
        createdBy: q.createdBy || undefined,
        voucherDate: range(q.from, q.to),
        OR: q.search
          ? [
              { voucherNo: { contains: q.search, mode: 'insensitive' } },
              { narration: { contains: q.search, mode: 'insensitive' } },
              { payerName: { contains: q.search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      include: { lines: { include: { account: true } } },
      orderBy: [{ voucherDate: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });
  }

  async getVoucher(tenantId: string, id: string) {
    const row = await this.prisma.schoolAcctVoucher.findFirst({
      where: { id, tenantId },
      include: { lines: { include: { account: true } }, attachments: true },
    });
    if (!row) throw new NotFoundException('Voucher not found');
    return row;
  }

  async createVoucher(
    tenantId: string,
    dto: AcctVoucherDto,
    actorUserId: string,
    ip?: string,
  ) {
    return this.posting.post(tenantId, {
      voucherType: dto.voucherType as AcctVoucherType,
      date: new Date(dto.date),
      narration: dto.narration,
      lines: dto.lines.map((l) => ({
        accountId: l.accountId,
        systemKey: l.systemKey,
        debit: l.debit ?? 0,
        credit: l.credit ?? 0,
        particulars: l.particulars,
        costCentreId: l.costCentreId,
      })),
      actorUserId,
      ip,
      payerName: dto.payerName,
      payeeName: dto.payeeName,
      studentId: dto.studentId,
      vendorId: dto.vendorId,
      costCentreId: dto.costCentreId,
      paymentMode: dto.paymentMode,
      bankAccountId: dto.bankAccountId,
      referenceNo: dto.referenceNo,
      chequeNo: dto.chequeNo,
      autoPost: dto.autoPost ?? false,
    });
  }

  async submit(tenantId: string, id: string, actorUserId: string) {
    const v = await this.mustVoucher(tenantId, id);
    if (v.status !== 'DRAFT')
      throw new BadRequestException('Only drafts can be submitted');
    return this.prisma.schoolAcctVoucher.update({
      where: { id },
      data: { status: 'SUBMITTED', submittedAt: new Date() },
    });
  }

  async approve(
    tenantId: string,
    id: string,
    actorUserId: string,
    roles: string[],
  ) {
    const v = await this.mustVoucher(tenantId, id);
    if (v.createdBy === actorUserId && money(v.totalDebit).gt(5000)) {
      throw new BadRequestException(
        'Maker cannot approve this high-value voucher',
      );
    }
    const rules = await this.prisma.schoolAcctApprovalRule.findMany({
      where: { tenantId, active: true },
      orderBy: { sortOrder: 'asc' },
    });
    const amount = money(v.totalDebit);
    const rule = rules.find((r) => {
      const min = money(r.minAmount);
      const max = r.maxAmount ? money(r.maxAmount) : null;
      return amount.gte(min) && (!max || amount.lte(max));
    });
    if (
      rule &&
      !roles.some(
        (r) =>
          r === rule.approverRole ||
          r.includes('admin') ||
          r.includes('principal'),
      )
    ) {
      throw new BadRequestException(`Requires ${rule.approverRole} approval`);
    }
    await this.prisma.schoolAcctApprovalAction.create({
      data: {
        tenantId,
        voucherId: id,
        actorId: actorUserId,
        decision: 'APPROVED',
      },
    });
    return this.prisma.schoolAcctVoucher.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: actorUserId,
        approvedAt: new Date(),
      },
    });
  }

  async postDraft(tenantId: string, id: string, actorUserId: string) {
    const v = await this.mustVoucher(tenantId, id);
    if (!['APPROVED', 'DRAFT', 'SUBMITTED'].includes(v.status)) {
      throw new BadRequestException('Voucher cannot be posted');
    }
    return this.prisma.schoolAcctVoucher.update({
      where: { id },
      data: { status: 'POSTED', postedBy: actorUserId, postedAt: new Date() },
    });
  }

  async reverse(tenantId: string, id: string, actorUserId: string) {
    const v = await this.mustVoucher(tenantId, id);
    if (v.status !== 'POSTED')
      throw new BadRequestException('Only posted vouchers reverse');
    return this.posting.reverseVoucher(tenantId, id, actorUserId);
  }

  async ledger(
    tenantId: string,
    q: { accountId: string; from?: string; to?: string },
  ) {
    await this.posting.ensureBooks(tenantId);
    const account = await this.prisma.schoolAcctAccount.findFirst({
      where: { id: q.accountId, tenantId },
    });
    if (!account) throw new NotFoundException('Account not found');
    const lines = await this.prisma.schoolAcctVoucherLine.findMany({
      where: {
        tenantId,
        accountId: q.accountId,
        voucher: {
          status: 'POSTED',
          voucherDate: range(q.from, q.to),
        },
      },
      include: { voucher: true },
      orderBy: [{ voucher: { voucherDate: 'asc' } }, { lineNo: 'asc' }],
    });
    let bal =
      account.openingSide === 'CREDIT'
        ? money(account.openingBalance).neg()
        : money(account.openingBalance);
    const rows = lines.map((l) => {
      bal = add(bal, money(l.debit).sub(money(l.credit)));
      return {
        ...l,
        voucherNo: l.voucher.voucherNo,
        voucherType: l.voucher.voucherType,
        date: l.voucher.voucherDate,
        balance: n(bal),
      };
    });
    return {
      account,
      opening: n(account.openingBalance),
      rows,
      closing: n(bal),
    };
  }

  async trialBalance(tenantId: string) {
    const accounts = await this.chart(tenantId);
    const lines = await this.prisma.schoolAcctVoucherLine.findMany({
      where: { tenantId, voucher: { tenantId, status: 'POSTED' } },
    });
    const map = new Map<
      string,
      { debit: Prisma.Decimal; credit: Prisma.Decimal }
    >();
    for (const a of accounts) {
      const open = money(a.openingBalance);
      map.set(a.id, {
        debit: a.openingSide === 'CREDIT' ? zero() : open,
        credit: a.openingSide === 'CREDIT' ? open : zero(),
      });
    }
    for (const l of lines) {
      const cur = map.get(l.accountId) ?? { debit: zero(), credit: zero() };
      cur.debit = add(cur.debit, l.debit);
      cur.credit = add(cur.credit, l.credit);
      map.set(l.accountId, cur);
    }
    const rows = accounts
      .filter((a) => !a.isGroup)
      .map((a) => {
        const t = map.get(a.id)!;
        const net = t.debit.sub(t.credit);
        return {
          id: a.id,
          code: a.code,
          name: a.name,
          type: a.type,
          debit: n(net.gt(0) ? net : zero()),
          credit: n(net.lt(0) ? net.abs() : zero()),
        };
      });
    const debit = rows.reduce((s, r) => s + Number(r.debit), 0);
    const credit = rows.reduce((s, r) => s + Number(r.credit), 0);
    return {
      rows,
      totals: { debit: debit.toFixed(2), credit: credit.toFixed(2) },
    };
  }

  async statements(tenantId: string) {
    const tb = await this.trialBalance(tenantId);
    const accounts = await this.chart(tenantId);
    const byId = new Map(tb.rows.map((r) => [r.id, r]));
    const pick = (type: string) =>
      accounts
        .filter((a) => a.type === type && !a.isGroup)
        .map((a) => byId.get(a.id))
        .filter(Boolean);
    const income = pick('INCOME');
    const expense = pick('EXPENSE');
    const assets = pick('ASSET');
    const liab = pick('LIABILITY');
    const equity = pick('EQUITY');
    const inc = income.reduce(
      (s, r) => s + Number(r!.credit) - Number(r!.debit),
      0,
    );
    const exp = expense.reduce(
      (s, r) => s + Number(r!.debit) - Number(r!.credit),
      0,
    );
    return {
      incomeExpenditure: {
        income,
        expense,
        surplus: (inc - exp).toFixed(2),
      },
      balanceSheet: { assets, liabilities: liab, funds: equity },
    };
  }

  async cashierCollection(
    tenantId: string,
    q: { from?: string; to?: string; userId?: string },
  ) {
    const rows = await this.prisma.schoolAcctVoucher.findMany({
      where: {
        tenantId,
        voucherType: 'RECEIPT',
        status: 'POSTED',
        createdBy: q.userId || undefined,
        voucherDate: range(q.from, q.to),
      },
    });
    const byUser = new Map<string, Record<string, number>>();
    for (const r of rows) {
      const cur = byUser.get(r.createdBy) ?? {};
      const mode = r.paymentMode || 'OTHER';
      cur[mode] = (cur[mode] ?? 0) + Number(r.totalDebit);
      cur.total = (cur.total ?? 0) + Number(r.totalDebit);
      byUser.set(r.createdBy, cur);
    }
    return [...byUser.entries()].map(([userId, totals]) => ({
      userId,
      totals,
    }));
  }

  async cashClose(
    tenantId: string,
    dto: AcctCashCloseDto,
    actorUserId: string,
  ) {
    const day = new Date(dto.closeDate);
    const expectedRows = await this.cashierCollection(tenantId, {
      from: dto.closeDate,
      to: dto.closeDate,
      userId: actorUserId,
    });
    const expected = money(expectedRows[0]?.totals?.CASH ?? 0);
    const actual = money(dto.actualCash);
    const difference = actual.sub(expected);
    return this.prisma.schoolAcctCashClose.upsert({
      where: {
        tenantId_closeDate_cashierUserId: {
          tenantId,
          closeDate: day,
          cashierUserId: actorUserId,
        },
      },
      create: {
        tenantId,
        closeDate: day,
        cashierUserId: actorUserId,
        expectedCash: expected,
        actualCash: actual,
        difference,
        explanation: dto.explanation,
        status: difference.abs().gt(0) ? 'SHORTAGE' : 'BALANCED',
      },
      update: {
        expectedCash: expected,
        actualCash: actual,
        difference,
        explanation: dto.explanation,
        status: difference.abs().gt(0) ? 'SHORTAGE' : 'BALANCED',
      },
    });
  }

  async banks(tenantId: string) {
    await this.posting.ensureBooks(tenantId);
    const rows = await this.prisma.schoolAcctBankAccount.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
    return rows.map((b) => ({
      ...b,
      accountNumber: maskAccountNumber(b.accountNumber),
      accountNumberMasked: true,
    }));
  }

  async saveBank(tenantId: string, dto: AcctBankDto) {
    const cashBank = await this.prisma.schoolAcctAccount.findFirst({
      where: { tenantId, systemKey: 'BANK' },
    });
    if (!cashBank) await this.posting.ensureBooks(tenantId);
    const ledger = await this.prisma.schoolAcctAccount.findFirstOrThrow({
      where: { tenantId, systemKey: 'BANK' },
    });
    return this.prisma.schoolAcctBankAccount.create({
      data: {
        tenantId,
        ledgerId: ledger.id,
        name: dto.name,
        bankName: dto.bankName,
        branch: dto.branch,
        accountNumber: dto.accountNumber,
        ifsc: dto.ifsc,
        openingBalance: money(dto.openingBalance ?? 0),
      },
    });
  }

  async importBank(
    tenantId: string,
    dto: AcctBankImportDto,
    actorUserId: string,
  ) {
    const stmt = await this.prisma.schoolAcctBankStatement.create({
      data: {
        tenantId,
        bankAccountId: dto.bankAccountId,
        createdBy: actorUserId,
        lines: {
          create: dto.rows.map((r) => ({
            tenantId,
            txnDate: new Date(r.txnDate),
            amount: money(r.amount),
            side: r.side,
            reference: r.reference,
            utr: r.utr,
            chequeNo: r.chequeNo,
            narration: r.narration,
            status: 'UNMATCHED',
          })),
        },
      },
      include: { lines: true },
    });
    const vouchers = await this.prisma.schoolAcctVoucher.findMany({
      where: { tenantId, status: 'POSTED', paymentMode: { not: 'CASH' } },
    });
    for (const line of stmt.lines) {
      const hit = vouchers.find(
        (v) =>
          money(v.totalDebit).eq(line.amount) &&
          (v.referenceNo === line.reference ||
            v.chequeNo === line.chequeNo ||
            v.referenceNo === line.utr),
      );
      if (hit) {
        await this.prisma.schoolAcctBankStmtLine.update({
          where: { id: line.id },
          data: { status: 'MATCHED', voucherId: hit.id },
        });
      }
    }
    return this.prisma.schoolAcctBankStatement.findFirst({
      where: { id: stmt.id },
      include: { lines: true },
    });
  }

  async reconSummary(tenantId: string, bankAccountId: string) {
    const lines = await this.prisma.schoolAcctBankStmtLine.findMany({
      where: { tenantId, statement: { bankAccountId } },
    });
    const unmatched = lines.filter((l) => l.status === 'UNMATCHED');
    const unmatchedAmt = unmatched.reduce((s, l) => s + Number(l.amount), 0);
    return {
      imported: lines.length,
      matched: lines.filter((l) => l.status === 'MATCHED').length,
      unmatched: unmatched.length,
      unmatchedAmount: unmatchedAmt.toFixed(2),
    };
  }

  async vendors(tenantId: string) {
    const rows = await this.prisma.schoolAcctVendor.findMany({
      where: { tenantId },
      include: { bills: true },
      orderBy: { name: 'asc' },
    });
    return rows.map((v) => {
      const purchases = v.bills.reduce((s, b) => s + Number(b.total), 0);
      const paid = v.bills.reduce((s, b) => s + Number(b.paidTotal), 0);
      return {
        ...v,
        accountNumber: maskAccountNumber(v.accountNumber),
        totals: {
          purchases: purchases.toFixed(2),
          paid: paid.toFixed(2),
          outstanding: (purchases - paid).toFixed(2),
          pendingBills: v.bills.filter(
            (b) => !['PAID', 'CANCELLED'].includes(b.status),
          ).length,
        },
      };
    });
  }

  async saveVendor(tenantId: string, dto: AcctVendorDto) {
    const count = await this.prisma.schoolAcctVendor.count({
      where: { tenantId },
    });
    const code = dto.code || `V${String(count + 1).padStart(4, '0')}`;
    return this.prisma.schoolAcctVendor.create({
      data: { tenantId, code, name: dto.name, ...pickVendor(dto) },
    });
  }

  async saveBill(tenantId: string, dto: AcctBillDto, actorUserId: string) {
    const total = dto.lines.reduce((s, l) => add(s, l.amount), zero());
    const bill = await this.prisma.schoolAcctVendorBill.create({
      data: {
        tenantId,
        vendorId: dto.vendorId,
        billNo: dto.billNo,
        billDate: new Date(dto.billDate),
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        subtotal: total,
        total,
        createdBy: actorUserId,
        lines: {
          create: dto.lines.map((l) => ({
            tenantId,
            accountId: l.accountId,
            description: l.description,
            amount: money(l.amount),
          })),
        },
      },
      include: { lines: true },
    });
    return bill;
  }

  async transitionBill(tenantId: string, id: string, status: string) {
    const bill = await this.prisma.schoolAcctVendorBill.findFirst({
      where: { id, tenantId },
      include: { lines: true, vendor: true },
    });
    if (!bill) throw new NotFoundException('Bill not found');
    if (status === 'POSTED' && !bill.voucherId) {
      const voucher = await this.posting.post(tenantId, {
        voucherType: 'PURCHASE_INVOICE',
        date: bill.billDate,
        narration: `Vendor bill ${bill.billNo}`,
        vendorId: bill.vendorId,
        actorUserId: bill.createdBy,
        sourceModule: 'vendor-bill',
        sourceId: bill.id,
        idempotencyKey: `bill:${bill.id}`,
        autoPost: true,
        lines: [
          ...bill.lines.map((l) => ({
            accountId: l.accountId,
            debit: l.amount,
            credit: 0,
            particulars: l.description,
          })),
          {
            systemKey: 'VENDOR_PAYABLE',
            debit: 0,
            credit: bill.total,
            particulars: bill.vendor.name,
          },
        ],
      });
      return this.prisma.schoolAcctVendorBill.update({
        where: { id },
        data: { status: 'POSTED', voucherId: voucher.id },
      });
    }
    return this.prisma.schoolAcctVendorBill.update({
      where: { id },
      data: { status },
    });
  }

  async budgets(tenantId: string) {
    return this.prisma.schoolAcctBudget.findMany({
      where: { tenantId },
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async saveBudget(tenantId: string, dto: AcctBudgetDto) {
    const fy = await this.posting.ensureBooks(tenantId);
    return this.prisma.schoolAcctBudget.create({
      data: {
        tenantId,
        financialYearId: fy.id,
        name: dto.name,
        lines: {
          create: dto.lines.map((l) => ({
            tenantId,
            accountId: l.accountId,
            costCentreId: l.costCentreId,
            monthKey: l.monthKey,
            amount: money(l.amount),
          })),
        },
      },
      include: { lines: true },
    });
  }

  async budgetVsActual(tenantId: string) {
    const budgets = await this.budgets(tenantId);
    const tb = await this.trialBalance(tenantId);
    const byAcc = new Map(tb.rows.map((r) => [r.id, r]));
    return budgets.flatMap((b) =>
      b.lines.map((l) => {
        const actual = Number(byAcc.get(l.accountId)?.debit ?? 0);
        const budget = Number(l.amount);
        const utilised = budget ? (actual / budget) * 100 : 0;
        return {
          budget: b.name,
          accountId: l.accountId,
          budgetAmount: budget,
          actual,
          utilised: utilised.toFixed(1),
          warning: utilised >= 80,
        };
      }),
    );
  }

  async costCentres(tenantId: string) {
    await this.posting.ensureBooks(tenantId);
    return this.prisma.schoolAcctCostCentre.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async assets(tenantId: string) {
    return this.prisma.schoolAcctAsset.findMany({
      where: { tenantId },
      include: { depreciations: true },
      orderBy: { assetCode: 'asc' },
    });
  }

  async saveAsset(tenantId: string, dto: AcctAssetDto) {
    const count = await this.prisma.schoolAcctAsset.count({
      where: { tenantId },
    });
    const value = money(dto.purchaseValue);
    return this.prisma.schoolAcctAsset.create({
      data: {
        tenantId,
        assetCode: `FA${String(count + 1).padStart(5, '0')}`,
        name: dto.name,
        category: dto.category,
        purchaseDate: new Date(dto.purchaseDate),
        purchaseValue: value,
        usefulLifeMonths: dto.usefulLifeMonths ?? 60,
        currentValue: value,
      },
    });
  }

  async depreciate(tenantId: string, periodCode: string, actorUserId: string) {
    const assets = await this.prisma.schoolAcctAsset.findMany({
      where: { tenantId, disposedAt: null },
    });
    const out = [];
    for (const a of assets) {
      const exists = await this.prisma.schoolAcctDepreciation.findUnique({
        where: { assetId_periodCode: { assetId: a.id, periodCode } },
      });
      if (exists) continue;
      const monthly = money(a.purchaseValue)
        .div(a.usefulLifeMonths)
        .toDecimalPlaces(2);
      const voucher = await this.posting.post(tenantId, {
        voucherType: 'JOURNAL',
        date: new Date(),
        narration: `Depreciation ${a.assetCode} ${periodCode}`,
        actorUserId,
        sourceModule: 'assets',
        sourceId: `${a.id}:${periodCode}`,
        idempotencyKey: `depn:${a.id}:${periodCode}`,
        autoPost: true,
        lines: [
          { systemKey: 'DEPRECIATION', debit: monthly, credit: 0 },
          { systemKey: 'ACCUM_DEPN', debit: 0, credit: monthly },
        ],
      });
      const dep = await this.prisma.schoolAcctDepreciation.create({
        data: {
          tenantId,
          assetId: a.id,
          periodCode,
          amount: monthly,
          voucherId: voucher.id,
        },
      });
      await this.prisma.schoolAcctAsset.update({
        where: { id: a.id },
        data: { currentValue: money(a.currentValue).sub(monthly) },
      });
      out.push(dep);
    }
    return out;
  }

  async taxConfigs(tenantId: string) {
    return this.prisma.schoolAcctTaxConfig.findMany({
      where: { tenantId },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async saveTax(tenantId: string, dto: AcctTaxConfigDto) {
    return this.prisma.schoolAcctTaxConfig.create({
      data: {
        tenantId,
        taxKind: dto.taxKind,
        name: dto.name,
        lawRef: dto.lawRef,
        sectionRef: dto.sectionRef,
        rateBps: dto.rateBps,
        threshold: money(dto.threshold ?? 0),
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
      },
    });
  }

  async periods(tenantId: string) {
    const fy = await this.posting.ensureBooks(tenantId);
    return this.prisma.schoolAcctPeriod.findMany({
      where: { tenantId, financialYearId: fy.id },
      orderBy: { startsOn: 'asc' },
    });
  }

  async lockPeriod(tenantId: string, id: string, actorUserId: string) {
    return this.prisma.schoolAcctPeriod.update({
      where: { id },
      data: { status: 'CLOSED', lockedAt: new Date(), lockedBy: actorUserId },
    });
  }

  async yearEnd(tenantId: string, actorUserId: string) {
    const fy = await this.posting.ensureBooks(tenantId);
    const tb = await this.trialBalance(tenantId);
    if (tb.totals.debit !== tb.totals.credit) {
      throw new BadRequestException('Trial balance is not squared');
    }
    await this.prisma.schoolAcctPeriod.updateMany({
      where: { financialYearId: fy.id },
      data: { status: 'CLOSED', lockedAt: new Date(), lockedBy: actorUserId },
    });
    return this.prisma.schoolFinYear.update({
      where: { id: fy.id },
      data: { status: 'CLOSED', lockedAt: new Date(), lockedBy: actorUserId },
    });
  }

  async audit(tenantId: string) {
    return this.prisma.schoolAcctAudit.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async approvalRules(tenantId: string) {
    await this.posting.ensureBooks(tenantId);
    return this.prisma.schoolAcctApprovalRule.findMany({
      where: { tenantId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async saveRule(tenantId: string, dto: AcctApprovalRuleDto) {
    return this.prisma.schoolAcctApprovalRule.create({
      data: {
        tenantId,
        voucherType: dto.voucherType ?? '*',
        minAmount: money(dto.minAmount),
        maxAmount: dto.maxAmount ? money(dto.maxAmount) : null,
        approverRole: dto.approverRole,
      },
    });
  }

  async settleGateway(
    tenantId: string,
    dto: AcctGatewaySettleDto,
    actorUserId: string,
  ) {
    return this.posting.postGatewaySettlement(tenantId, {
      settlementId: dto.settlementId,
      gross: Number(dto.gross),
      charges: Number(dto.charges),
      bank: Number(dto.bank),
      actorUserId,
    });
  }

  async exportReport(
    tenantId: string,
    key: string,
    format: 'pdf' | 'xlsx' | 'csv' | 'html',
    userId?: string,
  ) {
    const fy = await this.posting.ensureBooks(tenantId);
    let title = 'Accounts Report';
    let columns: { key: string; label: string; kind?: 'text' | 'currency' }[] =
      [];
    let rows: Record<string, unknown>[] = [];
    if (key === 'trial-balance') {
      const tb = await this.trialBalance(tenantId);
      title = 'Trial Balance';
      columns = [
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Account' },
        { key: 'debit', label: 'Debit', kind: 'currency' },
        { key: 'credit', label: 'Credit', kind: 'currency' },
      ];
      rows = tb.rows;
    } else if (key === 'day-book') {
      const list = await this.vouchers(tenantId, {});
      title = 'Day Book';
      columns = [
        { key: 'voucherNo', label: 'Voucher' },
        { key: 'voucherType', label: 'Type' },
        { key: 'narration', label: 'Particulars' },
        { key: 'totalDebit', label: 'Debit', kind: 'currency' },
        { key: 'status', label: 'Status' },
      ];
      rows = list;
    } else {
      const st = await this.statements(tenantId);
      title = 'Income & Expenditure';
      columns = [
        { key: 'name', label: 'Account' },
        { key: 'debit', label: 'Debit', kind: 'currency' },
        { key: 'credit', label: 'Credit', kind: 'currency' },
      ];
      rows = [
        ...st.incomeExpenditure.income,
        ...st.incomeExpenditure.expense,
      ] as never;
    }
    return this.reports.generate({
      tenantId,
      format,
      userId,
      document: {
        key: `accounts-${key}`,
        title,
        academicYear: fy.code,
        columns,
        rows,
        official: true,
      },
    });
  }

  private async mustVoucher(tenantId: string, id: string) {
    const v = await this.prisma.schoolAcctVoucher.findFirst({
      where: { id, tenantId },
    });
    if (!v) throw new NotFoundException('Voucher not found');
    return v;
  }
}

function n(v: Prisma.Decimal | number | string) {
  return money(v).toFixed(2);
}

function range(from?: string, to?: string) {
  if (!from && !to) return undefined;
  return {
    gte: from ? new Date(from) : undefined,
    lte: to ? new Date(to) : undefined,
  };
}

function sumType(
  vouchers: Array<{
    lines: Array<{
      debit: Prisma.Decimal;
      credit: Prisma.Decimal;
      account: { type: string };
    }>;
  }>,
  type: string,
) {
  let t = zero();
  for (const v of vouchers) {
    for (const l of v.lines) {
      if (l.account.type !== type) continue;
      t =
        type === 'INCOME'
          ? add(t, money(l.credit).sub(l.debit))
          : add(t, money(l.debit).sub(l.credit));
    }
  }
  return t;
}

function pickVendor(dto: AcctVendorDto) {
  return {
    contact: dto.contact,
    address: dto.address,
    pan: dto.pan,
    gstin: dto.gstin,
    bankName: dto.bankName,
    accountNumber: dto.accountNumber,
    ifsc: dto.ifsc,
    category: dto.category,
  };
}
