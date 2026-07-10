import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AccountingSettingsService } from './accounting-settings.service';
import { AutoVoucherService } from './auto-voucher.service';

type PayrollBridgeInput = {
  tenantId: string;
  payrollRunId: string;
  postedById?: string;
};

@Injectable()
export class PayrollJournalBridgeService {
  private readonly logger = new Logger(PayrollJournalBridgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: AccountingSettingsService,
    private readonly autoVoucher: AutoVoucherService,
  ) {}

  async onPayrollPublished(input: PayrollBridgeInput) {
    return this.postJournal({
      ...input,
      sourceType: 'PAYROLL_RUN_ACCRUAL',
      voucherTypeCode: 'JOURNAL',
      build: async (run) => this.buildAccrualLines(input.tenantId, run),
      narration: (run) =>
        `Auto journal · payroll accrual ${run.label ?? `${run.month}/${run.year}`}`,
      voucherDate: (run) => run.publishedAt ?? new Date(),
    });
  }

  async onPayrollPaid(input: PayrollBridgeInput) {
    return this.postJournal({
      ...input,
      sourceType: 'PAYROLL_RUN_PAYMENT',
      voucherTypeCode: 'PAYMENT',
      build: async (run) => this.buildPaymentLines(input.tenantId, run),
      narration: (run) =>
        `Auto journal · payroll payment ${run.label ?? `${run.month}/${run.year}`}`,
      voucherDate: (run) => run.paidAt ?? new Date(),
      paymentMode: 'NEFT',
    });
  }

  private async postJournal(params: {
    tenantId: string;
    payrollRunId: string;
    postedById?: string;
    sourceType: string;
    voucherTypeCode: string;
    paymentMode?: string;
    narration: (run: {
      label: string | null;
      month: number;
      year: number;
      publishedAt: Date | null;
      paidAt: Date | null;
    }) => string;
    voucherDate: (run: {
      publishedAt: Date | null;
      paidAt: Date | null;
    }) => Date;
    build: (run: {
      id: string;
      label: string | null;
      month: number;
      year: number;
      totalGross: unknown;
      totalDeductions: unknown;
      totalNet: unknown;
    }) => Promise<
      Array<{
        ledgerAccountId: string;
        entryType: 'DEBIT' | 'CREDIT';
        amount: number;
      }>
    >;
  }) {
    const existing = await this.prisma.accountingIntegrationLog.findUnique({
      where: {
        tenantId_sourceModule_sourceType_sourceId: {
          tenantId: params.tenantId,
          sourceModule: 'payroll',
          sourceType: params.sourceType,
          sourceId: params.payrollRunId,
        },
      },
    });
    if (existing?.status === 'SUCCESS') return existing;

    try {
      const config = await this.settings.getSettings(params.tenantId);
      if (!config.autoPostPayroll) return null;

      const run = await this.prisma.payrollRun.findFirst({
        where: { id: params.payrollRunId, tenantId: params.tenantId },
      });
      if (!run) throw new Error(`Payroll run ${params.payrollRunId} not found`);

      const lines = await params.build(run);
      if (!lines.length) return null;

      const voucher = await this.autoVoucher.postBalanced({
        tenantId: params.tenantId,
        voucherTypeCode: params.voucherTypeCode,
        voucherDate: params.voucherDate(run),
        narration: params.narration(run),
        referenceNo: run.id,
        paymentMode: params.paymentMode,
        postedById: params.postedById,
        metadata: {
          sourceModule: 'payroll',
          payrollRunId: run.id,
          sourceType: params.sourceType,
        },
        lines,
      });

      return this.prisma.accountingIntegrationLog.upsert({
        where: {
          tenantId_sourceModule_sourceType_sourceId: {
            tenantId: params.tenantId,
            sourceModule: 'payroll',
            sourceType: params.sourceType,
            sourceId: params.payrollRunId,
          },
        },
        create: {
          tenantId: params.tenantId,
          sourceModule: 'payroll',
          sourceType: params.sourceType,
          sourceId: params.payrollRunId,
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
        error instanceof Error
          ? error.message
          : 'Payroll journal bridge failed';
      this.logger.warn(`Payroll GL post failed: ${message}`);

      await this.prisma.accountingIntegrationLog.upsert({
        where: {
          tenantId_sourceModule_sourceType_sourceId: {
            tenantId: params.tenantId,
            sourceModule: 'payroll',
            sourceType: params.sourceType,
            sourceId: params.payrollRunId,
          },
        },
        create: {
          tenantId: params.tenantId,
          sourceModule: 'payroll',
          sourceType: params.sourceType,
          sourceId: params.payrollRunId,
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

  private async buildAccrualLines(
    tenantId: string,
    run: {
      id: string;
      totalGross: unknown;
      totalDeductions: unknown;
      totalNet: unknown;
    },
  ) {
    const config = await this.settings.getSettings(tenantId);
    const salaryExpenseId = config.salaryExpenseLedgerId;
    const salaryPayableId = config.salaryPayableLedgerId;
    if (!salaryExpenseId || !salaryPayableId) {
      throw new Error('Salary expense and payable ledgers are not configured');
    }

    const totalGross = Number(run.totalGross);
    const totalNet = Number(run.totalNet);
    if (totalGross <= 0) return [];

    const deductionCredits = await this.buildDeductionCreditLines(
      tenantId,
      run.id,
    );
    const creditSum = deductionCredits.reduce(
      (sum, line) => sum + line.amount,
      0,
    );
    const netCredit = Math.round((totalGross - creditSum) * 100) / 100;

    const lines: Array<{
      ledgerAccountId: string;
      entryType: 'DEBIT' | 'CREDIT';
      amount: number;
    }> = [
      {
        ledgerAccountId: salaryExpenseId,
        entryType: 'DEBIT',
        amount: totalGross,
      },
      ...deductionCredits.map((line) => ({
        ledgerAccountId: line.ledgerAccountId,
        entryType: 'CREDIT' as const,
        amount: line.amount,
      })),
    ];

    const payableAmount = netCredit > 0 ? netCredit : Math.max(totalNet, 0);
    if (payableAmount > 0) {
      lines.push({
        ledgerAccountId: salaryPayableId,
        entryType: 'CREDIT',
        amount: payableAmount,
      });
    }

    this.balanceRounding(lines, totalGross);
    return lines;
  }

  private async buildPaymentLines(
    tenantId: string,
    run: { totalNet: unknown },
  ) {
    const config = await this.settings.getSettings(tenantId);
    const salaryPayableId = config.salaryPayableLedgerId;
    const bankLedgerId = config.defaultBankLedgerId;
    if (!salaryPayableId || !bankLedgerId) {
      throw new Error('Salary payable and bank ledgers are not configured');
    }

    const totalNet = Number(run.totalNet);
    if (totalNet <= 0) return [];

    return [
      {
        ledgerAccountId: salaryPayableId,
        entryType: 'DEBIT' as const,
        amount: totalNet,
      },
      {
        ledgerAccountId: bankLedgerId,
        entryType: 'CREDIT' as const,
        amount: totalNet,
      },
    ];
  }

  private async buildDeductionCreditLines(
    tenantId: string,
    payrollRunId: string,
  ) {
    const payslips = await this.prisma.payslip.findMany({
      where: { payrollRunId, tenantId },
      include: {
        lines: {
          where: { componentType: 'DEDUCTION' },
        },
      },
    });

    const buckets = new Map<string, number>();
    for (const payslip of payslips) {
      for (const line of payslip.lines) {
        const code = line.componentCode.trim().toUpperCase();
        const amount = Number(line.amount);
        if (amount <= 0) continue;
        buckets.set(code, (buckets.get(code) ?? 0) + amount);
      }
    }

    const lines: Array<{ ledgerAccountId: string; amount: number }> = [];
    for (const [componentCode, amount] of buckets) {
      const ledgerId = await this.settings.resolvePayrollDeductionLedger(
        tenantId,
        componentCode,
      );
      if (!ledgerId) continue;
      lines.push({
        ledgerAccountId: ledgerId,
        amount: Math.round(amount * 100) / 100,
      });
    }

    return lines;
  }

  private balanceRounding(
    lines: Array<{
      ledgerAccountId: string;
      entryType: 'DEBIT' | 'CREDIT';
      amount: number;
    }>,
    targetDebit: number,
  ) {
    const debitTotal = lines
      .filter((line) => line.entryType === 'DEBIT')
      .reduce((sum, line) => sum + line.amount, 0);
    const creditTotal = lines
      .filter((line) => line.entryType === 'CREDIT')
      .reduce((sum, line) => sum + line.amount, 0);
    const diff = Math.round((debitTotal - creditTotal) * 100) / 100;
    if (Math.abs(diff) < 0.01) return;

    const creditLine = lines.find((line) => line.entryType === 'CREDIT');
    if (creditLine) {
      creditLine.amount = Math.round((creditLine.amount + diff) * 100) / 100;
    }
  }
}
