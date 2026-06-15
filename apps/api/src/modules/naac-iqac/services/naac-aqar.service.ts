import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { NAAC_AQAR_SECTIONS } from '../constants/naac.constants';
import type {
  CreateAqarDto,
  SyncAqarSectionDto,
  UpdateAqarDto,
} from '../dto/naac-iqac.dto';
import { naacDb } from './naac-prisma.util';
import { NaacAggregatorService } from './naac-aggregator.service';

@Injectable()
export class NaacAqarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aggregator: NaacAggregatorService,
  ) {}

  private db() {
    return naacDb(this.prisma);
  }

  async list(tenantId: string) {
    return this.db().naacAqar.findMany({
      where: { tenantId },
      orderBy: { academicYear: 'desc' },
      include: { sections: true },
    });
  }

  async getById(tenantId: string, id: string) {
    const row = await this.db().naacAqar.findFirst({
      where: { id, tenantId },
      include: { sections: { orderBy: { sectionKey: 'asc' } } },
    });
    if (!row) throw new NotFoundException('AQAR not found');
    return row;
  }

  async create(tenantId: string, dto: CreateAqarDto) {
    const existing = await this.db().naacAqar.findFirst({
      where: { tenantId, academicYear: dto.academicYear },
    });
    if (existing)
      throw new BadRequestException(
        'AQAR for this academic year already exists',
      );

    const aqar = await this.db().naacAqar.create({
      data: {
        tenantId,
        academicYear: dto.academicYear,
        title: dto.title,
        status: 'DRAFT',
      },
    });

    for (const sectionKey of NAAC_AQAR_SECTIONS) {
      await this.db().naacAqarSection.create({
        data: {
          tenantId,
          aqarId: aqar.id,
          sectionKey,
          content: {},
          completionPct: 0,
        },
      });
    }

    return this.getById(tenantId, aqar.id);
  }

  async update(tenantId: string, id: string, dto: UpdateAqarDto) {
    const row = await this.db().naacAqar.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('AQAR not found');
    return this.db().naacAqar.update({ where: { id }, data: dto });
  }

  async syncSection(tenantId: string, aqarId: string, dto: SyncAqarSectionDto) {
    const aqar = await this.getById(tenantId, aqarId);
    const section = aqar.sections.find(
      (s: { sectionKey: string }) => s.sectionKey === dto.sectionKey,
    );
    if (!section) throw new NotFoundException('AQAR section not found');

    let content: Record<string, unknown> = {};
    if (dto.sectionKey.startsWith('criterion_')) {
      const criterion = parseInt(dto.sectionKey.replace('criterion_', ''), 10);
      content = await this.aggregator.forCriterion(tenantId, criterion);
    } else if (dto.sectionKey === 'profile') {
      content = { institutionProfile: aqar.institutionProfile ?? {} };
    } else {
      content = {
        synced: true,
        message: 'Manual section — attach evidence via repository',
      };
    }

    const completionPct = Object.keys(content).length > 0 ? 60 : 0;
    await this.db().naacAqarSection.update({
      where: { id: section.id },
      data: { content, completionPct, lastSyncedAt: new Date() },
    });

    const sections = await this.db().naacAqarSection.findMany({
      where: { aqarId },
    });
    const avgCompletion =
      sections.reduce(
        (s: number, x: { completionPct: number }) => s + x.completionPct,
        0,
      ) / sections.length;
    await this.db().naacAqar.update({
      where: { id: aqarId },
      data: { completionPct: Math.round(avgCompletion) },
    });

    return this.getById(tenantId, aqarId);
  }
}
