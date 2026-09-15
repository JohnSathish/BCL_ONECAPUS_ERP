import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { FieldEncryptionService } from '../../common/crypto/field-encryption.service';
import {
  createCashfreeOrder,
  isCashfreeConfigured,
  verifyCashfreeWebhookSignature,
} from '../../common/payments/cashfree.util';
import {
  createRazorpayOrder,
  isRazorpayConfigured,
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhookSignature,
} from '../../common/payments/razorpay.util';
import { PrismaService } from '../../database/prisma.service';
import type {
  CollectSchoolFeeDto,
  PatchSchoolPaymentGatewayDto,
  SaveSchoolPaymentGatewayDto,
  SchoolOnlineCheckoutDto,
  SchoolOnlineVerifyDto,
} from './dto/school-sis.dto';
import { SchoolSisMonthlyFeesService } from './school-sis-monthly-fees.service';
import { SchoolSisService } from './school-sis.service';

const PROVIDERS = [
  'RAZORPAY',
  'PAYU',
  'CASHFREE',
  'PHONEPE',
  'STRIPE',
  'OTHER',
] as const;

const SECRET_KEYS = [
  'keySecret',
  'webhookSecret',
  'merchantSalt',
  'clientSecret',
  'saltKey',
  'secretKey',
  'apiSecret',
];

const MASK = '••••••••••••••••';

export type GatewayActor = {
  userId: string;
  access: 'configure' | 'view' | 'none';
  ip?: string;
  userAgent?: string;
};

function sanitizeCreds(
  creds: Record<string, string>,
  reveal: boolean,
): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const [k, v] of Object.entries(creds)) {
    if (!v) continue;
    if (SECRET_KEYS.includes(k)) {
      out[`has_${k}`] = true;
      out[k] = reveal ? v : MASK;
    } else {
      out[k] = v;
    }
  }
  return out;
}

function stripSecrets(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(stripSecrets);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEYS.includes(k) || /secret|salt|password/i.test(k)) {
      out[k] = v ? MASK : null;
    } else {
      out[k] = stripSecrets(v);
    }
  }
  return out;
}

function isMasked(value?: string) {
  return !value || value.includes('•') || value === MASK;
}

@Injectable()
export class SchoolSisPaymentGatewaysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sis: SchoolSisService,
    private readonly fees: SchoolSisMonthlyFeesService,
    private readonly encryption: FieldEncryptionService,
    private readonly config: ConfigService,
  ) {}

  async dashboard(tenantId: string, actor: GatewayActor) {
    await this.sis.assertSecondarySisTenant(tenantId);
    this.assertView(actor);
    const rows = await this.prisma.schoolPaymentGateway.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    const activeDefault = rows.find(
      (g) => g.isDefault && g.isActive && g.connectionStatus === 'OK',
    );
    const connected = rows.filter((g) => g.connectionStatus === 'OK').length;
    return {
      configured: rows.length,
      activeGateway: rows.find((g) => g.isActive)?.name ?? null,
      defaultGateway: activeDefault?.name ?? null,
      defaultProvider: activeDefault?.provider ?? null,
      gatewayStatus: activeDefault ? 'Connected' : 'Not Connected',
      connectedCount: connected,
      onlinePaymentsAvailable: Boolean(activeDefault),
      warning: activeDefault
        ? null
        : 'No active default payment gateway has been configured. Please configure and select a default gateway to enable online fee payments.',
      gateways: rows.map((g) => this.publicGateway(g, false)),
    };
  }

  async getOne(
    tenantId: string,
    id: string,
    actor: GatewayActor,
    reveal = false,
  ) {
    await this.sis.assertSecondarySisTenant(tenantId);
    if (reveal) this.assertConfigure(actor);
    else this.assertView(actor);
    const row = await this.requireGateway(tenantId, id);
    return this.publicGateway(row, reveal && actor.access === 'configure');
  }

  async create(
    tenantId: string,
    dto: SaveSchoolPaymentGatewayDto,
    actor: GatewayActor,
  ) {
    await this.sis.assertSecondarySisTenant(tenantId);
    this.assertConfigure(actor);
    const creds = this.mergeCreds({}, dto.credentials ?? {});
    const encrypted = this.encryption.encrypt(JSON.stringify(creds)) ?? '';
    const webhook = creds.webhookSecret
      ? this.encryption.encrypt(creds.webhookSecret)
      : null;
    const row = await this.prisma.schoolPaymentGateway.create({
      data: {
        id: randomUUID(),
        tenantId,
        provider: dto.provider,
        name: dto.name.trim(),
        environment: dto.environment,
        credentialsEncrypted: encrypted,
        webhookSecretEncrypted: webhook,
        configuration: (dto.configuration ?? {}) as Prisma.InputJsonValue,
        createdById: actor.userId,
        updatedById: actor.userId,
      },
    });
    await this.audit(tenantId, actor, 'GATEWAY_CREATED', row.id, null, {
      provider: dto.provider,
      name: dto.name,
      environment: dto.environment,
    });
    return this.publicGateway(row, false);
  }

  async update(
    tenantId: string,
    id: string,
    dto: PatchSchoolPaymentGatewayDto,
    actor: GatewayActor,
  ) {
    await this.sis.assertSecondarySisTenant(tenantId);
    this.assertConfigure(actor);
    const row = await this.requireGateway(tenantId, id);
    const current = this.decryptCreds(row.credentialsEncrypted);
    const nextCreds = dto.credentials
      ? this.mergeCreds(current, dto.credentials)
      : current;
    const updated = await this.prisma.schoolPaymentGateway.update({
      where: { id: row.id },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.environment ? { environment: dto.environment } : {}),
        credentialsEncrypted:
          this.encryption.encrypt(JSON.stringify(nextCreds)) ??
          row.credentialsEncrypted,
        webhookSecretEncrypted: nextCreds.webhookSecret
          ? this.encryption.encrypt(nextCreds.webhookSecret)
          : row.webhookSecretEncrypted,
        ...(dto.configuration
          ? { configuration: dto.configuration as Prisma.InputJsonValue }
          : {}),
        updatedById: actor.userId,
        connectionStatus: dto.credentials ? 'UNKNOWN' : row.connectionStatus,
      },
    });
    await this.audit(
      tenantId,
      actor,
      'GATEWAY_UPDATED',
      row.id,
      {
        name: row.name,
        environment: row.environment,
        credentialsChanged: Boolean(dto.credentials),
      },
      {
        name: updated.name,
        environment: updated.environment,
        credentialsChanged: Boolean(dto.credentials),
      },
    );
    return this.publicGateway(updated, false);
  }

  async remove(tenantId: string, id: string, actor: GatewayActor) {
    await this.sis.assertSecondarySisTenant(tenantId);
    this.assertConfigure(actor);
    const row = await this.requireGateway(tenantId, id);
    if (row.isDefault) {
      throw new ConflictException(
        'This gateway is currently the default payment gateway. Please select another active gateway as default before deleting it.',
      );
    }
    await this.prisma.schoolPaymentGateway.update({
      where: { id: row.id },
      data: { deletedAt: new Date(), isActive: false, isDefault: false },
    });
    await this.audit(
      tenantId,
      actor,
      'GATEWAY_DELETED',
      row.id,
      {
        name: row.name,
      },
      null,
    );
    return { ok: true };
  }

  async testConnection(tenantId: string, id: string, actor: GatewayActor) {
    await this.sis.assertSecondarySisTenant(tenantId);
    this.assertConfigure(actor);
    const row = await this.requireGateway(tenantId, id);
    const creds = this.decryptCreds(row.credentialsEncrypted);
    const result = await this.pingProvider(
      row.provider,
      row.environment,
      creds,
    );
    const updated = await this.prisma.schoolPaymentGateway.update({
      where: { id: row.id },
      data: {
        lastConnectionTest: new Date(),
        connectionStatus: result.ok ? 'OK' : 'FAILED',
        lastConnectionError: result.ok ? null : result.reason,
        updatedById: actor.userId,
      },
    });
    await this.audit(tenantId, actor, 'GATEWAY_TESTED', row.id, null, {
      ok: result.ok,
      reason: result.ok ? null : result.reason,
    });
    return {
      ok: result.ok,
      message: result.ok ? 'Connection successful' : 'Connection failed',
      reason: result.reason ?? null,
      gateway: this.publicGateway(updated, false),
    };
  }

  async setDefault(tenantId: string, id: string, actor: GatewayActor) {
    await this.sis.assertSecondarySisTenant(tenantId);
    this.assertConfigure(actor);
    const row = await this.requireGateway(tenantId, id);
    if (!row.isActive) {
      throw new BadRequestException(
        'Only an active gateway can be set as default.',
      );
    }
    if (row.connectionStatus !== 'OK') {
      throw new BadRequestException(
        'Test the gateway connection successfully before setting it as default.',
      );
    }
    const previous = await this.prisma.schoolPaymentGateway.findFirst({
      where: { tenantId, deletedAt: null, isDefault: true },
    });
    await this.prisma.$transaction(async (tx) => {
      await tx.schoolPaymentGateway.updateMany({
        where: { tenantId, deletedAt: null, isDefault: true },
        data: { isDefault: false },
      });
      await tx.schoolPaymentGateway.update({
        where: { id: row.id },
        data: { isDefault: true, updatedById: actor.userId },
      });
    });
    await this.audit(
      tenantId,
      actor,
      'GATEWAY_DEFAULT_CHANGED',
      row.id,
      { default: previous?.name ?? null },
      { default: row.name },
    );
    return {
      ok: true,
      message: `${row.name} is now the default payment gateway. All new online fee payments will use ${row.name}.`,
    };
  }

  async activate(tenantId: string, id: string, actor: GatewayActor) {
    await this.sis.assertSecondarySisTenant(tenantId);
    this.assertConfigure(actor);
    const row = await this.requireGateway(tenantId, id);
    if (row.connectionStatus !== 'OK') {
      throw new BadRequestException(
        'Test the connection successfully before activating this gateway.',
      );
    }
    const updated = await this.prisma.schoolPaymentGateway.update({
      where: { id: row.id },
      data: { isActive: true, updatedById: actor.userId },
    });
    await this.audit(
      tenantId,
      actor,
      'GATEWAY_ACTIVATED',
      row.id,
      {
        isActive: false,
      },
      { isActive: true },
    );
    return this.publicGateway(updated, false);
  }

  async deactivate(tenantId: string, id: string, actor: GatewayActor) {
    await this.sis.assertSecondarySisTenant(tenantId);
    this.assertConfigure(actor);
    const row = await this.requireGateway(tenantId, id);
    if (row.isDefault) {
      throw new ConflictException(
        'This gateway is currently the default payment gateway. Please select another active gateway as default before disabling it.',
      );
    }
    const updated = await this.prisma.schoolPaymentGateway.update({
      where: { id: row.id },
      data: { isActive: false, updatedById: actor.userId },
    });
    await this.audit(
      tenantId,
      actor,
      'GATEWAY_DISABLED',
      row.id,
      {
        isActive: true,
      },
      { isActive: false },
    );
    return this.publicGateway(updated, false);
  }

  async listTransactions(
    tenantId: string,
    actor: GatewayActor,
    filters: {
      from?: string;
      to?: string;
      gatewayId?: string;
      status?: string;
      student?: string;
      classId?: string;
      q?: string;
    },
  ) {
    await this.sis.assertSecondarySisTenant(tenantId);
    this.assertView(actor);
    const where: Prisma.SchoolPaymentGatewayTransactionWhereInput = {
      tenantId,
    };
    if (filters.gatewayId) where.gatewayId = filters.gatewayId;
    if (filters.status) where.status = filters.status;
    if (filters.from || filters.to) {
      where.createdAt = {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(`${filters.to}T23:59:59.999Z`) } : {}),
      };
    }
    if (filters.q) {
      where.OR = [
        { orderId: { contains: filters.q, mode: 'insensitive' } },
        { paymentId: { contains: filters.q, mode: 'insensitive' } },
        { feeReference: { contains: filters.q, mode: 'insensitive' } },
        {
          student: {
            OR: [
              { fullName: { contains: filters.q, mode: 'insensitive' } },
              { admissionNumber: { contains: filters.q, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }
    if (filters.classId) {
      where.student = {
        enrollments: { some: { section: { gradeId: filters.classId } } },
      };
    }
    if (filters.student) {
      where.student = {
        OR: [
          { fullName: { contains: filters.student, mode: 'insensitive' } },
          {
            admissionNumber: {
              contains: filters.student,
              mode: 'insensitive',
            },
          },
        ],
      };
    }
    const rows = await this.prisma.schoolPaymentGatewayTransaction.findMany({
      where,
      include: {
        gateway: true,
        student: {
          select: { id: true, fullName: true, admissionNumber: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        gateway: r.gateway.name,
        provider: r.gateway.provider,
        student: r.student.fullName,
        admissionNumber: r.student.admissionNumber,
        amount: r.amount,
        feeReference: r.feeReference,
        paymentMode: 'ONLINE',
        orderId: r.orderId,
        paymentId: r.paymentId,
        status: r.status,
        createdAt: r.createdAt,
        completedAt: r.verifiedAt,
        feePaymentId: r.feePaymentId,
      })),
    };
  }

  async checkout(
    tenantId: string,
    dto: SchoolOnlineCheckoutDto,
    actorUserId?: string,
  ) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const gateway = await this.requireCheckoutGateway(tenantId);
    const collectDto: CollectSchoolFeeDto = {
      studentId: dto.studentId,
      months: dto.months,
      feeMonth: dto.feeMonth,
      amountPaying: dto.amountPaying,
      waiveLateFee: dto.waiveLateFee,
      notes: dto.notes,
      paymentMode: 'ONLINE',
      channel: 'GATEWAY',
    };
    const preview = await this.fees.previewCollect(tenantId, collectDto);
    const txnId = randomUUID();
    const localOrder = `sls_${txnId.replace(/-/g, '').slice(0, 18)}`;
    const creds = this.decryptCreds(gateway.credentialsEncrypted);
    const created = await this.prisma.schoolPaymentGatewayTransaction.create({
      data: {
        id: txnId,
        tenantId,
        gatewayId: gateway.id,
        studentId: dto.studentId,
        academicYearId: preview.academicYearId,
        amount: preview.amountPaying,
        currency: this.currency(gateway),
        status: 'CREATED',
        orderId: localOrder,
        feeReference: preview.months.join(','),
        monthsJson: preview.months,
        collectJson: collectDto as unknown as Prisma.InputJsonValue,
        createdById: actorUserId ?? null,
      },
    });
    try {
      const hosted = await this.createProviderOrder(
        gateway.provider,
        gateway.environment,
        creds,
        {
          amountPaise: preview.amountPaying * 100,
          receipt: localOrder,
          notes: {
            studentId: dto.studentId,
            transactionId: txnId,
            tenantId,
          },
          notifyUrl: this.webhookUrl(gateway.id),
        },
      );
      const updated = await this.prisma.schoolPaymentGatewayTransaction.update({
        where: { id: created.id },
        data: {
          orderId: hosted.orderId,
          status: 'PENDING',
          rawReference: hosted.raw ?? null,
        },
      });
      return {
        transactionId: updated.id,
        orderId: updated.orderId,
        amount: updated.amount,
        currency: updated.currency,
        provider: gateway.provider,
        gatewayName: gateway.name,
        environment: gateway.environment,
        checkout: hosted.checkout,
      };
    } catch (err) {
      await this.prisma.schoolPaymentGatewayTransaction.update({
        where: { id: created.id },
        data: {
          status: 'FAILED',
          rawReference: err instanceof Error ? err.message : 'Order failed',
        },
      });
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Could not start online payment',
      );
    }
  }

  async verifyCheckout(
    tenantId: string,
    dto: SchoolOnlineVerifyDto,
    actorUserId?: string,
  ) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const txn = await this.prisma.schoolPaymentGatewayTransaction.findFirst({
      where: { tenantId, orderId: dto.orderId },
      include: { gateway: true },
    });
    if (!txn) throw new NotFoundException('Gateway transaction not found');
    if (txn.status === 'PAID' && txn.feePaymentId) {
      const payment = await this.fees.getPayment(tenantId, txn.feePaymentId);
      return {
        payment: {
          id: payment.id,
          receiptNumber: payment.receiptNumber,
          tuitionAmount: payment.tuitionAmount,
          lateFeeAmount: payment.lateFeeAmount,
          otherAmount: payment.otherAmount,
          discountAmount: payment.discountAmount,
          totalAmount: payment.totalAmount,
          status: payment.status,
        },
        receiptNumber: payment.receiptNumber,
      };
    }
    const gateway = txn.gateway;
    if (!gateway.isActive || gateway.deletedAt) {
      throw new BadRequestException(
        'This gateway is no longer active and cannot complete a new payment.',
      );
    }
    const creds = this.decryptCreds(gateway.credentialsEncrypted);
    this.assertPaymentSignature(gateway.provider, creds, dto);
    return this.finalizePaid(txn.id, dto.paymentId ?? dto.orderId, actorUserId);
  }

  async handleWebhook(
    gatewayId: string,
    rawBody: string,
    headers: Record<string, string | undefined>,
  ) {
    const gateway = await this.prisma.schoolPaymentGateway.findFirst({
      where: { id: gatewayId, deletedAt: null },
    });
    if (!gateway) throw new NotFoundException('Gateway not found');
    const creds = this.decryptCreds(gateway.credentialsEncrypted);
    if (gateway.provider === 'RAZORPAY') {
      const sig = headers['x-razorpay-signature'];
      if (
        !sig ||
        !verifyRazorpayWebhookSignature(
          {
            keyId: creds.keyId,
            keySecret: creds.keySecret,
            webhookSecret: creds.webhookSecret,
          },
          rawBody,
          sig,
        )
      ) {
        throw new ForbiddenException('Invalid webhook signature');
      }
      const payload = JSON.parse(rawBody) as {
        event?: string;
        payload?: {
          payment?: {
            entity?: { id?: string; order_id?: string; status?: string };
          };
          order?: { entity?: { id?: string } };
        };
      };
      const payment = payload.payload?.payment?.entity;
      const orderId = payment?.order_id || payload.payload?.order?.entity?.id;
      const paymentId = payment?.id;
      if (!orderId) return { ok: true, ignored: true };
      const txn = await this.prisma.schoolPaymentGatewayTransaction.findFirst({
        where: { gatewayId: gateway.id, orderId },
      });
      if (!txn) return { ok: true, ignored: true };
      if (txn.status === 'PAID') return { ok: true, duplicate: true };
      if (
        payment?.status &&
        !['captured', 'authorized'].includes(payment.status)
      ) {
        return { ok: true, ignored: true };
      }
      await this.finalizePaid(txn.id, paymentId ?? orderId, null);
      return { ok: true };
    }
    if (gateway.provider === 'CASHFREE') {
      const sig =
        headers['x-webhook-signature'] ?? headers['x-cashfree-signature'];
      const ts = headers['x-webhook-timestamp'];
      if (
        !sig ||
        !verifyCashfreeWebhookSignature(
          {
            keyId: creds.clientId || creds.keyId,
            keySecret: creds.clientSecret || creds.keySecret,
            webhookSecret: creds.webhookSecret,
          },
          rawBody,
          sig,
          ts,
        )
      ) {
        throw new ForbiddenException('Invalid webhook signature');
      }
      const payload = JSON.parse(rawBody) as {
        data?: {
          order?: { order_id?: string };
          payment?: { cf_payment_id?: string };
        };
        orderId?: string;
      };
      const orderId = payload.data?.order?.order_id ?? payload.orderId;
      if (!orderId) return { ok: true, ignored: true };
      const txn = await this.prisma.schoolPaymentGatewayTransaction.findFirst({
        where: { gatewayId: gateway.id, orderId },
      });
      if (!txn || txn.status === 'PAID')
        return { ok: true, duplicate: Boolean(txn?.feePaymentId) };
      await this.finalizePaid(
        txn.id,
        payload.data?.payment?.cf_payment_id ?? orderId,
        null,
      );
      return { ok: true };
    }
    return { ok: true, ignored: true };
  }

  publicUrls(id: string) {
    const hook = this.webhookUrl(id);
    const web =
      this.config.get<string>('WEB_APP_URL') ??
      this.config.get<string>('PUBLIC_APP_URL') ??
      'http://localhost:3000';
    return {
      webhookUrl: hook,
      callbackUrl: hook,
      successUrl: `${web.replace(/\/$/, '')}/admin/school-sis/fees/collect?gateway=success`,
      failureUrl: `${web.replace(/\/$/, '')}/admin/school-sis/fees/collect?gateway=failed`,
    };
  }

  private async finalizePaid(
    txnId: string,
    paymentId: string,
    actorUserId: string | null | undefined,
  ) {
    const locked = await this.prisma.schoolPaymentGatewayTransaction.findUnique(
      {
        where: { id: txnId },
        include: { gateway: true },
      },
    );
    if (!locked) throw new NotFoundException('Transaction not found');
    if (locked.status === 'PAID' && locked.feePaymentId) {
      const payment = await this.fees.getPayment(
        locked.tenantId,
        locked.feePaymentId,
      );
      return {
        payment: {
          id: payment.id,
          receiptNumber: payment.receiptNumber,
          tuitionAmount: payment.tuitionAmount,
          lateFeeAmount: payment.lateFeeAmount,
          otherAmount: payment.otherAmount,
          discountAmount: payment.discountAmount,
          totalAmount: payment.totalAmount,
          status: payment.status,
        },
        receiptNumber: payment.receiptNumber,
      };
    }
    const claimed =
      await this.prisma.schoolPaymentGatewayTransaction.updateMany({
        where: {
          id: locked.id,
          feePaymentId: null,
          status: { in: ['CREATED', 'PENDING', 'PROCESSING'] },
        },
        data: { status: 'PROCESSING', paymentId },
      });
    if (claimed.count === 0) {
      const again =
        await this.prisma.schoolPaymentGatewayTransaction.findUnique({
          where: { id: txnId },
        });
      if (again?.feePaymentId) {
        const payment = await this.fees.getPayment(
          locked.tenantId,
          again.feePaymentId,
        );
        return {
          payment: {
            id: payment.id,
            receiptNumber: payment.receiptNumber,
            tuitionAmount: payment.tuitionAmount,
            lateFeeAmount: payment.lateFeeAmount,
            otherAmount: payment.otherAmount,
            discountAmount: payment.discountAmount,
            totalAmount: payment.totalAmount,
            status: payment.status,
          },
          receiptNumber: payment.receiptNumber,
        };
      }
      throw new ConflictException('This payment is already being processed');
    }
    const collect = locked.collectJson as unknown as CollectSchoolFeeDto;
    try {
      const result = await this.fees.collect(
        locked.tenantId,
        {
          ...collect,
          paymentMode: 'ONLINE',
          reference: paymentId,
          channel: 'GATEWAY',
        },
        actorUserId ?? locked.createdById ?? undefined,
        {
          skipReference: true,
          gatewaySnapshot: {
            gatewayId: locked.gatewayId,
            gatewayName: locked.gateway.name,
            provider: locked.gateway.provider,
            orderId: locked.orderId,
            paymentId,
          },
        },
      );
      await this.prisma.schoolPaymentGatewayTransaction.update({
        where: { id: locked.id },
        data: {
          status: 'PAID',
          paymentId,
          feePaymentId: result.payment.id,
          verifiedAt: new Date(),
        },
      });
      return result;
    } catch (err) {
      await this.prisma.schoolPaymentGatewayTransaction.update({
        where: { id: locked.id },
        data: {
          status: 'FAILED',
          rawReference: err instanceof Error ? err.message : 'Verify failed',
        },
      });
      throw err;
    }
  }

  private async requireCheckoutGateway(tenantId: string) {
    const row = await this.prisma.schoolPaymentGateway.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        isDefault: true,
        isActive: true,
        connectionStatus: 'OK',
      },
    });
    if (!row) {
      throw new BadRequestException(
        'Online payments are currently unavailable. No active default payment gateway has been configured.',
      );
    }
    return row;
  }

  private async requireGateway(tenantId: string, id: string) {
    const row = await this.prisma.schoolPaymentGateway.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Payment gateway not found');
    return row;
  }

  private publicGateway(
    row: {
      id: string;
      provider: string;
      name: string;
      environment: string;
      isActive: boolean;
      isDefault: boolean;
      credentialsEncrypted: string;
      configuration: Prisma.JsonValue;
      lastConnectionTest: Date | null;
      connectionStatus: string;
      lastConnectionError: string | null;
      createdById: string | null;
      updatedById: string | null;
      createdAt: Date;
      updatedAt: Date;
    },
    reveal: boolean,
  ) {
    const creds = this.decryptCreds(row.credentialsEncrypted);
    const urls = this.publicUrls(row.id);
    const config = (row.configuration ?? {}) as Record<string, unknown>;
    return {
      id: row.id,
      provider: row.provider,
      name: row.name,
      environment: row.environment,
      isActive: row.isActive,
      isDefault: row.isDefault,
      connectionStatus: row.connectionStatus,
      lastConnectionTest: row.lastConnectionTest,
      lastConnectionError: row.lastConnectionError,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      credentials: sanitizeCreds(creds, reveal),
      configuration: {
        currency: config.currency ?? 'INR',
        paymentTimeout: config.paymentTimeout ?? 15,
        autoCapture: config.autoCapture ?? true,
        enableRefunds: config.enableRefunds ?? false,
        enablePartialPayment: config.enablePartialPayment ?? false,
        enableWebhookVerification: config.enableWebhookVerification ?? true,
        ...urls,
      },
    };
  }

  private decryptCreds(stored: string): Record<string, string> {
    try {
      const raw = this.encryption.decrypt(stored) ?? stored;
      const parsed = JSON.parse(raw) as Record<string, string>;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private mergeCreds(
    current: Record<string, string>,
    incoming: Record<string, string>,
  ) {
    const next = { ...current };
    for (const [k, v] of Object.entries(incoming)) {
      if (isMasked(v)) continue;
      if (!v) {
        delete next[k];
        continue;
      }
      next[k] = v;
    }
    return next;
  }

  private currency(row: { configuration: Prisma.JsonValue }) {
    const cfg = (row.configuration ?? {}) as { currency?: string };
    return cfg.currency || 'INR';
  }

  private webhookUrl(id: string) {
    const api =
      this.config.get<string>('API_PUBLIC_URL') ??
      this.config.get<string>('APP_URL') ??
      'http://localhost:4000';
    return `${api.replace(/\/$/, '')}/v1/school-sis/public/payment-gateways/${id}/webhook`;
  }

  private async pingProvider(
    provider: string,
    environment: string,
    creds: Record<string, string>,
  ): Promise<{ ok: boolean; reason?: string }> {
    try {
      if (provider === 'RAZORPAY') {
        if (
          !isRazorpayConfigured({
            keyId: creds.keyId,
            keySecret: creds.keySecret,
          })
        ) {
          return { ok: false, reason: 'Invalid credentials' };
        }
        const auth = Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString(
          'base64',
        );
        const res = await fetch('https://api.razorpay.com/v1/orders?count=1', {
          headers: { Authorization: `Basic ${auth}` },
        });
        if (res.status === 401 || res.status === 403) {
          return { ok: false, reason: 'Invalid credentials' };
        }
        if (!res.ok) return { ok: false, reason: 'API unavailable' };
        return { ok: true };
      }
      if (provider === 'CASHFREE') {
        const keyId = creds.clientId || creds.appId || creds.keyId;
        const keySecret = creds.clientSecret || creds.keySecret;
        if (!isCashfreeConfigured({ keyId, keySecret })) {
          return { ok: false, reason: 'Invalid credentials' };
        }
        const base =
          environment === 'LIVE'
            ? 'https://api.cashfree.com/pg'
            : 'https://sandbox.cashfree.com/pg';
        const res = await fetch(`${base}/orders`, {
          headers: {
            'x-client-id': keyId,
            'x-client-secret': keySecret,
            'x-api-version': '2023-08-01',
          },
        });
        if (res.status === 401 || res.status === 403) {
          return { ok: false, reason: 'Invalid credentials' };
        }
        return { ok: true };
      }
      if (provider === 'STRIPE') {
        if (!creds.secretKey)
          return { ok: false, reason: 'Invalid credentials' };
        const res = await fetch('https://api.stripe.com/v1/balance', {
          headers: { Authorization: `Bearer ${creds.secretKey}` },
        });
        if (!res.ok) {
          return {
            ok: false,
            reason:
              res.status === 401 ? 'Invalid credentials' : 'API unavailable',
          };
        }
        return { ok: true };
      }
      if (provider === 'PAYU') {
        if (!creds.merchantKey || !creds.merchantSalt) {
          return { ok: false, reason: 'Invalid credentials' };
        }
        return { ok: true };
      }
      if (provider === 'PHONEPE') {
        if (!creds.merchantId || !creds.saltKey) {
          return { ok: false, reason: 'Invalid credentials' };
        }
        return { ok: true };
      }
      if (!creds.apiKey && !creds.keyId && !creds.clientId) {
        return { ok: false, reason: 'Invalid credentials' };
      }
      return { ok: true };
    } catch {
      return { ok: false, reason: 'API unavailable' };
    }
  }

  private async createProviderOrder(
    provider: string,
    environment: string,
    creds: Record<string, string>,
    payload: {
      amountPaise: number;
      receipt: string;
      notes: Record<string, string>;
      notifyUrl: string;
    },
  ) {
    if (provider === 'RAZORPAY') {
      const order = await createRazorpayOrder(
        { keyId: creds.keyId, keySecret: creds.keySecret },
        payload,
      );
      return {
        orderId: order.id,
        checkout: {
          mode: 'RAZORPAY',
          keyId: creds.keyId,
          amount: payload.amountPaise,
          currency: 'INR',
          name: 'Fee payment',
        },
        raw: order.id,
      };
    }
    if (provider === 'CASHFREE') {
      const order = await createCashfreeOrder(
        {
          keyId: creds.clientId || creds.appId || creds.keyId,
          keySecret: creds.clientSecret || creds.keySecret,
          mode: environment === 'LIVE' ? 'LIVE' : 'TEST',
        },
        {
          ...payload,
          returnUrl: this.publicUrls('x').successUrl,
          notifyUrl: payload.notifyUrl,
        },
      );
      return {
        orderId: order.order_id,
        checkout: {
          mode: 'CASHFREE',
          paymentSessionId: order.payment_session_id,
        },
        raw: order.cf_order_id,
      };
    }
    if (provider === 'STRIPE') {
      const body = new URLSearchParams({
        amount: String(payload.amountPaise),
        currency: 'inr',
        'automatic_payment_methods[enabled]': 'true',
        'metadata[receipt]': payload.receipt,
      });
      const res = await fetch('https://api.stripe.com/v1/payment_intents', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${creds.secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      });
      const json = (await res.json()) as {
        id?: string;
        client_secret?: string;
        error?: { message?: string };
      };
      if (!res.ok || !json.id) {
        throw new Error(json.error?.message ?? 'Stripe order failed');
      }
      return {
        orderId: json.id,
        checkout: {
          mode: 'STRIPE',
          clientSecret: json.client_secret,
          publishableKey: creds.publishableKey,
        },
        raw: json.id,
      };
    }
    if (provider === 'PAYU') {
      const amount = (payload.amountPaise / 100).toFixed(2);
      const txnid = payload.receipt;
      const productinfo = 'School fee';
      const firstname = 'Parent';
      const email = 'fees@school.local';
      const hash = createHash('sha512')
        .update(
          `${creds.merchantKey}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${creds.merchantSalt}`,
        )
        .digest('hex');
      return {
        orderId: txnid,
        checkout: {
          mode: 'PAYU_FORM',
          action:
            environment === 'LIVE'
              ? 'https://secure.payu.in/_payment'
              : 'https://test.payu.in/_payment',
          fields: {
            key: creds.merchantKey,
            txnid,
            amount,
            productinfo,
            firstname,
            email,
            surl: this.publicUrls('x').successUrl,
            furl: this.publicUrls('x').failureUrl,
            hash,
          },
        },
        raw: txnid,
      };
    }
    throw new BadRequestException(
      `${provider} hosted checkout is not enabled yet. Use Razorpay, Cashfree, Stripe, or PayU, or record an offline UPI reference.`,
    );
  }

  private assertPaymentSignature(
    provider: string,
    creds: Record<string, string>,
    dto: SchoolOnlineVerifyDto,
  ) {
    if (provider === 'RAZORPAY') {
      if (!dto.paymentId || !dto.signature) {
        throw new BadRequestException('Payment signature is required');
      }
      const ok = verifyRazorpayPaymentSignature(
        { keyId: creds.keyId, keySecret: creds.keySecret },
        dto.orderId,
        dto.paymentId,
        dto.signature,
      );
      if (!ok)
        throw new ForbiddenException('Payment signature verification failed');
    }
  }

  private async audit(
    tenantId: string,
    actor: GatewayActor,
    action: string,
    gatewayId: string | null,
    oldValue: unknown,
    newValue: unknown,
  ) {
    await this.prisma.schoolPaymentGatewayAudit.create({
      data: {
        id: randomUUID(),
        tenantId,
        gatewayId,
        actorUserId: actor.userId,
        action,
        oldValue: stripSecrets(oldValue) as Prisma.InputJsonValue,
        newValue: stripSecrets(newValue) as Prisma.InputJsonValue,
        ip: actor.ip ?? null,
        userAgent: actor.userAgent ?? null,
      },
    });
  }

  private assertView(actor: GatewayActor) {
    if (actor.access !== 'configure' && actor.access !== 'view') {
      throw new ForbiddenException('Not allowed to view payment gateways');
    }
  }

  private assertConfigure(actor: GatewayActor) {
    if (actor.access !== 'configure') {
      throw new ForbiddenException(
        'Only institution administrators can change payment gateway configuration.',
      );
    }
  }
}

export const SCHOOL_GATEWAY_PROVIDERS = PROVIDERS;
