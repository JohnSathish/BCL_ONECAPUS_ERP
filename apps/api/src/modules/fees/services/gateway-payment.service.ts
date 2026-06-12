import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import type { GatewayPaymentDto } from '../dto/fees.dto';

@Injectable()
export class GatewayPaymentService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async initiate(user: JwtUser, dto: GatewayPaymentDto) {
    const payment = await this.db().paymentTransaction.create({
      data: {
        tenantId: user.tid,
        studentId: dto.studentId,
        transactionNo: await this.nextTransactionNo(user.tid),
        paymentMode: 'ONLINE',
        provider: dto.provider,
        providerOrderId: `${dto.provider}-${Date.now()}`,
        status: 'INITIATED',
        amount: dto.amount,
        unallocatedAmount: dto.amount,
        metadata: { demandIds: dto.demandIds ?? [] },
      },
    });
    await this.db().paymentGatewayLog.create({
      data: {
        tenantId: user.tid,
        paymentId: payment.id,
        provider: dto.provider,
        eventType: 'INITIATE',
        status: 'QUEUED',
        request: dto,
        response: {
          mode: 'SAFE_MOCK',
          message:
            'Gateway abstraction ready. Configure provider credentials to enable live checkout.',
        },
      },
    });
    return {
      payment,
      checkout: {
        provider: dto.provider,
        orderId: payment.providerOrderId,
        amount: dto.amount,
        currency: 'INR',
        mode: 'SAFE_MOCK',
      },
    };
  }

  async syncStatus(user: JwtUser, provider: string, orderId: string) {
    const payment = await this.db().paymentTransaction.findFirst({
      where: { tenantId: user.tid, provider, providerOrderId: orderId },
    });
    await this.db().paymentGatewayLog.create({
      data: {
        tenantId: user.tid,
        paymentId: payment?.id,
        provider,
        eventType: 'STATUS_SYNC',
        status: payment?.status ?? 'NOT_FOUND',
        response: { provider, orderId, status: payment?.status ?? 'NOT_FOUND' },
      },
    });
    return {
      provider,
      orderId,
      payment,
      status: payment?.status ?? 'NOT_FOUND',
    };
  }

  async webhook(
    tenantId: string,
    provider: string,
    payload: Record<string, unknown>,
  ) {
    return this.db().paymentGatewayLog.create({
      data: {
        tenantId,
        provider,
        eventType: 'WEBHOOK',
        status: 'RECEIVED',
        request: payload,
        signatureOk: false,
      },
    });
  }

  private async nextTransactionNo(tenantId: string) {
    const count = await this.db().paymentTransaction.count({
      where: { tenantId },
    });
    return `ONL-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;
  }
}
