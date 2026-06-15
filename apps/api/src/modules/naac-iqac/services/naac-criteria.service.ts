import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { NAAC_CRITERIA } from '../constants/naac.constants';
import type { CreateMetricDto, UpdateMetricDto } from '../dto/naac-iqac.dto';
import { naacDb } from './naac-prisma.util';

@Injectable()
export class NaacCriteriaService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return naacDb(this.prisma);
  }

  async listCriteria(tenantId: string) {
    return this.db().naacCriterion.findMany({
      where: { tenantId },
      orderBy: { sortOrder: 'asc' },
      include: { metrics: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async listMetrics(tenantId: string, criterion?: number) {
    const where: Record<string, unknown> = { tenantId };
    if (criterion) {
      where.criterion = { criterion };
    }
    return this.db().naacMetric.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      include: { criterion: { select: { criterion: true, title: true } } },
    });
  }

  async createMetric(tenantId: string, dto: CreateMetricDto) {
    const criterion = await this.db().naacCriterion.findFirst({
      where: { id: dto.criterionId, tenantId },
    });
    if (!criterion) throw new NotFoundException('Criterion not found');

    return this.db().naacMetric.create({
      data: {
        tenantId,
        criterionId: dto.criterionId,
        code: dto.code,
        title: dto.title,
        description: dto.description,
        dataType: dto.dataType ?? 'document',
        isMandatory: dto.isMandatory ?? false,
      },
    });
  }

  async updateMetric(tenantId: string, id: string, dto: UpdateMetricDto) {
    const row = await this.db().naacMetric.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Metric not found');
    return this.db().naacMetric.update({ where: { id }, data: dto });
  }
}
