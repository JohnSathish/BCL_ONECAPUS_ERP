import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import type { UpdateExamFeeSettingsDto } from '../dto/examination-fees.dto';

@Injectable()
export class ExamFeeSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async get(tenantId: string) {
    const existing = await this.db().examFeeSettings.findUnique({
      where: { tenantId },
    });
    if (existing) return existing;
    return this.db().examFeeSettings.create({
      data: {
        tenantId,
        receiptPrefix: 'EXAM',
        allowedManualModes: ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'DD'],
        requireDeclaration: true,
        autoVerifyOnPayment: false,
      },
    });
  }

  async update(user: JwtUser, dto: UpdateExamFeeSettingsDto) {
    await this.get(user.tid);
    return this.db().examFeeSettings.update({
      where: { tenantId: user.tid },
      data: {
        ...(dto.receiptPrefix != null
          ? { receiptPrefix: dto.receiptPrefix }
          : {}),
        ...(dto.allowedManualModes != null
          ? { allowedManualModes: dto.allowedManualModes }
          : {}),
        ...(dto.requireDeclaration != null
          ? { requireDeclaration: dto.requireDeclaration }
          : {}),
        ...(dto.autoVerifyOnPayment != null
          ? { autoVerifyOnPayment: dto.autoVerifyOnPayment }
          : {}),
      },
    });
  }

  async require(tenantId: string) {
    const settings = await this.get(tenantId);
    if (!settings) throw new NotFoundException('Exam fee settings not found');
    return settings;
  }
}
