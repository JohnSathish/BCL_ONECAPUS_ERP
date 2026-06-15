import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { ResolvedRecipient } from '../../communication/services/communication-audience.service';
import { CommunicationTriggerService } from '../../communication/services/communication-trigger.service';

export type ReceiptChannel = 'EMAIL' | 'SMS' | 'WHATSAPP' | 'IN_APP' | 'PUSH';

@Injectable()
export class FeeReceiptNotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly triggers: CommunicationTriggerService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async sendReceipt(
    tenantId: string,
    receiptId: string,
    channels: ReceiptChannel[],
    actorId?: string,
  ) {
    if (!channels.length)
      throw new BadRequestException('Select at least one channel.');

    const receipt = await this.db().feeReceipt.findFirst({
      where: { id: receiptId, tenantId },
      include: {
        payment: { select: { paymentMode: true, paidAt: true } },
      },
    });
    if (!receipt) throw new NotFoundException('Receipt not found');
    if (receipt.status === 'CANCELLED') {
      throw new BadRequestException('Cannot send a cancelled receipt.');
    }

    const student = await this.db().student.findFirst({
      where: { id: receipt.studentId, tenantId, deletedAt: null },
      include: {
        user: { select: { id: true, email: true, displayName: true } },
        masterProfile: {
          select: { fullName: true, email: true, mobileNumber: true },
        },
        programVersion: { include: { program: { select: { name: true } } } },
      },
    });
    if (!student?.user)
      throw new BadRequestException('Student contact details not found.');

    const recipient: ResolvedRecipient = {
      recipientType: 'STUDENT',
      userId: String(student.userId ?? student.user.id),
      studentId: receipt.studentId,
      displayName:
        student.masterProfile?.fullName ??
        student.user.displayName ??
        student.user.email,
      email: student.masterProfile?.email ?? student.user.email,
      phone: student.masterProfile?.mobileNumber,
    };

    if (channels.includes('EMAIL') && !recipient.email) {
      throw new BadRequestException('Student has no email on file.');
    }
    if (
      (channels.includes('SMS') || channels.includes('WHATSAPP')) &&
      !recipient.phone
    ) {
      throw new BadRequestException('Student has no mobile number on file.');
    }

    const institutionName = await this.triggers.getInstitutionName(tenantId);
    const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
    const verifyUrl = `${webOrigin}/verify/receipt/${receipt.receiptNo}`;
    const paidAt = receipt.payment?.paidAt ?? receipt.issuedAt;

    const result = await this.triggers.trigger({
      tenantId,
      templateCode: 'FEE_RECEIPT',
      triggerKey: `fee.receipt_manual.${receipt.id}`,
      entityType: 'fee_receipt',
      entityId: receipt.id,
      recipient,
      variables: {
        student_name: recipient.displayName,
        receipt_no: receipt.receiptNo,
        amount: String(receipt.amount),
        payment_mode: String(receipt.payment?.paymentMode ?? 'CASH'),
        paid_date: paidAt ? new Date(paidAt).toISOString().slice(0, 10) : '',
        enrollment_number: student.enrollmentNumber ?? '',
        programme: student.programVersion?.program?.name ?? '',
        institution_name: institutionName,
        verify_url: verifyUrl,
        triggered_by: actorId ?? 'admin',
      },
      channels,
      skipDedupe: true,
    });

    return {
      receiptNo: receipt.receiptNo,
      channels,
      queued: !result.skipped,
      message: `Receipt ${receipt.receiptNo} notification queued for ${channels.join(', ')}.`,
    };
  }
}
