import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { UserNotificationsService } from '../../communication/services/user-notifications.service';
import {
  ApproveLeaveDto,
  CreateLeaveApplicationDto,
  InitializeLeaveBalancesDto,
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

    const from = new Date(dto.fromDate);
    const to = new Date(dto.toDate);
    if (to < from)
      throw new BadRequestException('To date must be on or after from date');

    const totalDays = dto.totalDays ?? daysBetween(from, to);
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

    if (isFinal) {
      const year = app.fromDate.getFullYear();
      await this.prisma.staffLeaveBalance.updateMany({
        where: {
          tenantId: user.tid,
          staffProfileId: app.staffProfileId,
          leaveTypeId: app.leaveTypeId,
          year,
        },
        data: { usedDays: { increment: Number(app.totalDays) } },
      });
    }

    const updated = await this.prisma.staffLeaveApplication.update({
      where: { id },
      data: {
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
    const leaveTypes = await this.prisma.staffLeaveType.findMany({
      where: { tenantId: user.tid, active: true },
    });
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

    return { ...summary, leaveTypes };
  }

  async listApplicationsForSelf(user: JwtUser) {
    const staff = await this.resolveStaffForPortalUser(user);
    if (!staff) return [];
    return this.listApplications(user.tid, { staffProfileId: staff.id });
  }

  private async resolveStaffForPortalUser(user: JwtUser) {
    return this.prisma.staffProfile.findFirst({
      where: { tenantId: user.tid, portalUserId: user.sub, deletedAt: null },
    });
  }

  private async portalSummary(tenantId: string, staffProfileId: string) {
    const year = new Date().getFullYear();
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

    const [balances, pendingRequests] = await Promise.all([
      this.listBalances(tenantId, staffProfileId, year),
      this.prisma.staffLeaveApplication.count({
        where: {
          tenantId,
          staffProfileId,
          status: { in: ['PENDING', 'HOD_APPROVED'] },
        },
      }),
    ]);

    const byCode = (code: string) => {
      const row = balances.find((b) => b.leaveType.code.toUpperCase() === code);
      if (!row) return 0;
      return (
        Number(row.allocatedDays) +
        Number(row.carriedForward) -
        Number(row.usedDays)
      );
    };

    return {
      casual: byCode('CL'),
      sick: byCode('SL'),
      earned: byCode('EL'),
      pendingRequests,
      balances,
    };
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
