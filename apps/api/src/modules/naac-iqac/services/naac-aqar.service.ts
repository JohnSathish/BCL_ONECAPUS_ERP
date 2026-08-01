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
    let sources: string[] = [];

    if (dto.sectionKey.startsWith('criterion_')) {
      const criterion = parseInt(dto.sectionKey.replace('criterion_', ''), 10);
      const aggregates = await this.aggregator.forCriterion(
        tenantId,
        criterion,
      );
      const workspaceHints = await this.workspaceHintsForCriterion(
        tenantId,
        aqar.academicYear,
        criterion,
      );
      content = {
        ...aggregates,
        erpHints: workspaceHints,
        _meta: {
          syncedFrom: ['aggregator', 'metricWorkspaces'],
          syncedAt: new Date().toISOString(),
        },
      };
      sources = ['criterionAggregates', 'workspaceErpHints'];
    } else if (dto.sectionKey === 'profile') {
      const extended = await this.db().naacExtendedProfile.findUnique({
        where: {
          tenantId_academicYear: {
            tenantId,
            academicYear: aqar.academicYear,
          },
        },
      });
      const live = await this.aggregator.pullExtendedProfile(
        tenantId,
        aqar.academicYear,
      );
      content = {
        institutionProfile:
          aqar.institutionProfile ??
          (extended?.sections as { institutionProfile?: unknown })
            ?.institutionProfile ??
          {},
        extendedProfile: extended?.sections ?? live,
        extendedProfileLastPulledAt: extended?.lastPulledAt ?? null,
        _meta: {
          syncedFrom: extended
            ? ['naacExtendedProfile', 'aqarInstitutionProfile']
            : ['liveErpPull', 'aqarInstitutionProfile'],
          syncedAt: new Date().toISOString(),
        },
      };
      sources = extended
        ? ['extendedProfile', 'institutionProfile']
        : ['liveErpPull', 'institutionProfile'];
    } else {
      content = {
        synced: true,
        message: 'Manual section — attach evidence via repository',
        _meta: {
          syncedFrom: ['manual'],
          syncedAt: new Date().toISOString(),
        },
      };
      sources = ['manual'];
    }

    const completionPct = Object.keys(content).length > 0 ? 60 : 0;
    await this.db().naacAqarSection.update({
      where: { id: section.id },
      data: {
        content: { ...content, _sources: sources },
        completionPct,
        lastSyncedAt: new Date(),
      },
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

  private async workspaceHintsForCriterion(
    tenantId: string,
    academicYear: string,
    criterion: number,
  ) {
    const rows = await this.db().naacMetricWorkspace.findMany({
      where: {
        tenantId,
        academicYear,
        metric: { criterion: { criterion } },
        status: {
          in: [
            'APPROVED',
            'LOCKED',
            'IN_PROGRESS',
            'SUBMITTED',
            'UNDER_REVIEW',
            'EVIDENCE_PENDING',
          ],
        },
      },
      select: {
        id: true,
        status: true,
        progressPct: true,
        erpSourceHints: true,
        metric: { select: { code: true, title: true, erpSourceKey: true } },
      },
      take: 200,
    });
    return rows.map(
      (r: {
        id: string;
        status: string;
        progressPct: number;
        erpSourceHints: unknown;
        metric: { code: string; title: string; erpSourceKey: string | null };
      }) => ({
        workspaceId: r.id,
        metricCode: r.metric.code,
        title: r.metric.title,
        erpSourceKey: r.metric.erpSourceKey,
        status: r.status,
        progressPct: r.progressPct,
        hints: r.erpSourceHints,
      }),
    );
  }
}
