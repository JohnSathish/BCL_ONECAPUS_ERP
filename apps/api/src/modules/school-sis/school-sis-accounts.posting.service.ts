import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SchoolSisService } from './school-sis.service';
import {
  ACCT_VOUCHER_PREFIX,
  COST_CENTRE_SEED,
  DEFAULT_APPROVAL_RULES,
  DEFAULT_COA,
  MODE_TO_ASSET,
  type AcctVoucherType,
} from './school-sis-accounts.catalog';
import {
  assertBalanced,
  indianFy,
  money,
  paiseToMoney,
  twoSided,
  type DraftLine,
} from './school-sis-accounts.money';

type Db = Prisma.TransactionClient | PrismaService;

export type PostRequest = {
  voucherType: AcctVoucherType;
  date: Date;
  narration: string;
  lines: DraftLine[];
  actorUserId: string;
  ip?: string;
  payerName?: string;
  payeeName?: string;
  studentId?: string;
  vendorId?: string;
  costCentreId?: string;
  paymentMode?: string;
  bankAccountId?: string;
  referenceNo?: string;
  chequeNo?: string;
  sourceModule?: string;
  sourceId?: string;
  idempotencyKey?: string;
  autoPost?: boolean;
  skipSelfApprove?: boolean;
  academicYearId?: string;
  reversalOfId?: string;
};

@Injectable()
export class SchoolSisAccountsPostingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sis: SchoolSisService,
  ) {}

  async ensureBooks(tenantId: string, db: Db = this.prisma) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const fyMeta = indianFy();
    let fy = await db.schoolFinYear.findUnique({
      where: { tenantId_code: { tenantId, code: fyMeta.code } },
    });
    if (!fy) {
      fy = await db.schoolFinYear.create({
        data: {
          tenantId,
          code: fyMeta.code,
          name: fyMeta.name,
          startsOn: fyMeta.startsOn,
          endsOn: fyMeta.endsOn,
        },
      });
      const months = 12;
      for (let i = 0; i < months; i++) {
        const startsOn = new Date(
          Date.UTC(fyMeta.startsOn.getUTCFullYear(), 3 + i, 1),
        );
        const endsOn = new Date(
          Date.UTC(fyMeta.startsOn.getUTCFullYear(), 4 + i, 0),
        );
        const code = `${startsOn.getUTCFullYear()}-${String(startsOn.getUTCMonth() + 1).padStart(2, '0')}`;
        await db.schoolAcctPeriod.create({
          data: {
            tenantId,
            financialYearId: fy.id,
            code,
            name: startsOn.toLocaleString('en-IN', {
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            }),
            startsOn,
            endsOn,
          },
        });
      }
    }
    const count = await db.schoolAcctAccount.count({ where: { tenantId } });
    if (!count) {
      const ids = new Map<string, string>();
      for (const row of DEFAULT_COA) {
        const created = await db.schoolAcctAccount.create({
          data: {
            tenantId,
            code: row.code,
            name: row.name,
            type: row.type,
            parentId: row.parentCode ? ids.get(row.parentCode) : null,
            systemKey: row.systemKey ?? null,
            moduleKey: row.moduleKey ?? null,
            isGroup: !!row.isGroup,
            isSystem: !!row.systemKey || !!row.isGroup,
          },
        });
        ids.set(row.code, created.id);
      }
      for (const [code, name] of COST_CENTRE_SEED) {
        await db.schoolAcctCostCentre.create({
          data: { tenantId, code, name },
        });
      }
      for (const rule of DEFAULT_APPROVAL_RULES) {
        await db.schoolAcctApprovalRule.create({
          data: {
            tenantId,
            minAmount: money(rule.min),
            maxAmount: rule.max ? money(rule.max) : null,
            approverRole: rule.role,
            sortOrder: rule.sort,
          },
        });
      }
    }
    return fy;
  }

  async post(
    tenantId: string,
    req: PostRequest,
    db?: Prisma.TransactionClient,
  ) {
    if (db) return this.postIn(db, tenantId, req);
    return this.prisma.$transaction((tx) => this.postIn(tx, tenantId, req));
  }

  async reverseVoucher(
    tenantId: string,
    voucherId: string,
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const original = await tx.schoolAcctVoucher.findFirst({
        where: { id: voucherId, tenantId, status: 'POSTED' },
        include: { lines: true },
      });
      if (!original) throw new NotFoundException('Posted voucher not found');
      return this.postIn(tx, tenantId, {
        voucherType: 'REVERSAL',
        date: new Date(),
        narration: `Reversal of ${original.voucherNo}`,
        lines: original.lines.map((l) => ({
          accountId: l.accountId,
          debit: l.credit,
          credit: l.debit,
          particulars: `REV ${l.particulars ?? ''}`.trim(),
        })),
        actorUserId,
        sourceModule: original.sourceModule ?? 'manual',
        sourceId: `${original.id}:rev`,
        idempotencyKey: `rev:${original.id}`,
        autoPost: true,
        reversalOfId: original.id,
      });
    });
  }

  async reverseFromSource(
    tenantId: string,
    sourceModule: string,
    sourceId: string,
    actorUserId: string,
    db?: Prisma.TransactionClient,
  ) {
    const run = async (tx: Prisma.TransactionClient) => {
      const original = await tx.schoolAcctVoucher.findFirst({
        where: {
          tenantId,
          sourceModule,
          sourceId,
          status: 'POSTED',
          reversalOfId: null,
        },
        include: { lines: true },
      });
      if (!original) return null;
      return this.postIn(tx, tenantId, {
        voucherType: 'REVERSAL',
        date: new Date(),
        narration: `Reversal of ${original.voucherNo}`,
        lines: original.lines.map((l) => ({
          accountId: l.accountId,
          debit: l.credit,
          credit: l.debit,
          particulars: `REV ${l.particulars ?? ''}`.trim(),
        })),
        actorUserId,
        sourceModule,
        sourceId: `${sourceId}:rev`,
        idempotencyKey: `rev:${original.id}`,
        autoPost: true,
        reversalOfId: original.id,
      });
    };
    if (db) return run(db);
    return this.prisma.$transaction(run);
  }

  async postFeeCollection(
    tenantId: string,
    input: {
      paymentId: string;
      receiptNumber: string;
      amount: number;
      discount?: number;
      lateFee?: number;
      mode: string;
      studentId: string;
      actorUserId?: string;
      payerName?: string;
    },
    db: Prisma.TransactionClient,
  ) {
    const cash = money(input.amount);
    const late = money(input.lateFee ?? 0);
    const discount = money(input.discount ?? 0);
    if (cash.lte(0) && discount.lte(0)) return null;
    const assetKey = MODE_TO_ASSET[input.mode] ?? 'CASH';
    const tuition = cash.sub(late);
    const lines: DraftLine[] = [];
    if (cash.gt(0)) {
      lines.push({
        systemKey: assetKey,
        debit: cash,
        credit: 0,
        particulars: `Fee ${input.receiptNumber}`,
      });
    }
    if (tuition.gt(0)) {
      lines.push({
        systemKey: 'TUITION_FEES',
        debit: 0,
        credit: tuition,
        particulars: `Fee ${input.receiptNumber}`,
      });
    }
    if (late.gt(0)) {
      lines.push({
        systemKey: 'LATE_FEE',
        debit: 0,
        credit: late,
        particulars: 'Late fee',
      });
    }
    if (discount.gt(0)) {
      lines.push({
        systemKey: 'CONCESSION',
        debit: discount,
        credit: 0,
        particulars: 'Concession',
      });
      lines.push({
        systemKey: 'TUITION_FEES',
        debit: 0,
        credit: discount,
        particulars: 'Concession',
      });
    }
    return this.postIn(db, tenantId, {
      voucherType: 'RECEIPT',
      date: new Date(),
      narration: `Fee receipt ${input.receiptNumber}`,
      lines,
      actorUserId: input.actorUserId ?? '00000000-0000-0000-0000-000000000000',
      studentId: input.studentId,
      payerName: input.payerName,
      paymentMode: input.mode,
      sourceModule: 'fees',
      sourceId: input.paymentId,
      idempotencyKey: `fees:${input.paymentId}`,
      autoPost: true,
    });
  }

  async postPayrollAccrual(
    tenantId: string,
    input: {
      runId: string;
      grossPaise: number;
      actorUserId: string;
    },
  ) {
    return this.post(tenantId, {
      voucherType: 'JOURNAL',
      date: new Date(),
      narration: `Payroll accrual ${input.runId}`,
      lines: twoSided({
        debitAccount: { systemKey: 'SALARIES' },
        creditAccount: { systemKey: 'SALARY_PAYABLE' },
        amount: paiseToMoney(input.grossPaise),
      }),
      actorUserId: input.actorUserId,
      sourceModule: 'payroll',
      sourceId: input.runId,
      idempotencyKey: `payroll-accrual:${input.runId}`,
      autoPost: true,
    });
  }

  async postPayrollPayment(
    tenantId: string,
    input: {
      runId: string;
      netPaise: number;
      mode: string;
      actorUserId: string;
    },
  ) {
    const asset = MODE_TO_ASSET[input.mode] ?? 'BANK';
    return this.post(tenantId, {
      voucherType: 'PAYMENT',
      date: new Date(),
      narration: `Salary payment ${input.runId}`,
      lines: twoSided({
        debitAccount: { systemKey: 'SALARY_PAYABLE' },
        creditAccount: { systemKey: asset },
        amount: paiseToMoney(input.netPaise),
      }),
      actorUserId: input.actorUserId,
      paymentMode: input.mode,
      sourceModule: 'payroll-pay',
      sourceId: input.runId,
      idempotencyKey: `payroll-pay:${input.runId}:${input.netPaise}`,
      autoPost: true,
    });
  }

  async postLibraryFine(
    tenantId: string,
    input: {
      paymentId: string;
      receiptNo: string;
      amount: number;
      mode: string;
      actorUserId: string;
      payerName?: string;
    },
  ) {
    const asset = MODE_TO_ASSET[input.mode] ?? 'CASH';
    return this.post(tenantId, {
      voucherType: 'RECEIPT',
      date: new Date(),
      narration: `Library fine ${input.receiptNo}`,
      payerName: input.payerName,
      paymentMode: input.mode,
      lines: twoSided({
        debitAccount: { systemKey: asset },
        creditAccount: { systemKey: 'LIBRARY_FINE' },
        amount: input.amount,
      }),
      actorUserId: input.actorUserId,
      sourceModule: 'library-fine',
      sourceId: input.paymentId,
      idempotencyKey: `library-fine:${input.paymentId}`,
      autoPost: true,
    });
  }

  async postStationerySale(
    tenantId: string,
    input: {
      saleId: string;
      invoiceNo: string;
      amount: number;
      mode: string;
      actorUserId: string;
    },
    db?: Prisma.TransactionClient,
  ) {
    const asset = MODE_TO_ASSET[input.mode] ?? 'CASH';
    return this.post(
      tenantId,
      {
        voucherType: 'SALES_INVOICE',
        date: new Date(),
        narration: `Stationery ${input.invoiceNo}`,
        lines: twoSided({
          debitAccount: { systemKey: asset },
          creditAccount: { systemKey: 'STATIONERY_SALES' },
          amount: input.amount,
        }),
        actorUserId: input.actorUserId,
        paymentMode: input.mode,
        sourceModule: 'stationery',
        sourceId: input.saleId,
        idempotencyKey: `stationery:${input.saleId}`,
        autoPost: true,
      },
      db,
    );
  }

  async postGatewaySettlement(
    tenantId: string,
    input: {
      settlementId: string;
      gross: number;
      charges: number;
      bank: number;
      actorUserId: string;
    },
  ) {
    const gross = money(input.gross);
    const charges = money(input.charges);
    const bank = money(input.bank);
    const lines: DraftLine[] = [
      {
        systemKey: 'BANK',
        debit: bank,
        credit: 0,
        particulars: 'Settlement credit',
      },
      {
        systemKey: 'GATEWAY_CHARGES',
        debit: charges,
        credit: 0,
        particulars: 'Gateway fee',
      },
      {
        systemKey: 'GATEWAY_RECEIVABLE',
        debit: 0,
        credit: gross,
        particulars: 'Clear gateway receivable',
      },
    ];
    return this.post(tenantId, {
      voucherType: 'JOURNAL',
      date: new Date(),
      narration: `Gateway settlement ${input.settlementId}`,
      lines,
      actorUserId: input.actorUserId,
      sourceModule: 'gateway',
      sourceId: input.settlementId,
      idempotencyKey: `gateway:${input.settlementId}`,
      autoPost: true,
    });
  }

  private async postIn(
    tx: Prisma.TransactionClient,
    tenantId: string,
    req: PostRequest,
  ) {
    if (req.idempotencyKey) {
      const existing = await tx.schoolAcctVoucher.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId,
            idempotencyKey: req.idempotencyKey,
          },
        },
        include: {
          lines: { include: { account: true }, orderBy: { lineNo: 'asc' } },
        },
      });
      if (existing) return existing;
    }
    const fy = await this.ensureBooks(tenantId, tx);
    if (fy.status !== 'OPEN') {
      throw new BadRequestException('Financial year is closed');
    }
    const date = req.date;
    if (date < fy.startsOn || date > fy.endsOn) {
      throw new BadRequestException(
        'Voucher date is outside the financial year',
      );
    }
    const period = await tx.schoolAcctPeriod.findFirst({
      where: {
        tenantId,
        financialYearId: fy.id,
        startsOn: { lte: date },
        endsOn: { gte: date },
      },
    });
    if (period?.status === 'CLOSED') {
      throw new BadRequestException(`${period.name} is locked`);
    }
    const resolved = await this.resolveLines(tx, tenantId, req.lines);
    let totals: {
      debit: ReturnType<typeof money>;
      credit: ReturnType<typeof money>;
    };
    try {
      totals = assertBalanced(resolved);
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Unbalanced voucher',
      );
    }
    const voucherNo = await this.nextNo(
      tx,
      tenantId,
      fy.id,
      fy.code,
      req.voucherType,
    );
    const autoPost = req.autoPost !== false;
    const status = autoPost ? 'POSTED' : 'DRAFT';
    const now = new Date();
    try {
      const voucher = await tx.schoolAcctVoucher.create({
        data: {
          tenantId,
          financialYearId: fy.id,
          academicYearId: req.academicYearId ?? null,
          periodId: period?.id ?? null,
          voucherNo,
          voucherType: req.voucherType,
          status,
          voucherDate: date,
          narration: req.narration,
          payerName: req.payerName ?? null,
          payeeName: req.payeeName ?? null,
          studentId: req.studentId ?? null,
          vendorId: req.vendorId ?? null,
          costCentreId: req.costCentreId ?? null,
          paymentMode: req.paymentMode ?? null,
          bankAccountId: req.bankAccountId ?? null,
          referenceNo: req.referenceNo ?? null,
          chequeNo: req.chequeNo ?? null,
          idempotencyKey: req.idempotencyKey ?? `v:${voucherNo}`,
          sourceModule: req.sourceModule ?? null,
          sourceId: req.sourceId ?? null,
          reversalOfId: req.reversalOfId ?? null,
          totalDebit: totals.debit,
          totalCredit: totals.credit,
          createdBy: req.actorUserId,
          createdIp: req.ip ?? null,
          postedBy: status === 'POSTED' ? req.actorUserId : null,
          postedAt: status === 'POSTED' ? now : null,
          lines: {
            create: resolved.map((l, i) => ({
              tenantId,
              lineNo: i + 1,
              accountId: l.accountId!,
              debit: money(l.debit),
              credit: money(l.credit),
              particulars: l.particulars ?? null,
              costCentreId: l.costCentreId ?? req.costCentreId ?? null,
            })),
          },
        },
        include: {
          lines: { include: { account: true }, orderBy: { lineNo: 'asc' } },
        },
      });
      await tx.schoolAcctAudit.create({
        data: {
          tenantId,
          voucherId: voucher.id,
          actorId: req.actorUserId,
          action: status === 'POSTED' ? 'POSTED' : 'CREATED',
          ip: req.ip ?? null,
          afterJson: { voucherNo, totals: totals.debit.toFixed(2) },
        },
      });
      return voucher;
    } catch (err) {
      if (err instanceof Error && err.message.includes('≠')) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
  }

  private async resolveLines(
    tx: Prisma.TransactionClient,
    tenantId: string,
    lines: DraftLine[],
  ): Promise<DraftLine[]> {
    const out: DraftLine[] = [];
    for (const line of lines) {
      let accountId = line.accountId;
      if (!accountId && line.systemKey) {
        const acc = await tx.schoolAcctAccount.findFirst({
          where: { tenantId, systemKey: line.systemKey, active: true },
        });
        if (!acc)
          throw new NotFoundException(
            `Account ${line.systemKey} is not mapped`,
          );
        if (acc.isGroup) {
          throw new BadRequestException(`${acc.name} is a group account`);
        }
        accountId = acc.id;
      }
      if (!accountId)
        throw new BadRequestException('Each line needs an account');
      out.push({ ...line, accountId });
    }
    return out;
  }

  private async nextNo(
    tx: Prisma.TransactionClient,
    tenantId: string,
    financialYearId: string,
    yearCode: string,
    kind: AcctVoucherType,
  ) {
    const row = await tx.schoolAcctSequence.upsert({
      where: {
        tenantId_financialYearId_kind: {
          tenantId,
          financialYearId,
          kind,
        },
      },
      update: { lastValue: { increment: 1 } },
      create: { tenantId, financialYearId, kind, lastValue: 1 },
    });
    const prefix = ACCT_VOUCHER_PREFIX[kind];
    return `${prefix}/${yearCode}/${String(row.lastValue).padStart(6, '0')}`;
  }
}
