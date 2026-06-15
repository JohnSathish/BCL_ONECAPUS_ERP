import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { paginate } from '../constants/governance.constants';
import type {
  BulkAssignMembersDto,
  CreateMemberDto,
  ListQueryDto,
  UpdateMemberDto,
} from '../dto/governance.dto';
import { GovernanceCommitteeService } from './governance-committee.service';
import { governanceDb } from './governance-prisma.util';

@Injectable()
export class GovernanceMemberService {
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
        { displayName: { contains: query.q, mode: 'insensitive' } },
        { email: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.db().governanceCommitteeMember.findMany({
        where,
        skip,
        take,
        orderBy: [{ committeeId: 'asc' }, { role: 'asc' }],
        include: { committee: { select: { name: true, shortCode: true } } },
      }),
      this.db().governanceCommitteeMember.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getById(tenantId: string, id: string) {
    const row = await this.db().governanceCommitteeMember.findFirst({
      where: { id, tenantId },
      include: { committee: { select: { name: true, shortCode: true } } },
    });
    if (!row) throw new NotFoundException('Member not found');
    return row;
  }

  async listByCommittee(tenantId: string, committeeId: string) {
    await this.committees.getById(tenantId, committeeId);
    return this.db().governanceCommitteeMember.findMany({
      where: { tenantId, committeeId, status: { not: 'INACTIVE' } },
      orderBy: [{ role: 'asc' }, { displayName: 'asc' }],
      include: { committee: { select: { name: true, shortCode: true } } },
    });
  }

  async create(user: JwtUser, dto: CreateMemberDto) {
    await this.committees.getById(user.tid, dto.committeeId);
    return this.db().governanceCommitteeMember.create({
      data: {
        tenantId: user.tid,
        committeeId: dto.committeeId,
        displayName: dto.displayName.trim(),
        role: dto.role,
        staffProfileId: dto.staffProfileId,
        studentId: dto.studentId,
        userId: dto.userId,
        designation: dto.designation,
        mobile: dto.mobile,
        email: dto.email?.toLowerCase(),
        joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : new Date(),
        isExternal: dto.isExternal ?? false,
      },
    });
  }

  async update(user: JwtUser, id: string, dto: UpdateMemberDto) {
    await this.getById(user.tid, id);
    return this.db().governanceCommitteeMember.update({
      where: { id },
      data: {
        displayName: dto.displayName?.trim(),
        role: dto.role,
        designation: dto.designation,
        mobile: dto.mobile,
        email: dto.email?.toLowerCase(),
        status: dto.status,
        joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : undefined,
        isExternal: dto.isExternal,
      },
    });
  }

  async remove(user: JwtUser, id: string) {
    await this.getById(user.tid, id);
    return this.db().governanceCommitteeMember.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
  }

  async bulkAssign(user: JwtUser, dto: BulkAssignMembersDto) {
    await this.committees.getById(user.tid, dto.committeeId);
    const created = [];
    for (const member of dto.members) {
      if (!member.displayName?.trim()) {
        throw new BadRequestException('Each member requires a display name');
      }
      created.push(
        await this.db().governanceCommitteeMember.create({
          data: {
            tenantId: user.tid,
            committeeId: dto.committeeId,
            displayName: member.displayName.trim(),
            role: member.role,
            staffProfileId: member.staffProfileId,
            studentId: member.studentId,
            userId: member.userId,
            designation: member.designation,
            mobile: member.mobile,
            email: member.email?.toLowerCase(),
            joiningDate: member.joiningDate
              ? new Date(member.joiningDate)
              : new Date(),
            isExternal: member.isExternal ?? false,
          },
        }),
      );
    }
    return { count: created.length, items: created };
  }
}
