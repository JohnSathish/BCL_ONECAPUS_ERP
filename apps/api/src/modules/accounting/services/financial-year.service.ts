import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateFinancialYearDto } from '../dto/accounting.dto';
import {
  financialYearBounds,
  financialYearLabel,
} from '../utils/financial-year.util';
import { AccountingBootstrapService } from './accounting-bootstrap.service';

@Injectable()
export class FinancialYearService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bootstrap: AccountingBootstrapService,
  ) {}

  async list(tenantId: string) {
    await this.bootstrap.ensureTenantSetup(tenantId);
    return this.prisma.accountingFinancialYear.findMany({
      where: { tenantId },
      orderBy: { startYear: 'desc' },
    });
  }

  async getActive(tenantId: string) {
    await this.bootstrap.ensureTenantSetup(tenantId);
    const active = await this.prisma.accountingFinancialYear.findFirst({
      where: { tenantId, isActive: true },
    });
    if (!active) {
      throw new NotFoundException('No active financial year configured');
    }
    return active;
  }

  async assertActiveOpen(tenantId: string) {
    const active = await this.getActive(tenantId);
    if (active.status !== 'OPEN') {
      throw new BadRequestException(
        `Active financial year ${active.label} is locked (${active.status})`,
      );
    }
    return active;
  }

  async assertYearOpen(tenantId: string, financialYearId: string) {
    const fy = await this.prisma.accountingFinancialYear.findFirst({
      where: { tenantId, id: financialYearId },
    });
    if (!fy) {
      throw new NotFoundException('Financial year not found');
    }
    if (fy.status !== 'OPEN') {
      throw new BadRequestException(
        `Financial year ${fy.label} is locked (${fy.status})`,
      );
    }
    return fy;
  }

  async create(tenantId: string, dto: CreateFinancialYearDto) {
    const bounds = financialYearBounds(dto.startYear);
    const label = financialYearLabel(dto.startYear);

    const existing = await this.prisma.accountingFinancialYear.findUnique({
      where: { tenantId_startYear: { tenantId, startYear: dto.startYear } },
    });
    if (existing) {
      throw new ConflictException(`Financial year ${label} already exists`);
    }

    const fy = await this.prisma.accountingFinancialYear.create({
      data: {
        tenantId,
        label,
        startYear: dto.startYear,
        startDate: bounds.startDate,
        endDate: bounds.endDate,
        status: 'OPEN',
        isActive: false,
      },
    });

    const voucherTypes = await this.prisma.accountingVoucherType.findMany({
      where: { tenantId },
    });
    for (const vt of voucherTypes) {
      await this.prisma.accountingVoucherSequence.create({
        data: {
          tenantId,
          voucherTypeId: vt.id,
          financialYearId: fy.id,
          currentNo: 0,
        },
      });
    }

    return fy;
  }

  async activate(tenantId: string, id: string) {
    const fy = await this.prisma.accountingFinancialYear.findFirst({
      where: { tenantId, id },
    });
    if (!fy) throw new NotFoundException('Financial year not found');
    if (fy.status === 'CLOSED') {
      throw new BadRequestException('Cannot activate a closed financial year');
    }

    await this.prisma.$transaction([
      this.prisma.accountingFinancialYear.updateMany({
        where: { tenantId, isActive: true },
        data: { isActive: false },
      }),
      this.prisma.accountingFinancialYear.update({
        where: { id },
        data: { isActive: true },
      }),
    ]);

    return this.prisma.accountingFinancialYear.findUniqueOrThrow({
      where: { id },
    });
  }
}
