import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { CreateArrearBatchDto } from '../dto/payroll.dto';
import {
  FormulaEngineService,
  type FormulaNode,
} from './formula-engine.service';
import { PayrollAuditService } from './payroll-audit.service';

@Injectable()
export class ArrearsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly formula: FormulaEngineService,
    private readonly audit: PayrollAuditService,
  ) {}

  list(tenantId: string) {
    return this.prisma.salaryArrearBatch.findMany({
      where: { tenantId },
      include: { _count: { select: { lines: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(user: JwtUser, dto: CreateArrearBatchDto) {
    const effectiveFrom = new Date(dto.effectiveFrom);
    const monthsCount = this.monthDiff(
      effectiveFrom,
      new Date(dto.appliedInYear, dto.appliedInMonth - 1, 1),
    );

    const batch = await this.prisma.salaryArrearBatch.create({
      data: {
        tenantId: user.tid,
        name: dto.name,
        effectiveFrom,
        appliedInMonth: dto.appliedInMonth,
        appliedInYear: dto.appliedInYear,
        payrollRunId: dto.payrollRunId,
        createdById: user.sub,
      },
    });

    const activeAssignments = await this.prisma.staffPayAssignment.findMany({
      where: { tenantId: user.tid, status: 'ACTIVE' },
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
    });

    let totalAmount = 0;
    for (const assignment of activeAssignments) {
      const revision = await this.prisma.salaryRevision.findFirst({
        where: {
          tenantId: user.tid,
          staffPayAssignmentId: assignment.id,
          effectiveFrom: { lte: effectiveFrom },
        },
        orderBy: { effectiveFrom: 'desc' },
      });
      if (!revision) continue;

      const before = revision.beforeSnapshot as { basicPay: number };
      const after = revision.afterSnapshot as { basicPay: number };
      const components = assignment.payStructureTemplate.components.map(
        (c) => ({
          code: c.paySalaryComponent.code,
          name: c.paySalaryComponent.name,
          componentType: c.paySalaryComponent.componentType,
          formulaJson: c.formulaJson as FormulaNode,
        }),
      );

      const oldComputed = this.formula.computeAll(components, before.basicPay);
      const newComputed = this.formula.computeAll(components, after.basicPay);
      const oldNet = this.netFromLines(oldComputed);
      const newNet = this.netFromLines(newComputed);
      const arrearAmount = (newNet - oldNet) * monthsCount;
      if (arrearAmount <= 0) continue;

      await this.prisma.salaryArrearLine.create({
        data: {
          tenantId: user.tid,
          salaryArrearBatchId: batch.id,
          staffProfileId: assignment.staffProfileId,
          monthsCount,
          oldNetSalary: oldNet,
          newNetSalary: newNet,
          arrearAmount,
          breakdown: { oldNet, newNet, monthsCount },
        },
      });
      totalAmount += arrearAmount;
    }

    const result = await this.prisma.salaryArrearBatch.update({
      where: { id: batch.id },
      data: { totalAmount },
      include: { lines: true },
    });

    await this.audit.log({
      tenantId: user.tid,
      entityType: 'ARREAR_BATCH',
      entityId: batch.id,
      action: 'CREATED',
      newValue: { name: dto.name, totalAmount, lineCount: result.lines.length },
      userId: user.sub,
    });

    return result;
  }

  async applyToRun(user: JwtUser, batchId: string, runId: string) {
    const batch = await this.prisma.salaryArrearBatch.findFirst({
      where: { id: batchId, tenantId: user.tid },
      include: { lines: true },
    });
    if (!batch) throw new NotFoundException('Arrear batch not found');
    if (batch.status === 'APPLIED')
      throw new BadRequestException('Arrear batch already applied');

    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, tenantId: user.tid },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    if (run.locked) throw new BadRequestException('Payroll run is locked');

    const updated = await this.prisma.salaryArrearBatch.update({
      where: { id: batchId },
      data: {
        payrollRunId: runId,
        status: 'APPLIED',
        appliedAt: new Date(),
        appliedInMonth: run.month,
        appliedInYear: run.year,
      },
      include: { lines: true },
    });

    await this.audit.log({
      tenantId: user.tid,
      entityType: 'ARREAR_BATCH',
      entityId: batchId,
      action: 'APPLIED_TO_RUN',
      newValue: { payrollRunId: runId, month: run.month, year: run.year },
      userId: user.sub,
    });

    return updated;
  }

  async getArrearsForRun(tenantId: string, runId: string) {
    const batches = await this.prisma.salaryArrearBatch.findMany({
      where: { tenantId, payrollRunId: runId, status: 'APPLIED' },
      include: { lines: true },
    });
    const byStaff = new Map<string, number>();
    for (const batch of batches) {
      for (const line of batch.lines) {
        const cur = byStaff.get(line.staffProfileId) ?? 0;
        byStaff.set(line.staffProfileId, cur + Number(line.arrearAmount));
      }
    }
    return byStaff;
  }

  private netFromLines(
    lines: Array<{ componentType: string; amount: number }>,
  ) {
    let gross = 0;
    let ded = 0;
    for (const l of lines) {
      if (l.componentType === 'EARNING') gross += l.amount;
      else ded += l.amount;
    }
    return gross - ded;
  }

  private monthDiff(from: Date, to: Date) {
    return Math.max(
      0,
      (to.getFullYear() - from.getFullYear()) * 12 +
        (to.getMonth() - from.getMonth()),
    );
  }
}
