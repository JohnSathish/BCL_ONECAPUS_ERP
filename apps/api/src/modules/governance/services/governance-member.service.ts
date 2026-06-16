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
  ReplaceMemberDto,
  UpdateMemberDto,
} from '../dto/governance.dto';
import { GovernanceCommitteeService } from './governance-committee.service';
import { GovernanceNotificationService } from './governance-notification.service';
import { governanceDb } from './governance-prisma.util';

const TERMINAL_STAFF = [
  'RELIEVED',
  'RETIRED',
  'CONTRACT_ENDED',
  'INACTIVE',
] as const;

type StaffSnapshot = {
  displayName: string;
  employeeCode?: string;
  departmentName?: string;
  designation?: string;
  mobile?: string;
  email?: string;
  userId?: string;
  staffStatus?: string;
};

type MemberWithCommittee = {
  id: string;
  tenantId: string;
  committeeId: string;
  staffProfileId: string | null;
  userId: string | null;
  displayName: string;
  employeeCode: string | null;
  departmentName: string | null;
  designation: string | null;
  role: string;
  mobile: string | null;
  email: string | null;
  joiningDate: Date | null;
  endDate: Date | null;
  replacedByMemberId: string | null;
  status: string;
  isExternal: boolean;
  createdAt: Date;
  updatedAt: Date;
  committee?: { name?: string; shortCode?: string };
};

type MappedMember = MemberWithCommittee & {
  committeeName?: string;
  committeeShortCode?: string;
};

@Injectable()
export class GovernanceMemberService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly committees: GovernanceCommitteeService,
    private readonly notifications: GovernanceNotificationService,
  ) {}

  private db() {
    return governanceDb(this.prisma);
  }

  private mapMember(row: MemberWithCommittee): MappedMember {
    return {
      ...row,
      committeeName: row.committee?.name,
      committeeShortCode: row.committee?.shortCode,
    };
  }

  private async resolveStaff(
    tenantId: string,
    staffProfileId: string,
  ): Promise<StaffSnapshot> {
    const staff = await this.prisma.staffProfile.findFirst({
      where: { id: staffProfileId, tenantId, deletedAt: null },
      include: {
        department: { select: { name: true } },
        designation: { select: { label: true } },
      },
    });
    if (!staff) {
      throw new BadRequestException('Staff profile not found');
    }
    return {
      displayName: staff.fullName,
      employeeCode: staff.employeeCode,
      departmentName: staff.department?.name ?? undefined,
      designation: staff.designation?.label ?? undefined,
      mobile: staff.mobile ?? undefined,
      email: staff.email ?? undefined,
      userId: staff.portalUserId ?? undefined,
      staffStatus: staff.status,
    };
  }

  private async assertNoDuplicateActive(
    tenantId: string,
    committeeId: string,
    staffProfileId: string,
    excludeId?: string,
  ) {
    const existing = await this.db().governanceCommitteeMember.findFirst({
      where: {
        tenantId,
        committeeId,
        staffProfileId,
        status: 'ACTIVE',
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (existing) {
      throw new BadRequestException(
        'This staff member is already an active member of this committee',
      );
    }
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
        { employeeCode: { contains: query.q, mode: 'insensitive' } },
        { departmentName: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = (await Promise.all([
      this.db().governanceCommitteeMember.findMany({
        where,
        skip,
        take,
        orderBy: [
          { committeeId: 'asc' },
          { role: 'asc' },
          { displayName: 'asc' },
        ],
        include: { committee: { select: { name: true, shortCode: true } } },
      }),
      this.db().governanceCommitteeMember.count({ where }),
    ])) as [MemberWithCommittee[], number];

    const staffIds = rows
      .map((r) => r.staffProfileId)
      .filter((id): id is string => Boolean(id));
    const staffRows =
      staffIds.length > 0
        ? await this.prisma.staffProfile.findMany({
            where: { id: { in: staffIds }, tenantId },
            select: { id: true, status: true },
          })
        : [];
    const staffStatusById = new Map(staffRows.map((s) => [s.id, s.status]));

    const items = rows.map((row) => {
      const mapped = this.mapMember(row);
      const staffStatus = row.staffProfileId
        ? staffStatusById.get(row.staffProfileId)
        : undefined;
      return {
        ...mapped,
        replacementRequired:
          row.status === 'ACTIVE' &&
          Boolean(
            staffStatus &&
            TERMINAL_STAFF.includes(
              staffStatus as (typeof TERMINAL_STAFF)[number],
            ),
          ),
      };
    });

    return { items, total, page, limit };
  }

  async getById(tenantId: string, id: string): Promise<MappedMember> {
    const row = (await this.db().governanceCommitteeMember.findFirst({
      where: { id, tenantId },
      include: { committee: { select: { name: true, shortCode: true } } },
    })) as MemberWithCommittee | null;
    if (!row) throw new NotFoundException('Member not found');
    return this.mapMember(row);
  }

  async listByCommittee(tenantId: string, committeeId: string) {
    await this.committees.getById(tenantId, committeeId);
    const rows = (await this.db().governanceCommitteeMember.findMany({
      where: { tenantId, committeeId, status: { not: 'INACTIVE' } },
      orderBy: [{ role: 'asc' }, { displayName: 'asc' }],
      include: { committee: { select: { name: true, shortCode: true } } },
    })) as MemberWithCommittee[];
    return rows.map((r) => this.mapMember(r));
  }

  async listHistory(tenantId: string, committeeId: string) {
    await this.committees.getById(tenantId, committeeId);
    const rows = (await this.db().governanceCommitteeMember.findMany({
      where: { tenantId, committeeId },
      orderBy: [{ joiningDate: 'desc' }, { createdAt: 'desc' }],
      include: { committee: { select: { name: true, shortCode: true } } },
    })) as MemberWithCommittee[];
    return rows.map((r) => this.mapMember(r));
  }

  async listByStaff(tenantId: string, staffProfileId: string) {
    const rows = (await this.db().governanceCommitteeMember.findMany({
      where: {
        tenantId,
        staffProfileId,
        status: { in: ['ACTIVE', 'REPLACED', 'RESIGNED'] },
      },
      orderBy: [{ status: 'asc' }, { joiningDate: 'desc' }],
      include: { committee: { select: { name: true, shortCode: true } } },
    })) as MemberWithCommittee[];
    return rows.map((r) => this.mapMember(r));
  }

  async memberStats(tenantId: string) {
    const now = new Date();
    const in30Days = new Date(now);
    in30Days.setDate(in30Days.getDate() + 30);

    try {
      const [totalCommittees, totalMembers, expiringSoon, activeMembers] =
        await Promise.all([
          this.db().governanceCommittee.count({
            where: { tenantId, status: 'ACTIVE' },
          }),
          this.db().governanceCommitteeMember.count({
            where: { tenantId, status: 'ACTIVE' },
          }),
          this.db().governanceCommitteeMember.count({
            where: {
              tenantId,
              status: 'ACTIVE',
              endDate: { gte: now, lte: in30Days },
            },
          }),
          this.db().governanceCommitteeMember.findMany({
            where: {
              tenantId,
              status: 'ACTIVE',
              staffProfileId: { not: null },
            },
            select: { staffProfileId: true },
          }),
        ]);

      const staffIds = (activeMembers as { staffProfileId: string | null }[])
        .map((m) => m.staffProfileId)
        .filter((id): id is string => Boolean(id));
      let membersNeedingReplacement = 0;
      if (staffIds.length) {
        membersNeedingReplacement = await this.prisma.staffProfile.count({
          where: {
            tenantId,
            id: { in: staffIds },
            status: { in: [...TERMINAL_STAFF] },
          },
        });
      }

      return {
        totalCommittees,
        totalMembers,
        expiringSoon,
        membersNeedingReplacement,
      };
    } catch {
      const [totalCommittees, totalMembers] = await Promise.all([
        this.db().governanceCommittee.count({
          where: { tenantId, status: 'ACTIVE' },
        }),
        this.db().governanceCommitteeMember.count({
          where: { tenantId, status: 'ACTIVE' },
        }),
      ]);
      return {
        totalCommittees,
        totalMembers,
        expiringSoon: 0,
        membersNeedingReplacement: 0,
      };
    }
  }

  async create(user: JwtUser, dto: CreateMemberDto) {
    const committee = await this.committees.getById(user.tid, dto.committeeId);
    let data: Record<string, unknown> = {
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
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      isExternal: dto.isExternal ?? false,
    };

    if (dto.staffProfileId) {
      await this.assertNoDuplicateActive(
        user.tid,
        dto.committeeId,
        dto.staffProfileId,
      );
      const staff = await this.resolveStaff(user.tid, dto.staffProfileId);
      data = {
        ...data,
        displayName: staff.displayName,
        employeeCode: staff.employeeCode,
        departmentName: staff.departmentName,
        designation: staff.designation ?? dto.designation,
        mobile: staff.mobile ?? dto.mobile,
        email: staff.email?.toLowerCase() ?? dto.email?.toLowerCase(),
        userId: staff.userId ?? dto.userId,
        isExternal: false,
      };
    }

    const created = await this.db().governanceCommitteeMember.create({ data });
    if (created.userId) {
      await this.notifications.notifyMemberAssigned(user.tid, {
        userId: created.userId,
        committeeName: committee.name,
        role: created.role,
      });
    }
    return created;
  }

  async update(user: JwtUser, id: string, dto: UpdateMemberDto) {
    const existing = await this.getById(user.tid, id);
    const updated = await this.db().governanceCommitteeMember.update({
      where: { id },
      data: {
        displayName: dto.displayName?.trim(),
        role: dto.role,
        designation: dto.designation,
        mobile: dto.mobile,
        email: dto.email?.toLowerCase(),
        status: dto.status,
        joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        isExternal: dto.isExternal,
      },
    });

    if (dto.status && dto.status !== 'ACTIVE' && existing.userId) {
      await this.notifications.notifyMemberEnded(user.tid, {
        userId: existing.userId,
        committeeName: String(existing.committeeName ?? 'Committee'),
      });
    }

    return updated;
  }

  async remove(user: JwtUser, id: string) {
    const existing = await this.getById(user.tid, id);
    const updated = await this.db().governanceCommitteeMember.update({
      where: { id },
      data: { status: 'INACTIVE', endDate: new Date() },
    });
    if (existing.userId) {
      await this.notifications.notifyMemberEnded(user.tid, {
        userId: existing.userId,
        committeeName: String(existing.committeeName ?? 'Committee'),
      });
    }
    return updated;
  }

  async deactivate(user: JwtUser, id: string) {
    return this.remove(user, id);
  }

  async replaceMember(user: JwtUser, id: string, dto: ReplaceMemberDto) {
    const oldMember = await this.db().governanceCommitteeMember.findFirst({
      where: { id, tenantId: user.tid },
      include: { committee: { select: { id: true, name: true } } },
    });
    if (!oldMember) throw new NotFoundException('Member not found');
    if (oldMember.status !== 'ACTIVE') {
      throw new BadRequestException('Only active members can be replaced');
    }

    await this.assertNoDuplicateActive(
      user.tid,
      oldMember.committeeId,
      dto.staffProfileId,
    );

    const staff = await this.resolveStaff(user.tid, dto.staffProfileId);
    const previousEnd = dto.endDateForPrevious
      ? new Date(dto.endDateForPrevious)
      : new Date();
    const nextStart = dto.startDate
      ? new Date(dto.startDate)
      : new Date(previousEnd.getTime() + 86_400_000);

    const newMember = await this.db().governanceCommitteeMember.create({
      data: {
        tenantId: user.tid,
        committeeId: oldMember.committeeId,
        displayName: staff.displayName,
        employeeCode: staff.employeeCode,
        departmentName: staff.departmentName,
        designation: staff.designation,
        mobile: staff.mobile,
        email: staff.email?.toLowerCase(),
        userId: staff.userId,
        staffProfileId: dto.staffProfileId,
        role: dto.role,
        joiningDate: nextStart,
        status: 'ACTIVE',
        isExternal: false,
      },
    });

    await this.db().governanceCommitteeMember.update({
      where: { id: oldMember.id },
      data: {
        status: 'REPLACED',
        endDate: previousEnd,
        replacedByMemberId: newMember.id,
      },
    });

    if (oldMember.userId) {
      await this.notifications.notifyMemberEnded(user.tid, {
        userId: oldMember.userId,
        committeeName: oldMember.committee.name,
      });
    }
    if (newMember.userId) {
      await this.notifications.notifyMemberAssigned(user.tid, {
        userId: newMember.userId,
        committeeName: oldMember.committee.name,
        role: newMember.role,
      });
    }

    return { previous: oldMember, replacement: newMember };
  }

  async bulkAssign(user: JwtUser, dto: BulkAssignMembersDto) {
    await this.committees.getById(user.tid, dto.committeeId);
    const created = [];
    for (const member of dto.members) {
      created.push(
        await this.create(user, { ...member, committeeId: dto.committeeId }),
      );
    }
    return { count: created.length, items: created };
  }

  async handleStaffRelieved(tenantId: string, staffProfileId: string) {
    const memberships = (await this.db().governanceCommitteeMember.findMany({
      where: { tenantId, staffProfileId, status: 'ACTIVE' },
      include: { committee: { select: { name: true } } },
    })) as Array<{ committee: { name: string } }>;
    if (!memberships.length) return { committees: [] as string[] };

    const names = memberships.map((m) => m.committee.name);
    await this.notifications.notifyReplacementRequired(tenantId, {
      staffProfileId,
      committeeNames: names,
    });
    return { committees: names };
  }
}
