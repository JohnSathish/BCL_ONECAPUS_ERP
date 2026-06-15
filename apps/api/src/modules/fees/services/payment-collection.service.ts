import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import type { CollectionDto } from '../dto/fees.dto';
import {
  COLLECTION_MODE_LABELS,
  paymentModeToCollectionMode,
  resolveCollectionModes,
} from '../constants/collection-modes.constants';
import { isExternalPaymentSource } from '../constants/payment-source.constants';
import { FeeLedgerService } from './fee-ledger.service';
import { FeeFinanceSettingsService } from './fee-finance-settings.service';
import { StudentFeeSummaryService } from './student-fee-summary.service';
import { LicenseEnforcementService } from '../../licensing/services/license-enforcement.service';
import { QueueService } from '../../../shared/queue/queue.service';

type CollectAuditMeta = {
  clientIp?: string;
  userAgent?: string;
};

@Injectable()
export class PaymentCollectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: FeeLedgerService,
    private readonly financeSettings: FeeFinanceSettingsService,
    private readonly licenseEnforcement: LicenseEnforcementService,
    private readonly feeSummary: StudentFeeSummaryService,
    private readonly queue: QueueService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async collect(user: JwtUser, dto: CollectionDto, audit?: CollectAuditMeta) {
    await this.licenseEnforcement.assertWriteAllowed(user.tid, 'fee.write');
    const settings = await this.financeSettings.get(user.tid);
    await this.assertCollectionAllowed(user, settings, dto);

    if (dto.amount <= 0)
      throw new BadRequestException(
        'Payment amount must be greater than zero.',
      );

    const payment = await this.db().paymentTransaction.create({
      data: {
        tenantId: user.tid,
        studentId: dto.studentId,
        transactionNo: await this.nextTransactionNo(user.tid),
        paymentMode: dto.paymentMode,
        paymentSource:
          dto.paymentSource ?? this.defaultSourceForMode(dto.paymentMode),
        externalReference: dto.externalReference ?? null,
        remarks: dto.remarks ?? null,
        provider: dto.provider,
        status: 'SUCCESS',
        amount: dto.amount,
        paidAt: new Date(),
        collectedById: user.sub,
        metadata: {
          ...(dto.metadata ?? {}),
          ...(dto.paymentSource ? { paymentSource: dto.paymentSource } : {}),
          ...(dto.externalReference
            ? { externalReference: dto.externalReference }
            : {}),
          audit: {
            collectedById: user.sub,
            collectedByEmail: user.email,
            collectedAt: new Date().toISOString(),
            clientIp: audit?.clientIp ?? null,
            userAgent: audit?.userAgent ?? null,
          },
        },
      },
    });

    const allocations = await this.allocate(user, payment, dto.demandIds ?? []);
    const allocatedAmount = allocations.reduce(
      (sum, allocation) => sum + Number(allocation.amount ?? 0),
      0,
    );
    const updated = await this.db().paymentTransaction.update({
      where: { id: payment.id },
      data: {
        allocatedAmount,
        unallocatedAmount: Math.max(0, dto.amount - allocatedAmount),
      },
      include: { allocations: true },
    });

    const receipt = await this.issueReceipt(
      user.tid,
      dto.studentId,
      payment.id,
      dto.amount,
      user.sub,
      allocations.map((a) => a.id),
      dto.paymentMode,
    );

    await this.ledger.post({
      tenantId: user.tid,
      studentId: dto.studentId,
      paymentId: payment.id,
      entryType: 'PAYMENT',
      creditAmount: dto.amount,
      referenceType: 'PAYMENT',
      referenceId: payment.id,
      description: `${dto.paymentSource ?? dto.paymentMode} fee collection${dto.externalReference ? ` · ref ${dto.externalReference}` : ''}`,
      postedById: user.sub,
      metadata: { immutable: true },
    });

    void this.queue.enqueueFeeReceiptPdf({
      tenantId: user.tid,
      receiptId: receipt.id,
    });

    return { payment: updated, allocations, receipt };
  }

  private async assertCollectionAllowed(
    user: JwtUser,
    settings: Record<string, unknown>,
    dto: CollectionDto,
  ) {
    const modes = resolveCollectionModes(
      settings as Parameters<typeof resolveCollectionModes>[0],
    );
    const modeKey = paymentModeToCollectionMode(
      dto.paymentMode,
      dto.paymentSource,
    );
    if (modeKey && !modes[modeKey]) {
      throw new BadRequestException(
        `${COLLECTION_MODE_LABELS[modeKey]} is disabled for this institution. Enable it in Finance → Fee Settings → Collection Modes.`,
      );
    }

    if (dto.paymentMode === 'CASH' || modeKey === 'cash') {
      const canCash =
        user.permissions?.includes('fees:cash:collect') ||
        user.permissions?.includes('fees:manage');
      if (!canCash) {
        throw new ForbiddenException(
          'You do not have permission to collect cash.',
        );
      }
    }

    if (dto.paymentSource && isExternalPaymentSource(dto.paymentSource)) {
      const extMode = paymentModeToCollectionMode(
        'EXTERNAL',
        dto.paymentSource,
      );
      if (extMode && !modes[extMode]) {
        throw new BadRequestException(
          `${COLLECTION_MODE_LABELS[extMode]} is disabled for this institution.`,
        );
      }
    }
  }

  private defaultSourceForMode(paymentMode: string) {
    const mode = paymentMode.toUpperCase();
    if (mode === 'CASH') return 'CASH';
    if (mode === 'CHEQUE') return 'CHEQUE';
    if (mode === 'DD') return 'DD';
    return null;
  }

  async allocateToDemands(
    tenantId: string,
    payment: { id: string; studentId: string; amount: unknown },
    demandIds: string[] = [],
  ) {
    const demands = await this.db().studentFeeDemand.findMany({
      where: {
        tenantId,
        studentId: payment.studentId,
        status: { in: ['PUBLISHED', 'LOCKED', 'PARTIALLY_PAID'] },
        ...(demandIds.length ? { id: { in: demandIds } } : {}),
      },
      orderBy: { dueDate: 'asc' },
    });

    let remaining = Number(payment.amount);
    const allocations: any[] = [];
    for (const demand of demands) {
      if (remaining <= 0) break;
      const balance = Number(demand.balanceAmount ?? 0);
      if (balance <= 0) continue;
      const amount = Math.min(balance, remaining);
      const allocation = await this.db().paymentAllocation.create({
        data: { tenantId, paymentId: payment.id, demandId: demand.id, amount },
      });
      const paidAmount = Number(demand.paidAmount ?? 0) + amount;
      const balanceAmount = Math.max(0, balance - amount);
      await this.db().studentFeeDemand.update({
        where: { id: demand.id },
        data: {
          paidAmount,
          balanceAmount,
          status: balanceAmount <= 0 ? 'PAID' : 'PARTIALLY_PAID',
        },
      });
      allocations.push(allocation);
      remaining -= amount;
    }
    await this.feeSummary.touchAfterPayment(
      tenantId,
      String(payment.studentId),
    );
    return allocations;
  }

  async issueReceipt(
    tenantId: string,
    studentId: string,
    paymentId: string,
    amount: number,
    issuedById?: string,
    allocationIds: string[] = [],
    paymentMode?: string,
  ) {
    return this.db().feeReceipt.create({
      data: {
        tenantId,
        receiptNo: await this.nextReceiptNo(tenantId, paymentMode),
        studentId,
        paymentId,
        amount,
        issuedById,
        qrPayload: `fees:${paymentId}`,
        metadata: { allocations: allocationIds, immutable: true },
      },
    });
  }

  private async allocate(user: JwtUser, payment: any, demandIds: string[]) {
    return this.allocateToDemands(user.tid, payment, demandIds);
  }

  private async nextTransactionNo(tenantId: string) {
    const count = await this.db().paymentTransaction.count({
      where: { tenantId },
    });
    return `PAY-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;
  }

  private async nextReceiptNo(tenantId: string, paymentMode?: string) {
    const settings = await this.financeSettings.get(tenantId);
    const year = new Date().getFullYear();

    if (paymentMode?.toUpperCase() === 'CASH') {
      const prefix = String(settings.cashReceiptPrefix ?? 'DBC/CASH');
      const count = await this.db().paymentTransaction.count({
        where: { tenantId, paymentMode: 'CASH', status: 'SUCCESS' },
      });
      return `${prefix}/${year}/${String(count + 1).padStart(6, '0')}`;
    }

    const prefix = String(settings.receiptPrefix ?? 'DBC/RCPT');
    const count = await this.db().feeReceipt.count({ where: { tenantId } });
    return `${prefix}/${year}/${String(count + 1).padStart(6, '0')}`;
  }
}
