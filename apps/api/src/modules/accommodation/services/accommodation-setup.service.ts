import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { DEFAULT_QUARTER_TYPES } from '../constants';

@Injectable()
export class AccommodationSetupService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
    for (const tenant of tenants) {
      await this.ensureQuarterTypes(tenant.id);
      await this.ensureSalaryComponents(tenant.id);
    }
  }

  async ensureQuarterTypes(tenantId: string) {
    for (const [i, t] of DEFAULT_QUARTER_TYPES.entries()) {
      await this.prisma.quarterTypeConfig.upsert({
        where: { tenantId_slug: { tenantId, slug: t.slug } },
        create: {
          tenantId,
          slug: t.slug,
          name: t.name,
          isSystem: true,
          sortOrder: (i + 1) * 10,
        },
        update: {},
      });
    }
  }

  async ensureSalaryComponents(tenantId: string) {
    const defs = [
      { code: 'QUARTER_RENT', name: 'Quarter Rent', sortOrder: 121 },
      { code: 'ACCOM_WATER', name: 'Water Charge', sortOrder: 122 },
      { code: 'ACCOM_ELECTRICITY', name: 'Electricity Charge', sortOrder: 123 },
      { code: 'ACCOM_MAINTENANCE', name: 'Maintenance Charge', sortOrder: 124 },
      { code: 'ACCOM_INTERNET', name: 'Internet Charge', sortOrder: 125 },
    ];
    for (const d of defs) {
      const existing = await this.prisma.paySalaryComponent.findFirst({
        where: { tenantId, code: d.code, deletedAt: null },
      });
      if (!existing) {
        await this.prisma.paySalaryComponent.create({
          data: {
            tenantId,
            code: d.code,
            name: d.name,
            componentType: 'DEDUCTION',
            category: 'ACCOMMODATION',
            sortOrder: d.sortOrder,
            isActive: true,
          },
        });
      }
    }
  }
}
