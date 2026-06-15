import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { NAAC_CRITERIA } from '../constants/naac.constants';
import type {
  CreateEvidenceTagDto,
  EvidenceSearchDto,
} from '../dto/naac-iqac.dto';
import { paginate } from '../constants/naac.constants';
import { naacDb } from './naac-prisma.util';
import { GovernanceNaacService } from '../../governance/services/governance-naac.service';

@Injectable()
export class NaacEvidenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly governanceNaac: GovernanceNaacService,
  ) {}

  private db() {
    return naacDb(this.prisma);
  }

  async search(tenantId: string, query: EvidenceSearchDto) {
    const { skip, take, page, limit } = paginate(query.page, query.limit);
    const where: Record<string, unknown> = { tenantId };
    if (query.criterion) where.criterion = query.criterion;
    if (query.metricCode) where.metricCode = query.metricCode;
    if (query.academicYear) where.academicYear = query.academicYear;
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.sourceType) where.sourceType = query.sourceType;
    if (query.q) {
      where.OR = [
        { evidenceNotes: { contains: query.q, mode: 'insensitive' } },
        { activityTitle: { contains: query.q, mode: 'insensitive' } },
        { fileName: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const [nimsItems, nimsTotal] = await Promise.all([
      this.db().naacEvidenceTag.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.db().naacEvidenceTag.count({ where }),
    ]);

    const governanceTags = await this.listGovernanceEvidence(tenantId, query);
    const merged = [
      ...nimsItems.map((t: Record<string, unknown>) => ({
        ...t,
        origin: 'nims',
      })),
      ...governanceTags.slice(0, Math.max(0, take - nimsItems.length)),
    ];

    return {
      items: merged,
      total: nimsTotal + governanceTags.length,
      page,
      limit,
      nimsTotal,
      governanceTotal: governanceTags.length,
    };
  }

  async listGovernanceEvidence(tenantId: string, query: EvidenceSearchDto) {
    const tags = await this.governanceNaac.list(tenantId, {
      q: query.sourceType,
    });
    return tags
      .filter(
        (t: { criterion: number }) =>
          !query.criterion || t.criterion === query.criterion,
      )
      .map(
        (t: {
          id: string;
          entityType: string;
          entityId: string;
          criterion: number;
          evidenceNotes?: string;
          createdAt: Date;
        }) => ({
          id: t.id,
          sourceType: `governance_${t.entityType}`,
          sourceId: t.entityId,
          criterion: t.criterion,
          academicYear: query.academicYear ?? '2025-26',
          evidenceNotes: t.evidenceNotes,
          createdAt: t.createdAt,
          origin: 'governance',
        }),
      );
  }

  async create(user: JwtUser, dto: CreateEvidenceTagDto) {
    const valid = NAAC_CRITERIA.some((c) => c.criterion === dto.criterion);
    if (!valid) throw new BadRequestException('Invalid NAAC criterion');

    return this.db().naacEvidenceTag.create({
      data: {
        tenantId: user.tid,
        sourceType: dto.sourceType,
        sourceId: dto.sourceId,
        criterion: dto.criterion,
        metricCode: dto.metricCode,
        academicYear: dto.academicYear,
        departmentId: dto.departmentId,
        committeeId: dto.committeeId,
        programmeId: dto.programmeId,
        activityTitle: dto.activityTitle,
        eventTitle: dto.eventTitle,
        evidenceNotes: dto.evidenceNotes,
        fileName: dto.fileName,
        storageKey: dto.storageKey,
        fileUrl: dto.fileUrl,
        vaultDocumentId: dto.vaultDocumentId,
        createdById: user.sub,
      },
    });
  }

  async remove(user: JwtUser, id: string) {
    const row = await this.db().naacEvidenceTag.findFirst({
      where: { id, tenantId: user.tid },
    });
    if (!row) throw new NotFoundException('Evidence tag not found');
    return this.db().naacEvidenceTag.delete({ where: { id } });
  }

  async countByCriterion(tenantId: string, academicYear?: string) {
    const where: Record<string, unknown> = { tenantId };
    if (academicYear) where.academicYear = academicYear;

    const groups = await this.db().naacEvidenceTag.groupBy({
      by: ['criterion'],
      where,
      _count: { _all: true },
    });

    const govSummary = await this.governanceNaac.evidenceSummary(tenantId);
    const result: Record<number, number> = {};
    for (const c of NAAC_CRITERIA) {
      const nims =
        groups.find(
          (g: { criterion: number; _count: { _all: number } }) =>
            g.criterion === c.criterion,
        )?._count?._all ?? 0;
      const gov =
        govSummary.find(
          (g: { criterion: number; evidenceCount: number }) =>
            g.criterion === c.criterion,
        )?.evidenceCount ?? 0;
      result[c.criterion] = nims + gov;
    }
    return result;
  }

  async summary(tenantId: string, academicYear?: string) {
    const counts = await this.countByCriterion(tenantId, academicYear);
    return NAAC_CRITERIA.map((c) => ({
      ...c,
      evidenceCount: counts[c.criterion] ?? 0,
    }));
  }
}
