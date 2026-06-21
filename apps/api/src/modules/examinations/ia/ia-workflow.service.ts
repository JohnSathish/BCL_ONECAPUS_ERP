import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { APPROVAL_STEPS, SHEET_STATUSES } from './ia.constants';
import { IaAuditService } from './ia-audit.service';

@Injectable()
export class IaWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: IaAuditService,
  ) {}

  private hasRole(user: JwtUser, roleSlug: string) {
    return user.roles?.includes(roleSlug) ?? false;
  }

  private hasPermission(user: JwtUser, slug: string) {
    return user.permissions?.includes(slug) ?? false;
  }

  async getSheet(tenantId: string, sheetId: string) {
    const sheet = await (this.prisma as any).iaConsolidationSheet.findFirst({
      where: { id: sheetId, tenantId, deletedAt: null },
      include: {
        approvals: { orderBy: { sequence: 'asc' } },
        rows: { take: 5 },
      },
    });
    if (!sheet) throw new NotFoundException('Consolidation sheet not found');
    return sheet;
  }

  async submitSheet(user: JwtUser, sheetId: string) {
    const sheet = await this.getSheet(user.tid, sheetId);
    if (
      sheet.status !== SHEET_STATUSES.DRAFT &&
      sheet.status !== SHEET_STATUSES.REJECTED
    ) {
      throw new BadRequestException(
        'Sheet cannot be submitted in current status',
      );
    }

    await (this.prisma as any).iaApprovalStep.deleteMany({
      where: { sheetId, tenantId: user.tid },
    });
    await (this.prisma as any).iaApprovalStep.createMany({
      data: APPROVAL_STEPS.map((s) => ({
        tenantId: user.tid,
        sheetId,
        stepCode: s.stepCode,
        stepName: s.stepName,
        roleSlug: s.roleSlug,
        sequence: s.sequence,
        status: 'PENDING',
      })),
    });

    const updated = await (this.prisma as any).iaConsolidationSheet.update({
      where: { id: sheetId },
      data: {
        status: SHEET_STATUSES.SUBMITTED,
        submittedAt: new Date(),
      },
      include: { approvals: { orderBy: { sequence: 'asc' } } },
    });
    await this.audit.log(user, 'IA_SHEET', sheetId, 'SUBMIT', sheet, updated);
    return updated;
  }

  async actOnApproval(
    user: JwtUser,
    approvalId: string,
    action: 'APPROVE' | 'REJECT',
    remarks?: string,
  ) {
    const approval = await (this.prisma as any).iaApprovalStep.findFirst({
      where: { id: approvalId, tenantId: user.tid },
      include: { sheet: true },
    });
    if (!approval) throw new NotFoundException('Approval step not found');
    if (approval.status !== 'PENDING') {
      throw new BadRequestException('Approval step already actioned');
    }

    const permMap: Record<string, string> = {
      HOD_REVIEW: 'ia:marks:approve:hod',
      CONTROLLER_VERIFY: 'ia:marks:approve:controller',
      PRINCIPAL_APPROVE: 'ia:marks:approve:principal',
    };
    const requiredPerm = permMap[approval.stepCode];
    if (
      !this.hasRole(user, approval.roleSlug) &&
      !(requiredPerm && this.hasPermission(user, requiredPerm)) &&
      !this.hasPermission(user, 'ia:manage')
    ) {
      throw new ForbiddenException('Not authorized for this approval step');
    }

    const prior = await (this.prisma as any).iaApprovalStep.findMany({
      where: { sheetId: approval.sheetId, tenantId: user.tid },
      orderBy: { sequence: 'asc' },
    });
    const pendingBefore = prior.filter(
      (p: { sequence: number; status: string }) =>
        p.sequence < approval.sequence && p.status !== 'APPROVED',
    );
    if (pendingBefore.length) {
      throw new BadRequestException(
        'Prior approval steps must be completed first',
      );
    }

    await (this.prisma as any).iaApprovalStep.update({
      where: { id: approvalId },
      data: {
        status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        actedById: user.sub,
        actedAt: new Date(),
        remarks,
      },
    });

    let sheetStatus = approval.sheet.status;
    if (action === 'REJECT') {
      sheetStatus = SHEET_STATUSES.REJECTED;
    } else if (approval.stepCode === 'HOD_REVIEW') {
      sheetStatus = SHEET_STATUSES.HOD_APPROVED;
    } else if (approval.stepCode === 'CONTROLLER_VERIFY') {
      sheetStatus = SHEET_STATUSES.CONTROLLER_VERIFIED;
    } else if (approval.stepCode === 'PRINCIPAL_APPROVE') {
      sheetStatus = SHEET_STATUSES.PRINCIPAL_APPROVED;
    }

    const allApproved = prior.every((p: { id: string; status: string }) =>
      p.id === approvalId ? action === 'APPROVE' : p.status === 'APPROVED',
    );
    if (action === 'APPROVE' && allApproved) {
      sheetStatus = SHEET_STATUSES.LOCKED;
      await (this.prisma as any).iaConsolidationSheet.update({
        where: { id: approval.sheetId },
        data: { status: sheetStatus, lockedAt: new Date() },
      });
      await this.lockMarksForSheet(user.tid, approval.sheetId);
    } else {
      await (this.prisma as any).iaConsolidationSheet.update({
        where: { id: approval.sheetId },
        data: { status: sheetStatus },
      });
    }

    await this.audit.log(user, 'IA_APPROVAL', approvalId, action, approval, {
      sheetStatus,
      remarks,
    });
    return this.getSheet(user.tid, approval.sheetId);
  }

  private async lockMarksForSheet(tenantId: string, sheetId: string) {
    const rows = await (this.prisma as any).iaConsolidationRow.findMany({
      where: { sheetId, tenantId },
    });
    const offeringIds = [
      ...new Set(
        rows.map((r: { offeringId?: string }) => r.offeringId).filter(Boolean),
      ),
    ];
    if (!offeringIds.length) return;

    const papers = await (this.prisma as any).examPaperSchedule.findMany({
      where: { tenantId, offeringId: { in: offeringIds }, deletedAt: null },
    });
    const paperIds = papers.map((p: { id: string }) => p.id);
    await (this.prisma as any).iaComponentMark.updateMany({
      where: { tenantId, paperId: { in: paperIds }, deletedAt: null },
      data: { status: 'LOCKED', lockedAt: new Date() },
    });
  }

  async canEditMarks(tenantId: string, paperId: string) {
    const paper = await (this.prisma as any).examPaperSchedule.findFirst({
      where: { id: paperId, tenantId, deletedAt: null },
    });
    if (!paper?.offeringId) return true;

    const lockedSheet = await (
      this.prisma as any
    ).iaConsolidationSheet.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        status: {
          in: [
            SHEET_STATUSES.HOD_APPROVED,
            SHEET_STATUSES.CONTROLLER_VERIFIED,
            SHEET_STATUSES.PRINCIPAL_APPROVED,
            SHEET_STATUSES.LOCKED,
          ],
        },
      },
      include: {
        rows: { where: { offeringId: paper.offeringId }, take: 1 },
      },
    });
    if (!lockedSheet?.rows?.length) return true;
    if (lockedSheet.status === SHEET_STATUSES.HOD_APPROVED) return false;
    if (lockedSheet.status === SHEET_STATUSES.CONTROLLER_VERIFIED) return false;
    if (lockedSheet.status === SHEET_STATUSES.LOCKED) return false;
    return lockedSheet.status !== SHEET_STATUSES.LOCKED;
  }

  async pendingApprovals(user: JwtUser) {
    const steps = await (this.prisma as any).iaApprovalStep.findMany({
      where: {
        tenantId: user.tid,
        status: 'PENDING',
      },
      include: { sheet: true },
      orderBy: [{ createdAt: 'asc' }],
      take: 50,
    });
    return steps.filter((s: { roleSlug: string; stepCode: string }) => {
      const permMap: Record<string, string> = {
        HOD_REVIEW: 'ia:marks:approve:hod',
        CONTROLLER_VERIFY: 'ia:marks:approve:controller',
        PRINCIPAL_APPROVE: 'ia:marks:approve:principal',
      };
      return (
        this.hasRole(user, s.roleSlug) ||
        this.hasPermission(user, permMap[s.stepCode] ?? '') ||
        this.hasPermission(user, 'ia:manage')
      );
    });
  }
}
