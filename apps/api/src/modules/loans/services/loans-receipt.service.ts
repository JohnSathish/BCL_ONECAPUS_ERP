import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { CommunicationEmailService } from '../../communication/services/communication-email.service';
import {
  financialYearLabel,
  LoansReceiptDocumentService,
  type InstitutionHeader,
  type LoanReceiptData,
} from './loans-receipt-document.service';

const MANUAL_MODES = new Set(['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE']);

@Injectable()
export class LoansReceiptService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: LoansReceiptDocumentService,
    private readonly email: CommunicationEmailService,
  ) {}

  async nextReceiptNumber(tenantId: string, date: Date): Promise<string> {
    const year = date.getFullYear();
    const prefix = `LN-RCP-${year}-`;
    const count = await this.prisma.staffLoanTransaction.count({
      where: { tenantId, receiptNumber: { startsWith: prefix } },
    });
    return `${prefix}${String(count + 1).padStart(6, '0')}`;
  }

  private async institutionHeader(
    tenantId: string,
  ): Promise<InstitutionHeader> {
    const [tenant, branding, payrollSettings, institution] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      }),
      this.prisma.tenantBranding.findUnique({ where: { tenantId } }),
      this.prisma.payrollSettings.findUnique({ where: { tenantId } }),
      this.prisma.institution.findFirst({
        where: { tenantId, deletedAt: null },
        select: { name: true },
      }),
    ]);
    return {
      name:
        branding?.displayName ??
        institution?.name ??
        tenant?.name ??
        'Institution',
      address: branding?.address ?? null,
      contact: branding?.portalSubtitle ?? null,
      logoUrl: payrollSettings?.logoUrl ?? branding?.logoUrl ?? null,
    };
  }

  async generateReceiptPdf(
    tenantId: string,
    transactionId: string,
    userId?: string,
  ): Promise<string> {
    const tx = await this.loadTransaction(tenantId, transactionId);
    if (tx.status === 'CANCELLED') {
      throw new BadRequestException(
        'Cannot generate receipt for a cancelled transaction',
      );
    }
    if (tx.documentUrl) return tx.documentUrl;

    const institution = await this.institutionHeader(tenantId);
    let preparedBy: string | null = null;
    if (userId ?? tx.createdById) {
      const u = await this.prisma.user.findUnique({
        where: { id: userId ?? tx.createdById! },
        select: { displayName: true, email: true },
      });
      preparedBy = u?.displayName ?? u?.email ?? null;
    }

    const loan = tx.staffLoan;
    const staff = loan.staffProfile;
    const data: LoanReceiptData = {
      receiptNumber: tx.receiptNumber ?? `TX-${tx.id.slice(0, 8)}`,
      receiptDate: tx.receiptGeneratedAt ?? new Date(),
      financialYear: financialYearLabel(tx.paymentDate),
      staffName: staff.fullName,
      employeeCode: staff.employeeCode,
      department: staff.department?.name ?? '—',
      designation: staff.designation?.label ?? '—',
      loanNumber: loan.loanNumber,
      loanType: loan.loanTypeConfig?.name ?? loan.loanType,
      loanSanctionDate: loan.loanDate ?? loan.startDate,
      originalAmount: Number(loan.principalAmount),
      paymentDate: tx.paymentDate,
      paymentAmount: Number(tx.amount),
      paymentMode: tx.transactionType,
      transactionReference: tx.transactionReference,
      remarks: tx.remarks,
      recoveredBefore: Number(tx.recoveredBefore ?? 0),
      recoveredAfter: Number(tx.recoveredAfter ?? loan.totalRecovered),
      outstandingAfter: Number(tx.outstandingAfter ?? loan.balanceAmount),
      loanStatus: loan.status,
      preparedBy,
    };

    const html = this.documents.buildReceiptHtml(data, institution);
    const buffer = await this.documents.renderPdfToBuffer(html);
    const filename = `receipt-${tx.receiptNumber?.replace(/[^a-zA-Z0-9-]/g, '') ?? tx.id}.pdf`;
    const publicPath = await this.documents.persistPdf(
      tenantId,
      'loan-receipts',
      filename,
      buffer,
    );

    await this.prisma.staffLoanTransaction.update({
      where: { id: transactionId },
      data: { documentUrl: publicPath, receiptGeneratedAt: new Date() },
    });

    return publicPath;
  }

  async generateClosureCertificate(
    tenantId: string,
    loanId: string,
  ): Promise<string> {
    const loan = await this.prisma.staffLoan.findFirst({
      where: { id: loanId, tenantId },
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
    });
    if (!loan) throw new NotFoundException('Loan not found');
    if (Number(loan.balanceAmount) > 0) {
      throw new BadRequestException('Loan still has outstanding balance');
    }
    if (loan.closureCertificateUrl) return loan.closureCertificateUrl;

    const institution = await this.institutionHeader(tenantId);
    const certNumber = `LN-CLR-${loan.loanNumber.replace(/[^a-zA-Z0-9]/g, '')}`;
    const html = this.documents.buildClosureCertificateHtml({
      certificateNumber: certNumber,
      issueDate: loan.closedAt ?? new Date(),
      staffName: loan.staffProfile.fullName,
      employeeCode: loan.staffProfile.employeeCode,
      department: loan.staffProfile.department?.name ?? '—',
      loanNumber: loan.loanNumber,
      loanType: loan.loanTypeConfig?.name ?? loan.loanType,
      originalAmount: Number(loan.principalAmount),
      totalRecovered: Number(loan.totalRecovered),
      closureDate: loan.closedAt ?? new Date(),
      institution,
    });

    const buffer = await this.documents.renderPdfToBuffer(html);
    const filename = `closure-${loan.loanNumber.replace(/[^a-zA-Z0-9-]/g, '')}.pdf`;
    const publicPath = await this.documents.persistPdf(
      tenantId,
      'loan-closures',
      filename,
      buffer,
    );

    await this.prisma.staffLoan.update({
      where: { id: loanId },
      data: { closureCertificateUrl: publicPath },
    });

    return publicPath;
  }

  async cancelReceipt(user: JwtUser, transactionId: string, reason: string) {
    const tx = await this.loadTransaction(user.tid, transactionId);
    if (tx.status === 'CANCELLED') {
      throw new BadRequestException('Receipt already cancelled');
    }
    if (tx.payrollRunId) {
      throw new BadRequestException(
        'Payroll deductions must be reversed via payroll run reopen, not manual cancellation',
      );
    }

    const amount = Number(tx.amount);
    const loan = tx.staffLoan;

    await this.prisma.staffLoanTransaction.update({
      where: { id: transactionId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledById: user.sub,
        cancellationReason: reason,
      },
    });

    const newBalance = Number(loan.balanceAmount) + amount;
    const newRecovered = Math.max(0, Number(loan.totalRecovered) - amount);

    await this.prisma.staffLoan.update({
      where: { id: loan.id },
      data: {
        balanceAmount: newBalance,
        totalRecovered: newRecovered,
        paidInstallments: Math.max(0, loan.paidInstallments - 1),
        status: 'ACTIVE',
        closedAt: null,
        closureCertificateUrl: null,
      },
    });

    await this.prisma.staffLoanAuditLog.create({
      data: {
        tenantId: user.tid,
        staffLoanId: loan.id,
        action: 'RECEIPT_CANCELLED',
        oldValue: {
          transactionId,
          receiptNumber: tx.receiptNumber,
          amount,
        },
        newValue: { reason, cancelledBy: user.sub },
        userId: user.sub,
      },
    });

    return { cancelled: true, transactionId, receiptNumber: tx.receiptNumber };
  }

  async emailReceipt(
    tenantId: string,
    transactionId: string,
    toEmail?: string,
  ) {
    const tx = await this.loadTransaction(tenantId, transactionId);
    if (tx.status === 'CANCELLED')
      throw new BadRequestException('Receipt is cancelled');

    const pdfPath = await this.generateReceiptPdf(tenantId, transactionId);
    const staff = tx.staffLoan.staffProfile;
    const email = toEmail ?? staff.email ?? null;

    if (!email) {
      return {
        sent: false,
        pdfPath,
        message: 'No email address on file for this staff member',
      };
    }

    const institution = await this.institutionHeader(tenantId);
    const result = await this.email.send({
      to: email,
      subject: `Loan Repayment Receipt ${tx.receiptNumber} — ${institution.name}`,
      html: `<p>Dear ${staff.fullName},</p>
        <p>Please find attached your loan repayment receipt <strong>${tx.receiptNumber}</strong> for ${inr(Number(tx.amount))}.</p>
        <p>Outstanding balance: ${inr(Number(tx.outstandingAfter ?? tx.staffLoan.balanceAmount))}</p>
        <p>Regards,<br/>${institution.name}</p>`,
    });

    return {
      sent: result.ok,
      pdfPath,
      email,
      message: result.ok ? 'Receipt emailed successfully' : result.error,
    };
  }

  private async loadTransaction(tenantId: string, transactionId: string) {
    const tx = await this.prisma.staffLoanTransaction.findFirst({
      where: { id: transactionId, tenantId },
      include: {
        staffLoan: {
          include: {
            staffProfile: {
              select: {
                id: true,
                fullName: true,
                employeeCode: true,
                email: true,
                department: { select: { name: true } },
                designation: { select: { label: true } },
              },
            },
            loanTypeConfig: { select: { name: true } },
          },
        },
      },
    });
    if (!tx) throw new NotFoundException('Transaction not found');
    return tx;
  }
}

function inr(n: number) {
  return `₹${n.toLocaleString('en-IN')}`;
}
