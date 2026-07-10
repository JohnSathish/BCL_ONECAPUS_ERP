import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AccountingSettingsService } from './accounting-settings.service';
import { AutoVoucherService } from './auto-voucher.service';

type FeeLedgerBridgeInput = {
  tenantId: string;
  studentId: string;
  entryType: string;
  paymentId?: string;
  creditAmount?: number;
  debitAmount?: number;
  description?: string;
  postedById?: string;
  feeLedgerEntryId: string;
};

@Injectable()
export class FeesJournalBridgeService {
  private readonly logger = new Logger(FeesJournalBridgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: AccountingSettingsService,
    private readonly autoVoucher: AutoVoucherService,
  ) {}

  async onFeeLedgerPosted(input: FeeLedgerBridgeInput) {
    if (input.entryType !== 'PAYMENT' || !input.paymentId) return null;

    const existing = await this.prisma.accountingIntegrationLog.findUnique({
      where: {
        tenantId_sourceModule_sourceType_sourceId: {
          tenantId: input.tenantId,
          sourceModule: 'fees',
          sourceType: 'FEE_LEDGER_ENTRY',
          sourceId: input.feeLedgerEntryId,
        },
      },
    });
    if (existing?.status === 'SUCCESS') return existing;

    try {
      const config = await this.settings.getSettings(input.tenantId);
      if (!config.autoPostFees) return null;

      const payment = await this.prisma.paymentTransaction.findFirst({
        where: { tenantId: input.tenantId, id: input.paymentId },
        include: {
          allocations: {
            include: {
              demand: { include: { lines: true } },
            },
          },
        },
      });
      if (!payment) {
        throw new Error(`Payment ${input.paymentId} not found`);
      }

      const amount = Number(input.creditAmount ?? payment.amount);
      if (amount <= 0) return null;

      const debitLedgerId = await this.settings.resolveDebitLedger(
        input.tenantId,
        payment.paymentMode,
      );
      if (!debitLedgerId) {
        throw new Error(
          `No GL ledger mapped for payment mode ${payment.paymentMode}`,
        );
      }

      const creditLines = await this.buildIncomeCreditLines(
        input.tenantId,
        amount,
        payment,
      );

      const voucher = await this.autoVoucher.postBalanced({
        tenantId: input.tenantId,
        voucherTypeCode: 'RECEIPT',
        voucherDate: payment.paidAt ?? new Date(),
        narration:
          input.description ??
          `Auto journal · fee payment ${payment.transactionNo}`,
        referenceNo: payment.transactionNo,
        paymentMode: payment.paymentMode,
        postedById: input.postedById,
        metadata: {
          sourceModule: 'fees',
          paymentId: payment.id,
          studentId: input.studentId,
          feeLedgerEntryId: input.feeLedgerEntryId,
        },
        lines: [
          {
            ledgerAccountId: debitLedgerId,
            entryType: 'DEBIT',
            amount,
          },
          ...creditLines.map((line) => ({
            ledgerAccountId: line.ledgerAccountId,
            entryType: 'CREDIT' as const,
            amount: line.amount,
          })),
        ],
      });

      return this.prisma.accountingIntegrationLog.upsert({
        where: {
          tenantId_sourceModule_sourceType_sourceId: {
            tenantId: input.tenantId,
            sourceModule: 'fees',
            sourceType: 'FEE_LEDGER_ENTRY',
            sourceId: input.feeLedgerEntryId,
          },
        },
        create: {
          tenantId: input.tenantId,
          sourceModule: 'fees',
          sourceType: 'FEE_LEDGER_ENTRY',
          sourceId: input.feeLedgerEntryId,
          voucherId: voucher.id,
          status: 'SUCCESS',
          metadata: { voucherNo: voucher.voucherNo },
        },
        update: {
          voucherId: voucher.id,
          status: 'SUCCESS',
          errorMessage: null,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Fee journal bridge failed';
      this.logger.warn(`Fee GL post failed: ${message}`);

      await this.prisma.accountingIntegrationLog.upsert({
        where: {
          tenantId_sourceModule_sourceType_sourceId: {
            tenantId: input.tenantId,
            sourceModule: 'fees',
            sourceType: 'FEE_LEDGER_ENTRY',
            sourceId: input.feeLedgerEntryId,
          },
        },
        create: {
          tenantId: input.tenantId,
          sourceModule: 'fees',
          sourceType: 'FEE_LEDGER_ENTRY',
          sourceId: input.feeLedgerEntryId,
          status: 'FAILED',
          errorMessage: message,
        },
        update: {
          status: 'FAILED',
          errorMessage: message,
        },
      });

      return null;
    }
  }

  private async buildIncomeCreditLines(
    tenantId: string,
    totalAmount: number,
    payment: {
      allocations: Array<{
        amount: unknown;
        demand: {
          lines: Array<{ code: string; category: string; amount: unknown }>;
        };
      }>;
    },
  ) {
    const buckets = new Map<string, number>();

    if (payment.allocations.length > 0) {
      for (const allocation of payment.allocations) {
        const allocAmount = Number(allocation.amount);
        const demandTotal = allocation.demand.lines.reduce(
          (sum, line) => sum + Number(line.amount),
          0,
        );
        for (const line of allocation.demand.lines) {
          const weight =
            demandTotal > 0
              ? Number(line.amount) / demandTotal
              : 1 / Math.max(allocation.demand.lines.length, 1);
          const key = line.code || line.category || 'TUITION-FEES';
          buckets.set(key, (buckets.get(key) ?? 0) + allocAmount * weight);
        }
      }
    }

    if (buckets.size === 0) {
      buckets.set('TUITION-FEES', totalAmount);
    } else {
      const bucketTotal = [...buckets.values()].reduce((a, b) => a + b, 0);
      if (Math.abs(bucketTotal - totalAmount) > 0.05) {
        buckets.clear();
        buckets.set('TUITION-FEES', totalAmount);
      }
    }

    const lines: Array<{ ledgerAccountId: string; amount: number }> = [];
    for (const [sourceKey, amount] of buckets) {
      const ledgerId = await this.settings.resolveIncomeLedger(
        tenantId,
        sourceKey,
      );
      if (!ledgerId) continue;
      const rounded = Math.round(amount * 100) / 100;
      if (rounded <= 0) continue;
      lines.push({ ledgerAccountId: ledgerId, amount: rounded });
    }

    if (!lines.length) {
      const fallback = await this.settings.resolveIncomeLedger(
        tenantId,
        'TUITION-FEES',
      );
      if (!fallback) {
        throw new Error('No income ledger configured for fee posting');
      }
      lines.push({ ledgerAccountId: fallback, amount: totalAmount });
    }

    const creditSum = lines.reduce((sum, line) => sum + line.amount, 0);
    const diff = Math.round((totalAmount - creditSum) * 100) / 100;
    if (Math.abs(diff) >= 0.01 && lines[0]) {
      lines[0].amount = Math.round((lines[0].amount + diff) * 100) / 100;
    }

    return lines;
  }
}
