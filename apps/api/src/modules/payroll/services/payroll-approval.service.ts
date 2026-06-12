import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../../database/prisma.service';

import type { JwtUser } from '../../../common/decorators/current-user.decorator';

import { LoanService } from './loan.service';

import { PayrollAuditService } from './payroll-audit.service';

import { PayslipDocumentService } from './payslip-document.service';

import { PayslipNotificationService } from './payslip-notification.service';

@Injectable()
export class PayrollApprovalService {
  constructor(
    private readonly prisma: PrismaService,

    private readonly loans: LoanService,

    private readonly audit: PayrollAuditService,

    private readonly payslipDocs: PayslipDocumentService,

    private readonly payslipNotify: PayslipNotificationService,
  ) {}

  async transition(
    user: JwtUser,
    runId: string,
    action: 'verify' | 'approve' | 'publish',
  ) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, tenantId: user.tid },
    });

    if (!run) throw new NotFoundException('Payroll run not found');

    if (run.locked) throw new BadRequestException('Payroll run is locked');

    const actionMap: Record<string, string> = {
      verify: 'DRAFT',

      approve: 'VERIFIED',

      publish: 'APPROVED',
    };

    const expectedStatus = actionMap[action];

    if (run.status !== expectedStatus) {
      throw new BadRequestException(
        `Cannot ${action} run in status ${run.status}`,
      );
    }

    const nextStatus =
      action === 'verify'
        ? 'VERIFIED'
        : action === 'approve'
          ? 'APPROVED'
          : 'PUBLISHED';

    const updateData: Record<string, unknown> = { status: nextStatus };

    if (action === 'verify') {
      updateData.verifiedById = user.sub;

      updateData.verifiedAt = new Date();
    } else if (action === 'approve') {
      updateData.approvedById = user.sub;

      updateData.approvedAt = new Date();
    } else if (action === 'publish') {
      updateData.publishedById = user.sub;

      updateData.publishedAt = new Date();

      updateData.locked = true;

      const payslips = await this.prisma.payslip.findMany({
        where: { payrollRunId: runId },
      });

      for (const ps of payslips) {
        await this.prisma.payslip.update({
          where: { id: ps.id },
          data: { status: 'PUBLISHED' },
        });

        await this.loans.markRecovered(
          user.tid,
          ps.staffProfileId,
          run.month,
          run.year,
          runId,
          ps.id,
        );

        try {
          await this.payslipDocs.generatePdf(user.tid, ps.id);
        } catch {
          // best-effort bulk PDF generation
        }
      }

      try {
        await this.payslipNotify.emailRunPayslips(user, runId);
      } catch {
        // best-effort payslip email on publish
      }
    }

    const updated = await this.prisma.payrollRun.update({
      where: { id: runId },
      data: updateData,
    });

    await this.audit.log({
      tenantId: user.tid,

      entityType: 'PAYROLL_RUN',

      entityId: runId,

      action: action.toUpperCase(),

      oldValue: { status: run.status },

      newValue: { status: nextStatus },

      userId: user.sub,
    });

    return updated;
  }

  async markPaid(user: JwtUser, runId: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, tenantId: user.tid },
    });

    if (!run) throw new NotFoundException('Payroll run not found');

    if (run.status !== 'PUBLISHED') {
      throw new BadRequestException(
        'Only published runs can be marked as paid',
      );
    }

    const updated = await this.prisma.payrollRun.update({
      where: { id: runId },

      data: { paidAt: new Date(), paidById: user.sub },
    });

    await this.audit.log({
      tenantId: user.tid,

      entityType: 'PAYROLL_RUN',

      entityId: runId,

      action: 'MARKED_PAID',

      userId: user.sub,
    });

    return updated;
  }

  async reopen(user: JwtUser, runId: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, tenantId: user.tid },
    });

    if (!run) throw new NotFoundException('Payroll run not found');

    if (run.status !== 'PUBLISHED') {
      throw new BadRequestException(
        'Only published payroll runs can be reopened',
      );
    }

    await this.loans.unmarkRecoveredForRun(user.tid, runId);

    await this.prisma.payslip.updateMany({
      where: { payrollRunId: runId },

      data: { status: 'DRAFT' },
    });

    const updated = await this.prisma.payrollRun.update({
      where: { id: runId },

      data: {
        status: 'DRAFT',

        locked: false,

        verifiedById: null,

        verifiedAt: null,

        approvedById: null,

        approvedAt: null,

        publishedById: null,

        publishedAt: null,

        paidAt: null,

        paidById: null,
      },
    });

    await this.audit.log({
      tenantId: user.tid,

      entityType: 'PAYROLL_RUN',

      entityId: runId,

      action: 'REOPENED',

      userId: user.sub,
    });

    return updated;
  }
}
