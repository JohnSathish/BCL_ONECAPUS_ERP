import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { paginate } from '../constants/governance.constants';
import type {
  CreateCommitteeDto,
  ListQueryDto,
  UpdateCommitteeDto,
} from '../dto/governance.dto';
import { governanceDb } from './governance-prisma.util';

@Injectable()
export class GovernanceCommitteeService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return governanceDb(this.prisma);
  }

  async list(tenantId: string, query: ListQueryDto) {
    const { skip, take, page, limit } = paginate(query.page, query.limit);
    const where: Record<string, unknown> = { tenantId };
    if (query.status) where.status = query.status;
    if (query.category) where.category = query.category;
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { shortCode: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.db().governanceCommittee.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
        include: { _count: { select: { members: true, meetings: true } } },
      }),
      this.db().governanceCommittee.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getById(tenantId: string, id: string) {
    const row = await this.db().governanceCommittee.findFirst({
      where: { id, tenantId },
      include: {
        members: { where: { status: 'ACTIVE' }, orderBy: { role: 'asc' } },
        _count: { select: { meetings: true, actionItems: true, tasks: true } },
      },
    });
    if (!row) throw new NotFoundException('Committee not found');
    return row;
  }

  async create(user: JwtUser, dto: CreateCommitteeDto) {
    const existing = await this.db().governanceCommittee.findFirst({
      where: { tenantId: user.tid, shortCode: dto.shortCode.toUpperCase() },
    });
    if (existing) throw new ConflictException('Short code already exists');

    return this.db().governanceCommittee.create({
      data: {
        tenantId: user.tid,
        name: dto.name.trim(),
        shortCode: dto.shortCode.trim().toUpperCase(),
        committeeType: dto.committeeType ?? 'STANDING',
        category: dto.category,
        description: dto.description,
        academicYear: dto.academicYear,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        metadata: dto.metadata ?? {},
        createdById: user.sub,
      },
    });
  }

  async update(user: JwtUser, id: string, dto: UpdateCommitteeDto) {
    await this.getById(user.tid, id);
    return this.db().governanceCommittee.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        committeeType: dto.committeeType,
        category: dto.category,
        description: dto.description,
        academicYear: dto.academicYear,
        status: dto.status,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        metadata: dto.metadata,
      },
    });
  }

  async deactivate(user: JwtUser, id: string) {
    await this.getById(user.tid, id);
    return this.db().governanceCommittee.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
  }
}
