import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AccountingBootstrapService } from './accounting-bootstrap.service';

export type AccountingSettingsDto = {
  autoPostFees?: boolean;
  autoPostPayroll?: boolean;
  defaultCashLedgerId?: string | null;
  defaultBankLedgerId?: string | null;
  defaultIncomeLedgerId?: string | null;
  salaryExpenseLedgerId?: string | null;
  salaryPayableLedgerId?: string | null;
  payrollDeductionsLedgerId?: string | null;
};

export type FeeHeadMappingDto = {
  sourceKey: string;
  feeHeadId?: string;
  incomeLedgerId: string;
};

export type PaymentModeMappingDto = {
  paymentMode: string;
  debitLedgerId: string;
};

export type PayrollComponentMappingDto = {
  componentCode: string;
  ledgerAccountId: string;
};

@Injectable()
export class AccountingSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bootstrap: AccountingBootstrapService,
  ) {}

  async getSettings(tenantId: string) {
    await this.bootstrap.ensureTenantSetup(tenantId);
    return this.prisma.accountingSettings.findUniqueOrThrow({
      where: { tenantId },
    });
  }

  async updateSettings(tenantId: string, dto: AccountingSettingsDto) {
    await this.bootstrap.ensureTenantSetup(tenantId);
    return this.prisma.accountingSettings.update({
      where: { tenantId },
      data: dto,
    });
  }

  async listFeeHeadMappings(tenantId: string) {
    await this.bootstrap.ensureTenantSetup(tenantId);
    return this.prisma.accountingFeeHeadMapping.findMany({
      where: { tenantId, isActive: true },
      include: { incomeLedger: true },
      orderBy: { sourceKey: 'asc' },
    });
  }

  async upsertFeeHeadMapping(tenantId: string, dto: FeeHeadMappingDto) {
    await this.bootstrap.ensureTenantSetup(tenantId);
    return this.prisma.accountingFeeHeadMapping.upsert({
      where: {
        tenantId_sourceKey: { tenantId, sourceKey: dto.sourceKey },
      },
      create: {
        tenantId,
        sourceKey: dto.sourceKey,
        feeHeadId: dto.feeHeadId,
        incomeLedgerId: dto.incomeLedgerId,
      },
      update: {
        feeHeadId: dto.feeHeadId,
        incomeLedgerId: dto.incomeLedgerId,
        isActive: true,
      },
      include: { incomeLedger: true },
    });
  }

  async listPaymentModeMappings(tenantId: string) {
    await this.bootstrap.ensureTenantSetup(tenantId);
    return this.prisma.accountingPaymentModeMapping.findMany({
      where: { tenantId, isActive: true },
      include: { debitLedger: true },
      orderBy: { paymentMode: 'asc' },
    });
  }

  async upsertPaymentModeMapping(tenantId: string, dto: PaymentModeMappingDto) {
    await this.bootstrap.ensureTenantSetup(tenantId);
    return this.prisma.accountingPaymentModeMapping.upsert({
      where: {
        tenantId_paymentMode: {
          tenantId,
          paymentMode: dto.paymentMode.toUpperCase(),
        },
      },
      create: {
        tenantId,
        paymentMode: dto.paymentMode.toUpperCase(),
        debitLedgerId: dto.debitLedgerId,
      },
      update: {
        debitLedgerId: dto.debitLedgerId,
        isActive: true,
      },
      include: { debitLedger: true },
    });
  }

  async resolveDebitLedger(tenantId: string, paymentMode: string) {
    const settings = await this.getSettings(tenantId);
    const mapping = await this.prisma.accountingPaymentModeMapping.findUnique({
      where: {
        tenantId_paymentMode: {
          tenantId,
          paymentMode: paymentMode.toUpperCase(),
        },
      },
    });
    if (mapping?.isActive) return mapping.debitLedgerId;

    const mode = paymentMode.toUpperCase();
    if (mode === 'CASH') {
      return settings.defaultCashLedgerId;
    }
    return settings.defaultBankLedgerId ?? settings.defaultCashLedgerId;
  }

  async resolveIncomeLedger(tenantId: string, sourceKey: string) {
    const settings = await this.getSettings(tenantId);
    const normalized = sourceKey.trim().toUpperCase();
    const mapping = await this.prisma.accountingFeeHeadMapping.findFirst({
      where: {
        tenantId,
        isActive: true,
        OR: [
          { sourceKey: normalized },
          { sourceKey: { equals: sourceKey, mode: 'insensitive' } },
        ],
      },
    });
    if (mapping) return mapping.incomeLedgerId;
    return settings.defaultIncomeLedgerId;
  }

  async listPayrollComponentMappings(tenantId: string) {
    await this.bootstrap.ensureTenantSetup(tenantId);
    return this.prisma.accountingPayrollComponentMapping.findMany({
      where: { tenantId, isActive: true },
      include: { ledgerAccount: true },
      orderBy: { componentCode: 'asc' },
    });
  }

  async upsertPayrollComponentMapping(
    tenantId: string,
    dto: PayrollComponentMappingDto,
  ) {
    await this.bootstrap.ensureTenantSetup(tenantId);
    const componentCode = dto.componentCode.trim().toUpperCase();
    return this.prisma.accountingPayrollComponentMapping.upsert({
      where: {
        tenantId_componentCode: { tenantId, componentCode },
      },
      create: {
        tenantId,
        componentCode,
        ledgerAccountId: dto.ledgerAccountId,
      },
      update: {
        ledgerAccountId: dto.ledgerAccountId,
        isActive: true,
      },
      include: { ledgerAccount: true },
    });
  }

  async resolvePayrollDeductionLedger(tenantId: string, componentCode: string) {
    const settings = await this.getSettings(tenantId);
    const normalized = componentCode.trim().toUpperCase();
    const mapping =
      await this.prisma.accountingPayrollComponentMapping.findUnique({
        where: {
          tenantId_componentCode: { tenantId, componentCode: normalized },
        },
      });
    if (mapping?.isActive) return mapping.ledgerAccountId;
    return settings.payrollDeductionsLedgerId;
  }
}
