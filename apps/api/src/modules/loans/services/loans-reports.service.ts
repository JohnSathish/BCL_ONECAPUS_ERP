import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../database/prisma.service';

import { createWorkbookWithSheets } from '../../../common/import/excel.util';

const MANUAL_MODES = ['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE'];

@Injectable()
export class LoansReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async loanRegister(tenantId: string, status?: string) {
    const loans = await this.prisma.staffLoan.findMany({
      where: { tenantId, ...(status ? { status } : {}) },

      include: {
        staffProfile: {
          select: {
            fullName: true,

            employeeCode: true,

            department: { select: { name: true } },
          },
        },

        loanTypeConfig: { select: { name: true } },
      },

      orderBy: { loanNumber: 'asc' },
    });

    return loans.map((l) => ({
      loanNumber: l.loanNumber,

      staffName: l.staffProfile.fullName,

      employeeCode: l.staffProfile.employeeCode,

      department: l.staffProfile.department?.name ?? '—',

      loanType: l.loanTypeConfig?.name ?? l.loanType,

      principal: Number(l.principalAmount),

      recovered: Number(l.totalRecovered),

      outstanding: Number(l.balanceAmount),

      repaymentMethod: l.repaymentMethod,

      status: l.status,

      loanDate: l.loanDate ?? l.startDate,
    }));
  }

  async outstandingReport(tenantId: string) {
    return this.loanRegister(tenantId, 'ACTIVE');
  }

  async recoveryReport(tenantId: string, month: number, year: number) {
    const txs = await this.activeTransactionsInPeriod(tenantId, month, year);

    return txs.map((t) => this.mapTransactionRow(t));
  }

  async dailyCollectionReport(tenantId: string, date: string) {
    const d = new Date(date);

    const next = new Date(d);

    next.setDate(next.getDate() + 1);

    const txs = await this.prisma.staffLoanTransaction.findMany({
      where: {
        tenantId,

        status: 'ACTIVE',

        paymentDate: { gte: d, lt: next },

        transactionType: { in: MANUAL_MODES },
      },

      include: this.txInclude,

      orderBy: { createdAt: 'asc' },
    });

    return {
      date,

      total: txs.reduce((s, t) => s + Number(t.amount), 0),

      count: txs.length,

      rows: txs.map((t) => this.mapTransactionRow(t)),
    };
  }

  async monthlyCollectionReport(tenantId: string, month: number, year: number) {
    const txs = await this.activeTransactionsInPeriod(tenantId, month, year);

    const manual = txs.filter((t) => MANUAL_MODES.includes(t.transactionType));

    const payroll = txs.filter((t) => t.transactionType === 'SALARY_DEDUCTION');

    return {
      month,

      year,

      totalCollection: txs.reduce((s, t) => s + Number(t.amount), 0),

      cashCollection: manual.reduce((s, t) => s + Number(t.amount), 0),

      salaryDeduction: payroll.reduce((s, t) => s + Number(t.amount), 0),

      receiptCount: manual.length,

      rows: txs.map((t) => this.mapTransactionRow(t)),
    };
  }

  async receiptRegister(tenantId: string, from?: string, to?: string) {
    const txs = await this.prisma.staffLoanTransaction.findMany({
      where: {
        tenantId,

        receiptNumber: { not: null },

        ...(from || to
          ? {
              paymentDate: {
                ...(from ? { gte: new Date(from) } : {}),

                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },

      include: this.txInclude,

      orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],

      take: 2000,
    });

    return txs.map((t) => ({
      ...this.mapTransactionRow(t),

      status: t.status,

      documentUrl: t.documentUrl,

      cancelledAt: t.cancelledAt,

      cancellationReason: t.cancellationReason,
    }));
  }

  async cashReceiptRegister(tenantId: string, month?: number, year?: number) {
    const where: Record<string, unknown> = {
      tenantId,

      status: 'ACTIVE',

      transactionType: { in: MANUAL_MODES },
    };

    if (month && year) {
      where.paymentDate = {
        gte: new Date(year, month - 1, 1),

        lt: new Date(year, month, 1),
      };
    }

    const txs = await this.prisma.staffLoanTransaction.findMany({
      where,

      include: this.txInclude,

      orderBy: { paymentDate: 'desc' },
    });

    return txs.map((t) => this.mapTransactionRow(t));
  }

  async closureReport(tenantId: string) {
    const loans = await this.prisma.staffLoan.findMany({
      where: { tenantId, status: { in: ['CLOSED', 'COMPLETED'] } },

      include: {
        staffProfile: { select: { fullName: true, employeeCode: true } },

        loanTypeConfig: { select: { name: true } },
      },

      orderBy: { closedAt: 'desc' },
    });

    return loans.map((l) => ({
      id: l.id,

      loanNumber: l.loanNumber,

      staffName: l.staffProfile.fullName,

      employeeCode: l.staffProfile.employeeCode,

      loanType: l.loanTypeConfig?.name ?? l.loanType,

      principal: Number(l.principalAmount),

      totalRecovered: Number(l.totalRecovered),

      closedAt: l.closedAt,

      closureCertificateUrl: l.closureCertificateUrl,
    }));
  }

  async staffRepaymentReport(tenantId: string, staffProfileId: string) {
    const txs = await this.prisma.staffLoanTransaction.findMany({
      where: { tenantId, staffLoan: { staffProfileId }, status: 'ACTIVE' },

      include: this.txInclude,

      orderBy: { paymentDate: 'asc' },
    });

    const loans = await this.prisma.staffLoan.findMany({
      where: { tenantId, staffProfileId },

      select: {
        loanNumber: true,

        loanType: true,

        principalAmount: true,

        totalRecovered: true,

        balanceAmount: true,

        status: true,
      },
    });

    return {
      loans: loans.map((l) => ({
        loanNumber: l.loanNumber,

        loanType: l.loanType,

        principal: Number(l.principalAmount),

        recovered: Number(l.totalRecovered),

        outstanding: Number(l.balanceAmount),

        status: l.status,
      })),

      repayments: txs.map((t) => this.mapTransactionRow(t)),
    };
  }

  async registerExcelBuffer(tenantId: string) {
    const rows = await this.loanRegister(tenantId);

    return createWorkbookWithSheets([
      {
        name: 'Loan Register',

        headers: [
          'Loan No',

          'Employee Code',

          'Staff Name',

          'Department',

          'Loan Type',

          'Principal',

          'Recovered',

          'Outstanding',

          'Method',

          'Status',
        ],

        rows: rows.map((r) => [
          r.loanNumber,

          r.employeeCode,

          r.staffName,

          r.department,

          r.loanType,

          r.principal,

          r.recovered,

          r.outstanding,

          r.repaymentMethod,

          r.status,
        ]),
      },
    ]);
  }

  async receiptRegisterExcelBuffer(tenantId: string) {
    const rows = await this.receiptRegister(tenantId);

    return createWorkbookWithSheets([
      {
        name: 'Loan Receipt Register',

        headers: [
          'Receipt No',

          'Date',

          'Staff',

          'Loan No',

          'Mode',

          'Amount',

          'Outstanding After',

          'Status',
        ],

        rows: rows.map((r) => [
          r.receiptNumber ?? '',

          r.paymentDate instanceof Date
            ? r.paymentDate.toISOString().slice(0, 10)
            : String(r.paymentDate ?? ''),

          r.staffName,

          r.loanNumber,

          r.transactionType,

          r.amount,

          r.outstandingAfter ?? 0,

          String(r.status ?? 'ACTIVE'),
        ]),
      },
    ]);
  }

  private txInclude = {
    staffLoan: {
      include: {
        staffProfile: { select: { fullName: true, employeeCode: true } },
      },
    },
  } as const;

  private async activeTransactionsInPeriod(
    tenantId: string,
    month: number,
    year: number,
  ) {
    return this.prisma.staffLoanTransaction.findMany({
      where: {
        tenantId,

        status: 'ACTIVE',

        paymentDate: {
          gte: new Date(year, month - 1, 1),
          lt: new Date(year, month, 1),
        },
      },

      include: this.txInclude,

      orderBy: { paymentDate: 'asc' },
    });
  }

  private mapTransactionRow(t: {
    id: string;

    paymentDate: Date;

    transactionType: string;

    amount: unknown;

    receiptNumber: string | null;

    transactionReference: string | null;

    recoveredBefore: unknown;

    recoveredAfter: unknown;

    outstandingAfter: unknown;

    remarks: string | null;

    documentUrl: string | null;

    staffLoan: {
      loanNumber: string;

      staffProfile: { fullName: string; employeeCode: string };
    };
  }) {
    return {
      id: t.id,

      paymentDate: t.paymentDate,

      loanNumber: t.staffLoan.loanNumber,

      staffName: t.staffLoan.staffProfile.fullName,

      employeeCode: t.staffLoan.staffProfile.employeeCode,

      transactionType: t.transactionType,

      amount: Number(t.amount),

      receiptNumber: t.receiptNumber,

      transactionReference: t.transactionReference,

      recoveredBefore:
        t.recoveredBefore != null ? Number(t.recoveredBefore) : null,

      recoveredAfter:
        t.recoveredAfter != null ? Number(t.recoveredAfter) : null,

      outstandingAfter:
        t.outstandingAfter != null ? Number(t.outstandingAfter) : null,

      remarks: t.remarks,

      documentUrl: t.documentUrl,
    };
  }
}
