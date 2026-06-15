import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import {
  CreateReplacementAssignmentDto,
  EndReplacementAssignmentDto,
  ReplacementAssignmentQueryDto,
} from '../dto/substitute-staff.dto';
import { SubstituteStaffService } from './substitute-staff.service';

const REASON_LABELS: Record<string, string> = {
  STUDY_LEAVE: 'Study Leave',
  PHD_LEAVE: 'PhD Study Leave',
  MATERNITY_LEAVE: 'Maternity Leave',
  MEDICAL_LEAVE: 'Medical Leave',
  FDP: 'Faculty Development Program',
  RESEARCH_FELLOWSHIP: 'Research Fellowship',
  SABBATICAL: 'Sabbatical Leave',
  DEPUTATION: 'Deputation',
  OTHER: 'Other',
};

@Injectable()
export class ReplacementAssignmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly substituteStaff: SubstituteStaffService,
  ) {}

  reasonLabel(reason: string): string {
    return REASON_LABELS[reason] ?? reason;
  }

  async dashboardSummary(tenantId: string) {
    const today = new Date();
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const [active, studyLeave, maternity, expiringThisMonth] =
      await Promise.all([
        this.prisma.replacementAssignment.count({
          where: { tenantId, status: 'ACTIVE' },
        }),
        this.prisma.replacementAssignment.count({
          where: {
            tenantId,
            status: 'ACTIVE',
            reason: { in: ['STUDY_LEAVE', 'PHD_LEAVE', 'SABBATICAL'] },
          },
        }),
        this.prisma.replacementAssignment.count({
          where: { tenantId, status: 'ACTIVE', reason: 'MATERNITY_LEAVE' },
        }),
        this.prisma.replacementAssignment.count({
          where: {
            tenantId,
            status: 'ACTIVE',
            endDate: { gte: today, lte: monthEnd },
          },
        }),
      ]);
    return {
      activeAssignments: active,
      studyLeaveFaculty: studyLeave,
      maternityLeaveFaculty: maternity,
      expiringThisMonth,
    };
  }

  async list(tenantId: string, query: ReplacementAssignmentQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const today = new Date();
    const soon = new Date();
    soon.setDate(soon.getDate() + 30);

    const where: Prisma.ReplacementAssignmentWhereInput = {
      tenantId,
      ...(query.originalStaffProfileId
        ? { originalStaffProfileId: query.originalStaffProfileId }
        : {}),
      ...(query.substituteStaffId
        ? { substituteStaffId: query.substituteStaffId }
        : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.reason ? { reason: query.reason } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.fromDate
        ? { startDate: { gte: new Date(query.fromDate) } }
        : {}),
      ...(query.toDate ? { endDate: { lte: new Date(query.toDate) } } : {}),
      ...(query.expiringSoon
        ? { status: 'ACTIVE', endDate: { gte: today, lte: soon } }
        : {}),
      ...(query.search
        ? {
            OR: [
              {
                originalStaff: {
                  fullName: { contains: query.search, mode: 'insensitive' },
                },
              },
              {
                substitute: {
                  fullName: { contains: query.search, mode: 'insensitive' },
                },
              },
              {
                assignmentCode: { contains: query.search, mode: 'insensitive' },
              },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.replacementAssignment.findMany({
        where,
        include: this.defaultInclude(),
        orderBy: [{ status: 'asc' }, { endDate: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.replacementAssignment.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.toRow(row)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getActiveForOriginalStaff(
    tenantId: string,
    originalStaffProfileId: string,
  ) {
    const row = await this.prisma.replacementAssignment.findFirst({
      where: { tenantId, originalStaffProfileId, status: 'ACTIVE' },
      include: this.defaultInclude(),
      orderBy: { startDate: 'desc' },
    });
    return row ? this.toRow(row) : null;
  }

  async create(user: JwtUser, dto: CreateReplacementAssignmentDto) {
    if (new Date(dto.endDate) < new Date(dto.startDate)) {
      throw new BadRequestException('End date must be on or after start date');
    }

    const original = await this.prisma.staffProfile.findFirst({
      where: {
        id: dto.originalStaffProfileId,
        tenantId: user.tid,
        deletedAt: null,
      },
      include: { department: { select: { id: true, name: true } } },
    });
    if (!original)
      throw new NotFoundException('Original staff member not found');

    const overlapping = await this.prisma.replacementAssignment.findFirst({
      where: {
        tenantId: user.tid,
        originalStaffProfileId: dto.originalStaffProfileId,
        status: 'ACTIVE',
      },
    });
    if (overlapping) {
      throw new BadRequestException(
        'Original staff already has an active replacement assignment',
      );
    }

    let substituteStaffId = dto.substituteStaffId;
    if (!substituteStaffId) {
      if (!dto.createSubstitute) {
        throw new BadRequestException(
          'Select an existing substitute or provide createSubstitute details',
        );
      }
      const created = await this.substituteStaff.create(user, {
        ...dto.createSubstitute,
        departmentId:
          dto.createSubstitute.departmentId ??
          dto.departmentId ??
          original.departmentId ??
          undefined,
      });
      substituteStaffId = created.id;
    }

    const count = await this.prisma.replacementAssignment.count({
      where: { tenantId: user.tid },
    });
    const assignmentCode = `REP-${String(count + 1).padStart(4, '0')}`;

    const assignment = await this.prisma.replacementAssignment.create({
      data: {
        tenantId: user.tid,
        assignmentCode,
        originalStaffProfileId: dto.originalStaffProfileId,
        substituteStaffId,
        reason: dto.reason,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        departmentId: dto.departmentId ?? original.departmentId,
        salaryArrangement: dto.salaryArrangement,
        monthlyAgreedAmount: dto.monthlyAgreedAmount,
        fullWorkloadTransfer: dto.fullWorkloadTransfer ?? false,
        remarks: dto.remarks,
        leaveApplicationId: dto.leaveApplicationId,
        status: 'ACTIVE',
        createdById: user.sub,
        approvedById: user.sub,
        approvedAt: new Date(),
        subjects: dto.subjects?.length
          ? {
              create: dto.subjects.map((subject) => ({
                tenantId: user.tid,
                courseId: subject.courseId,
                offeringSectionId: subject.offeringSectionId,
                subjectLabel: subject.subjectLabel,
                notes: subject.notes,
              })),
            }
          : undefined,
      },
      include: this.defaultInclude(),
    });

    await this.writeAudit(
      user.tid,
      assignment.id,
      'CREATED',
      user.sub,
      null,
      assignment,
    );
    await this.applyStaffLeaveStatus(
      user.tid,
      original.id,
      dto.reason,
      dto.startDate,
      dto.endDate,
    );

    return this.toRow(assignment);
  }

  async complete(
    user: JwtUser,
    assignmentId: string,
    dto: EndReplacementAssignmentDto,
  ) {
    const assignment = await this.prisma.replacementAssignment.findFirst({
      where: { id: assignmentId, tenantId: user.tid, status: 'ACTIVE' },
      include: this.defaultInclude(),
    });
    if (!assignment) throw new NotFoundException('Active assignment not found');

    const updated = await this.prisma.replacementAssignment.update({
      where: { id: assignmentId },
      data: {
        status: 'COMPLETED',
        endedAt: new Date(),
        endedById: user.sub,
        remarks: dto.remarks
          ? `${assignment.remarks ?? ''}\n${dto.remarks}`.trim()
          : assignment.remarks,
      },
      include: this.defaultInclude(),
    });

    await this.writeAudit(
      user.tid,
      assignmentId,
      'COMPLETED',
      user.sub,
      assignment,
      updated,
    );
    await this.restoreOriginalStaffStatus(
      user.tid,
      assignment.originalStaffProfileId,
    );

    return this.toRow(updated);
  }

  async cancel(
    user: JwtUser,
    assignmentId: string,
    dto: EndReplacementAssignmentDto,
  ) {
    const assignment = await this.prisma.replacementAssignment.findFirst({
      where: { id: assignmentId, tenantId: user.tid, status: 'ACTIVE' },
      include: this.defaultInclude(),
    });
    if (!assignment) throw new NotFoundException('Active assignment not found');

    const updated = await this.prisma.replacementAssignment.update({
      where: { id: assignmentId },
      data: {
        status: 'CANCELLED',
        endedAt: new Date(),
        endedById: user.sub,
        remarks: dto.remarks
          ? `${assignment.remarks ?? ''}\n${dto.remarks}`.trim()
          : assignment.remarks,
      },
      include: this.defaultInclude(),
    });

    await this.writeAudit(
      user.tid,
      assignmentId,
      'CANCELLED',
      user.sub,
      assignment,
      updated,
    );
    await this.restoreOriginalStaffStatus(
      user.tid,
      assignment.originalStaffProfileId,
    );

    return this.toRow(updated);
  }

  async processExpiringAssignments(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expired = await this.prisma.replacementAssignment.findMany({
      where: { tenantId, status: 'ACTIVE', endDate: { lt: today } },
      include: this.defaultInclude(),
    });

    for (const assignment of expired) {
      const updated = await this.prisma.replacementAssignment.update({
        where: { id: assignment.id },
        data: { status: 'COMPLETED', endedAt: new Date() },
        include: this.defaultInclude(),
      });
      await this.writeAudit(
        tenantId,
        assignment.id,
        'AUTO_COMPLETED',
        null,
        assignment,
        updated,
      );
      await this.restoreOriginalStaffStatus(
        tenantId,
        assignment.originalStaffProfileId,
      );
    }

    return { completed: expired.length };
  }

  async reports(tenantId: string, type: 'active' | 'study-leave' | 'history') {
    const where: Prisma.ReplacementAssignmentWhereInput = { tenantId };
    if (type === 'active') where.status = 'ACTIVE';
    if (type === 'study-leave') {
      where.reason = {
        in: [
          'STUDY_LEAVE',
          'PHD_LEAVE',
          'SABBATICAL',
          'FDP',
          'RESEARCH_FELLOWSHIP',
        ],
      };
    }

    const rows = await this.prisma.replacementAssignment.findMany({
      where,
      include: this.defaultInclude(),
      orderBy: [{ status: 'asc' }, { endDate: 'desc' }],
      take: 500,
    });
    return rows.map((row) => this.toRow(row));
  }

  private defaultInclude() {
    return {
      originalStaff: {
        select: {
          id: true,
          fullName: true,
          employeeCode: true,
          department: { select: { id: true, name: true } },
        },
      },
      substitute: {
        select: {
          id: true,
          fullName: true,
          substituteCode: true,
          mobile: true,
          email: true,
        },
      },
      department: { select: { id: true, name: true } },
      subjects: true,
    } as const;
  }

  private async applyStaffLeaveStatus(
    tenantId: string,
    staffProfileId: string,
    reason: string,
    startDate: string,
    endDate: string,
  ) {
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (now < start || now > end) return;

    await this.prisma.staffProfile.update({
      where: { id: staffProfileId },
      data: {
        status: reason === 'MATERNITY_LEAVE' ? 'ON_LEAVE' : 'ON_LEAVE',
      },
    });
  }

  private async restoreOriginalStaffStatus(
    tenantId: string,
    staffProfileId: string,
  ) {
    const stillActive = await this.prisma.replacementAssignment.findFirst({
      where: {
        tenantId,
        originalStaffProfileId: staffProfileId,
        status: 'ACTIVE',
      },
    });
    if (stillActive) return;
    await this.prisma.staffProfile.update({
      where: { id: staffProfileId },
      data: { status: 'ACTIVE' },
    });
  }

  private async writeAudit(
    tenantId: string,
    assignmentId: string,
    action: string,
    actorId: string | null | undefined,
    before: unknown,
    after: unknown,
  ) {
    await this.prisma.replacementAssignmentAuditLog.create({
      data: {
        tenantId,
        assignmentId,
        action,
        actorId: actorId ?? undefined,
        beforeState: before ? (before as Prisma.InputJsonValue) : undefined,
        afterState: after as Prisma.InputJsonValue,
      },
    });
  }

  private toRow(
    row: Prisma.ReplacementAssignmentGetPayload<{
      include: ReturnType<ReplacementAssignmentService['defaultInclude']>;
    }>,
  ) {
    return {
      id: row.id,
      assignmentCode: row.assignmentCode,
      reason: row.reason,
      reasonLabel: this.reasonLabel(row.reason),
      startDate: row.startDate,
      endDate: row.endDate,
      status: row.status,
      salaryArrangement: row.salaryArrangement,
      monthlyAgreedAmount:
        row.monthlyAgreedAmount != null
          ? Number(row.monthlyAgreedAmount)
          : null,
      fullWorkloadTransfer: row.fullWorkloadTransfer,
      remarks: row.remarks,
      originalStaff: row.originalStaff,
      substitute: row.substitute,
      department: row.department,
      subjects: row.subjects,
      includeInPayroll: row.salaryArrangement === 'COLLEGE_PAYS_SUBSTITUTE',
      trackOnly: row.salaryArrangement === 'NO_PAYMENT_TRACKING',
      privatePayment:
        row.salaryArrangement === 'ORIGINAL_EMPLOYEE_PAYS_SUBSTITUTE',
      approvedAt: row.approvedAt,
      endedAt: row.endedAt,
    };
  }
}
