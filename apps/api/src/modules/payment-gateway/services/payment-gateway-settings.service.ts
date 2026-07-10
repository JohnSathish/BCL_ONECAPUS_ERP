import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

const DEFAULT_ALLOWED_MODES = {
  upi: true,
  creditCard: true,
  debitCard: true,
  netBanking: true,
  wallet: false,
};

@Injectable()
export class PaymentGatewaySettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async get(tenantId: string) {
    let row = await this.db().tenantPaymentSettings.findUnique({
      where: { tenantId },
    });
    if (!row) {
      row = await this.db().tenantPaymentSettings.create({
        data: { tenantId, allowedModes: DEFAULT_ALLOWED_MODES },
      });
    }
    return row;
  }

  async update(tenantId: string, dto: Record<string, unknown>) {
    await this.get(tenantId);
    return this.db().tenantPaymentSettings.update({
      where: { tenantId },
      data: {
        ...(dto.allowedModes !== undefined
          ? { allowedModes: dto.allowedModes }
          : {}),
        ...(dto.autoReceipt !== undefined
          ? { autoReceipt: dto.autoReceipt }
          : {}),
        ...(dto.autoEmailReceipt !== undefined
          ? { autoEmailReceipt: dto.autoEmailReceipt }
          : {}),
        ...(dto.autoSmsNotification !== undefined
          ? { autoSmsNotification: dto.autoSmsNotification }
          : {}),
        ...(dto.autoWhatsappNotification !== undefined
          ? { autoWhatsappNotification: dto.autoWhatsappNotification }
          : {}),
        ...(dto.retryFailedPayments !== undefined
          ? { retryFailedPayments: dto.retryFailedPayments }
          : {}),
        ...(dto.paymentTimeoutMinutes !== undefined
          ? { paymentTimeoutMinutes: dto.paymentTimeoutMinutes }
          : {}),
        ...(dto.preventDuplicatePayments !== undefined
          ? { preventDuplicatePayments: dto.preventDuplicatePayments }
          : {}),
      },
    });
  }
}
