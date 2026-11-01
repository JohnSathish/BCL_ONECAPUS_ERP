import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { resolveUploadRoot } from '../../../common/uploads/upload-paths';
import { UserNotificationsService } from '../../communication/services/user-notifications.service';
import {
  CASUAL_LEAVE_ANNUAL_DAYS,
  chargeableDates,
  eachDate,
  evaluateCasualLeave,
  isCasualLeaveType,
  isHiddenFromStaffLeave,
  isPrivilegedLeaveType,
  staffCanApplyForLeave,
  utcDateKey,
} from '../domain/casual-leave.policy';
import {
  ensureCasualLeaveType,
  ensurePrivilegedLeaveTypes,
  genderAllowsLeave,
  loadLeaveYear,
  readCasualLeaveSnapshot,
} from '../domain/casual-leave.snapshot';
import {
  ApproveLeaveDto,
  CreateLeaveApplicationDto,
  InitializeLeaveBalancesDto,
  RecordPrivilegedLeaveDto,
} from '../dto/leave.dto';

function daysBetween(from: Date, to: Date) {
  const ms = to.getTime() - from.getTime();
  return Math.max(1, Math.ceil(ms / (24 * 3600 * 1000)) + 1);
}

const FINAL_APPROVER_ROLES = new Set([
  'principal',
  'vice-principal',
  'erp-administrator',
  'institution-administrator',
  'super-admin',
]);

function resolveApproverRoleLabel(roles: string[] = []): string {
  const set = new Set(roles.map((r) => r.toLowerCase()));
  if (set.has('principal')) return 'Principal';
  if (set.has('vice-principal')) return 'Vice Principal';
  if (set.has('erp-administrator') || set.has('institution-administrator')) {
    return 'Institution Administrator';
  }
  if (set.has('hod') || set.has('head-of-department')) return 'HOD';
  if (set.has('super-admin')) return 'Institution Administrator';
  return (
    roles[0]?.replace(/-/g, ' ')?.replace(/\b\w/g, (c) => c.toUpperCase()) ||
    'Approver'
  );
}

function canFinalizeLeave(roles: string[] = []): boolean {
  return roles.some((r) => FINAL_APPROVER_ROLES.has(r.toLowerCase()));
}

function statusLabelFor(app: {
  status: string;
  reviewedByRole?: string | null;
  reviewedByName?: string | null;
}): string {
  const role = app.reviewedByRole?.trim();
  if (app.status === 'APPROVED') {
    return role ? `Approved by ${role}` : 'Approved';
  }
  if (app.status === 'REJECTED') {
    return role ? `Rejected by ${role}` : 'Rejected';
  }
  if (app.status === 'HOD_APPROVED') {
    // Legacy / intermediate HOD step — only label HOD when that was the reviewer
    if (role && role.toLowerCase() !== 'hod') {
      return `Approved by ${role}`;
    }
    return 'Approved by HOD';
  }
  if (app.status === 'PENDING') return 'Pending';
  if (app.status === 'CANCELLED') return 'Cancelled';
  if (role && app.status.endsWith('_APPROVED')) {
    return `Approved by ${role}`;
  }
  return app.status;
}

@Injectable()
export class LeaveService {
  private readonly logger = new Logger(LeaveService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: UserNotificationsService,
  ) {}

  private include = {
    leaveType: {
      select: {
        id: true,
        code: true,
        name: true,
        yearlyLimit: true,
        approvalFlow: true,
      },
    },
    staffProfile: {
      select: {
        id: true,
        fullName: true,
        employeeCode: true,
        portalUserId: true,
        department: { select: { id: true, name: true } },
        designation: { select: { label: true } },
      },
    },
  } as const;

  private enrichApplication<T extends Record<string, unknown>>(row: T) {
    const status = String(row.status ?? '');
    const reviewedByRole =
      (row.reviewedByRole as string | null | undefined) ?? null;
    const reviewedByName =
      (row.reviewedByName as string | null | undefined) ?? null;
    return {
      ...row,
      statusLabel: statusLabelFor({
        status,
        reviewedByRole,
        reviewedByName,
      }),
      approvedBy: row.reviewedById ?? null,
      approvedByName: reviewedByName,
      approvedByRole: reviewedByRole,
      approvedAt: row.reviewedAt ?? null,
      remarks: row.approvalRemarks ?? row.rejectionReason ?? null,
    };
  }

  async listBalances(
    tenantId: string,
    staffProfileId?: string,
    year = new Date().getFullYear(),
  ) {
    return this.prisma.staffLeaveBalance.findMany({
      where: {
        tenantId,
        year,
        ...(staffProfileId ? { staffProfileId } : {}),
      },
      include: {
        leaveType: { select: { code: true, name: true } },
        staffProfile: { select: { fullName: true, employeeCode: true } },
      },
      orderBy: [
        { staffProfile: { fullName: 'asc' } },
        { leaveType: { name: 'asc' } },
      ],
    });
  }

  async listApplications(
    tenantId: string,
    filters: {
      staffProfileId?: string;
      status?: string;
      pendingApproval?: boolean;
      privilegedOnly?: boolean;
    } = {},
  ) {
    const rows = await this.prisma.staffLeaveApplication.findMany({
      where: {
        tenantId,
        ...(filters.staffProfileId
          ? { staffProfileId: filters.staffProfileId }
          : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.pendingApproval
          ? { status: { in: ['PENDING', 'HOD_APPROVED'] } }
          : {}),
        ...(filters.privilegedOnly
          ? {
              leaveType: {
                OR: [
                  {
                    code: {
                      in: ['MAT', 'PAT', 'MATERNITY', 'PATERNITY', 'PL'],
                    },
                  },
                  { name: { contains: 'aternity', mode: 'insensitive' } },
                ],
              },
            }
          : {}),
      },
      include: this.include,
      orderBy: { createdAt: 'desc' },
    });
    const healed = await this.healMislabelledLeadershipApprovals(
      tenantId,
      rows,
    );
    const visible = filters.pendingApproval
      ? healed.filter((r) =>
          ['PENDING', 'HOD_APPROVED'].includes(String(r.status)),
        )
      : healed;
    return visible.map((row) => this.enrichApplication(row));
  }

  /**
   * Older flow stored Principal/VP approvals as HOD_APPROVED. Repair those rows
   * so Staff UI and pending queues reflect final approval.
   */
  private async healMislabelledLeadershipApprovals<
    T extends {
      id: string;
      status: string;
      staffProfileId: string;
      leaveTypeId: string;
      fromDate: Date;
      totalDays: unknown;
      reviewedById: string | null;
      reviewedByName: string | null;
      reviewedByRole: string | null;
      reviewedAt: Date | null;
      approvalRemarks: string | null;
    },
  >(tenantId: string, rows: T[]): Promise<T[]> {
    const candidates = rows.filter(
      (r) => r.status === 'HOD_APPROVED' && r.reviewedById,
    );
    if (!candidates.length) return rows;

    const reviewerIds = [...new Set(candidates.map((r) => r.reviewedById!))];
    const reviewers = await this.prisma.user.findMany({
      where: { tenantId, id: { in: reviewerIds } },
      select: {
        id: true,
        displayName: true,
        email: true,
        roles: { select: { role: { select: { slug: true } } } },
      },
    });
    const byId = new Map(
      reviewers.map((u) => [
        u.id,
        {
          name: u.displayName?.trim() || u.email?.split('@')[0] || 'Approver',
          roles: u.roles.map((ur) => ur.role.slug),
        },
      ]),
    );

    const out = [...rows];
    for (let i = 0; i < out.length; i += 1) {
      const row = out[i];
      if (row.status !== 'HOD_APPROVED' || !row.reviewedById) continue;
      const reviewer = byId.get(row.reviewedById);
      if (!reviewer || !canFinalizeLeave(reviewer.roles)) continue;

      const reviewedByRole =
        row.reviewedByRole || resolveApproverRoleLabel(reviewer.roles);
      const reviewedByName = row.reviewedByName || reviewer.name;
      const year = row.fromDate.getFullYear();

      await this.prisma.$transaction([
        this.prisma.staffLeaveApplication.update({
          where: { id: row.id },
          data: {
            status: 'APPROVED',
            reviewedByName,
            reviewedByRole,
            approvalRemarks: row.approvalRemarks ?? 'Approved',
            reviewedAt: row.reviewedAt ?? new Date(),
          },
        }),
        this.prisma.staffLeaveBalance.updateMany({
          where: {
            tenantId,
            staffProfileId: row.staffProfileId,
            leaveTypeId: row.leaveTypeId,
            year,
          },
          data: { usedDays: { increment: Number(row.totalDays) } },
        }),
      ]);

      out[i] = {
        ...row,
        status: 'APPROVED',
        reviewedByName,
        reviewedByRole,
        approvalRemarks: row.approvalRemarks ?? 'Approved',
        reviewedAt: row.reviewedAt ?? new Date(),
      };
    }
    return out;
  }

  async apply(user: JwtUser, dto: CreateLeaveApplicationDto) {
    const staff = await this.prisma.staffProfile.findFirst({
      where: { id: dto.staffProfileId, tenantId: user.tid, deletedAt: null },
    });
    if (!staff) throw new NotFoundException('Staff not found');

    const leaveType = await this.prisma.staffLeaveType.findFirst({
      where: { id: dto.leaveTypeId, tenantId: user.tid, active: true },
    });
    if (!leaveType) throw new NotFoundException('Leave type not found');

    if (isPrivilegedLeaveType(leaveType)) {
      throw new BadRequestException(
        'Maternity and paternity leave are recorded by the Principal from the admin leave page.',
      );
    }
    if (isHiddenFromStaffLeave(leaveType)) {
      throw new BadRequestException(
        'Medical leave and earned leave are not open for new applications.',
      );
    }

    const from = new Date(dto.fromDate);
    const to = new Date(dto.toDate);
    if (to < from) {
      throw new BadRequestException('To date must be on or after from date');
    }

    let totalDays = dto.totalDays ?? daysBetween(from, to);
    if (isCasualLeaveType(leaveType)) {
      const decision = await this.decideCasualLeave(
        user.tid,
        dto.staffProfileId,
        dto.fromDate,
        dto.toDate,
      );
      if (!decision.ok) throw new BadRequestException(decision.message);
      totalDays = decision.totalDays;
    } else {
      const year = from.getFullYear();
      const balance = await this.ensureBalance(
        user.tid,
        dto.staffProfileId,
        dto.leaveTypeId,
        year,
        leaveType,
      );
      const remaining =
        Number(balance.allocatedDays) +
        Number(balance.carriedForward) -
        Number(balance.usedDays);
      if (totalDays > remaining) {
        throw new BadRequestException(
          `Insufficient leave balance. Remaining: ${remaining} days`,
        );
      }
    }

    const created = await this.prisma.staffLeaveApplication.create({
      data: {
        tenantId: user.tid,
        staffProfileId: dto.staffProfileId,
        leaveTypeId: dto.leaveTypeId,
        fromDate: from,
        toDate: to,
        totalDays,
        reason: dto.reason,
        attachmentUrl: dto.attachmentUrl,
        status: 'PENDING',
        approvalStage: 0,
      },
      include: this.include,
    });
    return this.enrichApplication(created);
  }

  async applyForSelf(
    user: JwtUser,
    dto: Omit<CreateLeaveApplicationDto, 'staffProfileId'>,
  ) {
    const staff = await this.prisma.staffProfile.findFirst({
      where: { tenantId: user.tid, portalUserId: user.sub, deletedAt: null },
    });
    if (!staff)
      throw new NotFoundException('Staff profile not linked to your account');
    return this.apply(user, { ...dto, staffProfileId: staff.id });
  }

  async approve(user: JwtUser, id: string, dto: ApproveLeaveDto) {
    const app = await this.prisma.staffLeaveApplication.findFirst({
      where: { id, tenantId: user.tid },
      include: { leaveType: true, staffProfile: true },
    });
    if (!app) throw new NotFoundException('Leave application not found');
    if (['APPROVED', 'REJECTED', 'CANCELLED'].includes(app.status)) {
      throw new BadRequestException('Application already finalized');
    }

    const reviewer = await this.prisma.user.findFirst({
      where: { id: user.sub, tenantId: user.tid },
      select: { id: true, displayName: true, email: true },
    });
    const reviewedByRole = resolveApproverRoleLabel(user.roles ?? []);
    const reviewedByName =
      reviewer?.displayName?.trim() ||
      reviewer?.email?.split('@')[0] ||
      reviewedByRole;
    const reviewedAt = new Date();

    if (dto.action === 'REJECT') {
      const updated = await this.prisma.staffLeaveApplication.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectionReason: dto.rejectionReason ?? dto.remarks ?? 'Rejected',
          approvalRemarks: dto.remarks ?? null,
          reviewedById: user.sub,
          reviewedByName,
          reviewedByRole,
          reviewedAt,
        },
        include: this.include,
      });
      await this.notifyStaffLeaveDecision({
        tenantId: user.tid,
        staffUserId: app.staffProfile.portalUserId,
        leaveTypeName: app.leaveType.name,
        approved: false,
        roleLabel: reviewedByRole,
        applicationId: app.id,
      });
      return this.enrichApplication(updated);
    }

    let chargeableDays = Number(app.totalDays);
    if (isCasualLeaveType(app.leaveType)) {
      const decision = await this.decideCasualLeave(
        user.tid,
        app.staffProfileId,
        utcDateKey(app.fromDate),
        utcDateKey(app.toDate),
        app.id,
      );
      if (!decision.ok) throw new BadRequestException(decision.message);
      chargeableDays = decision.totalDays;
    }

    const flow = (app.leaveType.approvalFlow as string[] | null) ?? [
      'HOD',
      'PRINCIPAL',
    ];
    const leadershipFinal = canFinalizeLeave(user.roles ?? []);
    const nextStage = leadershipFinal ? flow.length : app.approvalStage + 1;
    const isFinal = leadershipFinal || nextStage >= flow.length;

    // Intermediate role step (e.g. HOD) — never hardcode HOD when a Principal acted.
    const stageRole = String(
      flow[app.approvalStage] ?? reviewedByRole,
    ).toUpperCase();
    const intermediateStatus =
      reviewedByRole === 'HOD' || stageRole.includes('HOD')
        ? 'HOD_APPROVED'
        : `${stageRole.replace(/\s+/g, '_')}_APPROVED`;

    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.staffLeaveApplication.findFirst({
        where: { id, tenantId: user.tid },
      });
      if (
        !current ||
        ['APPROVED', 'REJECTED', 'CANCELLED'].includes(current.status)
      ) {
        throw new BadRequestException('Application already finalized');
      }
      if (isFinal && !isPrivilegedLeaveType(app.leaveType)) {
        const year = Number(utcDateKey(app.fromDate).slice(0, 4));
        const balance = await this.ensureBalance(
          user.tid,
          app.staffProfileId,
          app.leaveTypeId,
          year,
          app.leaveType,
        );
        const fresh = await tx.staffLeaveBalance.findUnique({
          where: { id: balance.id },
        });
        const remaining =
          Number(fresh?.allocatedDays ?? 0) +
          Number(fresh?.carriedForward ?? 0) -
          Number(fresh?.usedDays ?? 0);
        if (chargeableDays > remaining) {
          throw new BadRequestException(
            isCasualLeaveType(app.leaveType)
              ? remaining <= 0
                ? 'Casual leave balance for this calendar year is exhausted.'
                : `Casual leave balance is not enough. Remaining: ${remaining} day(s).`
              : `Insufficient leave balance. Remaining: ${remaining} days`,
          );
        }
        await tx.staffLeaveBalance.update({
          where: { id: balance.id },
          data: { usedDays: { increment: chargeableDays } },
        });
      }
      return tx.staffLeaveApplication.update({
        where: { id },
        data: {
          totalDays: chargeableDays,
          approvalStage: isFinal ? flow.length : nextStage,
          status: isFinal ? 'APPROVED' : intermediateStatus,
          reviewedById: user.sub,
          reviewedByName,
          reviewedByRole,
          reviewedAt,
          approvalRemarks: dto.remarks ?? 'Approved',
          rejectionReason: null,
        },
        include: this.include,
      });
    });

    await this.notifyStaffLeaveDecision({
      tenantId: user.tid,
      staffUserId: app.staffProfile.portalUserId,
      leaveTypeName: app.leaveType.name,
      approved: isFinal,
      intermediate: !isFinal,
      roleLabel: reviewedByRole,
      applicationId: app.id,
    });

    return this.enrichApplication(updated);
  }

  private async notifyStaffLeaveDecision(input: {
    tenantId: string;
    staffUserId: string | null;
    leaveTypeName: string;
    approved: boolean;
    intermediate?: boolean;
    roleLabel: string;
    applicationId: string;
  }) {
    if (!input.staffUserId) return;
    try {
      const title = input.approved
        ? 'Leave approved'
        : input.intermediate
          ? 'Leave moved forward'
          : 'Leave rejected';
      const body = input.approved
        ? `Your leave request has been approved by the ${input.roleLabel}.`
        : input.intermediate
          ? `Your ${input.leaveTypeName} request was reviewed by the ${input.roleLabel} and is awaiting further approval.`
          : `Your leave request was rejected by the ${input.roleLabel}.`;
      await this.notifications.createInApp({
        tenantId: input.tenantId,
        userId: input.staffUserId,
        type: 'STAFF_LEAVE',
        title,
        body,
        link: '/staff/leave',
        metadata: {
          applicationId: input.applicationId,
          approvedByRole: input.roleLabel,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Leave decision notification failed: ${(err as Error).message}`,
      );
    }
  }

  async initializeBalances(user: JwtUser, dto: InitializeLeaveBalancesDto) {
    const year = dto.year ?? new Date().getFullYear();
    await ensureCasualLeaveType(this.prisma, user.tid);
    await ensurePrivilegedLeaveTypes(this.prisma, user.tid);
    const leaveTypes = (
      await this.prisma.staffLeaveType.findMany({
        where: { tenantId: user.tid, active: true },
      })
    ).filter((type) => staffCanApplyForLeave(type));
    const staff = await this.prisma.staffProfile.findMany({
      where: {
        tenantId: user.tid,
        deletedAt: null,
        status: 'ACTIVE',
        ...(dto.staffProfileIds?.length
          ? { id: { in: dto.staffProfileIds } }
          : {}),
        ...(dto.departmentId ? { departmentId: dto.departmentId } : {}),
      },
      select: { id: true },
    });

    let created = 0;
    for (const s of staff) {
      for (const lt of leaveTypes) {
        await this.prisma.staffLeaveBalance.upsert({
          where: {
            tenantId_staffProfileId_leaveTypeId_year: {
              tenantId: user.tid,
              staffProfileId: s.id,
              leaveTypeId: lt.id,
              year,
            },
          },
          create: {
            tenantId: user.tid,
            staffProfileId: s.id,
            leaveTypeId: lt.id,
            year,
            allocatedDays: lt.yearlyLimit ?? 0,
            usedDays: 0,
            carriedForward: 0,
          },
          update: {},
        });
        created += 1;
      }
    }
    await this.prisma.staffLeaveBalance.updateMany({
      where: {
        tenantId: user.tid,
        year,
        allocatedDays: { lt: CASUAL_LEAVE_ANNUAL_DAYS },
        leaveType: { code: { in: ['CL', 'CASUAL'] } },
      },
      data: { allocatedDays: CASUAL_LEAVE_ANNUAL_DAYS },
    });
    return {
      initialized: created,
      staffCount: staff.length,
      leaveTypeCount: leaveTypes.length,
      year,
    };
  }

  async portalSummaryForSelf(user: JwtUser) {
    const staff = await this.resolveStaffForPortalUser(user);
    if (!staff)
      return {
        casual: 0,
        sick: 0,
        earned: 0,
        pendingRequests: 0,
        balances: [],
        leaveTypes: [],
      };

    const [summary, leaveTypes] = await Promise.all([
      this.portalSummary(user.tid, staff.id),
      this.prisma.staffLeaveType.findMany({
        where: { tenantId: user.tid, active: true },
        select: { id: true, code: true, name: true, yearlyLimit: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      ...summary,
      leaveTypes: leaveTypes.filter((type) => staffCanApplyForLeave(type)),
    };
  }

  async listApplicationsForSelf(user: JwtUser) {
    const staff = await this.resolveStaffForPortalUser(user);
    if (!staff) return [];
    const rows = await this.listApplications(user.tid, {
      staffProfileId: staff.id,
    });
    return rows.filter((row) =>
      staffCanApplyForLeave(
        (row as { leaveType?: { code?: string; name?: string } }).leaveType ??
          {},
      ),
    );
  }

  private async resolveStaffForPortalUser(user: JwtUser) {
    return this.prisma.staffProfile.findFirst({
      where: { tenantId: user.tid, portalUserId: user.sub, deletedAt: null },
    });
  }

  private async portalSummary(tenantId: string, staffProfileId: string) {
    const mislabelled = await this.prisma.staffLeaveApplication.findMany({
      where: {
        tenantId,
        staffProfileId,
        status: 'HOD_APPROVED',
        reviewedById: { not: null },
      },
    });
    if (mislabelled.length) {
      await this.healMislabelledLeadershipApprovals(tenantId, mislabelled);
    }
    const snapshot = await readCasualLeaveSnapshot(
      this.prisma,
      tenantId,
      staffProfileId,
    );
    const balances = await this.listBalances(
      tenantId,
      staffProfileId,
      snapshot.year,
    );
    return { ...snapshot, balances };
  }

  async previewForSelf(
    user: JwtUser,
    query: { leaveTypeId?: string; fromDate?: string; toDate?: string },
  ) {
    const staff = await this.resolveStaffForPortalUser(user);
    if (!staff) {
      return {
        ok: false,
        totalDays: 0,
        message: 'Staff profile not linked to your account.',
      };
    }
    if (!query.leaveTypeId || !query.fromDate || !query.toDate) {
      return {
        ok: false,
        totalDays: 0,
        message: 'Choose the leave type and dates.',
      };
    }
    const leaveType = await this.prisma.staffLeaveType.findFirst({
      where: { id: query.leaveTypeId, tenantId: user.tid, active: true },
    });
    if (!leaveType || !staffCanApplyForLeave(leaveType)) {
      return {
        ok: false,
        totalDays: 0,
        message:
          'Choose casual leave. Medical, earned, maternity, and paternity leave are not applied here.',
      };
    }
    if (!isCasualLeaveType(leaveType)) {
      const from = new Date(query.fromDate);
      const to = new Date(query.toDate);
      if (to < from) {
        return {
          ok: false,
          totalDays: 0,
          message: 'To date must be on or after from date.',
        };
      }
      return { ok: true, totalDays: daysBetween(from, to), message: null };
    }
    const decision = await this.decideCasualLeave(
      user.tid,
      staff.id,
      query.fromDate,
      query.toDate,
    );
    return decision.ok
      ? { ok: true, totalDays: decision.totalDays, message: null }
      : { ok: false, totalDays: 0, message: decision.message };
  }

  async searchStaff(tenantId: string, term: string) {
    const q = term.trim();
    if (q.length < 2) return [];
    return this.prisma.staffProfile.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: 'ACTIVE',
        OR: [
          { fullName: { contains: q, mode: 'insensitive' } },
          { employeeCode: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, fullName: true, employeeCode: true, gender: true },
      take: 8,
      orderBy: { fullName: 'asc' },
    });
  }

  async recordPrivilegedLeave(
    user: JwtUser,
    dto: RecordPrivilegedLeaveDto,
    file?: Express.Multer.File,
  ) {
    await ensurePrivilegedLeaveTypes(this.prisma, user.tid);
    const leaveType = await this.prisma.staffLeaveType.findFirst({
      where: { tenantId: user.tid, code: dto.leaveTypeCode, active: true },
    });
    if (!leaveType) throw new NotFoundException('Leave type not found');
    const staff = await this.prisma.staffProfile.findFirst({
      where: { id: dto.staffProfileId, tenantId: user.tid, deletedAt: null },
    });
    if (!staff) throw new NotFoundException('Staff not found');
    if (!genderAllowsLeave(leaveType.genderRestriction, staff.gender)) {
      throw new BadRequestException(
        dto.leaveTypeCode === 'MAT'
          ? 'Maternity leave is recorded for a female staff member.'
          : 'Paternity leave is recorded for a male staff member.',
      );
    }
    const from = utcDateKey(dto.fromDate);
    const to = utcDateKey(dto.toDate);
    if (to < from) {
      throw new BadRequestException('To date must be on or after from date.');
    }
    const approvalDate = utcDateKey(dto.approvalDate);
    if (approvalDate > utcDateKey(new Date())) {
      throw new BadRequestException('Approval date cannot be in the future.');
    }
    const reviewer = await this.prisma.user.findFirst({
      where: { id: user.sub, tenantId: user.tid },
      select: { displayName: true, email: true },
    });
    const reviewedByRole = resolveApproverRoleLabel(user.roles ?? []);
    const reviewedByName =
      reviewer?.displayName?.trim() ||
      reviewer?.email?.split('@')[0] ||
      reviewedByRole;
    const overlap = await this.prisma.staffLeaveApplication.findFirst({
      where: {
        tenantId: user.tid,
        staffProfileId: staff.id,
        status: { notIn: ['REJECTED', 'CANCELLED'] },
        fromDate: { lte: new Date(`${to}T00:00:00.000Z`) },
        toDate: { gte: new Date(`${from}T00:00:00.000Z`) },
      },
      select: { id: true },
    });
    if (overlap) {
      throw new BadRequestException(
        'These dates overlap another leave record.',
      );
    }
    const priorRecords = await this.prisma.staffLeaveApplication.count({
      where: {
        tenantId: user.tid,
        staffProfileId: staff.id,
        leaveTypeId: leaveType.id,
        status: 'APPROVED',
      },
    });
    const created = await this.prisma.staffLeaveApplication.create({
      data: {
        tenantId: user.tid,
        staffProfileId: staff.id,
        leaveTypeId: leaveType.id,
        fromDate: new Date(`${from}T00:00:00.000Z`),
        toDate: new Date(`${to}T00:00:00.000Z`),
        totalDays: eachDate(from, to).length,
        reason: dto.remarks?.trim() || null,
        status: 'APPROVED',
        approvalStage: 1,
        attachmentUrl: dto.attachmentUrl?.trim() || null,
        reviewedById: user.sub,
        reviewedByName,
        reviewedByRole,
        reviewedAt: new Date(`${approvalDate}T00:00:00.000Z`),
        approvalRemarks:
          dto.remarks?.trim() || 'Recorded by the approving authority',
      },
      include: this.include,
    });
    if (file?.buffer?.length) {
      const attachmentUrl = await this.saveLeaveDocument(
        user.tid,
        created.id,
        file,
      );
      const withFile = await this.prisma.staffLeaveApplication.update({
        where: { id: created.id },
        data: { attachmentUrl },
        include: this.include,
      });
      return { ...this.enrichApplication(withFile), priorRecords };
    }
    return { ...this.enrichApplication(created), priorRecords };
  }

  private async decideCasualLeave(
    tenantId: string,
    staffProfileId: string,
    from: string,
    to: string,
    excludeApplicationId?: string,
  ) {
    const leaveType = await ensureCasualLeaveType(this.prisma, tenantId);
    const year = Number(utcDateKey(from).slice(0, 4));
    await this.prisma.staffLeaveBalance.updateMany({
      where: {
        tenantId,
        staffProfileId,
        year,
        leaveTypeId: leaveType.id,
        allocatedDays: { lt: CASUAL_LEAVE_ANNUAL_DAYS },
      },
      data: { allocatedDays: CASUAL_LEAVE_ANNUAL_DAYS },
    });
    const [balance, calendar, apps] = await Promise.all([
      this.ensureBalance(
        tenantId,
        staffProfileId,
        leaveType.id,
        year,
        leaveType,
      ),
      loadLeaveYear(this.prisma, tenantId, year),
      this.prisma.staffLeaveApplication.findMany({
        where: {
          tenantId,
          staffProfileId,
          status: { notIn: ['REJECTED', 'CANCELLED'] },
          ...(excludeApplicationId
            ? { id: { not: excludeApplicationId } }
            : {}),
          fromDate: { lte: new Date(`${year}-12-31T00:00:00.000Z`) },
          toDate: { gte: new Date(`${year}-01-01T00:00:00.000Z`) },
        },
        select: {
          status: true,
          fromDate: true,
          toDate: true,
          leaveType: { select: { code: true, name: true } },
        },
      }),
    ]);
    const existingCasualDates: string[] = [];
    const pendingDates: string[] = [];
    const otherLeaveDates: string[] = [];
    for (const app of apps) {
      const span = eachDate(
        utcDateKey(app.fromDate),
        utcDateKey(app.toDate),
      ).filter((day) => day.startsWith(String(year)));
      if (isCasualLeaveType(app.leaveType)) {
        const days = chargeableDates(span, calendar.holidays);
        existingCasualDates.push(...days);
        if (app.status !== 'APPROVED') pendingDates.push(...days);
      } else {
        otherLeaveDates.push(...span);
      }
    }
    return evaluateCasualLeave({
      from,
      to,
      holidays: calendar.holidays,
      vacations: calendar.vacations,
      existingCasualDates,
      otherLeaveDates,
      allocated: Number(balance.allocatedDays),
      carried: Number(balance.carriedForward),
      used: Number(balance.usedDays),
      pendingDates: [...new Set(pendingDates)],
    });
  }

  private async saveLeaveDocument(
    tenantId: string,
    applicationId: string,
    file: Express.Multer.File,
  ) {
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('The document must be 5 MB or smaller.');
    }
    const name = (file.originalname || '').toLowerCase();
    const ext =
      file.mimetype === 'application/pdf' || name.endsWith('.pdf')
        ? '.pdf'
        : file.mimetype === 'image/png' || name.endsWith('.png')
          ? '.png'
          : file.mimetype === 'image/webp' || name.endsWith('.webp')
            ? '.webp'
            : file.mimetype === 'image/jpeg' ||
                name.endsWith('.jpg') ||
                name.endsWith('.jpeg')
              ? '.jpg'
              : '';
    if (!ext) {
      throw new BadRequestException(
        'Upload a PDF or an image of the supporting document.',
      );
    }
    const relative = join('tenants', tenantId, 'hr', 'leave', applicationId);
    await mkdir(join(resolveUploadRoot(), relative), { recursive: true });
    await writeFile(
      join(resolveUploadRoot(), relative, `document${ext}`),
      file.buffer,
    );
    return `/uploads/${relative.replace(/\\/g, '/')}/document${ext}`;
  }

  private async ensureBalance(
    tenantId: string,
    staffProfileId: string,
    leaveTypeId: string,
    year: number,
    leaveType: { yearlyLimit: unknown },
  ) {
    const existing = await this.prisma.staffLeaveBalance.findUnique({
      where: {
        tenantId_staffProfileId_leaveTypeId_year: {
          tenantId,
          staffProfileId,
          leaveTypeId,
          year,
        },
      },
    });
    if (existing) return existing;
    return this.prisma.staffLeaveBalance.create({
      data: {
        tenantId,
        staffProfileId,
        leaveTypeId,
        year,
        allocatedDays: Number(leaveType.yearlyLimit ?? 0),
        usedDays: 0,
        carriedForward: 0,
      },
    });
  }
}
