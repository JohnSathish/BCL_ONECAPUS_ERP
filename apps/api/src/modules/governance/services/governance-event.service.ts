import { Injectable, NotFoundException } from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { paginate } from '../constants/governance.constants';
import type {
  CreateEventDto,
  ListQueryDto,
  UpdateEventDto,
} from '../dto/governance.dto';
import { GovernanceCommitteeService } from './governance-committee.service';
import { governanceDb } from './governance-prisma.util';

@Injectable()
export class GovernanceEventService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly committees: GovernanceCommitteeService,
  ) {}

  private db() {
    return governanceDb(this.prisma);
  }

  async list(tenantId: string, query: ListQueryDto) {
    const { skip, take, page, limit } = paginate(query.page, query.limit);
    const where: Record<string, unknown> = { tenantId };
    if (query.committeeId) where.committeeId = query.committeeId;
    if (query.status) where.status = query.status;
    if (query.from || query.to) {
      where.startDate = {};
      if (query.from)
        (where.startDate as Record<string, Date>).gte = new Date(query.from);
      if (query.to)
        (where.startDate as Record<string, Date>).lte = new Date(query.to);
    }

    const [items, total] = await Promise.all([
      this.db().governanceEvent.findMany({
        where,
        skip,
        take,
        orderBy: { startDate: 'desc' },
        include: { committee: { select: { name: true, shortCode: true } } },
      }),
      this.db().governanceEvent.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getById(tenantId: string, id: string) {
    const row = await this.db().governanceEvent.findFirst({
      where: { id, tenantId },
      include: {
        committee: { select: { name: true, shortCode: true } },
        naacTags: true,
      },
    });
    if (!row) throw new NotFoundException('Event not found');
    return row;
  }

  async create(user: JwtUser, dto: CreateEventDto) {
    await this.committees.getById(user.tid, dto.committeeId);
    return this.db().governanceEvent.create({
      data: {
        tenantId: user.tid,
        committeeId: dto.committeeId,
        title: dto.title.trim(),
        eventType: dto.eventType,
        description: dto.description,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        venue: dto.venue,
        createdById: user.sub,
      },
    });
  }

  async update(user: JwtUser, id: string, dto: UpdateEventDto) {
    await this.getById(user.tid, id);
    return this.db().governanceEvent.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        eventType: dto.eventType,
        description: dto.description,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        venue: dto.venue,
        status: dto.status,
      },
    });
  }
}
