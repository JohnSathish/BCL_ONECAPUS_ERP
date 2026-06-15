import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import {
  createRazorpayOrder,
  createRazorpayPaymentLink,
  createRazorpayUpiQr,
  isRazorpayConfigured,
} from '../../../common/payments/razorpay.util';
import { PrismaService } from '../../../database/prisma.service';
import { FeeFinanceSettingsService } from './fee-finance-settings.service';

export type CreatePaymentRequestDto = {
  studentId: string;
  demandIds: string[];
  channel?: 'OFFICE_QR' | 'PAYMENT_LINK' | 'STUDENT_PORTAL';
  sendLinkVia?: Array<'SMS' | 'EMAIL' | 'WHATSAPP'>;
};

@Injectable()
export class FeePaymentRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: FeeFinanceSettingsService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async list(
    tenantId: string,
    query: { studentId?: string; status?: string; limit?: number },
  ) {
    await this.expireStale(tenantId);
    return this.db().feePaymentRequest.findMany({
      where: {
        tenantId,
        ...(query.studentId ? { studentId: query.studentId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? 50,
    });
  }

  async getOne(tenantId: string, id: string) {
    await this.expireStale(tenantId);
    const row = await this.db().feePaymentRequest.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Payment request not found');
    return row;
  }

  async create(user: JwtUser, dto: CreatePaymentRequestDto) {
    const config = await this.settings.get(user.tid);
    const modes = config.collectionModes as Record<string, boolean> | undefined;
    if (
      dto.channel === 'OFFICE_QR' &&
      !modes?.upi_qr &&
      config.officeQrEnabled === false
    ) {
      throw new BadRequestException(
        'UPI QR collection is disabled. Enable it in Finance → Fee Settings → Collection Modes.',
      );
    }
    if (!dto.demandIds?.length) {
      throw new BadRequestException('Select at least one fee item.');
    }

    const demands = await this.db().studentFeeDemand.findMany({
      where: {
        tenantId: user.tid,
        studentId: dto.studentId,
        id: { in: dto.demandIds },
        status: { in: ['PUBLISHED', 'LOCKED', 'PARTIALLY_PAID'] },
        balanceAmount: { gt: 0 },
      },
    });
    if (!demands.length) {
      throw new BadRequestException(
        'No payable demands found for the selected items.',
      );
    }

    const amount = demands.reduce(
      (s: number, d: { balanceAmount: unknown }) => s + Number(d.balanceAmount),
      0,
    );
    if (amount <= 0)
      throw new BadRequestException('Selected fees have no balance due.');

    const student = await this.db().student.findFirst({
      where: { id: dto.studentId, tenantId: user.tid, deletedAt: null },
      include: {
        user: { select: { email: true, displayName: true } },
        masterProfile: {
          select: { fullName: true, mobileNumber: true, email: true },
        },
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    const expiryMin = Number(config.paymentRequestExpiryMinutes) || 15;
    const expiresAt = new Date(Date.now() + expiryMin * 60 * 1000);
    const requestNo = await this.nextRequestNo(user.tid);
    const feeItems = demands.map((d: Record<string, unknown>) => ({
      demandId: d.id,
      label: d.demandNo ?? d.demandType,
      amount: Number(d.balanceAmount),
    }));

    const payment = await this.db().paymentTransaction.create({
      data: {
        tenantId: user.tid,
        studentId: dto.studentId,
        transactionNo: await this.nextTransactionNo(user.tid),
        paymentMode: 'ONLINE',
        provider: 'RAZORPAY',
        status: 'INITIATED',
        amount,
        unallocatedAmount: amount,
        metadata: {
          demandIds: dto.demandIds,
          paymentRequestChannel: dto.channel ?? 'OFFICE_QR',
        },
      },
    });

    const creds = {
      keyId: process.env.RAZORPAY_KEY_ID ?? '',
      keySecret: process.env.RAZORPAY_KEY_SECRET ?? '',
      webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
    };
    const studentName =
      student.masterProfile?.fullName ?? student.user?.displayName ?? 'Student';
    const description = `Fee ${requestNo}`;
    const notes = {
      studentId: dto.studentId,
      paymentId: payment.id,
      requestNo,
      tenantId: user.tid,
    };
    const closeByUnix = Math.floor(expiresAt.getTime() / 1000);

    let providerOrderId: string | null = null;
    let paymentLinkUrl: string | null = null;
    let qrImageUrl: string | null = null;
    let mode: 'LIVE' | 'MOCK' = 'MOCK';

    if (config.onlinePaymentEnabled && isRazorpayConfigured(creds)) {
      try {
        if (dto.channel === 'PAYMENT_LINK') {
          const link = await createRazorpayPaymentLink(creds, {
            amountPaise: Math.round(amount * 100),
            description,
            referenceId: requestNo,
            customer: {
              name: studentName,
              email: student.masterProfile?.email ?? student.user?.email,
              contact: student.masterProfile?.mobileNumber ?? undefined,
            },
            expireByUnix: closeByUnix,
            notes,
          });
          paymentLinkUrl = link.short_url;
          providerOrderId = link.id;
        } else {
          const order = await createRazorpayOrder(creds, {
            amountPaise: Math.round(amount * 100),
            receipt: requestNo,
            notes,
          });
          providerOrderId = order.id;
          await this.db().paymentTransaction.update({
            where: { id: payment.id },
            data: { providerOrderId: order.id },
          });
          try {
            const qr = await createRazorpayUpiQr(creds, {
              amountPaise: Math.round(amount * 100),
              description,
              referenceId: requestNo,
              closeByUnix,
              notes,
            });
            qrImageUrl = qr.image_url;
          } catch {
            const link = await createRazorpayPaymentLink(creds, {
              amountPaise: Math.round(amount * 100),
              description,
              referenceId: requestNo,
              expireByUnix: closeByUnix,
              notes,
            });
            paymentLinkUrl = link.short_url;
          }
        }
        mode = 'LIVE';
      } catch {
        mode = 'MOCK';
      }
    }

    if (mode === 'MOCK') {
      const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
      paymentLinkUrl = `${webOrigin}/admin/fees/collections?mockPay=${payment.id}&ref=${requestNo}`;
      qrImageUrl = `https://quickchart.io/qr?size=280&text=${encodeURIComponent(paymentLinkUrl)}`;
    }

    const request = await this.db().feePaymentRequest.create({
      data: {
        tenantId: user.tid,
        requestNo,
        studentId: dto.studentId,
        amount,
        status: 'PENDING',
        channel: dto.channel ?? 'OFFICE_QR',
        demandIds: dto.demandIds,
        feeItems,
        paymentId: payment.id,
        provider: 'RAZORPAY',
        providerOrderId,
        paymentLinkUrl,
        qrImageUrl,
        upiReference: requestNo,
        generatedById: user.sub,
        expiresAt,
        metadata: { mode, studentName },
      },
    });

    return {
      request,
      payment,
      checkout: {
        mode,
        amount,
        requestNo,
        reference: requestNo,
        expiresAt,
        qrImageUrl,
        paymentLinkUrl,
        orderId: providerOrderId,
        keyId: process.env.RAZORPAY_KEY_ID,
      },
    };
  }

  async cancel(user: JwtUser, id: string, reason?: string) {
    const request = await this.getOne(user.tid, id);
    if (request.status === 'PAID')
      throw new BadRequestException('Cannot cancel a paid request.');
    if (request.status === 'CANCELLED') return request;

    await this.db().feePaymentRequest.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        metadata: { ...(request.metadata ?? {}), cancelReason: reason },
      },
    });
    if (request.paymentId) {
      await this.db().paymentTransaction.update({
        where: { id: request.paymentId },
        data: { status: 'CANCELLED' },
      });
    }
    return { id, status: 'CANCELLED' };
  }

  async markPaidFromPayment(
    tenantId: string,
    paymentId: string,
    providerPaymentId?: string,
    receiptId?: string,
  ) {
    const request = await this.db().feePaymentRequest.findFirst({
      where: { tenantId, paymentId, status: 'PENDING' },
    });
    if (!request) return null;
    await this.db().feePaymentRequest.update({
      where: { id: request.id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        providerPaymentId,
        receiptId,
      },
    });
    return request;
  }

  async expireStale(tenantId: string) {
    const now = new Date();
    const stale = await this.db().feePaymentRequest.findMany({
      where: { tenantId, status: 'PENDING', expiresAt: { lt: now } },
      take: 200,
    });
    for (const row of stale) {
      await this.db().feePaymentRequest.update({
        where: { id: row.id },
        data: { status: 'EXPIRED' },
      });
      if (row.paymentId) {
        await this.db().paymentTransaction.updateMany({
          where: { id: row.paymentId, status: 'INITIATED' },
          data: { status: 'EXPIRED' },
        });
      }
    }
    return stale.length;
  }

  private async nextRequestNo(tenantId: string) {
    const year = new Date().getFullYear();
    const shortYear = String(year).slice(-2);
    const count = await this.db().feePaymentRequest.count({
      where: { tenantId },
    });
    return `DBCT${shortYear}-${String(count + 1).padStart(4, '0')}`;
  }

  private async nextTransactionNo(tenantId: string) {
    const count = await this.db().paymentTransaction.count({
      where: { tenantId },
    });
    return `REQ-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;
  }
}
