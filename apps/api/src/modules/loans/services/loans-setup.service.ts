import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { DEFAULT_LOAN_TYPES } from '../constants';

@Injectable()
export class LoansSetupService implements OnModuleInit {
  private readonly logger = new Logger(LoansSetupService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
    for (const tenant of tenants) {
      await this.ensureTenant(tenant.id);
    }
  }

  async ensureTenant(tenantId: string) {
    for (const [i, t] of DEFAULT_LOAN_TYPES.entries()) {
      await this.prisma.loanTypeConfig.upsert({
        where: { tenantId_code: { tenantId, code: t.code } },
        create: {
          tenantId,
          code: t.code,
          name: t.name,
          maxAmount: t.maxAmount,
          defaultInstallment: t.defaultInstallment,
          sortOrder: (i + 1) * 10,
        },
        update: {},
      });
    }
  }

  listTypes(tenantId: string, activeOnly = true) {
    return this.prisma.loanTypeConfig.findMany({
      where: { tenantId, ...(activeOnly ? { isActive: true } : {}) },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createType(
    user: { tid: string },
    dto: import('../dto/loans.dto').CreateLoanTypeDto,
  ) {
    return this.prisma.loanTypeConfig.create({
      data: {
        tenantId: user.tid,
        code: dto.code.toUpperCase().replace(/\s+/g, '_'),
        name: dto.name,
        description: dto.description,
        maxAmount: dto.maxAmount,
        defaultInstallment: dto.defaultInstallment,
        interestApplicable: dto.interestApplicable ?? false,
        interestRate: dto.interestRate,
        sortOrder: dto.sortOrder ?? 100,
      },
    });
  }

  async updateType(
    tenantId: string,
    id: string,
    dto: import('../dto/loans.dto').UpdateLoanTypeDto,
  ) {
    return this.prisma.loanTypeConfig.update({
      where: { id, tenantId },
      data: {
        ...(dto.name != null ? { name: dto.name } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.maxAmount !== undefined ? { maxAmount: dto.maxAmount } : {}),
        ...(dto.defaultInstallment !== undefined
          ? { defaultInstallment: dto.defaultInstallment }
          : {}),
        ...(dto.interestApplicable !== undefined
          ? { interestApplicable: dto.interestApplicable }
          : {}),
        ...(dto.interestRate !== undefined
          ? { interestRate: dto.interestRate }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });
  }
}
