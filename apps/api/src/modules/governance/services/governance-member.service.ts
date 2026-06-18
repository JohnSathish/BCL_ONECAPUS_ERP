import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import {
  GOVERNANCE_EX_OFFICIO_DESIGNATION_CODES,
  GOVERNANCE_NAAC_COMPOSITION_RULES,
  paginate,
  type GOVERNANCE_EX_OFFICIO_POSITIONS,
} from '../constants/governance.constants';
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
  memberType: string;
  organization: string | null;
  address: string | null;
  areaOfExpertise: string | null;
  exOfficioPosition: string | null;
  studentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  committee?: { name?: string; shortCode?: string };
};

type MappedMember = MemberWithCommittee & {
  committeeName?: string;
  committeeShortCode?: string;
  gender?: string | null;
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

  private inferMemberType(row: {
    memberType?: string | null;
    isExternal?: boolean;
    staffProfileId?: string | null;
    studentId?: string | null;
    exOfficioPosition?: string | null;
  }) {
    if (row.memberType) return row.memberType;
    if (row.exOfficioPosition) return 'EX_OFFICIO';
    if (row.studentId) return 'STUDENT_REPRESENTATIVE';
    if (row.isExternal) return 'EXTERNAL';
    if (row.staffProfileId) return 'INTERNAL_STAFF';
    return 'EXTERNAL';
  }

  private defaultRoleForMemberType(memberType: string) {
    switch (memberType) {
      case 'STUDENT_REPRESENTATIVE':
        return 'STUDENT_REPRESENTATIVE';
      case 'ALUMNI_REPRESENTATIVE':
        return 'ALUMNI_REPRESENTATIVE';
      case 'PARENT_REPRESENTATIVE':
        return 'PARENT_REPRESENTATIVE';
      case 'INDUSTRY_EXPERT':
        return 'INDUSTRY_EXPERT';
      case 'EX_OFFICIO':
        return 'EX_OFFICIO';
      case 'EXTERNAL':
        return 'EXTERNAL_EXPERT';
      default:
        return 'MEMBER';
    }
  }

  private async resolveStudent(
    tenantId: string,
    studentId: string,
  ): Promise<{
    displayName: string;
    email?: string;
    mobile?: string;
    departmentName?: string;
    userId?: string;
  }> {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId, deletedAt: null },
      include: {
        user: { select: { id: true, email: true } },
        masterProfile: true,
        programVersion: {
          include: { program: { select: { name: true } } },
        },
        department: { select: { name: true } },
      },
    });
    if (!student) throw new BadRequestException('Student not found');
    return {
      displayName: student.masterProfile?.fullName ?? student.enrollmentNumber,
      email: student.masterProfile?.email ?? student.user.email,
      mobile: student.masterProfile?.mobileNumber ?? undefined,
      departmentName:
        student.department?.name ?? student.programVersion?.program?.name,
      userId: student.userId,
    };
  }

  private async resolveExOfficioPosition(
    tenantId: string,
    position: string,
  ): Promise<StaffSnapshot & { staffProfileId: string }> {
    const codes = GOVERNANCE_EX_OFFICIO_DESIGNATION_CODES[
      position as (typeof GOVERNANCE_EX_OFFICIO_POSITIONS)[number]
    ] ?? [position];

    const staff = await this.prisma.staffProfile.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        status: 'ACTIVE',
        designation: {
          code: { in: codes, mode: 'insensitive' },
        },
      },
      include: {
        department: { select: { name: true } },
        designation: { select: { label: true, code: true } },
      },
      orderBy: { joiningDate: 'desc' },
    });

    if (!staff) {
      throw new BadRequestException(
        `No active staff found for ex-officio position: ${position.replace(/_/g, ' ')}`,
      );
    }

    return {
      staffProfileId: staff.id,
      displayName: staff.fullName,
      employeeCode: staff.employeeCode,
      departmentName: staff.department?.name ?? undefined,
      designation: staff.designation?.label ?? position.replace(/_/g, ' '),
      mobile: staff.mobile ?? undefined,
      email: staff.email ?? undefined,
      userId: staff.portalUserId ?? undefined,
      staffStatus: staff.status,
    };
  }

  private async enrichMemberRow(
    tenantId: string,
    row: MemberWithCommittee,
  ): Promise<MappedMember> {
    const mapped = this.mapMember(row);
    mapped.memberType = this.inferMemberType(row);

    if (mapped.memberType === 'EX_OFFICIO' && row.exOfficioPosition) {
      try {
        const resolved = await this.resolveExOfficioPosition(
          tenantId,
          row.exOfficioPosition,
        );
        mapped.displayName = resolved.displayName;
        mapped.employeeCode = resolved.employeeCode ?? mapped.employeeCode;
        mapped.departmentName =
          resolved.departmentName ?? mapped.departmentName;
        mapped.designation = resolved.designation ?? mapped.designation;
        mapped.mobile = resolved.mobile ?? mapped.mobile;
        mapped.email = resolved.email ?? mapped.email;
        mapped.staffProfileId = resolved.staffProfileId;
        if (resolved.staffProfileId) {
          const staff = await this.prisma.staffProfile.findFirst({
            where: { id: resolved.staffProfileId },
            select: { gender: true },
          });
          mapped.gender = staff?.gender ?? null;
        }
      } catch {
        /* keep stored snapshot if position holder not found */
      }
    } else if (row.staffProfileId) {
      const staff = await this.prisma.staffProfile.findFirst({
        where: { id: row.staffProfileId },
        select: { gender: true },
      });
      mapped.gender = staff?.gender ?? null;
    } else if (row.studentId) {
      const student = await this.prisma.student.findFirst({
        where: { id: row.studentId },
        include: { masterProfile: { select: { gender: true } } },
      });
      mapped.gender = student?.masterProfile?.gender ?? null;
    }

    return mapped;
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

    const items = await Promise.all(
      rows.map(async (row) => {
        const mapped = await this.enrichMemberRow(tenantId, row);
        const staffStatus = row.staffProfileId
          ? staffStatusById.get(row.staffProfileId)
          : undefined;
        return {
          ...mapped,
          replacementRequired:
            row.status === 'ACTIVE' &&
            mapped.memberType === 'INTERNAL_STAFF' &&
            Boolean(
              staffStatus &&
              TERMINAL_STAFF.includes(
                staffStatus as (typeof TERMINAL_STAFF)[number],
              ),
            ),
        };
      }),
    );

    return { items, total, page, limit };
  }

  async getById(tenantId: string, id: string): Promise<MappedMember> {
    const row = (await this.db().governanceCommitteeMember.findFirst({
      where: { id, tenantId },
      include: { committee: { select: { name: true, shortCode: true } } },
    })) as MemberWithCommittee | null;
    if (!row) throw new NotFoundException('Member not found');
    return this.enrichMemberRow(tenantId, row);
  }

  async listByCommittee(tenantId: string, committeeId: string) {
    await this.committees.getById(tenantId, committeeId);
    const rows = (await this.db().governanceCommitteeMember.findMany({
      where: { tenantId, committeeId, status: { not: 'INACTIVE' } },
      orderBy: [{ role: 'asc' }, { displayName: 'asc' }],
      include: { committee: { select: { name: true, shortCode: true } } },
    })) as MemberWithCommittee[];
    return Promise.all(rows.map((r) => this.enrichMemberRow(tenantId, r)));
  }

  async listHistory(tenantId: string, committeeId: string) {
    await this.committees.getById(tenantId, committeeId);
    const rows = (await this.db().governanceCommitteeMember.findMany({
      where: { tenantId, committeeId },
      orderBy: [{ joiningDate: 'desc' }, { createdAt: 'desc' }],
      include: { committee: { select: { name: true, shortCode: true } } },
    })) as MemberWithCommittee[];
    return Promise.all(rows.map((r) => this.enrichMemberRow(tenantId, r)));
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
    return Promise.all(rows.map((r) => this.enrichMemberRow(tenantId, r)));
  }

  async getComposition(tenantId: string, committeeId: string) {
    const committee = await this.committees.getById(tenantId, committeeId);
    const members = await this.listByCommittee(tenantId, committeeId);
    const active = members.filter((m) => m.status === 'ACTIVE');

    const byType: Record<string, number> = {};
    for (const m of active) {
      const type = m.memberType ?? this.inferMemberType(m);
      byType[type] = (byType[type] ?? 0) + 1;
    }

    const naac = this.validateNaacComposition(committee.shortCode, active);

    return {
      committeeId,
      committeeName: committee.name,
      shortCode: committee.shortCode,
      totalMembers: active.length,
      internalStaff: byType.INTERNAL_STAFF ?? 0,
      externalMembers:
        (byType.EXTERNAL ?? 0) +
        (byType.INDUSTRY_EXPERT ?? 0) +
        (byType.ALUMNI_REPRESENTATIVE ?? 0) +
        (byType.PARENT_REPRESENTATIVE ?? 0),
      studentMembers: byType.STUDENT_REPRESENTATIVE ?? 0,
      exOfficio: byType.EX_OFFICIO ?? 0,
      alumniRepresentatives: byType.ALUMNI_REPRESENTATIVE ?? 0,
      parentRepresentatives: byType.PARENT_REPRESENTATIVE ?? 0,
      industryExperts: byType.INDUSTRY_EXPERT ?? 0,
      byType,
      naacCompliance: naac,
    };
  }

  validateNaacComposition(
    shortCode: string,
    activeMembers: Array<{
      role: string;
      memberType?: string;
      isExternal?: boolean;
      displayName?: string;
      gender?: string | null;
    }>,
  ) {
    const key = shortCode.toUpperCase();
    const rule =
      GOVERNANCE_NAAC_COMPOSITION_RULES[key] ??
      (key.includes('ICC') || key.includes('POSH')
        ? GOVERNANCE_NAAC_COMPOSITION_RULES.ICC
        : undefined) ??
      (key.includes('IQAC')
        ? GOVERNANCE_NAAC_COMPOSITION_RULES.IQAC
        : undefined) ??
      (key.includes('RAGGING')
        ? GOVERNANCE_NAAC_COMPOSITION_RULES.ANTI_RAGGING
        : undefined);

    if (!rule) {
      return {
        applicable: false,
        complete: activeMembers.length > 0,
        checks: [],
        message:
          activeMembers.length > 0
            ? 'No statutory composition rules configured for this committee.'
            : 'No active members yet.',
      };
    }

    const checks: Array<{
      id: string;
      label: string;
      passed: boolean;
      detail?: string;
    }> = [];

    const hasRequiredRole = rule.requiredRoles.some((required) =>
      activeMembers.some(
        (m) =>
          m.role === required ||
          m.role === 'CONVENER' ||
          m.role === 'CHAIRPERSON',
      ),
    );
    checks.push({
      id: 'required_role',
      label: `Required leadership role (${rule.requiredRoles.join(' or ')})`,
      passed: hasRequiredRole,
    });

    const externalCount = activeMembers.filter(
      (m) =>
        m.isExternal ||
        [
          'EXTERNAL',
          'INDUSTRY_EXPERT',
          'ALUMNI_REPRESENTATIVE',
          'PARENT_REPRESENTATIVE',
        ].includes(m.memberType ?? '') ||
        m.role === 'EXTERNAL_EXPERT' ||
        m.role === 'LEGAL_EXPERT',
    ).length;

    if (rule.requireExternal) {
      checks.push({
        id: 'external_member',
        label: 'External member present',
        passed: externalCount > 0,
        detail: `${externalCount} external member(s)`,
      });
    }

    if (rule.requireFemalePresiding) {
      const presiding = activeMembers.filter((m) =>
        ['CHAIRPERSON', 'COORDINATOR', 'CONVENER'].includes(m.role),
      );
      const femalePresiding = presiding.some((m) =>
        (m.gender ?? '').toUpperCase().startsWith('F'),
      );
      checks.push({
        id: 'female_presiding',
        label: 'Female presiding officer present',
        passed: femalePresiding,
      });
    }

    const minOk = activeMembers.length >= rule.minMembers;
    checks.push({
      id: 'min_members',
      label: `Minimum ${rule.minMembers} members`,
      passed: minOk,
      detail: `${activeMembers.length} active`,
    });

    const complete = checks.every((c) => c.passed);

    return {
      applicable: true,
      ruleLabel: rule.label,
      complete,
      checks,
      message: complete
        ? 'Committee composition meets configured NAAC requirements.'
        : 'Committee composition incomplete — review missing requirements.',
    };
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
    const memberType =
      dto.memberType ??
      (dto.isExternal
        ? 'EXTERNAL'
        : dto.exOfficioPosition
          ? 'EX_OFFICIO'
          : dto.studentId
            ? 'STUDENT_REPRESENTATIVE'
            : dto.staffProfileId
              ? 'INTERNAL_STAFF'
              : 'EXTERNAL');

    const role = dto.role || this.defaultRoleForMemberType(memberType);

    let data: Record<string, unknown> = {
      tenantId: user.tid,
      committeeId: dto.committeeId,
      displayName: dto.displayName.trim(),
      role,
      memberType,
      staffProfileId: null,
      studentId: null,
      userId: dto.userId,
      designation: dto.designation,
      mobile: dto.mobile,
      email: dto.email?.toLowerCase(),
      organization: dto.organization,
      address: dto.address,
      areaOfExpertise: dto.areaOfExpertise,
      exOfficioPosition: dto.exOfficioPosition,
      joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : new Date(),
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      isExternal: [
        'EXTERNAL',
        'INDUSTRY_EXPERT',
        'ALUMNI_REPRESENTATIVE',
        'PARENT_REPRESENTATIVE',
      ].includes(memberType),
    };

    if (memberType === 'INTERNAL_STAFF') {
      if (!dto.staffProfileId) {
        throw new BadRequestException(
          'Staff profile is required for internal members',
        );
      }
      await this.assertNoDuplicateActive(
        user.tid,
        dto.committeeId,
        dto.staffProfileId,
      );
      const staff = await this.resolveStaff(user.tid, dto.staffProfileId);
      data = {
        ...data,
        staffProfileId: dto.staffProfileId,
        displayName: staff.displayName,
        employeeCode: staff.employeeCode,
        departmentName: staff.departmentName,
        designation: staff.designation ?? dto.designation,
        mobile: staff.mobile ?? dto.mobile,
        email: staff.email?.toLowerCase() ?? dto.email?.toLowerCase(),
        userId: staff.userId ?? dto.userId,
        isExternal: false,
      };
    } else if (memberType === 'EX_OFFICIO') {
      if (!dto.exOfficioPosition) {
        throw new BadRequestException('Ex-officio position is required');
      }
      const resolved = await this.resolveExOfficioPosition(
        user.tid,
        dto.exOfficioPosition,
      );
      await this.assertNoDuplicateActive(
        user.tid,
        dto.committeeId,
        resolved.staffProfileId,
      );
      data = {
        ...data,
        exOfficioPosition: dto.exOfficioPosition,
        staffProfileId: resolved.staffProfileId,
        displayName: resolved.displayName,
        employeeCode: resolved.employeeCode,
        departmentName: resolved.departmentName,
        designation: resolved.designation,
        mobile: resolved.mobile,
        email: resolved.email?.toLowerCase(),
        userId: resolved.userId,
        isExternal: false,
        role: dto.role || 'EX_OFFICIO',
      };
    } else if (memberType === 'STUDENT_REPRESENTATIVE') {
      if (!dto.studentId) {
        throw new BadRequestException(
          'Student is required for student representative',
        );
      }
      const student = await this.resolveStudent(user.tid, dto.studentId);
      data = {
        ...data,
        studentId: dto.studentId,
        displayName: student.displayName,
        email: student.email?.toLowerCase(),
        mobile: student.mobile,
        departmentName: student.departmentName,
        userId: student.userId,
        isExternal: false,
        role: dto.role || 'STUDENT_REPRESENTATIVE',
      };
    } else {
      if (!dto.displayName?.trim()) {
        throw new BadRequestException('Full name is required');
      }
      if (!dto.designation?.trim()) {
        throw new BadRequestException(
          'Designation is required for external members',
        );
      }
      data = {
        ...data,
        displayName: dto.displayName.trim(),
        designation: dto.designation,
        organization: dto.organization,
        address: dto.address,
        areaOfExpertise: dto.areaOfExpertise,
        mobile: dto.mobile,
        email: dto.email?.toLowerCase(),
        isExternal: true,
        role: dto.role || this.defaultRoleForMemberType(memberType),
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
        memberType: dto.memberType,
        organization: dto.organization,
        address: dto.address,
        areaOfExpertise: dto.areaOfExpertise,
        exOfficioPosition: dto.exOfficioPosition,
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

    const memberType =
      dto.memberType ?? this.inferMemberType(oldMember as MemberWithCommittee);

    const createDto: CreateMemberDto = {
      committeeId: oldMember.committeeId,
      displayName: dto.displayName ?? oldMember.displayName,
      role: dto.role,
      memberType,
      staffProfileId: dto.staffProfileId,
      studentId: dto.studentId,
      designation: dto.designation,
      organization: dto.organization,
      mobile: dto.mobile,
      email: dto.email,
      address: dto.address,
      areaOfExpertise: dto.areaOfExpertise,
      exOfficioPosition:
        dto.exOfficioPosition ?? oldMember.exOfficioPosition ?? undefined,
      joiningDate: dto.startDate,
    };

    const previousEnd = dto.endDateForPrevious
      ? new Date(dto.endDateForPrevious)
      : new Date();
    const nextStart = dto.startDate
      ? new Date(dto.startDate)
      : new Date(previousEnd.getTime() + 86_400_000);

    if (memberType === 'INTERNAL_STAFF' || memberType === 'EX_OFFICIO') {
      if (memberType === 'INTERNAL_STAFF' && !dto.staffProfileId) {
        throw new BadRequestException('Select replacement staff member');
      }
    } else if (!dto.displayName?.trim()) {
      throw new BadRequestException('Replacement member name is required');
    }

    createDto.joiningDate = nextStart.toISOString().slice(0, 10);
    const replacement = await this.create(user, createDto);

    await this.db().governanceCommitteeMember.update({
      where: { id: oldMember.id },
      data: {
        status: 'REPLACED',
        endDate: previousEnd,
        replacedByMemberId: replacement.id,
      },
    });

    if (oldMember.userId) {
      await this.notifications.notifyMemberEnded(user.tid, {
        userId: oldMember.userId,
        committeeName: oldMember.committee.name,
      });
    }

    return { previous: oldMember, replacement };
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
