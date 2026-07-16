import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { PaymentGatewayResolverService } from '../../payment-gateway/services/payment-gateway-resolver.service';

type PaymentMeta = {
  paymentToken?: string;
  provider?: string;
  mode?: string;
  membershipTypeId?: string;
  membershipTypeName?: string;
  demo?: boolean;
};

@Injectable()
export class AlumniPaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gatewayResolver: PaymentGatewayResolverService,
  ) {}

  /** Local/demo checkout when live Atom/Razorpay is unavailable. */
  private isDemoPaymentEnabled() {
    if (process.env.ALUMNI_PAYMENT_DEMO === 'true') return true;
    if (process.env.ALUMNI_PAYMENT_DEMO === 'false') return false;
    return process.env.NODE_ENV !== 'production';
  }

  async getPaymentStatus(
    tenantId: string,
    alumniId: string,
    paymentId: string,
    paymentToken: string,
  ) {
    const payment = await this.requirePayment(
      tenantId,
      alumniId,
      paymentId,
      paymentToken,
    );
    const alumni = await this.prisma.alumniProfile.findFirst({
      where: { id: alumniId, tenantId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        status: true,
        membershipNumber: true,
      },
    });
    if (!alumni) throw new NotFoundException('Alumni registration not found');

    return {
      alumni,
      payment: {
        id: payment.id,
        status: payment.status,
        amountInr: payment.amountPaise / 100,
        currency: payment.currency,
        gateway: payment.gateway,
        receiptNumber: payment.receiptNumber,
        paidAt: payment.paidAt,
        membershipId: payment.membershipId,
      },
      canPay: payment.status === 'PENDING',
      canDownloadReceipt: payment.status === 'PAID',
      canDownloadMembershipCard:
        alumni.status === 'ACTIVE' && Boolean(alumni.membershipNumber),
      demoPaymentEnabled: this.isDemoPaymentEnabled(),
    };
  }

  async ensurePendingPayment(tenantId: string, alumniId: string) {
    const alumni = await this.prisma.alumniProfile.findFirst({
      where: { id: alumniId, tenantId },
      include: {
        memberships: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: { membershipType: true },
        },
      },
    });
    if (!alumni) throw new NotFoundException('Alumni registration not found');

    const membership = alumni.memberships[0];
    if (!membership?.membershipType) {
      throw new BadRequestException('No membership type selected for payment');
    }

    const existingPaid = await this.prisma.alumniPayment.findFirst({
      where: { tenantId, alumniId, status: 'PAID' },
      orderBy: { createdAt: 'desc' },
    });
    if (existingPaid) {
      return {
        alumni,
        membership,
        payment: existingPaid,
        alreadyPaid: true as const,
      };
    }

    const existingPending = await this.prisma.alumniPayment.findFirst({
      where: { tenantId, alumniId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    if (existingPending) {
      return {
        alumni,
        membership,
        payment: existingPending,
        alreadyPaid: false as const,
      };
    }

    const paymentToken = randomUUID();
    const payment = await this.prisma.alumniPayment.create({
      data: {
        tenantId,
        alumniId,
        membershipId: membership.id,
        amountPaise: membership.membershipType.amountPaise,
        currency: 'INR',
        status: 'PENDING',
        metadata: {
          paymentToken,
          membershipTypeId: membership.membershipType.id,
          membershipTypeName: membership.membershipType.name,
        } satisfies PaymentMeta,
      },
    });

    return {
      alumni,
      membership,
      payment,
      alreadyPaid: false as const,
    };
  }

  async initiateCheckout(
    tenantId: string,
    input: {
      alumniId: string;
      paymentId: string;
      paymentToken: string;
      forceDemo?: boolean;
    },
  ) {
    const payment = await this.requirePayment(
      tenantId,
      input.alumniId,
      input.paymentId,
      input.paymentToken,
    );
    if (payment.status === 'PAID') {
      return {
        alreadyPaid: true,
        payment: {
          id: payment.id,
          status: payment.status,
          amountInr: payment.amountPaise / 100,
          receiptNumber: payment.receiptNumber,
        },
      };
    }

    const alumni = await this.prisma.alumniProfile.findFirst({
      where: { id: input.alumniId, tenantId },
    });
    if (!alumni) throw new NotFoundException('Alumni registration not found');

    const amountInr = payment.amountPaise / 100;
    const receipt = `ALU-${payment.id.slice(0, 8)}`.toUpperCase();
    const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
    const returnUrl =
      `${webOrigin}/alumni-portal/pay` +
      `?alumniId=${encodeURIComponent(input.alumniId)}` +
      `&paymentId=${encodeURIComponent(payment.id)}` +
      `&paymentToken=${encodeURIComponent(input.paymentToken)}` +
      `&return=1`;

    const useDemo = input.forceDemo === true || this.isDemoPaymentEnabled();

    let checkout: {
      provider: string;
      orderId: string;
      amount: number;
      currency: string;
      mode: string;
      keyId?: string;
      paymentSessionId?: string;
      checkoutUrl?: string;
      atomTokenId?: string;
      merchantId?: string;
    };

    if (useDemo) {
      checkout = {
        provider: 'RAZORPAY',
        orderId: `MOCK-${payment.id}`,
        amount: amountInr,
        currency: payment.currency || 'INR',
        mode: 'SAFE_MOCK',
      };
    } else {
      try {
        await this.gatewayResolver.requireActiveGateway(tenantId);
        checkout = await this.gatewayResolver.createCheckoutOrder(tenantId, {
          amount: amountInr,
          currency: payment.currency || 'INR',
          receipt,
          notes: {
            alumniId: alumni.id,
            paymentId: payment.id,
            module: 'ALUMNI_MEMBERSHIP',
          },
        });
      } catch {
        // Live gateway misconfigured (common with Atom/NTT in local) — fall back to demo.
        checkout = {
          provider: 'RAZORPAY',
          orderId: `MOCK-${payment.id}`,
          amount: amountInr,
          currency: payment.currency || 'INR',
          mode: 'SAFE_MOCK',
        };
      }
    }

    const meta = (payment.metadata ?? {}) as PaymentMeta;
    const isDemo = checkout.mode === 'SAFE_MOCK' || checkout.mode === 'MOCK';
    await this.prisma.alumniPayment.update({
      where: { id: payment.id },
      data: {
        gateway: checkout.provider,
        gatewayOrderId: isDemo
          ? `MOCK-${payment.id}`
          : checkout.orderId || payment.gatewayOrderId,
        metadata: {
          ...meta,
          provider: checkout.provider,
          mode: checkout.mode,
          demo: isDemo,
        } as Prisma.InputJsonValue,
      },
    });

    return {
      alreadyPaid: false,
      demo: isDemo,
      payment: {
        id: payment.id,
        status: payment.status,
        amountInr,
        currency: payment.currency || 'INR',
      },
      checkout: {
        ...checkout,
        paymentId: payment.id,
        returnUrl,
        custEmail: alumni.email || undefined,
        custMobile: alumni.phone || undefined,
        requestNo: receipt,
      },
      prefill: {
        name: alumni.fullName,
        email: alumni.email || '',
        contact: alumni.phone || '',
      },
      description: isDemo
        ? `Alumni membership demo payment — ${alumni.fullName}`
        : `Alumni membership — ${alumni.fullName}`,
    };
  }

  async verifyRazorpay(
    tenantId: string,
    input: {
      alumniId: string;
      paymentId: string;
      paymentToken: string;
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    },
  ) {
    const payment = await this.requirePayment(
      tenantId,
      input.alumniId,
      input.paymentId,
      input.paymentToken,
    );
    if (payment.status === 'PAID') {
      return { alreadyPaid: true, payment };
    }

    if (
      payment.gatewayOrderId &&
      payment.gatewayOrderId !== input.razorpay_order_id
    ) {
      throw new BadRequestException('Payment order does not match this record');
    }

    const provider = String(payment.gateway ?? 'RAZORPAY').toUpperCase();
    const valid = await this.gatewayResolver.verifyPayment(tenantId, provider, {
      orderId: input.razorpay_order_id,
      paymentId: input.razorpay_payment_id,
      signature: input.razorpay_signature,
    });
    if (!valid) throw new BadRequestException('Invalid payment signature');

    return this.markPaid(tenantId, payment.id, {
      gatewayPaymentId: input.razorpay_payment_id,
      gatewayOrderId: input.razorpay_order_id,
      gateway: provider,
    });
  }

  async confirmMockOrReturn(
    tenantId: string,
    input: { alumniId: string; paymentId: string; paymentToken: string },
  ) {
    const payment = await this.requirePayment(
      tenantId,
      input.alumniId,
      input.paymentId,
      input.paymentToken,
    );
    if (payment.status === 'PAID') {
      return { alreadyPaid: true, payment };
    }

    const meta = (payment.metadata ?? {}) as PaymentMeta;
    const mode = String(meta.mode ?? '').toUpperCase();
    const orderId = String(payment.gatewayOrderId ?? '');

    if (mode === 'SAFE_MOCK' || orderId.startsWith('MOCK-')) {
      return this.markPaid(tenantId, payment.id, {
        gatewayPaymentId: `MOCK-PAY-${payment.id.slice(0, 8)}`,
        gatewayOrderId: orderId || `MOCK-${payment.id}`,
        gateway: payment.gateway || 'RAZORPAY',
      });
    }

    throw new BadRequestException(
      'Online payment is still pending confirmation. Complete checkout in the payment window, or wait for gateway confirmation.',
    );
  }

  private async markPaid(
    tenantId: string,
    paymentId: string,
    refs: {
      gatewayPaymentId: string;
      gatewayOrderId?: string;
      gateway?: string;
    },
  ) {
    const existing = await this.prisma.alumniPayment.findFirst({
      where: { id: paymentId, tenantId },
    });
    if (!existing) throw new NotFoundException('Payment not found');
    if (existing.status === 'PAID') {
      return { alreadyPaid: true, payment: existing };
    }

    const year = new Date().getFullYear();
    const seq = String(
      (await this.prisma.alumniPayment.count({
        where: { tenantId, status: 'PAID' },
      })) + 1,
    ).padStart(4, '0');
    const receiptNumber = `ALU-RCP-${year}-${seq}`;

    const payment = await this.prisma.alumniPayment.update({
      where: { id: paymentId },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        receiptNumber,
        gateway: refs.gateway ?? existing.gateway,
        gatewayOrderId: refs.gatewayOrderId ?? existing.gatewayOrderId,
        gatewayPaymentId: refs.gatewayPaymentId,
      },
    });

    return {
      alreadyPaid: false,
      payment,
      message:
        'Payment received. The Alumni Office will verify your details and activate membership.',
    };
  }

  private async requirePayment(
    tenantId: string,
    alumniId: string,
    paymentId: string,
    paymentToken: string,
  ) {
    if (!paymentToken?.trim()) {
      throw new BadRequestException('Payment token is required');
    }
    const payment = await this.prisma.alumniPayment.findFirst({
      where: { id: paymentId, tenantId, alumniId },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    const meta = (payment.metadata ?? {}) as PaymentMeta;
    if (meta.paymentToken !== paymentToken) {
      throw new BadRequestException('Invalid payment token');
    }
    return payment;
  }
}
