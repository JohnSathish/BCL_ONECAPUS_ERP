import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { BooksQueryDto, LedgerQueryDto } from '../dto/accounting.dto';
import { FinancialYearService } from './financial-year.service';

@Injectable()
export class BooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financialYear: FinancialYearService,
  ) {}

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

  async cashBook(tenantId: string, query: BooksQueryDto) {
    const { fromDate, toDate } = await this.resolveDateRange(tenantId, query);

    const cashLedgers = await this.prisma.accountingLedgerAccount.findMany({
      where: { tenantId, isCash: true, isActive: true },
    });
    const ledgerIds = cashLedgers.map((l) => l.id);
    if (!ledgerIds.length) {
      return {
        openingBalance: 0,
        receipts: 0,
        payments: 0,
        closingBalance: 0,
        entries: [],
      };
    }

    return this.buildBook(tenantId, ledgerIds, fromDate, toDate);
  }

  async bankBook(tenantId: string, query: BooksQueryDto) {
    const { fromDate, toDate } = await this.resolveDateRange(tenantId, query);

    const bankLedgers = await this.prisma.accountingLedgerAccount.findMany({
      where: { tenantId, isBank: true, isActive: true },
    });
    const ledgerIds = bankLedgers.map((l) => l.id);
    if (!ledgerIds.length) {
      return {
        openingBalance: 0,
        receipts: 0,
        payments: 0,
        closingBalance: 0,
        entries: [],
      };
    }

    return this.buildBook(tenantId, ledgerIds, fromDate, toDate);
  }

  async generalLedger(tenantId: string, query: LedgerQueryDto) {
    if (!query.ledgerAccountId) {
      throw new NotFoundException('ledgerAccountId is required');
    }

    const ledger = await this.prisma.accountingLedgerAccount.findFirst({
      where: { tenantId, id: query.ledgerAccountId },
      include: { group: true },
    });
    if (!ledger) throw new NotFoundException('Ledger account not found');

    const { fromDate, toDate } = await this.resolveDateRange(tenantId, query);
    const book = await this.buildBook(tenantId, [ledger.id], fromDate, toDate);

    return {
      ledger,
      ...book,
    };
  }

  private async buildBook(
    tenantId: string,
    ledgerIds: string[],
    fromDate: Date,
    toDate: Date,
  ) {
    const priorAgg = await this.prisma.accountingLedgerPosting.aggregate({
      where: {
        tenantId,
        ledgerAccountId: { in: ledgerIds },
        voucherDate: { lt: fromDate },
      },
      _sum: {
        amount: true,
      },
    });

    const ledgers = await this.prisma.accountingLedgerAccount.findMany({
      where: { id: { in: ledgerIds } },
      include: { group: true },
    });

    const openingFromLedgers = ledgers.reduce(
      (sum, l) => sum + Number(l.openingBalance),
      0,
    );

    const postings = await this.prisma.accountingLedgerPosting.findMany({
      where: {
        tenantId,
        ledgerAccountId: { in: ledgerIds },
        voucherDate: { gte: fromDate, lte: toDate },
      },
      orderBy: [{ voucherDate: 'asc' }, { createdAt: 'asc' }],
      include: {
        voucher: { include: { voucherType: true } },
        ledgerAccount: { include: { group: true } },
      },
    });

    let running = openingFromLedgers;
    let receipts = 0;
    let payments = 0;

    const entries = postings.map((p) => {
      const amount = Number(p.amount);
      const isReceipt =
        (p.ledgerAccount.group.nature === 'ASSET' && p.entryType === 'DEBIT') ||
        (p.ledgerAccount.group.nature === 'LIABILITY' &&
          p.entryType === 'CREDIT');

      if (isReceipt) receipts += amount;
      else payments += amount;

      const delta =
        p.entryType === 'DEBIT'
          ? p.ledgerAccount.group.nature === 'ASSET' ||
            p.ledgerAccount.group.nature === 'EXPENSE'
            ? amount
            : -amount
          : p.ledgerAccount.group.nature === 'ASSET' ||
              p.ledgerAccount.group.nature === 'EXPENSE'
            ? -amount
            : amount;

      running += delta;

      return {
        id: p.id,
        voucherDate: p.voucherDate,
        voucherNo: p.voucher.voucherNo,
        voucherType: p.voucher.voucherType.name,
        entryType: p.entryType,
        amount,
        narration: p.narration,
        ledgerName: p.ledgerAccount.name,
        paymentMode: p.voucher.paymentMode,
        chequeNo: p.voucher.chequeNo,
        runningBalance: running,
      };
    });

    return {
      openingBalance: openingFromLedgers,
      receipts,
      payments,
      closingBalance: running,
      entries,
    };
  }
}
