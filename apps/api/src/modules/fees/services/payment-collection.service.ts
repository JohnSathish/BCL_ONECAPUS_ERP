import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import type { CollectionDto } from '../dto/fees.dto';
import { FeeLedgerService } from './fee-ledger.service';
import { LicenseEnforcementService } from '../../licensing/services/license-enforcement.service';

@Injectable()
export class PaymentCollectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: FeeLedgerService,
    private readonly licenseEnforcement: LicenseEnforcementService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async collect(user: JwtUser, dto: CollectionDto) {
    await this.licenseEnforcement.assertWriteAllowed(user.tid, 'fee.write');
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
        provider: dto.provider,
        status: 'SUCCESS',
        amount: dto.amount,
        paidAt: new Date(),
        collectedById: user.sub,
        metadata: dto.metadata,
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

    const receipt = await this.db().feeReceipt.create({
      data: {
        tenantId: user.tid,
        receiptNo: await this.nextReceiptNo(user.tid),
        studentId: dto.studentId,
        paymentId: payment.id,
        amount: dto.amount,
        issuedById: user.sub,
        qrPayload: `fees:${payment.id}`,
        metadata: {
          allocations: allocations.map((allocation) => allocation.id),
        },
      },
    });

    await this.ledger.post({
      tenantId: user.tid,
      studentId: dto.studentId,
      paymentId: payment.id,
      entryType: 'PAYMENT',
      creditAmount: dto.amount,
      referenceType: 'PAYMENT',
      referenceId: payment.id,
      description: `${dto.paymentMode} fee collection`,
      postedById: user.sub,
    });

    return { payment: updated, allocations, receipt };
  }

  private async allocate(user: JwtUser, payment: any, demandIds: string[]) {
    const demands = await this.db().studentFeeDemand.findMany({
      where: {
        tenantId: user.tid,
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
        data: {
          tenantId: user.tid,
          paymentId: payment.id,
          demandId: demand.id,
          amount,
        },
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
    return allocations;
  }

  private async nextTransactionNo(tenantId: string) {
    const count = await this.db().paymentTransaction.count({
      where: { tenantId },
    });
    return `PAY-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;
  }

  private async nextReceiptNo(tenantId: string) {
    const count = await this.db().feeReceipt.count({ where: { tenantId } });
    return `REC-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;
  }
}
