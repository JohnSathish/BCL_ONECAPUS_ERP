import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { GOVERNANCE_NAAC_CRITERIA } from '../constants/governance.constants';
import type { CreateNaacTagDto, ListQueryDto } from '../dto/governance.dto';
import { governanceDb } from './governance-prisma.util';

@Injectable()
export class GovernanceNaacService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return governanceDb(this.prisma);
  }

  criteria() {
    return GOVERNANCE_NAAC_CRITERIA;
  }

  async list(tenantId: string, query: ListQueryDto) {
    const where: Record<string, unknown> = { tenantId };
    if (query.q) where.entityType = query.q;

    return this.db().governanceNaacTag.findMany({
      where,
      orderBy: [{ criterion: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    });
  }

  async listByCriterion(tenantId: string, criterion: number) {
    return this.db().governanceNaacTag.findMany({
      where: { tenantId, criterion },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(user: JwtUser, dto: CreateNaacTagDto) {
    const valid = GOVERNANCE_NAAC_CRITERIA.some(
      (c) => c.criterion === dto.criterion,
    );
    if (!valid) throw new BadRequestException('Invalid NAAC criterion');

    return this.db().governanceNaacTag.create({
      data: {
        tenantId: user.tid,
        entityType: dto.entityType,
        entityId: dto.entityId,
        criterion: dto.criterion,
        evidenceNotes: dto.evidenceNotes,
        documentId: dto.documentId,
        eventId: dto.entityType === 'event' ? dto.entityId : undefined,
        actionItemId:
          dto.entityType === 'action_item' ? dto.entityId : undefined,
        noticeId: dto.entityType === 'notice' ? dto.entityId : undefined,
      },
    });
  }

  async remove(user: JwtUser, id: string) {
    const row = await this.db().governanceNaacTag.findFirst({
      where: { id, tenantId: user.tid },
    });
    if (!row) throw new NotFoundException('NAAC tag not found');
    return this.db().governanceNaacTag.delete({ where: { id } });
  }

  async evidenceSummary(tenantId: string) {
    const tags = await this.db().governanceNaacTag.groupBy({
      by: ['criterion'],
      where: { tenantId },
      _count: { _all: true },
    });

    return GOVERNANCE_NAAC_CRITERIA.map((c) => ({
      ...c,
      evidenceCount:
        tags.find((t: { criterion: number }) => t.criterion === c.criterion)
          ?._count?._all ?? 0,
    }));
  }
}
