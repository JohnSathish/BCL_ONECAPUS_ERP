import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { FeeLedgerService } from './fee-ledger.service';
import { StudentFeeSummaryService } from './student-fee-summary.service';
import { LicenseEnforcementService } from '../../licensing/services/license-enforcement.service';

@Injectable()
export class FeeReversalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: FeeLedgerService,
    private readonly licenseEnforcement: LicenseEnforcementService,
    private readonly feeSummary: StudentFeeSummaryService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async cancelReceipt(user: JwtUser, receiptId: string, reason: string) {
    await this.licenseEnforcement.assertWriteAllowed(user.tid, 'fee.write');
    if (!reason?.trim())
      throw new BadRequestException('Cancellation reason is required.');

    const receipt = await this.db().feeReceipt.findFirst({
      where: { id: receiptId, tenantId: user.tid },
      include: {
        payment: { include: { allocations: true } },
      },
    });
    if (!receipt) throw new NotFoundException('Receipt not found');
    if (receipt.status === 'CANCELLED')
      throw new BadRequestException('Receipt is already cancelled.');
    if (!receipt.paymentId || !receipt.payment) {
      throw new BadRequestException(
        'Receipt has no linked payment to reverse.',
      );
    }
    if (receipt.payment.status === 'CANCELLED') {
      throw new BadRequestException('Payment is already cancelled.');
    }

    const before = {
      receipt: {
        id: receipt.id,
        status: receipt.status,
        amount: receipt.amount,
      },
      payment: {
        id: receipt.payment.id,
        status: receipt.payment.status,
        amount: receipt.payment.amount,
      },
      allocations: receipt.payment.allocations,
    };

    await this.reverseAllocations(user.tid, receipt.payment.allocations ?? []);

    await this.db().paymentTransaction.update({
      where: { id: receipt.payment.id },
      data: {
        status: 'CANCELLED',
        metadata: {
          ...(receipt.payment.metadata ?? {}),
          cancelReason: reason.trim(),
        },
      },
    });

    await this.db().feeReceipt.update({
      where: { id: receipt.id },
      data: {
        status: 'CANCELLED',
        metadata: {
          ...(receipt.metadata ?? {}),
          cancelReason: reason.trim(),
          cancelledAt: new Date().toISOString(),
        },
      },
    });

    await this.ledger.post({
      tenantId: user.tid,
      studentId: receipt.studentId,
      paymentId: receipt.payment.id,
      entryType: 'REVERSAL',
      debitAmount: Number(receipt.amount),
      referenceType: 'RECEIPT_CANCEL',
      referenceId: receipt.id,
      description: `Receipt ${receipt.receiptNo} cancelled: ${reason.trim()}`,
      postedById: user.sub,
    });

    await this.writeAudit(
      user.tid,
      user.sub,
      'RECEIPT_CANCELLED',
      reason.trim(),
      before,
      {
        receiptStatus: 'CANCELLED',
        paymentStatus: 'CANCELLED',
      },
      { receiptId: receipt.id, paymentId: receipt.payment.id },
    );

    await this.feeSummary.touchAfterPayment(user.tid, receipt.studentId);

    return {
      receiptId: receipt.id,
      receiptNo: receipt.receiptNo,
      status: 'CANCELLED',
      message: `Receipt ${receipt.receiptNo} cancelled and allocations reversed.`,
    };
  }

  async refundPayment(
    user: JwtUser,
    dto: {
      receiptId?: string;
      paymentId?: string;
      amount: number;
      reason: string;
      refundMode?: string;
    },
  ) {
    await this.licenseEnforcement.assertWriteAllowed(user.tid, 'fee.write');
    if (!dto.reason?.trim())
      throw new BadRequestException('Refund reason is required.');
    if (dto.amount <= 0)
      throw new BadRequestException('Refund amount must be greater than zero.');

    let payment: Record<string, unknown> | null = null;
    let receipt: Record<string, unknown> | null = null;

    if (dto.receiptId) {
      receipt = await this.db().feeReceipt.findFirst({
        where: { id: dto.receiptId, tenantId: user.tid },
        include: { payment: { include: { allocations: true } } },
      });
      if (!receipt) throw new NotFoundException('Receipt not found');
      if (receipt.status === 'CANCELLED')
        throw new BadRequestException('Cannot refund a cancelled receipt.');
      payment =
        (receipt as { payment?: Record<string, unknown> }).payment ?? null;
    } else if (dto.paymentId) {
      payment = await this.db().paymentTransaction.findFirst({
        where: { id: dto.paymentId, tenantId: user.tid },
        include: { allocations: true, receipts: true },
      });
      receipt =
        (payment as { receipts?: Array<Record<string, unknown>> })
          ?.receipts?.[0] ?? null;
    }

    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === 'CANCELLED')
      throw new BadRequestException('Cannot refund a cancelled payment.');
    if (Number(payment.amount) < dto.amount) {
      throw new BadRequestException(
        'Refund amount exceeds original payment amount.',
      );
    }

    const studentId = String(payment.studentId);
    const refundPayment = await this.db().paymentTransaction.create({
      data: {
        tenantId: user.tid,
        studentId,
        transactionNo: await this.nextRefundNo(user.tid),
        paymentMode: dto.refundMode ?? 'REFUND',
        status: 'SUCCESS',
        amount: dto.amount,
        paidAt: new Date(),
        collectedById: user.sub,
        metadata: {
          type: 'REFUND',
          originalPaymentId: payment.id,
          receiptId: receipt?.id ?? null,
          reason: dto.reason.trim(),
        },
      },
    });

    const allocations =
      (payment.allocations as Array<Record<string, unknown>>) ?? [];
    await this.reverseAllocationsPartial(user.tid, allocations, dto.amount);

    await this.ledger.post({
      tenantId: user.tid,
      studentId,
      paymentId: refundPayment.id,
      entryType: 'REFUND',
      debitAmount: dto.amount,
      referenceType: 'REFUND',
      referenceId: refundPayment.id,
      description: `Refund: ${dto.reason.trim()}`,
      postedById: user.sub,
      metadata: { originalPaymentId: payment.id },
    });

    if (receipt) {
      const receiptAmount = Number(receipt.amount);
      const newStatus =
        dto.amount >= receiptAmount ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
      await this.db().feeReceipt.update({
        where: { id: receipt.id },
        data: {
          status: newStatus,
          metadata: {
            ...((receipt.metadata as Record<string, unknown>) ?? {}),
            refundedAmount: dto.amount,
            refundReason: dto.reason.trim(),
          },
        },
      });
    }

    await this.writeAudit(
      user.tid,
      user.sub,
      'PAYMENT_REFUNDED',
      dto.reason.trim(),
      { payment, receipt, amount: payment.amount },
      { refundPaymentId: refundPayment.id, refundAmount: dto.amount },
      {
        paymentId: payment.id,
        receiptId: receipt?.id,
        refundPaymentId: refundPayment.id,
      },
    );

    return {
      refundTransactionNo: refundPayment.transactionNo,
      refundPaymentId: refundPayment.id,
      amount: dto.amount,
      message: `Refund of ₹${dto.amount} recorded successfully.`,
    };
  }

  private async reverseAllocations(
    tenantId: string,
    allocations: Array<Record<string, unknown>>,
  ) {
    for (const allocation of allocations) {
      await this.reverseSingleAllocation(
        tenantId,
        allocation,
        Number(allocation.amount ?? 0),
      );
    }
  }

  private async reverseAllocationsPartial(
    tenantId: string,
    allocations: Array<Record<string, unknown>>,
    refundAmount: number,
  ) {
    let remaining = refundAmount;
    const sorted = [...allocations].sort(
      (a, b) => Number(b.amount ?? 0) - Number(a.amount ?? 0),
    );
    for (const allocation of sorted) {
      if (remaining <= 0) break;
      const allocAmt = Number(allocation.amount ?? 0);
      const reverseAmt = Math.min(allocAmt, remaining);
      await this.reverseSingleAllocation(tenantId, allocation, reverseAmt);
      remaining -= reverseAmt;
    }
  }

  private async reverseSingleAllocation(
    tenantId: string,
    allocation: Record<string, unknown>,
    amount: number,
  ) {
    if (amount <= 0) return;
    const demand = await this.db().studentFeeDemand.findFirst({
      where: { id: allocation.demandId, tenantId },
    });
    if (!demand) return;

    const paidAmount = Math.max(0, Number(demand.paidAmount ?? 0) - amount);
    const balanceAmount = Number(demand.balanceAmount ?? 0) + amount;
    const totalAmount = Number(demand.totalAmount ?? 0);
    let status = 'PUBLISHED';
    if (paidAmount > 0 && balanceAmount > 0) status = 'PARTIALLY_PAID';
    if (paidAmount >= totalAmount && balanceAmount <= 0) status = 'PAID';

    await this.db().studentFeeDemand.update({
      where: { id: demand.id },
      data: { paidAmount, balanceAmount, status },
    });
  }

  private async writeAudit(
    tenantId: string,
    actorId: string,
    action: string,
    reason: string,
    before: unknown,
    after: unknown,
    metadata?: Record<string, unknown>,
  ) {
    await this.db().feeAuditLog.create({
      data: {
        tenantId,
        actorId,
        action,
        reason,
        before: before as object,
        after: after as object,
        metadata: metadata as object,
      },
    });
  }

  private async nextRefundNo(tenantId: string) {
    const count = await this.db().paymentTransaction.count({
      where: { tenantId, paymentMode: 'REFUND' },
    });
    return `REF-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;
  }
}
