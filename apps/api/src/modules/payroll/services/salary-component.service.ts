import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  CreatePaySalaryComponentDto,
  UpdatePaySalaryComponentDto,
} from '../dto/payroll.dto';

@Injectable()
export class SalaryComponentService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, componentType?: string) {
    return this.prisma.paySalaryComponent.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(componentType ? { componentType } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
  }

  async create(tenantId: string, dto: CreatePaySalaryComponentDto) {
    return this.prisma.paySalaryComponent.create({
      data: {
        tenantId,
        code: dto.code.toUpperCase(),
        name: dto.name,
        componentType: dto.componentType,
        category: dto.category ?? 'GENERAL',
        isStatutory: dto.isStatutory ?? false,
        sortOrder: dto.sortOrder ?? 100,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdatePaySalaryComponentDto) {
    const row = await this.prisma.paySalaryComponent.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Component not found');
    return this.prisma.paySalaryComponent.update({ where: { id }, data: dto });
  }
}
