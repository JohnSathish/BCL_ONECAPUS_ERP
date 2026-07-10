import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { UpdateFixedAssetDto } from '../dto/accounting.dto';
import { AccountingBootstrapService } from './accounting-bootstrap.service';
import { AutoVoucherService } from './auto-voucher.service';
import { FinancialYearService } from './financial-year.service';

export type CreateFixedAssetInput = {
  code: string;
  name: string;
  category: string;
  acquisitionDate: string;
  cost: number;
  salvageValue?: number;
  usefulLifeMonths: number;
  assetLedgerId: string;
  accumDepreciationLedgerId: string;
  expenseLedgerId: string;
  location?: string;
};

@Injectable()
export class FixedAssetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bootstrap: AccountingBootstrapService,
    private readonly financialYear: FinancialYearService,
    private readonly autoVoucher: AutoVoucherService,
  ) {}

  async list(tenantId: string, params?: { search?: string; status?: string }) {
    await this.bootstrap.ensureTenantSetup(tenantId);
    const where: Record<string, unknown> = { tenantId };
    if (params?.status) where.status = params.status;
    if (params?.search) {
      where.OR = [
        { code: { contains: params.search, mode: 'insensitive' } },
        { name: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const items = await this.prisma.accountingFixedAsset.findMany({
      where,
      include: {
        assetLedger: true,
        accumDepreciationLedger: true,
        expenseLedger: true,
      },
      orderBy: { acquisitionDate: 'desc' },
    });

    return items.map((asset) => this.withBookValue(asset));
  }

  async create(tenantId: string, input: CreateFixedAssetInput) {
    await this.financialYear.assertActiveOpen(tenantId);
    await this.bootstrap.ensureTenantSetup(tenantId);
    const cost = input.cost;
    if (cost <= 0) throw new BadRequestException('Asset cost must be positive');

    const asset = await this.prisma.accountingFixedAsset.create({
      data: {
        tenantId,
        code: input.code.trim().toUpperCase(),
        name: input.name.trim(),
        category: input.category.trim().toUpperCase(),
        acquisitionDate: new Date(input.acquisitionDate),
        cost,
        salvageValue: input.salvageValue ?? 0,
        usefulLifeMonths: input.usefulLifeMonths,
        assetLedgerId: input.assetLedgerId,
        accumDepreciationLedgerId: input.accumDepreciationLedgerId,
        expenseLedgerId: input.expenseLedgerId,
        location: input.location,
      },
      include: {
        assetLedger: true,
        accumDepreciationLedger: true,
        expenseLedger: true,
      },
    });

    return this.withBookValue(asset);
  }

  async update(tenantId: string, id: string, dto: UpdateFixedAssetDto) {
    await this.financialYear.assertActiveOpen(tenantId);
    await this.bootstrap.ensureTenantSetup(tenantId);
    const existing = await this.prisma.accountingFixedAsset.findFirst({
      where: { tenantId, id },
    });
    if (!existing) throw new NotFoundException('Fixed asset not found');

    return this.withBookValue(
      await this.prisma.accountingFixedAsset.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.category !== undefined
            ? { category: dto.category.trim().toUpperCase() }
            : {}),
          ...(dto.acquisitionDate !== undefined
            ? { acquisitionDate: new Date(dto.acquisitionDate) }
            : {}),
          ...(dto.cost !== undefined ? { cost: dto.cost } : {}),
          ...(dto.salvageValue !== undefined
            ? { salvageValue: dto.salvageValue }
            : {}),
          ...(dto.usefulLifeMonths !== undefined
            ? { usefulLifeMonths: dto.usefulLifeMonths }
            : {}),
          ...(dto.assetLedgerId !== undefined
            ? { assetLedgerId: dto.assetLedgerId }
            : {}),
          ...(dto.accumDepreciationLedgerId !== undefined
            ? { accumDepreciationLedgerId: dto.accumDepreciationLedgerId }
            : {}),
          ...(dto.expenseLedgerId !== undefined
            ? { expenseLedgerId: dto.expenseLedgerId }
            : {}),
          ...(dto.location !== undefined ? { location: dto.location } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
        },
        include: {
          assetLedger: true,
          accumDepreciationLedger: true,
          expenseLedger: true,
        },
      }),
    );
  }

  async runDepreciation(
    tenantId: string,
    periodYear: number,
    periodMonth: number,
    postedById?: string,
  ) {
    await this.financialYear.assertActiveOpen(tenantId);
    await this.bootstrap.ensureTenantSetup(tenantId);
    const activeFy = await this.financialYear.getActive(tenantId);
    const assets = await this.prisma.accountingFixedAsset.findMany({
      where: { tenantId, status: 'ACTIVE' },
    });

    const created: string[] = [];
    for (const asset of assets) {
      const monthly = this.monthlyDepreciation(asset);
      if (monthly <= 0) continue;

      const remaining =
        Number(asset.cost) -
        Number(asset.salvageValue) -
        Number(asset.accumulatedDepreciation);
      if (remaining <= 0) continue;

      const amount = Math.min(monthly, remaining);
      const entry = await this.prisma.accountingDepreciationEntry.upsert({
        where: {
          tenantId_assetId_periodYear_periodMonth: {
            tenantId,
            assetId: asset.id,
            periodYear,
            periodMonth,
          },
        },
        create: {
          tenantId,
          assetId: asset.id,
          financialYearId: activeFy.id,
          periodYear,
          periodMonth,
          amount,
          status: 'DRAFT',
        },
        update: {},
        include: { asset: true },
      });

      if (entry.status === 'DRAFT') {
        created.push(entry.id);
      }
    }

    if (!created.length) {
      return { entriesCreated: 0, entriesPosted: 0, voucherId: null };
    }

    const posted = await this.postDepreciationEntries(
      tenantId,
      created,
      periodYear,
      periodMonth,
      postedById,
    );

    return {
      entriesCreated: created.length,
      entriesPosted: posted.entryIds.length,
      voucherId: posted.voucherId,
    };
  }

  async listDepreciationEntries(
    tenantId: string,
    params?: { periodYear?: number; periodMonth?: number; status?: string },
  ) {
    await this.bootstrap.ensureTenantSetup(tenantId);
    return this.prisma.accountingDepreciationEntry.findMany({
      where: {
        tenantId,
        periodYear: params?.periodYear,
        periodMonth: params?.periodMonth,
        status: params?.status,
      },
      include: {
        asset: { include: { assetLedger: true } },
        voucher: true,
      },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
    });
  }

  private async postDepreciationEntries(
    tenantId: string,
    entryIds: string[],
    periodYear: number,
    periodMonth: number,
    postedById?: string,
  ) {
    const entries = await this.prisma.accountingDepreciationEntry.findMany({
      where: {
        tenantId,
        id: { in: entryIds },
        status: 'DRAFT',
      },
      include: { asset: true },
    });
    if (!entries.length) {
      return { entryIds: [], voucherId: null };
    }

    const expenseBuckets = new Map<string, number>();
    const accumBuckets = new Map<string, number>();

    for (const entry of entries) {
      expenseBuckets.set(
        entry.asset.expenseLedgerId,
        (expenseBuckets.get(entry.asset.expenseLedgerId) ?? 0) +
          Number(entry.amount),
      );
      accumBuckets.set(
        entry.asset.accumDepreciationLedgerId,
        (accumBuckets.get(entry.asset.accumDepreciationLedgerId) ?? 0) +
          Number(entry.amount),
      );
    }

    const lines = [
      ...[...expenseBuckets.entries()].map(([ledgerAccountId, amount]) => ({
        ledgerAccountId,
        entryType: 'DEBIT' as const,
        amount: Math.round(amount * 100) / 100,
      })),
      ...[...accumBuckets.entries()].map(([ledgerAccountId, amount]) => ({
        ledgerAccountId,
        entryType: 'CREDIT' as const,
        amount: Math.round(amount * 100) / 100,
      })),
    ];

    const voucherDate = new Date(periodYear, periodMonth, 0);
    const voucher = await this.autoVoucher.postBalanced({
      tenantId,
      voucherTypeCode: 'JOURNAL',
      voucherDate,
      narration: `Depreciation run ${periodMonth}/${periodYear}`,
      referenceNo: `DEP-${periodYear}-${String(periodMonth).padStart(2, '0')}`,
      postedById,
      metadata: {
        sourceModule: 'fixed_assets',
        periodYear,
        periodMonth,
        entryIds,
      },
      lines,
    });

    await this.prisma.$transaction(async (tx) => {
      for (const entry of entries) {
        await tx.accountingDepreciationEntry.update({
          where: { id: entry.id },
          data: {
            status: 'POSTED',
            voucherId: voucher.id,
            postedAt: new Date(),
          },
        });
        await tx.accountingFixedAsset.update({
          where: { id: entry.assetId },
          data: {
            accumulatedDepreciation: {
              increment: entry.amount,
            },
          },
        });
      }
    });

    return {
      entryIds: entries.map((entry) => entry.id),
      voucherId: voucher.id,
    };
  }

  private monthlyDepreciation(asset: {
    cost: unknown;
    salvageValue: unknown;
    usefulLifeMonths: number;
    accumulatedDepreciation: unknown;
  }) {
    const depreciable = Number(asset.cost) - Number(asset.salvageValue);
    if (depreciable <= 0 || asset.usefulLifeMonths <= 0) return 0;
    return Math.round((depreciable / asset.usefulLifeMonths) * 100) / 100;
  }

  private withBookValue<
    T extends { cost: unknown; accumulatedDepreciation: unknown },
  >(asset: T) {
    const cost = Number(asset.cost);
    const accumulatedDepreciation = Number(asset.accumulatedDepreciation);
    return {
      ...asset,
      cost,
      accumulatedDepreciation,
      bookValue: Math.round((cost - accumulatedDepreciation) * 100) / 100,
    };
  }
}

@Injectable()
export class BankReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bootstrap: AccountingBootstrapService,
    private readonly financialYear: FinancialYearService,
  ) {}

  async list(tenantId: string, ledgerAccountId?: string) {
    await this.bootstrap.ensureTenantSetup(tenantId);
    return this.prisma.accountingBankReconciliation.findMany({
      where: {
        tenantId,
        ledgerAccountId: ledgerAccountId ?? undefined,
      },
      include: {
        ledgerAccount: true,
        lines: { take: 5, orderBy: { lineDate: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(tenantId: string, id: string) {
    const session = await this.prisma.accountingBankReconciliation.findFirst({
      where: { id, tenantId },
      include: {
        ledgerAccount: true,
        lines: { orderBy: { lineDate: 'asc' } },
      },
    });
    if (!session) throw new NotFoundException('Bank reconciliation not found');
    return session;
  }

  async create(
    tenantId: string,
    input: {
      ledgerAccountId: string;
      statementStartDate: string;
      statementEndDate: string;
      statementOpeningBalance: number;
      statementClosingBalance: number;
    },
    createdById?: string,
  ) {
    await this.bootstrap.ensureTenantSetup(tenantId);
    const activeFy = await this.financialYear.getActive(tenantId);
    const ledger = await this.prisma.accountingLedgerAccount.findFirst({
      where: { id: input.ledgerAccountId, tenantId, isBank: true },
    });
    if (!ledger) {
      throw new BadRequestException('Select a valid bank ledger account');
    }

    const bookClosingBalance = Number(ledger.currentBalance);
    const fromDate = new Date(input.statementStartDate);
    const toDate = new Date(input.statementEndDate);

    return this.prisma.accountingBankReconciliation.create({
      data: {
        tenantId,
        ledgerAccountId: input.ledgerAccountId,
        financialYearId: activeFy.id,
        statementStartDate: fromDate,
        statementEndDate: toDate,
        statementOpeningBalance: input.statementOpeningBalance,
        statementClosingBalance: input.statementClosingBalance,
        bookOpeningBalance: Number(ledger.openingBalance),
        bookClosingBalance,
        createdById,
      },
      include: { ledgerAccount: true },
    });
  }

  async importLines(
    tenantId: string,
    reconciliationId: string,
    lines: Array<{
      lineDate: string;
      description?: string;
      referenceNo?: string;
      debitAmount?: number;
      creditAmount?: number;
    }>,
  ) {
    const session = await this.get(tenantId, reconciliationId);
    if (session.status === 'RECONCILED') {
      throw new BadRequestException('Cannot import into a reconciled session');
    }

    await this.prisma.accountingBankStatementLine.createMany({
      data: lines.map((line) => ({
        tenantId,
        reconciliationId,
        lineDate: new Date(line.lineDate),
        description: line.description,
        referenceNo: line.referenceNo,
        debitAmount: line.debitAmount ?? 0,
        creditAmount: line.creditAmount ?? 0,
      })),
    });

    return this.get(tenantId, reconciliationId);
  }

  async autoMatch(tenantId: string, reconciliationId: string) {
    const session = await this.get(tenantId, reconciliationId);
    if (session.status === 'RECONCILED') {
      throw new BadRequestException('Session is already reconciled');
    }

    const unmatched = session.lines.filter(
      (line) => line.matchStatus === 'UNMATCHED',
    );
    const postings = await this.prisma.accountingLedgerPosting.findMany({
      where: {
        tenantId,
        ledgerAccountId: session.ledgerAccountId,
        voucherDate: {
          gte: session.statementStartDate,
          lte: session.statementEndDate,
        },
      },
      include: { voucher: true },
    });

    const usedPostingIds = new Set(
      session.lines
        .map((line) => line.matchedPostingId)
        .filter((id): id is string => Boolean(id)),
    );

    let matched = 0;
    for (const line of unmatched) {
      const lineAmount =
        Number(line.debitAmount) > 0
          ? Number(line.debitAmount)
          : Number(line.creditAmount);
      const lineType = Number(line.debitAmount) > 0 ? 'DEBIT' : 'CREDIT';

      const candidate = postings.find((posting) => {
        if (usedPostingIds.has(posting.id)) return false;
        if (posting.entryType !== lineType) return false;
        if (Math.abs(Number(posting.amount) - lineAmount) > 0.01) return false;
        const daysDiff = Math.abs(
          (posting.voucherDate.getTime() - line.lineDate.getTime()) /
            (1000 * 60 * 60 * 24),
        );
        return daysDiff <= 3;
      });

      if (!candidate) continue;

      usedPostingIds.add(candidate.id);
      await this.prisma.accountingBankStatementLine.update({
        where: { id: line.id },
        data: {
          matchStatus: 'MATCHED',
          matchedPostingId: candidate.id,
          matchedVoucherId: candidate.voucherId,
        },
      });
      matched += 1;
    }

    return { matched, session: await this.get(tenantId, reconciliationId) };
  }

  async reconcile(tenantId: string, reconciliationId: string, userId?: string) {
    const session = await this.get(tenantId, reconciliationId);
    if (session.status === 'RECONCILED') {
      throw new BadRequestException('Session is already reconciled');
    }

    const unmatched = session.lines.filter(
      (line) => line.matchStatus === 'UNMATCHED',
    ).length;

    return this.prisma.accountingBankReconciliation.update({
      where: { id: reconciliationId },
      data: {
        status: 'RECONCILED',
        reconciledById: userId,
        reconciledAt: new Date(),
        metadata: {
          unmatchedLines: unmatched,
          matchedLines: session.lines.length - unmatched,
        },
      },
      include: {
        ledgerAccount: true,
        lines: { orderBy: { lineDate: 'asc' } },
      },
    });
  }
}
