import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import {
  BulkStaffPayAssignmentDto,
  CreateSalaryRevisionDto,
  CreateStaffPayAssignmentDto,
  UpdatePayAssignmentStatutoryDto,
} from '../dto/payroll.dto';
import {
  buildAssignmentOverrides,
  mergeStatutoryOverrides,
  parseAssignmentOverrides,
} from './pay-statutory-overrides';
import { StaffPfConfigService } from './staff-pf-config.service';
import { PayrollAuditService } from './payroll-audit.service';

const STAFF_TYPE_TO_SCALE: Record<string, string> = {
  TEACHING: 'COLLEGE_TEACHING',
  NON_TEACHING: 'COLLEGE_NON_TEACHING',
  CONTRACT: 'CONTRACT',
  GUEST: 'GUEST',
  VISITING: 'VISITING',
  ADMIN: 'COLLEGE_NON_TEACHING',
};

const STRUCTURE_TYPE_MAP: Record<string, string> = {
  COLLEGE_TEACHING: 'COLLEGE_TEACHING',
  COLLEGE_NON_TEACHING: 'COLLEGE_NON_TEACHING',
  UGC: 'UGC',
  STATE: 'STATE',
  CONTRACT: 'CONTRACT',
  GUEST: 'GUEST',
  VISITING: 'GUEST',
  DAILY_WAGE: 'DAILY_WAGE',
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function resolveCreatedById(userId?: string) {
  return userId && UUID_RE.test(userId) ? userId : undefined;
}

@Injectable()
export class StaffPayAssignmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pfConfig: StaffPfConfigService,
    private readonly audit: PayrollAuditService,
  ) {}

  private staffInclude = {
    staffProfile: {
      select: {
        id: true,
        fullName: true,
        employeeCode: true,
        staffType: true,
        photoUrl: true,
        basicPay: true,
        mobile: true,
        designation: { select: { id: true, label: true } },
        department: { select: { id: true, name: true } },
      },
    },
    payStructureTemplate: {
      select: { id: true, code: true, name: true, structureType: true },
    },
  } as const;

  list(
    tenantId: string,
    filters: {
      staffProfileId?: string;
      departmentId?: string;
      staffType?: string;
      designationId?: string;
      payScaleType?: string;
      status?: string;
      search?: string;
    } = {},
  ) {
    const search = filters.search?.trim();
    return this.prisma.staffPayAssignment.findMany({
      where: {
        tenantId,
        ...(filters.staffProfileId
          ? { staffProfileId: filters.staffProfileId }
          : {}),
        ...(filters.payScaleType ? { payScaleType: filters.payScaleType } : {}),
        ...(filters.status === 'ALL'
          ? {}
          : filters.status
            ? { status: filters.status }
            : { status: 'ACTIVE' }),
        staffProfile: {
          deletedAt: null,
          ...(filters.departmentId
            ? { departmentId: filters.departmentId }
            : {}),
          ...(filters.staffType
            ? { staffType: filters.staffType as never }
            : {}),
          ...(filters.designationId
            ? { designationId: filters.designationId }
            : {}),
          ...(search
            ? {
                OR: [
                  {
                    fullName: {
                      contains: search,
                      mode: 'insensitive' as const,
                    },
                  },
                  {
                    employeeCode: {
                      contains: search,
                      mode: 'insensitive' as const,
                    },
                  },
                  {
                    mobile: { contains: search, mode: 'insensitive' as const },
                  },
                ],
              }
            : {}),
        },
      },
      include: this.staffInclude,
      orderBy: [
        { staffProfile: { fullName: 'asc' } },
        { effectiveFrom: 'desc' },
      ],
    });
  }

  async stats(tenantId: string) {
    const activeWhere = { tenantId, status: 'ACTIVE' as const };
    const [totalAssigned, byPayScale, assignments] = await Promise.all([
      this.prisma.staffPayAssignment.count({ where: activeWhere }),
      this.prisma.staffPayAssignment.groupBy({
        by: ['payScaleType'],
        where: activeWhere,
        _count: true,
      }),
      this.prisma.staffPayAssignment.findMany({
        where: activeWhere,
        select: { staffProfile: { select: { staffType: true } } },
      }),
    ]);

    const teachingTypes = new Set(['TEACHING', 'VISITING', 'GUEST']);
    let teachingStaff = 0;
    let nonTeachingStaff = 0;
    for (const row of assignments) {
      if (teachingTypes.has(row.staffProfile.staffType)) teachingStaff += 1;
      else nonTeachingStaff += 1;
    }

    const scaleCount = (type: string) =>
      byPayScale.find((r) => r.payScaleType === type)?._count ?? 0;

    return {
      totalAssigned,
      teachingStaff,
      nonTeachingStaff,
      ugcScaleStaff: scaleCount('UGC'),
      stateScaleStaff: scaleCount('STATE'),
      contractStaff:
        scaleCount('CONTRACT') + scaleCount('GUEST') + scaleCount('VISITING'),
      collegeTeachingStaff: scaleCount('COLLEGE_TEACHING'),
      collegeNonTeachingStaff: scaleCount('COLLEGE_NON_TEACHING'),
      byPayScale: byPayScale.map((r) => ({
        payScaleType: r.payScaleType,
        count: r._count,
      })),
    };
  }

  async getActive(tenantId: string, staffProfileId: string, asOf = new Date()) {
    return this.prisma.staffPayAssignment.findFirst({
      where: {
        tenantId,
        staffProfileId,
        status: 'ACTIVE',
        effectiveFrom: { lte: asOf },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
      },
      include: {
        payStructureTemplate: {
          include: {
            components: {
              include: { paySalaryComponent: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async create(user: JwtUser, dto: CreateStaffPayAssignmentDto) {
    await this.prisma.staffPayAssignment.updateMany({
      where: {
        tenantId: user.tid,
        staffProfileId: dto.staffProfileId,
        status: 'ACTIVE',
      },
      data: {
        status: 'ARCHIVED',
        effectiveTo: new Date(dto.effectiveFrom),
      },
    });

    const assignment = await this.prisma.staffPayAssignment.create({
      data: {
        tenantId: user.tid,
        staffProfileId: dto.staffProfileId,
        payStructureTemplateId: dto.payStructureTemplateId,
        payScaleType: dto.payScaleType,
        basicPay: dto.basicPay,
        componentOverrides: (dto.componentOverrides ??
          buildAssignmentOverrides({
            pfExempt: dto.pfExempt,
            houseRent: dto.houseRent,
            cpfRate: dto.cpfRate,
            fixedAllowance: dto.fixedAllowance,
          })) as object | undefined,
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
        notes: dto.notes,
        createdById: resolveCreatedById(user.sub),
      },
      include: this.staffInclude,
    });

    await this.prisma.staffProfile.update({
      where: { id: dto.staffProfileId },
      data: { basicPay: dto.basicPay },
    });

    return assignment;
  }

  async bulkCreate(user: JwtUser, dto: BulkStaffPayAssignmentDto) {
    let staffProfileIds = dto.staffProfileIds ?? [];
    if (staffProfileIds.length === 0) {
      const rows = await this.prisma.staffProfile.findMany({
        where: {
          tenantId: user.tid,
          deletedAt: null,
          status: 'ACTIVE',
          ...(dto.departmentId ? { departmentId: dto.departmentId } : {}),
          ...(dto.staffType ? { staffType: dto.staffType as never } : {}),
        },
        select: { id: true, basicPay: true },
      });
      staffProfileIds = rows.map((r) => r.id);
    }

    if (staffProfileIds.length === 0) {
      throw new BadRequestException(
        'No staff match the bulk assignment filters.',
      );
    }

    let created = 0;
    let skipped = 0;
    for (const staffProfileId of staffProfileIds) {
      const profile = await this.prisma.staffProfile.findFirst({
        where: { id: staffProfileId, tenantId: user.tid, deletedAt: null },
        select: { id: true, basicPay: true },
      });
      if (!profile) continue;

      const basicPay =
        dto.basicPay ??
        (profile.basicPay != null ? Number(profile.basicPay) : null);
      if (basicPay == null || basicPay <= 0) {
        skipped += 1;
        continue;
      }

      await this.create(user, {
        staffProfileId,
        payStructureTemplateId: dto.payStructureTemplateId,
        payScaleType: dto.payScaleType,
        basicPay,
        effectiveFrom: dto.effectiveFrom,
        notes: dto.notes,
      });
      created += 1;
    }

    return { created, skipped, total: staffProfileIds.length };
  }

  async archive(user: JwtUser, assignmentId: string) {
    const assignment = await this.prisma.staffPayAssignment.findFirst({
      where: { id: assignmentId, tenantId: user.tid },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');

    return this.prisma.staffPayAssignment.update({
      where: { id: assignmentId },
      data: {
        status: 'ARCHIVED',
        effectiveTo: new Date(),
      },
      include: this.staffInclude,
    });
  }

  async updateStatutory(
    user: JwtUser,
    assignmentId: string,
    dto: UpdatePayAssignmentStatutoryDto,
  ) {
    const assignment = await this.prisma.staffPayAssignment.findFirst({
      where: { id: assignmentId, tenantId: user.tid, status: 'ACTIVE' },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');

    const componentOverrides = mergeStatutoryOverrides(
      assignment.componentOverrides as Record<string, unknown> | null,
      {
        pfExempt: dto.pfExempt,
        houseRent: dto.houseRent,
        cpfRate: dto.cpfRate,
        fixedAllowance: dto.fixedAllowance,
      },
    );

    const updated = await this.prisma.staffPayAssignment.update({
      where: { id: assignmentId },
      data: { componentOverrides: componentOverrides ?? undefined },
      include: this.staffInclude,
    });

    if (dto.pfExempt !== undefined) {
      const parsed = parseAssignmentOverrides(
        assignment.componentOverrides as Record<string, unknown> | null,
      );
      if (parsed.pfExempt !== dto.pfExempt) {
        await this.pfConfig.syncFromPfExempt(
          user.tid,
          assignment.staffProfileId,
          dto.pfExempt,
          user.sub,
        );
      }
    }

    return updated;
  }

  async createRevision(user: JwtUser, dto: CreateSalaryRevisionDto) {
    const assignment = await this.prisma.staffPayAssignment.findFirst({
      where: { id: dto.staffPayAssignmentId, tenantId: user.tid },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');

    const beforeSnapshot = {
      basicPay: Number(assignment.basicPay),
      payScaleType: assignment.payScaleType,
      effectiveFrom: assignment.effectiveFrom,
    };
    const afterSnapshot = { ...beforeSnapshot, basicPay: dto.newBasicPay };

    await this.prisma.staffPayAssignment.update({
      where: { id: assignment.id },
      data: {
        basicPay: dto.newBasicPay,
        effectiveFrom: new Date(dto.effectiveFrom),
      },
    });

    await this.prisma.staffProfile.update({
      where: { id: assignment.staffProfileId },
      data: { basicPay: dto.newBasicPay },
    });

    const revision = await this.prisma.salaryRevision.create({
      data: {
        tenantId: user.tid,
        staffPayAssignmentId: assignment.id,
        revisionType: dto.revisionType,
        effectiveFrom: new Date(dto.effectiveFrom),
        beforeSnapshot,
        afterSnapshot,
        notes: dto.notes,
        createdById: resolveCreatedById(user.sub),
      },
    });

    await this.audit.log({
      tenantId: user.tid,
      entityType: 'SALARY_REVISION',
      entityId: revision.id,
      action: 'CREATED',
      userId: user.sub,
      oldValue: beforeSnapshot,
      newValue: afterSnapshot,
    });

    return revision;
  }

  listRevisions(tenantId: string, staffProfileId?: string) {
    return this.prisma.salaryRevision.findMany({
      where: {
        tenantId,
        ...(staffProfileId ? { staffPayAssignment: { staffProfileId } } : {}),
      },
      include: {
        staffPayAssignment: {
          include: {
            staffProfile: {
              select: { id: true, fullName: true, employeeCode: true },
            },
            payStructureTemplate: { select: { name: true } },
          },
        },
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async backfillFromProfiles(tenantId: string, userId?: string) {
    const profiles = await this.prisma.staffProfile.findMany({
      where: {
        tenantId,
        basicPay: { not: null },
        deletedAt: null,
        status: 'ACTIVE',
      },
    });
    let created = 0;
    for (const profile of profiles) {
      const existing = await this.prisma.staffPayAssignment.findFirst({
        where: { tenantId, staffProfileId: profile.id, status: 'ACTIVE' },
      });
      if (existing) continue;

      const payScaleType =
        STAFF_TYPE_TO_SCALE[profile.staffType] ?? 'COLLEGE_TEACHING';
      const template = await this.prisma.payStructureTemplate.findFirst({
        where: {
          tenantId,
          structureType: STRUCTURE_TYPE_MAP[payScaleType] ?? 'COLLEGE_TEACHING',
          status: 'ACTIVE',
        },
      });
      if (!template) continue;

      await this.prisma.staffPayAssignment.create({
        data: {
          tenantId,
          staffProfileId: profile.id,
          payStructureTemplateId: template.id,
          payScaleType,
          basicPay: profile.basicPay!,
          effectiveFrom: profile.joiningDate ?? new Date(),
          createdById: resolveCreatedById(userId),
        },
      });
      created++;
    }
    return { created, total: profiles.length };
  }
}
