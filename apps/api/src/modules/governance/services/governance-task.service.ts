import { Injectable, NotFoundException } from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { paginate } from '../constants/governance.constants';
import type {
  CreateTaskDto,
  ListQueryDto,
  UpdateTaskDto,
} from '../dto/governance.dto';
import { GovernanceCommitteeService } from './governance-committee.service';
import { governanceDb } from './governance-prisma.util';

@Injectable()
export class GovernanceTaskService {
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
      where.OR = [
        { title: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.db().governanceTask.findMany({
        where,
        skip,
        take,
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        include: { committee: { select: { name: true, shortCode: true } } },
      }),
      this.db().governanceTask.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getById(tenantId: string, id: string) {
    const row = await this.db().governanceTask.findFirst({
      where: { id, tenantId },
      include: { committee: { select: { name: true, shortCode: true } } },
    });
    if (!row) throw new NotFoundException('Task not found');
    return row;
  }

  async create(user: JwtUser, dto: CreateTaskDto) {
    await this.committees.getById(user.tid, dto.committeeId);
    return this.db().governanceTask.create({
      data: {
        tenantId: user.tid,
        committeeId: dto.committeeId,
        title: dto.title.trim(),
        description: dto.description,
        assignedToId: dto.assignedToId,
        assignedName: dto.assignedName,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        createdById: user.sub,
      },
    });
  }

  async update(user: JwtUser, id: string, dto: UpdateTaskDto) {
    await this.getById(user.tid, id);
    return this.db().governanceTask.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        description: dto.description,
        assignedToId: dto.assignedToId,
        assignedName: dto.assignedName,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        status: dto.status,
        completedAt: dto.status === 'COMPLETED' ? new Date() : undefined,
      },
    });
  }
}
