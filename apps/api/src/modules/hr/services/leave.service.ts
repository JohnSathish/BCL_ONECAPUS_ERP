import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import {
  ApproveLeaveDto,
  CreateLeaveApplicationDto,
  InitializeLeaveBalancesDto,
} from '../dto/leave.dto';

function daysBetween(from: Date, to: Date) {
  const ms = to.getTime() - from.getTime();
  return Math.max(1, Math.ceil(ms / (24 * 3600 * 1000)) + 1);
}

@Injectable()
export class LeaveService {
  constructor(private readonly prisma: PrismaService) {}

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
        department: { select: { id: true, name: true } },
        designation: { select: { label: true } },
      },
    },
  } as const;

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
    return this.prisma.staffLeaveApplication.findMany({
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

    return this.prisma.staffLeaveApplication.create({
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
      include: { leaveType: true },
    });
    if (!app) throw new NotFoundException('Leave application not found');
    if (['APPROVED', 'REJECTED', 'CANCELLED'].includes(app.status)) {
      throw new BadRequestException('Application already finalized');
    }

    if (dto.action === 'REJECT') {
      return this.prisma.staffLeaveApplication.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectionReason: dto.rejectionReason ?? 'Rejected',
          reviewedById: user.sub,
          reviewedAt: new Date(),
        },
        include: this.include,
      });
    }

    const flow = (app.leaveType.approvalFlow as string[] | null) ?? [
      'HOD',
      'PRINCIPAL',
    ];
    const nextStage = app.approvalStage + 1;
    const isFinal = nextStage >= flow.length;

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

    return this.prisma.staffLeaveApplication.update({
      where: { id },
      data: {
        approvalStage: nextStage,
        status: isFinal ? 'APPROVED' : 'HOD_APPROVED',
        reviewedById: user.sub,
        reviewedAt: new Date(),
      },
      include: this.include,
    });
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
        const allocated = Number(lt.yearlyLimit ?? 0);
        if (allocated <= 0) continue;
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
            allocatedDays: allocated,
          },
          update: dto.overwrite ? { allocatedDays: allocated } : {},
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
      };
    return this.portalSummary(user.tid, staff.id);
  }

  async listApplicationsForSelf(user: JwtUser) {
    const staff = await this.resolveStaffForPortalUser(user);
    if (!staff) return [];
    return this.listApplications(user.tid, { staffProfileId: staff.id });
  }

  private async resolveStaffForPortalUser(user: JwtUser) {
    return this.prisma.staffProfile.findFirst({
      where: { tenantId: user.tid, portalUserId: user.sub, deletedAt: null },
      select: { id: true },
    });
  }

  async portalSummary(tenantId: string, staffProfileId: string) {
    const year = new Date().getFullYear();
    const [balances, pending] = await Promise.all([
      this.listBalances(tenantId, staffProfileId, year),
      this.prisma.staffLeaveApplication.count({
        where: {
          tenantId,
          staffProfileId,
          status: { in: ['PENDING', 'HOD_APPROVED'] },
        },
      }),
    ]);

    const byCode: Record<string, number> = {};
    for (const b of balances) {
      const remaining =
        Number(b.allocatedDays) + Number(b.carriedForward) - Number(b.usedDays);
      byCode[b.leaveType.code.toUpperCase()] = remaining;
    }

    return {
      casual: byCode['CL'] ?? byCode['CASUAL'] ?? 0,
      sick: byCode['SL'] ?? byCode['SICK'] ?? byCode['MEDICAL'] ?? 0,
      earned: byCode['EL'] ?? byCode['EARNED'] ?? 0,
      pendingRequests: pending,
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
      },
    });
  }
}
