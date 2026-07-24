import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../../../database/prisma.service';
import { ChallengeService } from '../../auth/challenge.service';
import { verifyTurnstileToken } from '../../../common/utils/turnstile.util';
import { StudentFeeAccountService } from './student-fee-account.service';
import { GatewayPaymentService } from './gateway-payment.service';
import { FeeReceiptDocumentService } from './fee-receipt-document.service';
import type {
  PublicFeeInitiateDto,
  PublicFeeLookupDto,
} from '../dto/public-fee-pay.dto';

type PaymentSessionPayload = {
  typ: 'public_fee_pay';
  tid: string;
  sid: string;
  sess: string;
};

type ReceiptAccessPayload = {
  typ: 'public_fee_receipt';
  tid: string;
  rid: string;
  pid: string;
};

@Injectable()
export class PublicFeePayService {
  private readonly sessionTtlSeconds = 15 * 60;
  private readonly receiptTtlSeconds = 60 * 60;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly challenge: ChallengeService,
    private readonly feeAccounts: StudentFeeAccountService,
    private readonly gateways: GatewayPaymentService,
    private readonly receiptDocs: FeeReceiptDocumentService,
  ) {}

  private sessionSecret() {
    return (
      this.config.get<string>('PUBLIC_FEE_PAY_SECRET') ??
      this.config.get<string>('AUTH_CHALLENGE_SECRET') ??
      this.config.getOrThrow<string>('JWT_ACCESS_SECRET')
    );
  }

  getChallenge() {
    const turnstileSiteKey = process.env.TURNSTILE_SITE_KEY?.trim();
    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY?.trim();
    const math = this.challenge.createChallenge();
    if (turnstileSiteKey && turnstileSecret) {
      return {
        mode: 'turnstile' as const,
        siteKey: turnstileSiteKey,
        // Always include math as fallback payload
        math,
      };
    }
    return {
      mode: 'math' as const,
      ...math,
    };
  }

  async assertCaptcha(
    dto: {
      challengeToken?: string;
      challengeAnswer?: string;
      turnstileToken?: string;
    },
    remoteIp?: string,
  ) {
    const hasTurnstileKeys = Boolean(
      process.env.TURNSTILE_SITE_KEY?.trim() &&
      process.env.TURNSTILE_SECRET_KEY?.trim(),
    );

    if (hasTurnstileKeys && dto.turnstileToken?.trim()) {
      try {
        await verifyTurnstileToken(dto.turnstileToken, remoteIp);
        return;
      } catch {
        // Fall through to math CAPTCHA
      }
    }

    const token = dto.challengeToken?.trim();
    const answerRaw = dto.challengeAnswer?.trim();
    if (!token || !answerRaw) {
      throw new BadRequestException('CAPTCHA verification required');
    }
    const answer = Number(answerRaw);
    if (!this.challenge.verify(token, answer)) {
      throw new BadRequestException('Incorrect CAPTCHA answer');
    }
  }

  private hashIdentifier(value: string) {
    return createHash('sha256')
      .update(value.trim().toLowerCase())
      .digest('hex');
  }

  private async audit(
    tenantId: string,
    action: string,
    opts: {
      studentId?: string;
      paymentId?: string;
      identifier?: string;
      outcome?: string;
      details?: Record<string, unknown>;
      ipAddress?: string;
      userAgent?: string;
    } = {},
  ) {
    const details = {
      ...(opts.details ?? {}),
      studentId: opts.studentId,
      identifierHash: opts.identifier
        ? this.hashIdentifier(opts.identifier)
        : undefined,
      ipAddress: opts.ipAddress,
      userAgent: opts.userAgent,
    };
    try {
      const db = this.prisma as any;
      if (db.publicFeePayAuditLog?.create) {
        await db.publicFeePayAuditLog.create({
          data: {
            tenantId,
            action,
            studentId: opts.studentId,
            paymentId: opts.paymentId,
            identifier: opts.identifier
              ? this.hashIdentifier(opts.identifier)
              : undefined,
            outcome: opts.outcome,
            details: opts.details ?? {},
            ipAddress: opts.ipAddress,
            userAgent: opts.userAgent,
          },
        });
        return;
      }
    } catch {
      /* fall through */
    }
    try {
      await this.prisma.paymentGatewayLog.create({
        data: {
          tenantId,
          paymentId: opts.paymentId,
          provider: 'PUBLIC_FEE_PAY',
          eventType: action,
          status: opts.outcome ?? 'OK',
          request: details,
        },
      });
    } catch {
      // Never fail the request on audit write
    }
  }

  signPaymentSession(tenantId: string, studentId: string) {
    const payload: PaymentSessionPayload = {
      typ: 'public_fee_pay',
      tid: tenantId,
      sid: studentId,
      sess: randomUUID(),
    };
    return this.jwt.sign(payload, {
      secret: this.sessionSecret(),
      expiresIn: this.sessionTtlSeconds,
    });
  }

  verifyPaymentSession(token: string): PaymentSessionPayload {
    try {
      const payload = this.jwt.verify<PaymentSessionPayload>(token, {
        secret: this.sessionSecret(),
      });
      if (payload?.typ !== 'public_fee_pay' || !payload.tid || !payload.sid) {
        throw new Error('invalid');
      }
      return payload;
    } catch {
      throw new BadRequestException(
        'Payment session expired. Search again with your roll number.',
      );
    }
  }

  signReceiptAccess(tenantId: string, receiptId: string, paymentId: string) {
    const payload: ReceiptAccessPayload = {
      typ: 'public_fee_receipt',
      tid: tenantId,
      rid: receiptId,
      pid: paymentId,
    };
    return this.jwt.sign(payload, {
      secret: this.sessionSecret(),
      expiresIn: this.receiptTtlSeconds,
    });
  }

  verifyReceiptAccess(token: string): ReceiptAccessPayload {
    try {
      const payload = this.jwt.verify<ReceiptAccessPayload>(token, {
        secret: this.sessionSecret(),
      });
      if (payload?.typ !== 'public_fee_receipt' || !payload.rid) {
        throw new Error('invalid');
      }
      return payload;
    } catch {
      throw new BadRequestException('Receipt access expired.');
    }
  }

  async lookup(
    tenantId: string,
    dto: PublicFeeLookupDto,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    await this.assertCaptcha(dto, meta?.ipAddress);
    const q = dto.identifier.trim();
    if (q.length < 2) {
      throw new BadRequestException('Enter at least 2 characters');
    }

    const student = await this.prisma.student.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { rollNumber: { equals: q, mode: 'insensitive' } },
          { enrollmentNumber: { equals: q, mode: 'insensitive' } },
          { admissionNumber: { equals: q, mode: 'insensitive' } },
          { universityRollNumber: { equals: q, mode: 'insensitive' } },
          {
            universityRegistrationNumber: {
              equals: q,
              mode: 'insensitive',
            },
          },
        ],
      },
      include: {
        masterProfile: { select: { fullName: true } },
        programVersion: {
          include: { program: { select: { name: true, code: true } } },
        },
        department: { select: { name: true } },
        academicProfile: {
          include: {
            admissionBatch: {
              select: { batchCode: true, admissionYear: true },
            },
          },
        },
        academicStanding: {
          select: { currentSemesterSequence: true },
        },
      },
    });

    if (!student) {
      await this.audit(tenantId, 'LOOKUP', {
        identifier: q,
        outcome: 'NOT_FOUND',
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });
      throw new NotFoundException('No student found for that number');
    }

    const account = await this.feeAccounts.getAccount(tenantId, student.id);
    const unpaid = (account.payableItems ?? [])
      .filter((item: any) => Number(item.amount ?? 0) > 0)
      .map((item: any) => ({
        demandId: String(item.demandId ?? item.id),
        feeType: String(item.feeType ?? item.demandType ?? 'Fee'),
        label: String(item.label ?? item.title ?? 'Fee'),
        periodLabel: item.periodLabel ? String(item.periodLabel) : null,
        semester: item.periodLabel ? String(item.periodLabel) : null,
        academicYear:
          student.academicProfile?.admissionBatch?.batchCode ??
          (student.academicProfile?.admissionBatch?.admissionYear
            ? String(student.academicProfile.admissionBatch.admissionYear)
            : null),
        amount: Number(item.amount ?? 0),
        fineAmount: Number(item.fineAmount ?? 0),
        dueDate: item.dueDate ?? null,
        status: 'Unpaid',
      }));

    const paymentSessionToken = this.signPaymentSession(tenantId, student.id);
    const expiresAt = new Date(
      Date.now() + this.sessionTtlSeconds * 1000,
    ).toISOString();

    await this.audit(tenantId, 'LOOKUP', {
      studentId: student.id,
      identifier: q,
      outcome: 'OK',
      details: { unpaidCount: unpaid.length },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return {
      paymentSessionToken,
      expiresAt,
      student: {
        fullName: student.masterProfile?.fullName ?? 'Student',
        rollNumber: student.rollNumber,
        registrationNumber:
          student.universityRegistrationNumber ??
          student.enrollmentNumber ??
          student.admissionNumber ??
          null,
        programme: student.programVersion?.program?.name ?? null,
        department: student.department?.name ?? null,
        semester: student.academicStanding?.currentSemesterSequence ?? null,
        academicYear:
          student.academicProfile?.admissionBatch?.batchCode ??
          (student.academicProfile?.admissionBatch?.admissionYear
            ? String(student.academicProfile.admissionBatch.admissionYear)
            : null),
        admissionBatch: student.academicProfile?.admissionBatch?.batchCode
          ? student.academicProfile.admissionBatch.admissionYear
            ? `${student.academicProfile.admissionBatch.admissionYear}-${Number(student.academicProfile.admissionBatch.admissionYear) + 1}`
            : student.academicProfile.admissionBatch.batchCode
          : student.academicProfile?.admissionBatch?.admissionYear
            ? `${student.academicProfile.admissionBatch.admissionYear}-${Number(student.academicProfile.admissionBatch.admissionYear) + 1}`
            : null,
        feePeriod: null as string | null,
      },
      lookedUpAt: new Date().toISOString(),
      unpaidFees: unpaid,
      totals: {
        unpaidCount: unpaid.length,
        unpaidAmount: unpaid.reduce((s, i) => s + i.amount, 0),
      },
    };
  }

  async initiate(
    tenantId: string,
    dto: PublicFeeInitiateDto,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const session = this.verifyPaymentSession(dto.paymentSessionToken);
    if (session.tid !== tenantId) {
      throw new BadRequestException('Invalid payment session');
    }

    const account = await this.feeAccounts.getAccount(tenantId, session.sid);
    const payable = new Map(
      (account.payableItems ?? []).map((item: any) => [
        String(item.demandId ?? item.id),
        Number(item.amount ?? 0),
      ]),
    );

    const selected: string[] = [];
    let amount = 0;
    for (const id of dto.demandIds) {
      const bal = payable.get(id);
      if (bal == null || bal <= 0) continue;
      selected.push(id);
      amount += bal;
    }

    if (!selected.length || amount <= 0) {
      await this.audit(tenantId, 'PAY_INITIATE', {
        studentId: session.sid,
        outcome: 'DUPLICATE_OR_PAID',
        details: { demandIds: dto.demandIds },
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });
      throw new BadRequestException(
        'Selected fees are already paid or no longer due. Search again.',
      );
    }

    const result = await this.gateways.initiatePublic(tenantId, {
      studentId: session.sid,
      amount,
      demandIds: selected,
      channel: 'PUBLIC_PORTAL',
      returnPath: '/public-fee-pay/return',
      metadata: {
        collectedVia: 'PUBLIC_PORTAL',
        channel: 'PUBLIC_PORTAL',
        sessionId: session.sess,
        payerEmail: dto.payerEmail ?? null,
        payerMobile: dto.payerMobile ?? null,
        clientIp: meta?.ipAddress ?? null,
        userAgent: meta?.userAgent ?? null,
      },
    } as any);

    await this.audit(tenantId, 'PAY_INITIATE', {
      studentId: session.sid,
      paymentId: result.payment?.id,
      outcome: 'OK',
      details: { amount, demandIds: selected },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return result;
  }

  async verifyRazorpay(
    tenantId: string,
    dto: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
      paymentSessionToken?: string;
    },
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    if (dto.paymentSessionToken) {
      const session = this.verifyPaymentSession(dto.paymentSessionToken);
      if (session.tid !== tenantId) {
        throw new BadRequestException('Invalid payment session');
      }
    }

    const result = await this.gateways.verifyRazorpayPublic(tenantId, dto);
    const receiptId = (result as any).receipt?.id as string | undefined;
    const paymentId = String(
      (result as any).payment?.id ?? result.payment?.id ?? '',
    );

    await this.audit(tenantId, 'PAY_VERIFY', {
      paymentId: paymentId || undefined,
      outcome: result.alreadyPaid ? 'ALREADY_PAID' : 'OK',
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    const receiptAccessToken =
      receiptId && paymentId
        ? this.signReceiptAccess(tenantId, receiptId, paymentId)
        : undefined;

    return {
      ...result,
      receiptAccessToken,
      receiptId,
    };
  }

  async simulateMock(
    tenantId: string,
    paymentSessionToken: string,
    paymentId: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const session = this.verifyPaymentSession(paymentSessionToken);
    if (session.tid !== tenantId) {
      throw new BadRequestException('Invalid payment session');
    }
    const payment = await this.prisma.paymentTransaction.findFirst({
      where: { id: paymentId, tenantId, studentId: session.sid },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    const result = await this.gateways.simulateMockPaymentPublic(
      tenantId,
      paymentId,
    );
    const alreadyPaid = Boolean(
      (result as { alreadyPaid?: boolean }).alreadyPaid,
    );
    const receiptId = (result as any).receipt?.id as string | undefined;

    await this.audit(tenantId, 'PAY_SIMULATE', {
      studentId: session.sid,
      paymentId,
      outcome: alreadyPaid ? 'ALREADY_PAID' : 'OK',
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return {
      ...result,
      alreadyPaid,
      receiptId,
      receiptAccessToken:
        receiptId && paymentId
          ? this.signReceiptAccess(tenantId, receiptId, paymentId)
          : undefined,
    };
  }

  async getReceiptPdf(
    tenantId: string,
    receiptId: string,
    access: { paymentSessionToken: string } | { receiptAccessToken: string },
  ) {
    if ('receiptAccessToken' in access && access.receiptAccessToken) {
      const payload = this.verifyReceiptAccess(access.receiptAccessToken);
      if (payload.tid !== tenantId || payload.rid !== receiptId) {
        throw new BadRequestException('Invalid receipt access');
      }
    } else if ('paymentSessionToken' in access && access.paymentSessionToken) {
      const session = this.verifyPaymentSession(access.paymentSessionToken);
      if (session.tid !== tenantId) {
        throw new BadRequestException('Invalid payment session');
      }
      const receipt = await this.prisma.feeReceipt.findFirst({
        where: { id: receiptId, tenantId, studentId: session.sid },
      });
      if (!receipt) throw new NotFoundException('Receipt not found');
    } else {
      throw new BadRequestException('Receipt access required');
    }

    return this.receiptDocs.generatePdfBuffer(tenantId, receiptId);
  }

  async verifyReceiptByNumber(
    tenantId: string,
    receiptNo: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const no = receiptNo.trim();
    if (no.length < 4) {
      throw new BadRequestException('Enter a valid receipt number');
    }

    const receipt = await this.prisma.feeReceipt.findFirst({
      where: { tenantId, receiptNo: { equals: no, mode: 'insensitive' } },
      include: { payment: true },
    });

    if (!receipt) {
      await this.audit(tenantId, 'RECEIPT_VERIFY', {
        outcome: 'NOT_FOUND',
        details: { receiptNo: no },
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });
      throw new NotFoundException('Receipt not found');
    }

    const student = await this.prisma.student.findFirst({
      where: { id: receipt.studentId, tenantId },
      include: {
        masterProfile: { select: { fullName: true } },
        programVersion: {
          include: { program: { select: { name: true } } },
        },
      },
    });

    await this.audit(tenantId, 'RECEIPT_VERIFY', {
      studentId: receipt.studentId,
      paymentId: receipt.paymentId ?? undefined,
      outcome: 'OK',
      details: { receiptNo: receipt.receiptNo },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    const receiptAccessToken = this.signReceiptAccess(
      tenantId,
      receipt.id,
      receipt.paymentId ?? receipt.id,
    );

    return {
      authentic: true,
      receiptId: receipt.id,
      receiptNo: receipt.receiptNo,
      issuedAt: receipt.issuedAt,
      amount: Number(receipt.amount ?? receipt.payment?.amount ?? 0),
      paymentMode:
        receipt.payment?.paymentMode ??
        receipt.payment?.paymentSource ??
        'ONLINE',
      transactionId:
        receipt.payment?.providerPaymentId ??
        receipt.payment?.transactionNo ??
        null,
      student: {
        fullName: student?.masterProfile?.fullName ?? 'Student',
        rollNumber: student?.rollNumber ?? null,
        programme: student?.programVersion?.program?.name ?? null,
      },
      receiptAccessToken,
    };
  }
}
