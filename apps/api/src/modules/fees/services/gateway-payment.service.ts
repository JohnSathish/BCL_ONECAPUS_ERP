import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import type { GatewayPaymentDto } from '../dto/fees.dto';
import {
  createRazorpayOrder,
  verifyRazorpayPaymentSignature,
} from '../../../common/payments/razorpay.util';
import { FeeFinanceSettingsService } from './fee-finance-settings.service';
import { resolveCollectionModes } from '../constants/collection-modes.constants';
import { FeeLedgerService } from './fee-ledger.service';
import { PaymentCollectionService } from './payment-collection.service';
import { QueueService } from '../../../shared/queue/queue.service';
import { FeeReceiptNotificationService } from './fee-receipt-notification.service';
import { verifyRazorpayWebhookSignature } from '../../../common/payments/razorpay.util';

@Injectable()
export class GatewayPaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: FeeFinanceSettingsService,
    private readonly ledger: FeeLedgerService,
    private readonly collections: PaymentCollectionService,
    private readonly queue: QueueService,
    private readonly receiptNotify: FeeReceiptNotificationService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async initiate(user: JwtUser, dto: GatewayPaymentDto) {
    const config = await this.settings.get(user.tid);
    const modes = resolveCollectionModes(config);
    if (!modes.gateway) {
      throw new BadRequestException(
        'Online gateway payments are disabled. Enable Online Gateway in Finance → Fee Settings → Collection Modes.',
      );
    }

    const payment = await this.db().paymentTransaction.create({
      data: {
        tenantId: user.tid,
        studentId: dto.studentId,
        transactionNo: await this.nextTransactionNo(user.tid),
        paymentMode: 'ONLINE',
        paymentSource: 'ERP_GATEWAY',
        provider: dto.provider,
        status: 'INITIATED',
        amount: dto.amount,
        unallocatedAmount: dto.amount,
        metadata: { demandIds: dto.demandIds ?? [], channel: 'STUDENT_PORTAL' },
      },
    });

    if (dto.provider === 'RAZORPAY' && process.env.RAZORPAY_KEY_ID) {
      try {
        const creds = {
          keyId: process.env.RAZORPAY_KEY_ID!,
          keySecret: process.env.RAZORPAY_KEY_SECRET!,
          webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
        };
        const order = await createRazorpayOrder(creds, {
          amountPaise: Math.round(dto.amount * 100),
          currency: 'INR',
          receipt: payment.transactionNo,
          notes: { studentId: dto.studentId, paymentId: payment.id },
        });
        await this.db().paymentTransaction.update({
          where: { id: payment.id },
          data: { providerOrderId: order.id },
        });
        return {
          payment,
          checkout: {
            provider: 'RAZORPAY',
            orderId: order.id,
            amount: dto.amount,
            currency: 'INR',
            keyId: process.env.RAZORPAY_KEY_ID,
            mode: 'LIVE',
          },
        };
      } catch {
        // fall through to mock
      }
    }

    await this.db().paymentGatewayLog.create({
      data: {
        tenantId: user.tid,
        paymentId: payment.id,
        provider: dto.provider,
        eventType: 'INITIATE',
        status: 'QUEUED',
        request: dto,
        response: { mode: 'SAFE_MOCK' },
      },
    });
    return {
      payment,
      checkout: {
        provider: dto.provider,
        orderId: `MOCK-${payment.id}`,
        amount: dto.amount,
        currency: 'INR',
        mode: 'SAFE_MOCK',
        paymentId: payment.id,
      },
    };
  }

  async verifyRazorpay(
    user: JwtUser,
    dto: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    },
  ) {
    const creds = {
      keyId: process.env.RAZORPAY_KEY_ID ?? '',
      keySecret: process.env.RAZORPAY_KEY_SECRET ?? '',
    };
    if (!creds.keyId || !creds.keySecret) {
      throw new BadRequestException('Razorpay is not configured.');
    }
    const valid = verifyRazorpayPaymentSignature(
      creds,
      dto.razorpay_order_id,
      dto.razorpay_payment_id,
      dto.razorpay_signature,
    );
    if (!valid) throw new BadRequestException('Invalid payment signature.');

    const payment = await this.db().paymentTransaction.findFirst({
      where: { tenantId: user.tid, providerOrderId: dto.razorpay_order_id },
    });
    if (!payment) throw new BadRequestException('Payment record not found.');
    if (payment.status === 'SUCCESS') {
      return { alreadyPaid: true, payment };
    }

    const result = await this.completePayment(
      user.tid,
      payment,
      dto.razorpay_payment_id,
      user.sub,
    );
    return { alreadyPaid: false, ...result };
  }

  /** Dev / mock: simulate successful online payment when gateway keys are absent. */
  async simulateMockPayment(user: JwtUser, paymentId: string) {
    const payment = await this.db().paymentTransaction.findFirst({
      where: { id: paymentId, tenantId: user.tid },
    });
    if (!payment) throw new BadRequestException('Payment not found.');
    if (
      user.permissions?.includes('student:portal:self') &&
      !user.permissions?.includes('fees:manage')
    ) {
      const ledger = await this.ledger.myLedger(user.tid, user.sub);
      if (
        !ledger.studentId ||
        String(payment.studentId) !== String(ledger.studentId)
      ) {
        throw new BadRequestException('Payment not found.');
      }
    }
    if (payment.status === 'SUCCESS') return { alreadyPaid: true, payment };
    return this.completePayment(
      user.tid,
      payment,
      `MOCK-${Date.now()}`,
      user.sub,
    );
  }

  async webhook(
    tenantId: string,
    provider: string,
    payload: Record<string, unknown>,
  ) {
    await this.db().paymentGatewayLog.create({
      data: {
        tenantId,
        provider,
        eventType: 'WEBHOOK',
        status: 'RECEIVED',
        request: payload,
        signatureOk: false,
      },
    });

    if (provider === 'RAZORPAY' && payload.event === 'payment.captured') {
      const entity = (
        payload.payload as { payment?: { entity?: Record<string, unknown> } }
      )?.payment?.entity;
      const orderId = entity?.order_id as string | undefined;
      if (orderId) {
        const payment = await this.db().paymentTransaction.findFirst({
          where: { tenantId, providerOrderId: orderId },
        });
        if (payment && payment.status !== 'SUCCESS') {
          await this.completePayment(
            tenantId,
            payment,
            String(entity?.id ?? ''),
          );
        }
      }
    }
    return { received: true };
  }

  async handlePublicWebhook(
    tenantId: string,
    rawBody: string,
    signature: string | undefined,
    payload: Record<string, unknown>,
  ) {
    const creds = {
      keyId: process.env.RAZORPAY_KEY_ID ?? '',
      keySecret: process.env.RAZORPAY_KEY_SECRET ?? '',
      webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
    };
    if (!creds.keyId || !creds.keySecret) {
      throw new BadRequestException('Razorpay is not configured.');
    }
    if (
      !signature ||
      !verifyRazorpayWebhookSignature(creds, rawBody, signature)
    ) {
      throw new BadRequestException('Invalid webhook signature');
    }
    return this.webhook(tenantId, 'RAZORPAY', payload);
  }

  async syncStatus(user: JwtUser, provider: string, orderId: string) {
    const payment = await this.db().paymentTransaction.findFirst({
      where: { tenantId: user.tid, provider, providerOrderId: orderId },
    });
    const request = payment
      ? await this.db().feePaymentRequest.findFirst({
          where: { paymentId: payment.id },
        })
      : null;
    return {
      provider,
      orderId,
      payment,
      paymentRequest: request,
      status: payment?.status ?? 'NOT_FOUND',
    };
  }

  private async completePayment(
    tenantId: string,
    payment: Record<string, unknown>,
    providerPaymentId: string,
    collectedById?: string,
  ) {
    const demandIds =
      (payment.metadata as { demandIds?: string[] })?.demandIds ?? [];
    const allocations = await this.collections.allocateToDemands(
      tenantId,
      payment as { id: string; studentId: string; amount: unknown },
      demandIds,
    );
    const allocatedAmount = allocations.reduce(
      (sum, a) => sum + Number(a.amount ?? 0),
      0,
    );

    await this.db().paymentTransaction.update({
      where: { id: payment.id },
      data: {
        status: 'SUCCESS',
        paidAt: new Date(),
        providerPaymentId,
        allocatedAmount,
        unallocatedAmount: Math.max(
          0,
          Number(payment.amount) - allocatedAmount,
        ),
        ...(collectedById ? { collectedById } : {}),
      },
    });

    await this.ledger.post({
      tenantId,
      studentId: String(payment.studentId),
      paymentId: String(payment.id),
      entryType: 'PAYMENT',
      creditAmount: Number(payment.amount),
      referenceType: 'PAYMENT',
      referenceId: String(payment.id),
      description: 'Online fee payment',
      postedById: collectedById,
    });

    const receipt = await this.collections.issueReceipt(
      tenantId,
      String(payment.studentId),
      String(payment.id),
      Number(payment.amount),
      collectedById,
      allocations.map((a) => a.id),
    );

    await this.db().feePaymentRequest.updateMany({
      where: { tenantId, paymentId: payment.id, status: 'PENDING' },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        providerPaymentId,
        receiptId: receipt.id,
      },
    });

    void this.queue.enqueueFeeReceiptPdf({ tenantId, receiptId: receipt.id });

    void this.receiptNotify
      .sendReceipt(
        tenantId,
        receipt.id,
        ['EMAIL', 'IN_APP', 'PUSH'],
        collectedById,
      )
      .catch(() => undefined);

    return { payment, allocations, receipt };
  }

  private async nextTransactionNo(tenantId: string) {
    const count = await this.db().paymentTransaction.count({
      where: { tenantId },
    });
    return `ONL-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;
  }
}
