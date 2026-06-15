import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  createRazorpayOrder,
  isRazorpayConfigured,
  type RazorpayCredentials,
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhookSignature,
} from '../../common/payments/razorpay.util';
import { AdmissionsService } from './admissions.service';

type PaymentMeta = {
  razorpayOrderId?: string;
  amountPaise?: number;
  currency?: string;
  createdAt?: string;
};

@Injectable()
export class AdmissionsPaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly admissions: AdmissionsService,
  ) {}

  isConfigured() {
    return isRazorpayConfigured(this.resolveCredentials());
  }

  async getPaymentInfo(tenantId: string, userId: string) {
    const application = await this.getApplicationForUser(tenantId, userId);
    const feeInr = this.resolveApplicationFee(application.cycle?.settings);
    const creds = this.resolveCredentials();

    return {
      configured: isRazorpayConfigured(creds),
      applicationFee: feeInr,
      currency: 'INR',
      paymentStatus: application.paymentStatus,
      amountPaid: application.amountPaid
        ? Number(application.amountPaid)
        : null,
      paymentReference: application.paymentReference,
      paymentDeadline: application.cycle?.paymentDeadline ?? null,
      canPay:
        isRazorpayConfigured(creds) &&
        !['PAID', 'WAIVED'].includes(application.paymentStatus),
    };
  }

  async createOrder(tenantId: string, userId: string) {
    const creds = this.resolveCredentials();
    if (!isRazorpayConfigured(creds)) {
      return {
        configured: false,
        message:
          'Online payment is not configured. Please pay at the college office and await confirmation.',
      };
    }

    const application = await this.getApplicationForUser(tenantId, userId);

    if (['PAID', 'WAIVED'].includes(application.paymentStatus)) {
      throw new BadRequestException('Application fee is already paid');
    }

    const cycle = application.cycle;
    if (cycle?.paymentDeadline && cycle.paymentDeadline < new Date()) {
      throw new BadRequestException('Payment deadline has passed');
    }

    const feeInr = this.resolveApplicationFee(cycle?.settings);
    const amountPaise = Math.round(feeInr * 100);
    const receipt = `ADM-${application.applicationNumber}`.replace(
      /[^A-Za-z0-9_-]/g,
      '-',
    );

    const order = await createRazorpayOrder(creds, {
      amountPaise,
      receipt,
      notes: {
        applicationId: application.id,
        applicationNumber: application.applicationNumber,
        tenantId,
      },
    });

    const formData = (application.formData as Record<string, unknown>) ?? {};
    const paymentMeta: PaymentMeta = {
      razorpayOrderId: order.id,
      amountPaise,
      currency: order.currency,
      createdAt: new Date().toISOString(),
    };

    await this.prisma.admissionApplication.update({
      where: { id: application.id },
      data: {
        paymentReference: order.id,
        formData: {
          ...formData,
          payment: paymentMeta,
        } as Prisma.InputJsonValue,
      },
    });

    return {
      configured: true,
      keyId: creds.keyId,
      orderId: order.id,
      amount: amountPaise,
      currency: order.currency,
      applicationFee: feeInr,
      description: `Application fee — ${application.applicationNumber}`,
      prefill: {
        name: application.firstName?.trim() || 'Applicant',
        email: application.email,
        contact: application.phone ?? '',
      },
    };
  }

  async verifyPayment(
    tenantId: string,
    userId: string,
    dto: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    },
  ) {
    const creds = this.resolveCredentials();
    if (!isRazorpayConfigured(creds)) {
      throw new ServiceUnavailableException('Online payment is not configured');
    }

    const application = await this.getApplicationForUser(tenantId, userId);
    const formData = (application.formData as Record<string, unknown>) ?? {};
    const paymentMeta = (formData.payment ?? {}) as PaymentMeta;

    if (paymentMeta.razorpayOrderId !== dto.razorpay_order_id) {
      throw new BadRequestException(
        'Payment order does not match this application',
      );
    }

    const valid = verifyRazorpayPaymentSignature(
      creds,
      dto.razorpay_order_id,
      dto.razorpay_payment_id,
      dto.razorpay_signature,
    );
    if (!valid) {
      throw new BadRequestException('Invalid payment signature');
    }

    const feeInr = paymentMeta.amountPaise
      ? paymentMeta.amountPaise / 100
      : this.resolveApplicationFee(application.cycle?.settings);
    const updated = await this.admissions.markPayment(
      tenantId,
      application.id,
      {
        status: 'PAID',
        paymentReference: dto.razorpay_payment_id,
        amountPaid: feeInr,
      },
      userId,
    );

    await this.prisma.admissionAuditLog.create({
      data: {
        tenantId,
        cycleId: application.cycleId,
        entityType: 'application',
        entityId: application.id,
        action: 'payment.razorpay.verified',
        actorId: userId,
        newValue: {
          orderId: dto.razorpay_order_id,
          paymentId: dto.razorpay_payment_id,
        },
      },
    });

    return {
      success: true,
      paymentStatus: updated.paymentStatus,
      paymentReference: updated.paymentReference,
      amountPaid: Number(updated.amountPaid ?? feeInr),
    };
  }

  async handleWebhook(
    tenantId: string,
    rawBody: string,
    signature: string | undefined,
  ) {
    const creds = this.resolveCredentials();
    if (!isRazorpayConfigured(creds)) {
      throw new ServiceUnavailableException('Online payment is not configured');
    }
    if (
      !signature ||
      !verifyRazorpayWebhookSignature(creds, rawBody, signature)
    ) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const payload = JSON.parse(rawBody) as {
      event?: string;
      payload?: {
        payment?: {
          entity?: {
            id?: string;
            order_id?: string;
            amount?: number;
            status?: string;
          };
        };
      };
    };

    if (payload.event !== 'payment.captured') {
      return { received: true, handled: false };
    }

    const payment = payload.payload?.payment?.entity;
    const orderId = payment?.order_id;
    const paymentId = payment?.id;
    if (!orderId || !paymentId) {
      return { received: true, handled: false };
    }

    const application = await this.prisma.admissionApplication.findFirst({
      where: {
        tenantId,
        paymentReference: orderId,
        paymentStatus: 'PENDING',
        deletedAt: null,
      },
      include: { cycle: true },
    });

    if (!application || application.paymentStatus === 'PAID') {
      return { received: true, handled: false };
    }

    const feeInr = payment?.amount
      ? payment.amount / 100
      : this.resolveApplicationFee(application.cycle?.settings);
    await this.admissions.markPayment(tenantId, application.id, {
      status: 'PAID',
      paymentReference: paymentId,
      amountPaid: feeInr,
    });

    return { received: true, handled: true, applicationId: application.id };
  }

  private resolveCredentials(): RazorpayCredentials {
    return {
      keyId: this.config.get<string>('RAZORPAY_KEY_ID') ?? '',
      keySecret: this.config.get<string>('RAZORPAY_KEY_SECRET') ?? '',
      webhookSecret: this.config.get<string>('RAZORPAY_WEBHOOK_SECRET'),
    };
  }

  private resolveApplicationFee(settings: unknown) {
    const fee = (settings as { applicationFee?: number } | null)
      ?.applicationFee;
    return typeof fee === 'number' && fee > 0 ? fee : 600;
  }

  private async getApplicationForUser(tenantId: string, userId: string) {
    const application = await this.prisma.admissionApplication.findFirst({
      where: { tenantId, applicantUserId: userId, deletedAt: null },
      include: { cycle: true },
    });
    if (!application) throw new NotFoundException('Application not found');
    return application;
  }
}
