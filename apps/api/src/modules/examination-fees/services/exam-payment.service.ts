import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { GatewayPaymentService } from '../../fees/services/gateway-payment.service';
import { PaymentCollectionService } from '../../fees/services/payment-collection.service';
import { EXAM_APPLICATION_STATUSES } from '../constants/exam-fee.constants';
import type {
  InitiateExamOnlinePaymentDto,
  ManualExamPaymentDto,
} from '../dto/examination-fees.dto';
import { toNumber } from '../utils/exam-fee.util';
import { ExamApplicationService } from './exam-application.service';
import { ExamFeeSettingsService } from './exam-fee-settings.service';
import { ExamReceiptService } from './exam-receipt.service';

@Injectable()
export class ExamPaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly applications: ExamApplicationService,
    private readonly settings: ExamFeeSettingsService,
    private readonly gateway: GatewayPaymentService,
    private readonly collections: PaymentCollectionService,
    private readonly receipts: ExamReceiptService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  private async ensureExamDemand(user: JwtUser, app: any) {
    if (app.demandId) {
      const existing = await this.db().studentFeeDemand.findFirst({
        where: { id: app.demandId, tenantId: user.tid },
      });
      if (existing && existing.status !== 'CANCELLED') {
        return existing;
      }
    }

    const demandNo = `EXAM-${app.applicationNo}`;
    const amount = toNumber(app.totalFee);
    const lines = Array.isArray(app.feeBreakdown?.lines)
      ? app.feeBreakdown.lines
      : [];

    const demand = await this.db().studentFeeDemand.create({
      data: {
        tenantId: user.tid,
        studentId: app.studentId,
        demandNo,
        demandType: 'EXAM_FEE',
        feeProductCode: 'EXAM_FEE',
        billingLayer: 'SEMESTER',
        status: 'PUBLISHED',
        totalAmount: amount,
        balanceAmount: amount,
        publishedAt: new Date(),
        generatedById: user.sub,
        metadata: {
          examApplicationId: app.id,
          sessionId: app.sessionId,
        },
        lines: {
          create: (lines.length
            ? lines
            : [
                {
                  headCode: 'EXAM_TOTAL',
                  headName: 'Examination Fee',
                  amount,
                  quantity: 1,
                  unitAmount: amount,
                },
              ]
          ).map((line: any) => ({
            tenantId: user.tid,
            code: line.headCode ?? 'EXAM',
            name: line.headName ?? 'Examination Fee',
            category: 'EXAM_FEE',
            quantity: line.quantity ?? 1,
            unitAmount: line.unitAmount ?? line.amount ?? 0,
            amount: line.amount ?? 0,
            sourceType: 'EXAM_FEE',
            sourceRefId: app.id,
          })),
        },
      },
    });

    await this.db().examApplication.update({
      where: { id: app.id },
      data: { demandId: demand.id },
    });
    return demand;
  }

  async initiateOnline(
    user: JwtUser,
    applicationId: string,
    _dto: InitiateExamOnlinePaymentDto,
  ) {
    const app = await this.applications.get(user.tid, applicationId);
    if (
      ![
        EXAM_APPLICATION_STATUSES.AWAITING_PAYMENT,
        EXAM_APPLICATION_STATUSES.SUBMITTED,
        EXAM_APPLICATION_STATUSES.CORRECTION_REQUESTED,
      ].includes(app.status)
    ) {
      throw new BadRequestException(
        'Application is not ready for online payment.',
      );
    }

    const demand = await this.ensureExamDemand(user, app);
    const amount = toNumber(app.totalFee);
    // GatewayPaymentService.resolve uses the tenant's active provider;
    // dto.provider is only a hint for validation on HTTP fee routes.
    const result = await this.gateway.initiate(user, {
      studentId: app.studentId,
      demandIds: [demand.id],
      amount,
      provider: (_dto.provider as any) || 'RAZORPAY',
    });

    const examPayment = await this.db().examPayment.create({
      data: {
        tenantId: user.tid,
        applicationId: app.id,
        studentId: app.studentId,
        channel: 'ONLINE',
        paymentMode: 'ONLINE',
        amount,
        status: 'INITIATED',
        paymentTransactionId: result.payment.id,
        provider: result.checkout?.provider ?? result.payment.provider,
        metadata: { checkout: result.checkout },
      },
    });

    return {
      examPayment,
      checkout: {
        ...result.checkout,
        paymentId: result.payment.id,
        paymentTransactionId: result.payment.id,
      },
      payment: result.payment,
    };
  }

  async completeOnline(
    user: JwtUser,
    applicationId: string,
    body: {
      paymentTransactionId: string;
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
    },
  ) {
    const app = await this.applications.get(user.tid, applicationId);
    let txn = await this.db().paymentTransaction.findFirst({
      where: { id: body.paymentTransactionId, tenantId: user.tid },
    });
    if (!txn) throw new NotFoundException('Payment transaction not found');

    if (txn.status !== 'SUCCESS') {
      if (
        body.razorpay_order_id &&
        body.razorpay_payment_id &&
        body.razorpay_signature
      ) {
        await this.gateway.verifyRazorpay(user, {
          razorpay_order_id: body.razorpay_order_id,
          razorpay_payment_id: body.razorpay_payment_id,
          razorpay_signature: body.razorpay_signature,
        });
      } else if (
        String(txn.providerOrderId ?? '').startsWith('MOCK-') ||
        String(txn.provider ?? '').toUpperCase() === 'SAFE_MOCK'
      ) {
        await this.gateway.simulateMockPayment(user, txn.id);
      } else {
        const synced = await this.gateway.reconcilePaymentTransaction(
          user,
          txn.id,
        );
        if (!synced.synced) {
          throw new BadRequestException(
            `Payment is not confirmed yet (${synced.providerStatus}). Finish checkout at the gateway, then tap Verify payment.`,
          );
        }
      }
      txn = await this.db().paymentTransaction.findFirst({
        where: { id: body.paymentTransactionId, tenantId: user.tid },
      });
      if (!txn || txn.status !== 'SUCCESS') {
        throw new BadRequestException(
          'Payment is not confirmed yet. Finish checkout at the gateway, then try again.',
        );
      }
    }

    return this.markPaid(user, app.id, {
      channel: 'ONLINE',
      paymentMode: 'ONLINE',
      paymentTransactionId: txn.id,
      provider: txn.provider,
    });
  }

  async collectManual(
    user: JwtUser,
    applicationId: string,
    dto: ManualExamPaymentDto,
  ) {
    const app = await this.applications.get(user.tid, applicationId);
    const settings = await this.settings.get(user.tid);
    const allowed = Array.isArray(settings.allowedManualModes)
      ? settings.allowedManualModes
      : [];
    if (allowed.length && !allowed.includes(dto.paymentMode)) {
      throw new BadRequestException(
        `Payment mode ${dto.paymentMode} is not allowed.`,
      );
    }

    const demand = await this.ensureExamDemand(user, app);
    const amount = toNumber(app.totalFee);
    const collected = await this.collections.collect(user, {
      studentId: app.studentId,
      demandIds: [demand.id],
      amount,
      paymentMode: dto.paymentMode,
      externalReference: dto.externalReference,
      remarks: dto.remarks ?? `Exam fee ${app.applicationNo}`,
      metadata: { examApplicationId: app.id },
    });

    return this.markPaid(user, app.id, {
      channel: 'MANUAL',
      paymentMode: dto.paymentMode,
      paymentTransactionId: collected.payment?.id,
      externalReference: dto.externalReference,
      remarks: dto.remarks,
      collectedById: user.sub,
    });
  }

  private async markPaid(
    user: JwtUser,
    applicationId: string,
    input: {
      channel: 'ONLINE' | 'MANUAL';
      paymentMode: string;
      paymentTransactionId?: string;
      provider?: string | null;
      externalReference?: string;
      remarks?: string;
      collectedById?: string;
    },
  ) {
    const app = await this.applications.get(user.tid, applicationId);
    const amount = toNumber(app.totalFee);
    const status =
      input.channel === 'MANUAL'
        ? EXAM_APPLICATION_STATUSES.MANUAL_PAID
        : EXAM_APPLICATION_STATUSES.PAID;

    const examPayment = await this.db().examPayment.create({
      data: {
        tenantId: user.tid,
        applicationId,
        studentId: app.studentId,
        channel: input.channel,
        paymentMode: input.paymentMode,
        amount,
        status: 'SUCCESS',
        paymentTransactionId: input.paymentTransactionId ?? null,
        provider: input.provider ?? null,
        externalReference: input.externalReference ?? null,
        collectedById: input.collectedById ?? null,
        paidAt: new Date(),
        remarks: input.remarks ?? null,
      },
    });

    const settings = await this.settings.get(user.tid);
    const nextStatus = settings.autoVerifyOnPayment
      ? EXAM_APPLICATION_STATUSES.APPROVED
      : EXAM_APPLICATION_STATUSES.UNDER_VERIFICATION;

    await this.db().examApplication.update({
      where: { id: applicationId },
      data: {
        status: nextStatus,
        paidAt: new Date(),
        ...(settings.autoVerifyOnPayment
          ? { verifiedAt: new Date(), verifiedById: user.sub }
          : {}),
      },
    });

    await this.db().examApplicationStatusHistory.create({
      data: {
        tenantId: user.tid,
        applicationId,
        fromStatus: app.status,
        toStatus: nextStatus,
        action: input.channel === 'MANUAL' ? 'MANUAL_PAID' : 'PAID',
        actorUserId: user.sub,
      },
    });

    const receipt = await this.receipts.issue(
      user,
      applicationId,
      examPayment.id,
    );
    return {
      application: await this.applications.get(user.tid, applicationId),
      examPayment,
      receipt,
      priorStatus: status,
    };
  }

  list(tenantId: string, sessionId?: string) {
    return this.db().examPayment.findMany({
      where: {
        tenantId,
        ...(sessionId ? { application: { sessionId } } : {}),
      },
      include: {
        application: {
          select: {
            id: true,
            applicationNo: true,
            studentId: true,
            departmentName: true,
            sessionId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }
}
