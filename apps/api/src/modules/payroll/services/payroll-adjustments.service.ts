import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PayrollAuditService } from './payroll-audit.service';
import {
  buildUgcBreakdownFromLines,
  isUgcExcludedDeduction,
  syncUgcPayslipTotalsFromLines,
} from './ugc-payroll-formulas';

@Injectable()
export class PayrollAdjustmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PayrollAuditService,
  ) {}

  async listExclusions(tenantId: string, runId: string) {
    return this.prisma.payrollRunStaffExclusion
      .findMany({
        where: { tenantId, payrollRunId: runId },
        include: {
          payrollRun: {
            select: { id: true, month: true, year: true, status: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      })
      .then(async (rows) => {
        const staffIds = rows.map((r) => r.staffProfileId);
        const staff = await this.prisma.staffProfile.findMany({
          where: { id: { in: staffIds } },
          select: { id: true, fullName: true, employeeCode: true },
        });
        const byId = new Map(staff.map((s) => [s.id, s]));
        return rows.map((r) => ({
          ...r,
          staffProfile: byId.get(r.staffProfileId) ?? null,
        }));
      });
  }

  async excludeStaff(
    user: JwtUser,
    runId: string,
    staffProfileId: string,
    reason?: string,
  ) {
    const run = await this.requireEditableRun(user.tid, runId);
    const row = await this.prisma.payrollRunStaffExclusion.upsert({
      where: {
        payrollRunId_staffProfileId: { payrollRunId: runId, staffProfileId },
      },
      create: {
        tenantId: user.tid,
        payrollRunId: runId,
        staffProfileId,
        reason,
        createdById: user.sub,
      },
      update: { reason },
    });
    await this.prisma.payslip.deleteMany({
      where: { payrollRunId: runId, staffProfileId },
    });
    await this.audit.log({
      tenantId: user.tid,
      entityType: 'PAYROLL_RUN',
      entityId: runId,
      action: 'STAFF_EXCLUDED',
      newValue: { staffProfileId, reason },
      userId: user.sub,
    });
    return row;
  }

  async includeStaff(user: JwtUser, runId: string, staffProfileId: string) {
    await this.requireEditableRun(user.tid, runId);
    await this.prisma.payrollRunStaffExclusion.deleteMany({
      where: { tenantId: user.tid, payrollRunId: runId, staffProfileId },
    });
    await this.audit.log({
      tenantId: user.tid,
      entityType: 'PAYROLL_RUN',
      entityId: runId,
      action: 'STAFF_INCLUDED',
      newValue: { staffProfileId },
      userId: user.sub,
    });
    return { included: true };
  }

  async listAdjustments(tenantId: string, runId: string) {
    const rows = await this.prisma.payslipAdjustment.findMany({
      where: { tenantId, payrollRunId: runId },
      orderBy: { createdAt: 'desc' },
    });
    const staffIds = rows.map((r) => r.staffProfileId);
    const staff = await this.prisma.staffProfile.findMany({
      where: { id: { in: staffIds } },
      select: { id: true, fullName: true, employeeCode: true },
    });
    const byId = new Map(staff.map((s) => [s.id, s]));
    return rows.map((r) => ({
      ...r,
      staffProfile: byId.get(r.staffProfileId) ?? null,
    }));
  }

  async addAdjustment(
    user: JwtUser,
    runId: string,
    body: {
      staffProfileId: string;
      label: string;
      adjustmentType: 'EARNING' | 'DEDUCTION';
      amount: number;
      notes?: string;
    },
  ) {
    await this.requireEditableRun(user.tid, runId);
    const payslip = await this.prisma.payslip.findFirst({
      where: { payrollRunId: runId, staffProfileId: body.staffProfileId },
    });

    const adj = await this.prisma.payslipAdjustment.create({
      data: {
        tenantId: user.tid,
        payrollRunId: runId,
        staffProfileId: body.staffProfileId,
        payslipId: payslip?.id,
        label: body.label,
        adjustmentType: body.adjustmentType,
        amount: body.amount,
        notes: body.notes,
        createdById: user.sub,
      },
    });

    if (payslip) {
      await this.applyAdjustmentsToPayslip(payslip.id, runId);
    }

    await this.audit.log({
      tenantId: user.tid,
      entityType: 'PAYSLIP',
      entityId: payslip?.id,
      action: 'ADJUSTMENT_ADDED',
      newValue: body,
      userId: user.sub,
    });

    return adj;
  }

  async removeAdjustment(user: JwtUser, adjustmentId: string) {
    const adj = await this.prisma.payslipAdjustment.findFirst({
      where: { id: adjustmentId, tenantId: user.tid },
    });
    if (!adj) throw new NotFoundException('Adjustment not found');
    await this.requireEditableRun(user.tid, adj.payrollRunId);
    await this.prisma.payslipAdjustment.delete({ where: { id: adjustmentId } });
    if (adj.payslipId) {
      await this.applyAdjustmentsToPayslip(adj.payslipId, adj.payrollRunId);
    }
    await this.audit.log({
      tenantId: user.tid,
      entityType: 'PAYSLIP',
      entityId: adj.payslipId ?? undefined,
      action: 'ADJUSTMENT_REMOVED',
      oldValue: adj,
      userId: user.sub,
    });
    return { removed: true };
  }

  /** Re-apply all manual adjustments for a payslip and update totals. */
  async applyAdjustmentsToPayslip(payslipId: string, runId: string) {
    const payslip = await this.prisma.payslip.findFirst({
      where: { id: payslipId, payrollRunId: runId },
      include: { lines: true },
    });
    if (!payslip) return;

    await this.prisma.payslipLine.deleteMany({
      where: { payslipId, componentCode: { startsWith: 'ADJ_' } },
    });

    if (payslip.payScaleType === 'UGC') {
      const strayExcluded = payslip.lines.filter((line) =>
        isUgcExcludedDeduction(line.componentCode),
      );
      if (strayExcluded.length) {
        await this.prisma.payslipLine.deleteMany({
          where: { id: { in: strayExcluded.map((line) => line.id) } },
        });
      }
    }

    const adjustments = await this.prisma.payslipAdjustment.findMany({
      where: { payrollRunId: runId, staffProfileId: payslip.staffProfileId },
    });

    let baseGross = 0;
    let baseDed = 0;
    if (payslip.payScaleType === 'UGC') {
      const base = buildUgcBreakdownFromLines(
        payslip.lines
          .filter((line) => !line.componentCode.startsWith('ADJ_'))
          .map((line) => ({
            componentCode: line.componentCode,
            componentName: line.componentName,
            componentType: line.componentType,
            amount: Number(line.amount),
          })),
      );
      baseGross = base.gross;
      baseDed = base.totalDeductions;
    } else {
      for (const line of payslip.lines) {
        if (line.componentCode.startsWith('ADJ_')) continue;
        if (line.componentType === 'EARNING') baseGross += Number(line.amount);
        else baseDed += Number(line.amount);
      }
    }

    let adjEarnings = 0;
    let adjDeductions = 0;
    let sort = 900;
    for (const adj of adjustments) {
      const code = `ADJ_${adj.id.slice(0, 8).toUpperCase()}`;
      const type = adj.adjustmentType;
      const amount = Number(adj.amount);
      if (type === 'EARNING') adjEarnings += amount;
      else adjDeductions += amount;
      await this.prisma.payslipLine.create({
        data: {
          tenantId: payslip.tenantId,
          payslipId,
          componentCode: code,
          componentName: adj.label,
          componentType: type,
          amount,
          formulaTrace: { source: 'MANUAL_ADJUSTMENT', adjustmentId: adj.id },
          sortOrder: sort++,
        },
      });
      await this.prisma.payslipAdjustment.update({
        where: { id: adj.id },
        data: { payslipId },
      });
    }

    const gross = baseGross + adjEarnings;
    const deductions = baseDed + adjDeductions;
    let net = gross - deductions;

    if (payslip.payScaleType === 'UGC') {
      const synced = syncUgcPayslipTotalsFromLines(
        (
          await this.prisma.payslipLine.findMany({
            where: { payslipId },
            orderBy: { sortOrder: 'asc' },
          })
        ).map((line) => ({
          componentCode: line.componentCode,
          componentName: line.componentName,
          componentType: line.componentType,
          amount: Number(line.amount),
        })),
      );
      const ugcGross = synced.gross + adjEarnings;
      const ugcDeductions = synced.totalDeductions + adjDeductions;
      net = ugcGross - ugcDeductions;
      await this.prisma.payslip.update({
        where: { id: payslipId },
        data: {
          grossSalary: ugcGross,
          totalDeductions: ugcDeductions,
          netSalary: net,
        },
      });
    } else {
      await this.prisma.payslip.update({
        where: { id: payslipId },
        data: {
          grossSalary: gross,
          totalDeductions: deductions,
          netSalary: net,
        },
      });
    }

    await this.recalcRunTotals(runId);
  }

  async recalcRunTotals(runId: string) {
    const payslips = await this.prisma.payslip.findMany({
      where: { payrollRunId: runId },
    });
    const totalGross = payslips.reduce((s, p) => s + Number(p.grossSalary), 0);
    const totalDeductions = payslips.reduce(
      (s, p) => s + Number(p.totalDeductions),
      0,
    );
    const totalNet = payslips.reduce((s, p) => s + Number(p.netSalary), 0);
    await this.prisma.payrollRun.update({
      where: { id: runId },
      data: {
        employeeCount: payslips.length,
        totalGross,
        totalDeductions,
        totalNet,
      },
    });
  }

  async getExcludedStaffIds(
    tenantId: string,
    runId: string,
  ): Promise<Set<string>> {
    const rows = await this.prisma.payrollRunStaffExclusion.findMany({
      where: { tenantId, payrollRunId: runId },
      select: { staffProfileId: true },
    });
    return new Set(rows.map((r) => r.staffProfileId));
  }

  private async requireEditableRun(tenantId: string, runId: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, tenantId },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    if (run.locked) throw new BadRequestException('Payroll run is locked');
    return run;
  }
}
