import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { PayrollSettingsDto } from '../dto/payroll.dto';
import { DEFAULT_MEGHALAYA_PT } from './professional-tax.service';
import { DEFAULT_NEW_REGIME_TDS } from './tds.service';

@Injectable()
export class PayrollSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(tenantId: string) {
    const row = await this.prisma.payrollSettings.findUnique({
      where: { tenantId },
    });
    if (row) return row;
    return {
      tenantId,
      professionalTaxSlabs: DEFAULT_MEGHALAYA_PT,
      tdsSlabs: DEFAULT_NEW_REGIME_TDS,
      payslipFooter: null,
      logoUrl: null,
      defaultPfRate: null,
      defaultCpfRate: null,
      qrVerifyBaseUrl: null,
      exportLayouts: null,
      bankFileFormats: null,
    };
  }

  upsert(tenantId: string, dto: PayrollSettingsDto) {
    return this.prisma.payrollSettings.upsert({
      where: { tenantId },
      create: {
        tenantId,
        logoUrl: dto.logoUrl,
        payslipFooter: dto.payslipFooter,
        defaultPfRate: dto.defaultPfRate,
        defaultCpfRate: dto.defaultCpfRate,
        professionalTaxSlabs: (dto.professionalTaxSlabs ??
          DEFAULT_MEGHALAYA_PT) as object,
        tdsSlabs: (dto.tdsSlabs ?? DEFAULT_NEW_REGIME_TDS) as object,
        qrVerifyBaseUrl: dto.qrVerifyBaseUrl,
        exportLayouts: dto.exportLayouts as object | undefined,
        bankFileFormats: dto.bankFileFormats as object | undefined,
      },
      update: {
        logoUrl: dto.logoUrl,
        payslipFooter: dto.payslipFooter,
        defaultPfRate: dto.defaultPfRate,
        defaultCpfRate: dto.defaultCpfRate,
        professionalTaxSlabs: dto.professionalTaxSlabs as object | undefined,
        tdsSlabs: dto.tdsSlabs as object | undefined,
        qrVerifyBaseUrl: dto.qrVerifyBaseUrl,
        exportLayouts: dto.exportLayouts as object | undefined,
        bankFileFormats: dto.bankFileFormats as object | undefined,
      },
    });
  }
}
