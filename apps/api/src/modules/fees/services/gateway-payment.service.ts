import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import type { GatewayPaymentDto } from '../dto/fees.dto';
import {
  fetchRazorpayOrderPayments,
  fetchRazorpayPaymentLink,
  isRazorpayConfigured,
} from '../../../common/payments/razorpay.util';
import {
  fetchCashfreeOrder,
  fetchCashfreeOrderPayments,
  isCashfreeConfigured,
} from '../../../common/payments/cashfree.util';
import {
  isBilldeskConfigured,
  retrieveBilldeskOrder,
  toBilldeskCredentials,
  verifyBilldeskWebhook,
} from '../../../common/payments/billdesk.util';
import {
  isNttDataConfigured,
  toNttDataCredentials,
  trackNttDataTransaction,
  verifyNttDataReturnPayload,
} from '../../../common/payments/nttdata.util';
import { FeeFinanceSettingsService } from './fee-finance-settings.service';
import { resolveCollectionModes } from '../constants/collection-modes.constants';
import { FeeLedgerService } from './fee-ledger.service';
import { PaymentCollectionService } from './payment-collection.service';
import { QueueService } from '../../../shared/queue/queue.service';
import { FeeReceiptNotificationService } from './fee-receipt-notification.service';
import { PaymentGatewayResolverService } from '../../payment-gateway/services/payment-gateway-resolver.service';

@Injectable()
export class GatewayPaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: FeeFinanceSettingsService,
    private readonly ledger: FeeLedgerService,
    private readonly collections: PaymentCollectionService,
    private readonly queue: QueueService,
    private readonly receiptNotify: FeeReceiptNotificationService,
    private readonly gatewayResolver: PaymentGatewayResolverService,
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

    const active = await this.gatewayResolver.requireActiveGateway(user.tid);
    const provider = active.providerCode;

    const payment = await this.db().paymentTransaction.create({
      data: {
        tenantId: user.tid,
        studentId: dto.studentId,
        transactionNo: await this.nextTransactionNo(user.tid),
        paymentMode: 'ONLINE',
        paymentSource: 'ERP_GATEWAY',
        provider,
        status: 'INITIATED',
        amount: dto.amount,
        unallocatedAmount: dto.amount,
        collectedById: user.sub,
        metadata: {
          demandIds: dto.demandIds ?? [],
          channel: dto.channel ?? 'STUDENT_PORTAL',
          ...(dto.metadata ?? {}),
        },
      },
    });

    const checkout = await this.gatewayResolver.createCheckoutOrder(user.tid, {
      amount: dto.amount,
      currency: 'INR',
      receipt: payment.transactionNo,
      notes: { studentId: dto.studentId, paymentId: payment.id },
    });

    const webOrigin =
      dto.channel === 'CENTER_PORTAL'
        ? (process.env.PAY_PORTAL_ORIGIN ??
          process.env.WEB_ORIGIN ??
          'http://localhost:3000')
        : (process.env.WEB_ORIGIN ?? 'http://localhost:3000');
    const returnPath = dto.returnPath?.startsWith('/')
      ? dto.returnPath
      : dto.channel === 'CENTER_PORTAL'
        ? '/fee-collection-portal/pay/return'
        : '/student/fees';
    const returnUrl = `${webOrigin}${returnPath}${returnPath.includes('?') ? '&' : '?'}atomReturn=1&paymentId=${payment.id}`;

    if (
      checkout.mode !== 'SAFE_MOCK' &&
      (checkout.orderId || checkout.atomTokenId)
    ) {
      if (checkout.orderId) {
        await this.db().paymentTransaction.update({
          where: { id: payment.id },
          data: { providerOrderId: checkout.orderId },
        });
      }
      return {
        payment,
        checkout: {
          ...checkout,
          paymentId: payment.id,
          returnUrl,
        },
      };
    }

    await this.db().paymentGatewayLog.create({
      data: {
        tenantId: user.tid,
        paymentId: payment.id,
        provider,
        eventType: 'INITIATE',
        status: 'QUEUED',
        request: dto,
        response: { mode: 'SAFE_MOCK' },
      },
    });
    return {
      payment,
      checkout: {
        provider,
        orderId: `MOCK-${payment.id}`,
        amount: dto.amount,
        currency: 'INR',
        mode: 'SAFE_MOCK',
        paymentId: payment.id,
        returnUrl,
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
    const payment = await this.db().paymentTransaction.findFirst({
      where: { tenantId: user.tid, providerOrderId: dto.razorpay_order_id },
    });
    if (!payment) throw new BadRequestException('Payment record not found.');

    const valid = await this.gatewayResolver.verifyPayment(
      user.tid,
      String(payment.provider ?? 'RAZORPAY'),
      {
        orderId: dto.razorpay_order_id,
        paymentId: dto.razorpay_payment_id,
        signature: dto.razorpay_signature,
      },
    );
    if (!valid) throw new BadRequestException('Invalid payment signature.');

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

  /**
   * Poll the active gateway for an initiated payment (exam fees / redirect returns).
   * Does not require a FeePaymentRequest row.
   */
  async reconcilePaymentTransaction(user: JwtUser, paymentId: string) {
    const payment = await this.db().paymentTransaction.findFirst({
      where: { id: paymentId, tenantId: user.tid },
    });
    if (!payment) throw new BadRequestException('Payment not found.');
    if (payment.status === 'SUCCESS') {
      return { synced: true, payment, providerStatus: 'paid' as const };
    }

    const providerRef = String(payment.providerOrderId ?? '').trim();
    if (!providerRef || providerRef.startsWith('MOCK-')) {
      return {
        synced: false,
        payment,
        providerStatus: 'NO_PROVIDER_REF' as const,
      };
    }

    const providerCode = String(payment.provider ?? 'RAZORPAY').toUpperCase();
    const creds = await this.gatewayResolver.resolveCredentials(
      user.tid,
      providerCode,
    );
    if (!creds) {
      return {
        synced: false,
        payment,
        providerStatus: 'NOT_CONFIGURED' as const,
      };
    }

    try {
      if (
        providerCode === 'CASHFREE' &&
        isCashfreeConfigured({
          keyId: creds.keyId,
          keySecret: creds.keySecret,
          webhookSecret: creds.webhookSecret ?? undefined,
          mode: creds.mode,
        })
      ) {
        const order = await fetchCashfreeOrder(
          {
            keyId: creds.keyId,
            keySecret: creds.keySecret,
            webhookSecret: creds.webhookSecret ?? undefined,
            mode: creds.mode,
          },
          providerRef,
        );
        if (order.order_status === 'PAID') {
          const payments = await fetchCashfreeOrderPayments(
            {
              keyId: creds.keyId,
              keySecret: creds.keySecret,
              webhookSecret: creds.webhookSecret ?? undefined,
              mode: creds.mode,
            },
            providerRef,
          );
          const success = payments.find((p) => p.payment_status === 'SUCCESS');
          const result = await this.completePayment(
            user.tid,
            payment,
            success?.cf_payment_id ?? `cf-${providerRef}`,
            user.sub,
          );
          return {
            synced: true,
            payment: result.payment,
            providerStatus: 'paid' as const,
          };
        }
        return {
          synced: false,
          payment,
          providerStatus: order.order_status,
        };
      }

      if (providerCode === 'BILLDESK') {
        const billdesk = toBilldeskCredentials(creds);
        if (!billdesk || !isBilldeskConfigured(billdesk)) {
          return {
            synced: false,
            payment,
            providerStatus: 'NOT_CONFIGURED' as const,
          };
        }
        const order = await retrieveBilldeskOrder(billdesk, providerRef);
        const status = String(
          (order as { status?: string }).status ??
            (order as { transaction_error_type?: string })
              .transaction_error_type ??
            '',
        ).toLowerCase();
        if (status === 'paid' || status === 'success' || status === '0300') {
          const result = await this.completePayment(
            user.tid,
            payment,
            String(
              (order as { transactionid?: string }).transactionid ??
                `bd-${providerRef}`,
            ),
            user.sub,
          );
          return {
            synced: true,
            payment: result.payment,
            providerStatus: 'paid' as const,
          };
        }
        return {
          synced: false,
          payment,
          providerStatus: status || 'pending',
        };
      }

      if (
        providerRef.startsWith('order_') &&
        isRazorpayConfigured({
          keyId: creds.keyId,
          keySecret: creds.keySecret,
          webhookSecret: creds.webhookSecret ?? undefined,
        })
      ) {
        const orderPayments = await fetchRazorpayOrderPayments(
          {
            keyId: creds.keyId,
            keySecret: creds.keySecret,
            webhookSecret: creds.webhookSecret ?? undefined,
          },
          providerRef,
        );
        const captured = orderPayments.items?.find(
          (p) => p.status === 'captured',
        );
        if (captured) {
          const result = await this.completePayment(
            user.tid,
            payment,
            captured.id,
            user.sub,
          );
          return {
            synced: true,
            payment: result.payment,
            providerStatus: 'paid' as const,
          };
        }
        return { synced: false, payment, providerStatus: 'pending' as const };
      }
    } catch (err) {
      return {
        synced: false,
        payment,
        providerStatus: err instanceof Error ? err.message : 'SYNC_FAILED',
      };
    }

    return { synced: false, payment, providerStatus: 'UNSUPPORTED' as const };
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
      const paymentId = entity?.id as string | undefined;
      const notes = (entity?.notes ?? {}) as Record<string, string>;
      if (orderId) {
        const payment = await this.db().paymentTransaction.findFirst({
          where: { tenantId, providerOrderId: orderId },
        });
        if (payment && payment.status !== 'SUCCESS') {
          await this.completePayment(
            tenantId,
            payment,
            String(paymentId ?? ''),
          );
        }
      } else if (notes.paymentId) {
        const payment = await this.db().paymentTransaction.findFirst({
          where: { tenantId, id: notes.paymentId },
        });
        if (payment && payment.status !== 'SUCCESS') {
          await this.completePayment(
            tenantId,
            payment,
            String(paymentId ?? ''),
          );
        }
      }
    }

    if (provider === 'RAZORPAY' && payload.event === 'payment_link.paid') {
      const linkEntity = (
        payload.payload as {
          payment_link?: { entity?: Record<string, unknown> };
        }
      )?.payment_link?.entity;
      const payEntity = (
        payload.payload as { payment?: { entity?: Record<string, unknown> } }
      )?.payment?.entity;
      const linkId = linkEntity?.id as string | undefined;
      const providerPaymentId = payEntity?.id as string | undefined;
      if (linkId) {
        await this.completePaymentRequestByProviderRef(
          tenantId,
          linkId,
          providerPaymentId,
        );
      }
    }

    if (provider === 'RAZORPAY' && payload.event === 'payment.failed') {
      const entity = (
        payload.payload as { payment?: { entity?: Record<string, unknown> } }
      )?.payment?.entity;
      const orderId = entity?.order_id as string | undefined;
      const notes = (entity?.notes ?? {}) as Record<string, string>;
      const payment = orderId
        ? await this.db().paymentTransaction.findFirst({
            where: { tenantId, providerOrderId: orderId },
          })
        : notes.paymentId
          ? await this.db().paymentTransaction.findFirst({
              where: { tenantId, id: notes.paymentId },
            })
          : null;
      if (payment && payment.status === 'INITIATED') {
        await this.db().paymentTransaction.update({
          where: { id: payment.id },
          data: { status: 'FAILED' },
        });
        await this.db().feePaymentRequest.updateMany({
          where: { tenantId, paymentId: payment.id, status: 'PENDING' },
          data: {
            status: 'CANCELLED',
            metadata: { failureReason: 'Payment failed at gateway' },
          },
        });
      }
    }

    if (provider === 'CASHFREE') {
      const eventType = String(payload.type ?? '');
      if (eventType === 'PAYMENT_SUCCESS_WEBHOOK') {
        const data = payload.data as {
          order?: { order_id?: string };
          payment?: { cf_payment_id?: string };
        };
        const orderId = data.order?.order_id;
        const paymentId = data.payment?.cf_payment_id;
        if (orderId) {
          const payment = await this.db().paymentTransaction.findFirst({
            where: { tenantId, providerOrderId: orderId },
          });
          if (payment && payment.status !== 'SUCCESS') {
            await this.completePayment(
              tenantId,
              payment,
              String(paymentId ?? ''),
            );
          }
        }
      }
      if (eventType === 'PAYMENT_FAILED_WEBHOOK') {
        const data = payload.data as { order?: { order_id?: string } };
        const orderId = data.order?.order_id;
        if (orderId) {
          const payment = await this.db().paymentTransaction.findFirst({
            where: { tenantId, providerOrderId: orderId },
          });
          if (payment && payment.status === 'INITIATED') {
            await this.db().paymentTransaction.update({
              where: { id: payment.id },
              data: { status: 'FAILED' },
            });
          }
        }
      }
    }

    if (provider === 'BILLDESK') {
      const rawJws = String(payload._billdeskJws ?? '');
      const creds = await this.gatewayResolver.resolveCredentials(
        tenantId,
        'BILLDESK',
      );
      const billdesk = creds ? toBilldeskCredentials(creds) : null;
      const verified =
        billdesk && rawJws
          ? verifyBilldeskWebhook(billdesk, rawJws)
          : { valid: false, payload: undefined };
      const txn = verified.payload;
      if (verified.valid && txn?.orderid) {
        const success =
          txn.transaction_error_type === 'success' ||
          txn.auth_status === '0300';
        const payment = await this.db().paymentTransaction.findFirst({
          where: { tenantId, providerOrderId: txn.orderid },
        });
        if (payment && payment.status !== 'SUCCESS' && success) {
          await this.completePayment(
            tenantId,
            payment,
            String(txn.transactionid ?? ''),
          );
        } else if (payment && payment.status === 'INITIATED' && !success) {
          await this.db().paymentTransaction.update({
            where: { id: payment.id },
            data: { status: 'FAILED' },
          });
        }
      }
    }

    if (provider === 'NTT_DATA') {
      const raw = String(payload._nttDataRaw ?? '');
      const creds = await this.gatewayResolver.resolveCredentials(
        tenantId,
        'NTT_DATA',
      );
      const ntt = creds ? toNttDataCredentials(creds) : null;
      if (ntt && raw) {
        const enc = raw.includes('encData=')
          ? decodeURIComponent(raw.split('encData=')[1]?.split('&')[0] ?? '')
          : raw.trim();
        const verified = enc ? verifyNttDataReturnPayload(ntt, enc) : null;
        const orderId = String(
          (verified?.payload as { merchTxnId?: string })?.merchTxnId ??
            (
              verified?.payload as {
                payInstrument?: { merchDetails?: { merchTxnId?: string } };
              }
            )?.payInstrument?.merchDetails?.merchTxnId ??
            '',
        );
        if (verified?.valid && orderId) {
          const payment = await this.db().paymentTransaction.findFirst({
            where: { tenantId, providerOrderId: orderId },
          });
          if (payment && payment.status !== 'SUCCESS') {
            await this.completePayment(
              tenantId,
              payment,
              String(
                (verified.payload as { atomTxnId?: string }).atomTxnId ??
                  `ntt-${Date.now()}`,
              ),
            );
          }
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
    providerCode = 'RAZORPAY',
    context?: { timestamp?: string },
  ) {
    const verified = await this.gatewayResolver.verifyWebhook(
      tenantId,
      providerCode,
      rawBody,
      signature,
      context,
    );
    if (!verified) {
      throw new BadRequestException('Invalid webhook signature');
    }
    return this.webhook(tenantId, providerCode.toUpperCase(), payload);
  }

  /** After Atom/Cashfree redirect return — reconcile ERP payment by id. */
  async reconcilePaymentById(user: JwtUser, paymentId: string) {
    const payment = await this.db().paymentTransaction.findFirst({
      where: { id: paymentId, tenantId: user.tid },
    });
    if (!payment) throw new BadRequestException('Payment not found.');

    if (
      user.permissions?.includes('student:portal:self') &&
      !user.permissions?.includes('fees:manage') &&
      !user.permissions?.includes('fees:read')
    ) {
      const account = await this.db().student.findFirst({
        where: {
          tenantId: user.tid,
          userId: user.sub,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!account || payment.studentId !== account.id) {
        throw new BadRequestException('Payment not found.');
      }
    }

    if (payment.status === 'SUCCESS') {
      return { synced: true, alreadyPaid: true, payment };
    }

    const request = await this.db().feePaymentRequest.findFirst({
      where: { paymentId: payment.id, tenantId: user.tid },
    });
    if (request?.status === 'PENDING') {
      const synced = await this.syncPaymentRequest(user, request.id);
      return { ...synced, paymentId: payment.id };
    }

    const providerCode = String(payment.provider ?? '').toUpperCase();
    const providerRef = String(payment.providerOrderId ?? '').trim();
    if (providerCode === 'NTT_DATA' && providerRef) {
      const creds = await this.gatewayResolver.resolveCredentials(
        user.tid,
        'NTT_DATA',
      );
      const ntt = creds ? toNttDataCredentials(creds) : null;
      if (ntt && isNttDataConfigured(ntt)) {
        const status = await trackNttDataTransaction(ntt, {
          merchTxnId: providerRef,
          amount: Number(payment.amount),
          txnDate: new Date().toISOString().slice(0, 10),
        });
        const code = String(
          (status as { statusCode?: string }).statusCode ??
            (status as { txnStatus?: string }).txnStatus ??
            '',
        ).toUpperCase();
        if (code === 'OTS0000' || code === 'SUCCESS') {
          const result = await this.completePayment(
            user.tid,
            payment,
            String(
              (status as { atomTxnId?: string }).atomTxnId ??
                `ntt-${providerRef}`,
            ),
            user.sub,
          );
          return { synced: true, providerStatus: 'paid', ...result };
        }
        return { synced: false, providerStatus: code || 'pending', payment };
      }
    }

    if (providerRef) {
      return this.syncStatus(user, providerCode || 'RAZORPAY', providerRef);
    }

    return { synced: false, providerStatus: 'NO_PROVIDER_REF', payment };
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
    if (request?.status === 'PENDING') {
      await this.syncPaymentRequest(user, request.id);
    }
    const refreshedPayment = await this.db().paymentTransaction.findFirst({
      where: { tenantId: user.tid, provider, providerOrderId: orderId },
    });
    const refreshedRequest = refreshedPayment
      ? await this.db().feePaymentRequest.findFirst({
          where: { paymentId: refreshedPayment.id },
        })
      : null;
    return {
      provider,
      orderId,
      payment: refreshedPayment,
      paymentRequest: refreshedRequest,
      status: refreshedPayment?.status ?? 'NOT_FOUND',
    };
  }

  /** Poll Razorpay for payment-link / order status and reconcile ERP records. */
  async syncPaymentRequest(user: JwtUser, requestId: string) {
    const request = await this.db().feePaymentRequest.findFirst({
      where: { id: requestId, tenantId: user.tid },
    });
    if (!request) throw new BadRequestException('Payment request not found.');
    if (request.status !== 'PENDING') {
      return { synced: false, request, providerStatus: request.status };
    }

    const payment = request.paymentId
      ? await this.db().paymentTransaction.findFirst({
          where: { id: request.paymentId, tenantId: user.tid },
        })
      : null;
    if (!payment) {
      return { synced: false, request, providerStatus: 'NOT_FOUND' };
    }
    if (payment.status === 'SUCCESS') {
      await this.db().feePaymentRequest.updateMany({
        where: { id: request.id, status: 'PENDING' },
        data: { status: 'PAID', paidAt: payment.paidAt ?? new Date() },
      });
      const updated = await this.db().feePaymentRequest.findFirst({
        where: { id: request.id },
      });
      return { synced: true, request: updated, providerStatus: 'paid' };
    }

    const providerCode = String(payment.provider ?? 'RAZORPAY').toUpperCase();
    const creds = await this.gatewayResolver.resolveCredentials(
      user.tid,
      providerCode,
    );
    if (!creds) {
      return { synced: false, request, providerStatus: 'NOT_CONFIGURED' };
    }

    const providerRef = String(
      request.providerOrderId ?? payment.providerOrderId ?? '',
    ).trim();
    if (!providerRef) {
      return { synced: false, request, providerStatus: 'NO_PROVIDER_REF' };
    }

    try {
      if (
        providerCode === 'CASHFREE' &&
        isCashfreeConfigured({
          keyId: creds.keyId,
          keySecret: creds.keySecret,
          webhookSecret: creds.webhookSecret ?? undefined,
          mode: creds.mode,
        })
      ) {
        const order = await fetchCashfreeOrder(
          {
            keyId: creds.keyId,
            keySecret: creds.keySecret,
            webhookSecret: creds.webhookSecret ?? undefined,
            mode: creds.mode,
          },
          providerRef,
        );
        if (order.order_status === 'PAID') {
          const payments = await fetchCashfreeOrderPayments(
            {
              keyId: creds.keyId,
              keySecret: creds.keySecret,
              webhookSecret: creds.webhookSecret ?? undefined,
              mode: creds.mode,
            },
            providerRef,
          );
          const success = payments.find((p) => p.payment_status === 'SUCCESS');
          await this.completePayment(
            user.tid,
            payment,
            success?.cf_payment_id ?? `cf-${providerRef}`,
            request.generatedById ?? user.sub,
          );
          const updated = await this.db().feePaymentRequest.findFirst({
            where: { id: request.id },
          });
          return { synced: true, request: updated, providerStatus: 'paid' };
        }
        if (
          order.order_status === 'EXPIRED' ||
          order.order_status === 'TERMINATED'
        ) {
          await this.markPaymentRequestClosed(
            user.tid,
            request,
            payment,
            order.order_status.toLowerCase(),
          );
          const updated = await this.db().feePaymentRequest.findFirst({
            where: { id: request.id },
          });
          return {
            synced: true,
            request: updated,
            providerStatus: order.order_status.toLowerCase(),
          };
        }
        return { synced: false, request, providerStatus: order.order_status };
      }

      if (providerCode === 'BILLDESK') {
        const billdesk = toBilldeskCredentials(creds);
        if (!billdesk || !isBilldeskConfigured(billdesk)) {
          return { synced: false, request, providerStatus: 'NOT_CONFIGURED' };
        }
        const order = await retrieveBilldeskOrder(billdesk, providerRef);
        const status = String(
          (order as { status?: string }).status ??
            (order as { transaction_error_type?: string })
              .transaction_error_type ??
            '',
        ).toLowerCase();
        if (status === 'paid' || status === 'success' || status === '0300') {
          await this.completePayment(
            user.tid,
            payment,
            String(
              (order as { transactionid?: string }).transactionid ??
                `bd-${providerRef}`,
            ),
            request.generatedById ?? user.sub,
          );
          const updated = await this.db().feePaymentRequest.findFirst({
            where: { id: request.id },
          });
          return { synced: true, request: updated, providerStatus: 'paid' };
        }
        return { synced: false, request, providerStatus: status || 'pending' };
      }

      if (providerCode === 'NTT_DATA') {
        const ntt = toNttDataCredentials(creds);
        if (!ntt || !isNttDataConfigured(ntt)) {
          return { synced: false, request, providerStatus: 'NOT_CONFIGURED' };
        }
        const status = await trackNttDataTransaction(ntt, {
          merchTxnId: providerRef,
          amount: Number(payment.amount),
          txnDate: new Date().toISOString().slice(0, 10),
        });
        const code = String(
          (status as { statusCode?: string }).statusCode ??
            (status as { txnStatus?: string }).txnStatus ??
            '',
        ).toUpperCase();
        if (code === 'OTS0000' || code === 'SUCCESS') {
          await this.completePayment(
            user.tid,
            payment,
            String(
              (status as { atomTxnId?: string }).atomTxnId ??
                `ntt-${providerRef}`,
            ),
            request.generatedById ?? user.sub,
          );
          const updated = await this.db().feePaymentRequest.findFirst({
            where: { id: request.id },
          });
          return { synced: true, request: updated, providerStatus: 'paid' };
        }
        return { synced: false, request, providerStatus: code || 'pending' };
      }

      if (
        !isRazorpayConfigured({
          keyId: creds.keyId,
          keySecret: creds.keySecret,
          webhookSecret: creds.webhookSecret ?? undefined,
        })
      ) {
        return { synced: false, request, providerStatus: 'NOT_CONFIGURED' };
      }

      if (
        providerRef.startsWith('plink_') ||
        request.channel === 'PAYMENT_LINK'
      ) {
        const link = await fetchRazorpayPaymentLink(
          {
            keyId: creds.keyId,
            keySecret: creds.keySecret,
            webhookSecret: creds.webhookSecret ?? undefined,
          },
          providerRef,
        );
        if (link.status === 'paid') {
          const providerPaymentId =
            link.payments?.find((p) => p.status === 'captured')?.payment_id ??
            link.payments?.[0]?.payment_id ??
            link.payments?.[0]?.id ??
            `plink-${link.id}`;
          await this.completePayment(
            user.tid,
            payment,
            providerPaymentId,
            request.generatedById ?? user.sub,
          );
          const updated = await this.db().feePaymentRequest.findFirst({
            where: { id: request.id },
          });
          return { synced: true, request: updated, providerStatus: 'paid' };
        }
        if (link.status === 'expired' || link.status === 'cancelled') {
          await this.markPaymentRequestClosed(
            user.tid,
            request,
            payment,
            link.status,
          );
          const updated = await this.db().feePaymentRequest.findFirst({
            where: { id: request.id },
          });
          return {
            synced: true,
            request: updated,
            providerStatus: link.status,
          };
        }
        return { synced: false, request, providerStatus: link.status };
      }

      if (providerRef.startsWith('order_')) {
        const orderPayments = await fetchRazorpayOrderPayments(
          {
            keyId: creds.keyId,
            keySecret: creds.keySecret,
            webhookSecret: creds.webhookSecret ?? undefined,
          },
          providerRef,
        );
        const captured = orderPayments.items?.find(
          (p) => p.status === 'captured',
        );
        if (captured) {
          await this.completePayment(
            user.tid,
            payment,
            captured.id,
            request.generatedById ?? user.sub,
          );
          const updated = await this.db().feePaymentRequest.findFirst({
            where: { id: request.id },
          });
          return { synced: true, request: updated, providerStatus: 'paid' };
        }
        const failed = orderPayments.items?.find((p) => p.status === 'failed');
        if (failed) {
          await this.markPaymentRequestClosed(
            user.tid,
            request,
            payment,
            'failed',
          );
          const updated = await this.db().feePaymentRequest.findFirst({
            where: { id: request.id },
          });
          return { synced: true, request: updated, providerStatus: 'failed' };
        }

        const linkId = (
          request.metadata as { paymentLinkProviderId?: string } | null
        )?.paymentLinkProviderId;
        if (linkId?.startsWith('plink_')) {
          const link = await fetchRazorpayPaymentLink(
            {
              keyId: creds.keyId,
              keySecret: creds.keySecret,
              webhookSecret: creds.webhookSecret ?? undefined,
            },
            linkId,
          );
          if (link.status === 'paid') {
            const providerPaymentId =
              link.payments?.find((p) => p.status === 'captured')?.payment_id ??
              link.payments?.[0]?.payment_id ??
              link.payments?.[0]?.id ??
              `plink-${link.id}`;
            await this.completePayment(
              user.tid,
              payment,
              providerPaymentId,
              request.generatedById ?? user.sub,
            );
            const updated = await this.db().feePaymentRequest.findFirst({
              where: { id: request.id },
            });
            return { synced: true, request: updated, providerStatus: 'paid' };
          }
          if (link.status === 'expired' || link.status === 'cancelled') {
            await this.markPaymentRequestClosed(
              user.tid,
              request,
              payment,
              link.status,
            );
            const updated = await this.db().feePaymentRequest.findFirst({
              where: { id: request.id },
            });
            return {
              synced: true,
              request: updated,
              providerStatus: link.status,
            };
          }
        }
      }
    } catch {
      return { synced: false, request, providerStatus: 'SYNC_ERROR' };
    }

    return { synced: false, request, providerStatus: 'pending' };
  }

  private async completePaymentRequestByProviderRef(
    tenantId: string,
    providerRef: string,
    providerPaymentId?: string,
  ) {
    const request = await this.db().feePaymentRequest.findFirst({
      where: { tenantId, providerOrderId: providerRef, status: 'PENDING' },
    });
    if (!request?.paymentId) return;
    const payment = await this.db().paymentTransaction.findFirst({
      where: { id: request.paymentId, tenantId },
    });
    if (!payment || payment.status === 'SUCCESS') return;
    await this.completePayment(
      tenantId,
      payment,
      providerPaymentId ?? `WH-${Date.now()}`,
      request.generatedById,
    );
  }

  private async markPaymentRequestClosed(
    tenantId: string,
    request: Record<string, unknown>,
    payment: Record<string, unknown>,
    reason: string,
  ) {
    const requestStatus = reason === 'failed' ? 'CANCELLED' : 'EXPIRED';
    await this.db().feePaymentRequest.update({
      where: { id: request.id },
      data: {
        status: requestStatus,
        metadata: { ...(request.metadata as object), closeReason: reason },
      },
    });
    await this.db().paymentTransaction.update({
      where: { id: payment.id },
      data: { status: reason === 'failed' ? 'FAILED' : 'EXPIRED' },
    });
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

    const paymentMeta = (payment.metadata ?? {}) as Record<string, unknown>;
    const notifyChannels: Array<'EMAIL' | 'SMS' | 'IN_APP' | 'PUSH'> =
      paymentMeta.collectedVia === 'CENTER_PORTAL'
        ? ['EMAIL', 'SMS', 'IN_APP', 'PUSH']
        : ['EMAIL', 'IN_APP', 'PUSH'];
    void this.receiptNotify
      .sendReceipt(tenantId, receipt.id, notifyChannels, collectedById)
      .catch(() => undefined);

    await this.confirmShortTermEnrollments(
      tenantId,
      demandIds,
      String(payment.id),
    );

    return { payment, allocations, receipt };
  }

  /** Confirm short-term course enrollments linked to paid demands. */
  private async confirmShortTermEnrollments(
    tenantId: string,
    demandIds: string[],
    paymentId: string,
  ) {
    if (!demandIds.length) return;
    const demands = await this.db().studentFeeDemand.findMany({
      where: {
        tenantId,
        id: { in: demandIds },
        demandType: 'SHORT_TERM_COURSE',
      },
      select: { id: true, metadata: true },
    });
    for (const demand of demands) {
      const enrollmentId =
        (demand.metadata as { shortTermEnrollmentId?: string } | null)
          ?.shortTermEnrollmentId ?? null;
      if (!enrollmentId) continue;
      const enrollment = await this.db().shortTermEnrollment.findFirst({
        where: { id: enrollmentId, tenantId },
        include: { batch: { include: { course: true } } },
      });
      if (
        !enrollment ||
        ['CONFIRMED', 'COMPLETED'].includes(enrollment.status)
      ) {
        continue;
      }
      const maxSeats = enrollment.batch?.course?.maxSeats ?? 40;
      const confirmed = await this.db().shortTermEnrollment.count({
        where: {
          tenantId,
          batchId: enrollment.batchId,
          status: { in: ['CONFIRMED', 'COMPLETED'] },
        },
      });
      const available = Math.max(0, maxSeats - confirmed);
      const nextStatus = available > 0 ? 'CONFIRMED' : 'WAITLISTED';
      await this.db().shortTermEnrollment.update({
        where: { id: enrollment.id },
        data: {
          status: nextStatus,
          paymentId,
          confirmedAt: nextStatus === 'CONFIRMED' ? new Date() : null,
        },
      });
    }
  }

  private async nextTransactionNo(tenantId: string) {
    const count = await this.db().paymentTransaction.count({
      where: { tenantId },
    });
    return `ONL-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;
  }
}
