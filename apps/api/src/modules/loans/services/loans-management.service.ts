import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import {
  CreateStaffLoanDto,
  RecordLoanPaymentDto,
  RestructureLoanDto,
} from '../dto/loans.dto';
import { usesSalaryDeduction } from '../constants';
import { LoansReceiptService } from './loans-receipt.service';

const staffInclude = {
  staffProfile: {
    select: {
      id: true,
      fullName: true,
      employeeCode: true,
      photoUrl: true,
      mobile: true,
      basicPay: true,
      department: { select: { id: true, name: true } },
      designation: { select: { id: true, label: true } },
    },
  },
  loanTypeConfig: { select: { id: true, code: true, name: true } },
  _count: { select: { transactions: true } },
} satisfies Prisma.StaffLoanInclude;

@Injectable()
export class LoansManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly receipts: LoansReceiptService,
  ) {}

  private async audit(
    tenantId: string,
    loanId: string,
    action: string,
    userId: string | undefined,
    oldValue?: unknown,
    newValue?: unknown,
  ) {
    await this.prisma.staffLoanAuditLog.create({
      data: {
        tenantId,
        staffLoanId: loanId,
        action,
        oldValue: oldValue ? (oldValue as object) : undefined,
        newValue: newValue ? (newValue as object) : undefined,
        userId,
      },
    });
  }

  private serializeLoan(
    loan: Prisma.StaffLoanGetPayload<{ include: typeof staffInclude }>,
  ) {
    const principal = Number(loan.principalAmount);
    const recovered = Number(loan.totalRecovered);
    const balance = Number(loan.balanceAmount);
    const progress =
      principal > 0 ? Math.round((recovered / principal) * 100) : 0;
    return {
      ...loan,
      principalAmount: principal,
      balanceAmount: balance,
      totalRecovered: recovered,
      monthlyDeduction: Number(loan.monthlyDeduction),
      salaryDeductionAmount:
        loan.salaryDeductionAmount != null
          ? Number(loan.salaryDeductionAmount)
          : null,
      progressPercent: progress,
    };
  }

  async list(
    tenantId: string,
    query: {
      staffProfileId?: string;
      status?: string;
      repaymentMethod?: string;
      search?: string;
    },
  ) {
    const loans = await this.prisma.staffLoan.findMany({
      where: {
        tenantId,
        ...(query.staffProfileId
          ? { staffProfileId: query.staffProfileId }
          : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.repaymentMethod
          ? { repaymentMethod: query.repaymentMethod }
          : {}),
        ...(query.search
          ? {
              OR: [
                { loanNumber: { contains: query.search, mode: 'insensitive' } },
                { loanType: { contains: query.search, mode: 'insensitive' } },
                {
                  staffProfile: {
                    fullName: { contains: query.search, mode: 'insensitive' },
                  },
                },
                {
                  staffProfile: {
                    employeeCode: {
                      contains: query.search,
                      mode: 'insensitive',
                    },
                  },
                },
              ],
            }
          : {}),
      },
      include: staffInclude,
      orderBy: { createdAt: 'desc' },
    });
    return loans.map((l) => this.serializeLoan(l));
  }

  async get(tenantId: string, loanId: string) {
    const loan = await this.prisma.staffLoan.findFirst({
      where: { id: loanId, tenantId },
      include: {
        ...staffInclude,
        transactions: {
          orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
        },
        auditLogs: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!loan) throw new NotFoundException('Loan not found');
    return {
      ...this.serializeLoan(loan),
      transactions: loan.transactions.map((t) => ({
        ...t,
        amount: Number(t.amount),
        recoveredBefore:
          t.recoveredBefore != null ? Number(t.recoveredBefore) : null,
        recoveredAfter:
          t.recoveredAfter != null ? Number(t.recoveredAfter) : null,
        outstandingAfter:
          t.outstandingAfter != null ? Number(t.outstandingAfter) : null,
      })),
      auditLogs: loan.auditLogs,
    };
  }

  async searchStaff(tenantId: string, q?: string) {
    if (!q?.trim()) return [];
    const term = q.trim();
    const tokens = term.split(/\s+/).filter(Boolean);
    const tokenClauses = tokens.map((token) => ({
      OR: [
        { fullName: { contains: token, mode: 'insensitive' as const } },
        { employeeCode: { contains: token, mode: 'insensitive' as const } },
        { shortCode: { contains: token, mode: 'insensitive' as const } },
        { mobile: { contains: token } },
        { email: { contains: token, mode: 'insensitive' as const } },
      ],
    }));

    return this.prisma.staffProfile.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: 'ACTIVE',
        ...(tokenClauses.length ? { AND: tokenClauses } : {}),
      },
      select: {
        id: true,
        fullName: true,
        employeeCode: true,
        photoUrl: true,
        mobile: true,
        basicPay: true,
        department: { select: { name: true } },
        designation: { select: { label: true } },
      },
      take: 20,
      orderBy: { fullName: 'asc' },
    });
  }

  async create(user: JwtUser, dto: CreateStaffLoanDto) {
    const staff = await this.prisma.staffProfile.findFirst({
      where: { id: dto.staffProfileId, tenantId: user.tid, deletedAt: null },
    });
    if (!staff) throw new NotFoundException('Staff member not found');

    const salaryDeduction =
      dto.salaryDeductionAmount ??
      (usesSalaryDeduction(dto.repaymentMethod)
        ? (dto.monthlyInstallment ?? 0)
        : 0);
    const suggestedInstallment =
      dto.monthlyInstallment ?? salaryDeduction ?? dto.principalAmount / 12;

    const count = await this.prisma.staffLoan.count({
      where: { tenantId: user.tid },
    });
    const loanNumber = `LN-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
    const loanDate = new Date(dto.loanDate);
    const repaymentStart = new Date(dto.repaymentStartDate ?? dto.loanDate);
    const expectedClose = dto.expectedCloseDate
      ? new Date(dto.expectedCloseDate)
      : suggestedInstallment > 0
        ? new Date(
            repaymentStart.getFullYear(),
            repaymentStart.getMonth() +
              Math.ceil(dto.principalAmount / suggestedInstallment),
            repaymentStart.getDate(),
          )
        : null;

    const totalInstallments =
      suggestedInstallment > 0
        ? Math.ceil(dto.principalAmount / suggestedInstallment)
        : 0;

    const loan = await this.prisma.staffLoan.create({
      data: {
        tenantId: user.tid,
        staffProfileId: dto.staffProfileId,
        loanNumber,
        loanType: dto.loanType,
        loanTypeConfigId: dto.loanTypeConfigId,
        principalAmount: dto.principalAmount,
        monthlyDeduction: suggestedInstallment,
        salaryDeductionAmount: salaryDeduction,
        balanceAmount: dto.principalAmount,
        totalRecovered: 0,
        totalInstallments,
        repaymentMethod: dto.repaymentMethod,
        startDate: loanDate,
        loanDate,
        repaymentStartDate: repaymentStart,
        expectedCloseDate: expectedClose,
        notes: dto.notes,
        createdById: user.sub,
      },
      include: staffInclude,
    });

    await this.audit(user.tid, loan.id, 'CREATED', user.sub, null, {
      principalAmount: dto.principalAmount,
      repaymentMethod: dto.repaymentMethod,
    });

    return this.serializeLoan(loan);
  }

  async recordPayment(
    user: JwtUser,
    loanId: string,
    dto: RecordLoanPaymentDto,
  ) {
    const loan = await this.prisma.staffLoan.findFirst({
      where: { id: loanId, tenantId: user.tid },
    });
    if (!loan) throw new NotFoundException('Loan not found');
    if (loan.status === 'CLOSED' || loan.status === 'COMPLETED') {
      throw new BadRequestException('Loan is already closed');
    }
    if (Number(loan.balanceAmount) <= 0) {
      throw new BadRequestException('Loan has no outstanding balance');
    }

    const amount = Math.min(dto.amount, Number(loan.balanceAmount));
    const paymentDate = new Date(dto.paymentDate);
    const recoveredBefore = Number(loan.totalRecovered);
    const newBalance = Number(loan.balanceAmount) - amount;
    const newRecovered = recoveredBefore + amount;
    const closed = newBalance <= 0;

    const receiptNumber = await this.receipts.nextReceiptNumber(
      user.tid,
      paymentDate,
    );

    const tx = await this.prisma.staffLoanTransaction.create({
      data: {
        tenantId: user.tid,
        staffLoanId: loanId,
        transactionType: dto.paymentMode,
        amount,
        paymentDate,
        receiptNumber,
        transactionReference: dto.transactionReference,
        remarks: dto.remarks,
        recoveredBefore,
        recoveredAfter: newRecovered,
        outstandingAfter: Math.max(0, newBalance),
        status: 'ACTIVE',
        createdById: user.sub,
      },
    });

    await this.prisma.staffLoan.update({
      where: { id: loanId },
      data: {
        balanceAmount: Math.max(0, newBalance),
        totalRecovered: newRecovered,
        paidInstallments: loan.paidInstallments + 1,
        status: closed ? 'CLOSED' : loan.status,
        closedAt: closed ? new Date() : null,
      },
    });

    let receiptPdfUrl: string | null = null;
    let closureCertificateUrl: string | null = null;
    try {
      receiptPdfUrl = await this.receipts.generateReceiptPdf(
        user.tid,
        tx.id,
        user.sub,
      );
      if (closed) {
        closureCertificateUrl = await this.receipts.generateClosureCertificate(
          user.tid,
          loanId,
        );
      }
    } catch {
      // PDF generation is best-effort; payment is already recorded
    }

    await this.audit(user.tid, loanId, 'PAYMENT_RECORDED', user.sub, null, {
      amount,
      mode: dto.paymentMode,
      receiptNumber,
      transactionId: tx.id,
    });

    return {
      transaction: {
        ...tx,
        amount: Number(tx.amount),
        receiptNumber,
        documentUrl: receiptPdfUrl,
      },
      closed,
      receiptPdfUrl,
      closureCertificateUrl,
    };
  }

  async restructure(user: JwtUser, loanId: string, dto: RestructureLoanDto) {
    const loan = await this.prisma.staffLoan.findFirst({
      where: { id: loanId, tenantId: user.tid },
    });
    if (!loan) throw new NotFoundException('Loan not found');

    const before = {
      salaryDeductionAmount: loan.salaryDeductionAmount,
      monthlyDeduction: loan.monthlyDeduction,
      repaymentMethod: loan.repaymentMethod,
      paused: loan.paused,
      expectedCloseDate: loan.expectedCloseDate,
    };

    const salaryDeduction =
      dto.salaryDeductionAmount ??
      Number(loan.salaryDeductionAmount ?? loan.monthlyDeduction);
    const monthly = dto.monthlyInstallment ?? Number(loan.monthlyDeduction);
    const balance = Number(loan.balanceAmount);
    const expectedClose =
      dto.expectedCloseDate != null
        ? new Date(dto.expectedCloseDate)
        : salaryDeduction > 0
          ? new Date(
              new Date().getFullYear(),
              new Date().getMonth() + Math.ceil(balance / salaryDeduction),
              1,
            )
          : loan.expectedCloseDate;

    const updated = await this.prisma.staffLoan.update({
      where: { id: loanId },
      data: {
        salaryDeductionAmount: salaryDeduction,
        monthlyDeduction: monthly,
        repaymentMethod: dto.repaymentMethod ?? loan.repaymentMethod,
        paused: dto.paused ?? loan.paused,
        status: dto.paused
          ? 'PAUSED'
          : loan.status === 'PAUSED'
            ? 'ACTIVE'
            : loan.status,
        expectedCloseDate: expectedClose,
        notes: dto.remarks
          ? `${loan.notes ?? ''}\n${dto.remarks}`.trim()
          : loan.notes,
      },
      include: staffInclude,
    });

    await this.audit(user.tid, loanId, 'RESTRUCTURED', user.sub, before, {
      salaryDeductionAmount: salaryDeduction,
      monthlyDeduction: monthly,
      repaymentMethod: dto.repaymentMethod ?? loan.repaymentMethod,
      paused: dto.paused ?? loan.paused,
    });

    return this.serializeLoan(updated);
  }

  async getStatement(tenantId: string, loanId: string) {
    const loan = await this.get(tenantId, loanId);
    return {
      loan,
      summary: {
        originalAmount: loan.principalAmount,
        totalRecovered: loan.totalRecovered,
        outstanding: loan.balanceAmount,
        nextDueAmount: loan.paused
          ? 0
          : (loan.salaryDeductionAmount ?? loan.monthlyDeduction),
        expectedCloseDate: loan.expectedCloseDate,
        progressPercent: loan.progressPercent,
      },
    };
  }
}
