import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { paginate } from '../constants/governance.constants';
import type {
  AtrStatusTransitionDto,
  CreateAtrDto,
  ListQueryDto,
  UpdateAtrDto,
} from '../dto/governance.dto';
import { GovernanceCommitteeService } from './governance-committee.service';
import { governanceDb } from './governance-prisma.util';

const ATR_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['IN_PROGRESS', 'DEFERRED', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'OVERDUE', 'DEFERRED', 'CANCELLED'],
  OVERDUE: ['IN_PROGRESS', 'COMPLETED', 'DEFERRED', 'CANCELLED'],
  DEFERRED: ['PENDING', 'IN_PROGRESS', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

@Injectable()
export class GovernanceAtrService {
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
    if (query.q) {
      where.actionItem = { contains: query.q, mode: 'insensitive' };
    }

    const [items, total] = await Promise.all([
      this.db().governanceActionItem.findMany({
        where,
        skip,
        take,
        orderBy: [{ targetDate: 'asc' }, { createdAt: 'desc' }],
        include: {
          committee: { select: { name: true, shortCode: true } },
          meeting: { select: { title: true, meetingDate: true } },
        },
      }),
      this.db().governanceActionItem.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getById(tenantId: string, id: string) {
    const row = await this.db().governanceActionItem.findFirst({
      where: { id, tenantId },
      include: {
        committee: { select: { name: true, shortCode: true } },
        meeting: { select: { title: true, meetingDate: true } },
        naacTags: true,
      },
    });
    if (!row) throw new NotFoundException('Action item not found');
    return row;
  }

  async create(user: JwtUser, dto: CreateAtrDto) {
    await this.committees.getById(user.tid, dto.committeeId);
    if (dto.meetingId) {
      const meeting = await this.db().governanceMeeting.findFirst({
        where: {
          id: dto.meetingId,
          tenantId: user.tid,
          committeeId: dto.committeeId,
        },
      });
      if (!meeting)
        throw new BadRequestException('Meeting does not belong to committee');
    }

    return this.db().governanceActionItem.create({
      data: {
        tenantId: user.tid,
        committeeId: dto.committeeId,
        meetingId: dto.meetingId,
        actionItem: dto.actionItem.trim(),
        assignedToId: dto.assignedToId,
        assignedName: dto.assignedName,
        priority: dto.priority ?? 'NORMAL',
        targetDate: dto.targetDate ? new Date(dto.targetDate) : undefined,
        remarks: dto.remarks,
        createdById: user.sub,
      },
    });
  }

  async update(user: JwtUser, id: string, dto: UpdateAtrDto) {
    await this.getById(user.tid, id);
    return this.db().governanceActionItem.update({
      where: { id },
      data: {
        actionItem: dto.actionItem?.trim(),
        assignedToId: dto.assignedToId,
        assignedName: dto.assignedName,
        priority: dto.priority,
        targetDate: dto.targetDate ? new Date(dto.targetDate) : undefined,
        remarks: dto.remarks,
        status: dto.status,
        completedAt: dto.status === 'COMPLETED' ? new Date() : undefined,
      },
    });
  }

  async transition(user: JwtUser, id: string, dto: AtrStatusTransitionDto) {
    const row = await this.getById(user.tid, id);
    const allowed = ATR_TRANSITIONS[row.status as string] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition from ${row.status} to ${dto.status}`,
      );
    }

    return this.db().governanceActionItem.update({
      where: { id },
      data: {
        status: dto.status,
        remarks: dto.remarks ?? row.remarks,
        completedAt: dto.status === 'COMPLETED' ? new Date() : row.completedAt,
      },
    });
  }

  async markOverdue(tenantId: string) {
    const now = new Date();
    const result = await this.db().governanceActionItem.updateMany({
      where: {
        tenantId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        targetDate: { lt: now },
      },
      data: { status: 'OVERDUE' },
    });
    return { updated: result.count };
  }
}
