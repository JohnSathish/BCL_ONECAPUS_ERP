import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { CreatePayrollRunDto } from '../dto/payroll.dto';
import {
  FormulaEngineService,
  type ComponentOverride,
  type FormulaNode,
} from './formula-engine.service';
import { LoanService } from './loan.service';
import { PayrollAttendanceBridgeService } from './payroll-attendance-bridge.service';
import { PfCpfService } from './pf-cpf.service';
import { AccommodationPayrollBridgeService } from '../../accommodation/services/accommodation-payroll-bridge.service';
import {
  buildPfOverridesFromConfig,
  isPfApplicable,
  mergeComponentOverrides,
  shouldOmitPfPayslipLine,
} from './pf-config-overrides';
import { StaffPfConfigService } from './staff-pf-config.service';
import { PayrollAdjustmentsService } from './payroll-adjustments.service';
import { PayrollAuditService } from './payroll-audit.service';
import { ArrearsService } from './arrears.service';
import { ProfessionalTaxService } from './professional-tax.service';
import {
  isCpfEnabledInAssignment,
  shouldApplyProfessionalTax,
} from './pay-statutory-overrides';
import { TdsService } from './tds.service';
import {
  finalizeStatePayslipTotals,
  isStateExcludedDeduction,
} from './state-payroll-formulas';
import {
  finalizeUgcPayslipTotals,
  isUgcExcludedDeduction,
} from './ugc-payroll-formulas';
import { SubstitutePayrollBridgeService } from './substitute-payroll-bridge.service';

@Injectable()
export class PayrollRunEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly formula: FormulaEngineService,
    private readonly loans: LoanService,
    private readonly attendance: PayrollAttendanceBridgeService,
    private readonly pfCpf: PfCpfService,
    private readonly accommodation: AccommodationPayrollBridgeService,
    private readonly pfConfig: StaffPfConfigService,
    private readonly adjustments: PayrollAdjustmentsService,
    private readonly audit: PayrollAuditService,
    private readonly arrears: ArrearsService,
    private readonly professionalTax: ProfessionalTaxService,
    private readonly tds: TdsService,
    private readonly substituteBridge: SubstitutePayrollBridgeService,
  ) {}

  list(
    tenantId: string,
    query: {
      month?: number;
      year?: number;
      payScaleType?: string;
      status?: string;
    },
  ) {
    return this.prisma.payrollRun.findMany({
      where: {
        tenantId,
        ...(query.month ? { month: query.month } : {}),
        ...(query.year ? { year: query.year } : {}),
        ...(query.payScaleType ? { payScaleType: query.payScaleType } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  async create(user: JwtUser, dto: CreatePayrollRunDto) {
    const existing = await this.prisma.payrollRun.findFirst({
      where: {
        tenantId: user.tid,
        month: dto.month,
        year: dto.year,
        payScaleType: dto.payScaleType ?? null,
      },
    });
    if (existing)
      throw new BadRequestException(
        'Payroll run already exists for this period and scale',
      );

    return this.prisma.payrollRun.create({
      data: {
        tenantId: user.tid,
        month: dto.month,
        year: dto.year,
        payScaleType: dto.payScaleType,
        payStructureTemplateId: dto.payStructureTemplateId,
        label:
          dto.label ??
          `${dto.month}/${dto.year}${dto.payScaleType ? ` - ${dto.payScaleType}` : ''}`,
        preparedById: user.sub,
        preparedAt: new Date(),
      },
    });
  }

  async calculate(user: JwtUser, runId: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, tenantId: user.tid },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    if (run.locked) throw new BadRequestException('Payroll run is locked');

    await this.prisma.payslipLine.deleteMany({
      where: { payslip: { payrollRunId: runId } },
    });
    await this.prisma.pfCpfLedgerEntry.deleteMany({
      where: { payslip: { payrollRunId: runId } },
    });
    await this.prisma.payslip.deleteMany({ where: { payrollRunId: runId } });

    const assignmentWhere: Record<string, unknown> = {
      tenantId: user.tid,
      status: 'ACTIVE',
      effectiveFrom: { lte: new Date(run.year, run.month, 0) },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gte: new Date(run.year, run.month - 1, 1) } },
      ],
    };
    if (run.payScaleType) assignmentWhere.payScaleType = run.payScaleType;

    const assignments = await this.prisma.staffPayAssignment.findMany({
      where: assignmentWhere,
      include: {
        staffProfile: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            departmentId: true,
            designationId: true,
            status: true,
          },
        },
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

    const periodEnd = new Date(run.year, run.month, 0);
    const pfConfigMap = await this.pfConfig.loadEffectiveMap(
      user.tid,
      assignments.map((a) => a.staffProfileId),
      periodEnd,
    );

    const excluded = await this.adjustments.getExcludedStaffIds(
      user.tid,
      runId,
    );
    const collegePaidAssignments =
      await this.substituteBridge.collegePaidAssignmentsForMonth(
        user.tid,
        run.month,
        run.year,
      );
    const collegePaidOriginals = new Set(
      collegePaidAssignments.map((row) => row.originalStaffProfileId),
    );
    const substituteLinkedStaffIds = new Set(
      collegePaidAssignments
        .map((row) => row.substitute.linkedStaffProfileId)
        .filter((id): id is string => Boolean(id)),
    );
    const arrearMap = await this.arrears.getArrearsForRun(user.tid, runId);
    const payrollSettings = await this.prisma.payrollSettings.findUnique({
      where: { tenantId: user.tid },
    });
    const ptComponent = await this.prisma.paySalaryComponent.findFirst({
      where: { tenantId: user.tid, code: 'PROFESSIONAL_TAX', deletedAt: null },
    });
    const tdsComponent = await this.prisma.paySalaryComponent.findFirst({
      where: { tenantId: user.tid, code: 'TDS', deletedAt: null },
    });

    let count = 0;

    for (const assignment of assignments) {
      if (assignment.staffProfile.status !== 'ACTIVE') continue;
      if (excluded.has(assignment.staffProfileId)) continue;
      if (collegePaidOriginals.has(assignment.staffProfileId)) continue;
      if (substituteLinkedStaffIds.has(assignment.staffProfileId)) continue;

      const att = await this.attendance.getProrationFactor(
        user.tid,
        assignment.staffProfileId,
        run.month,
        run.year,
      );
      const loanDeduction = await this.loans.getActiveDeduction(
        user.tid,
        assignment.staffProfileId,
        run.month,
        run.year,
      );

      const basicPay = Number(assignment.basicPay);
      const components = assignment.payStructureTemplate.components.map(
        (c) => ({
          code: c.paySalaryComponent.code,
          name: c.paySalaryComponent.name,
          componentType: c.paySalaryComponent.componentType,
          formulaJson: c.formulaJson as FormulaNode,
          componentId: c.paySalaryComponentId,
          sortOrder: c.sortOrder,
        }),
      );

      const pfSnapshot = pfConfigMap.get(assignment.staffProfileId);
      const pfOverrides = buildPfOverridesFromConfig(pfSnapshot, periodEnd);
      const rawAssignmentOverrides = (assignment.componentOverrides ??
        null) as Record<string, ComponentOverride> | null;
      const isUgc = assignment.payScaleType === 'UGC';
      const isState = assignment.payScaleType === 'STATE';
      const cpfFromAssignment = isUgc || isState;
      const assignmentOverrides = cpfFromAssignment
        ? (rawAssignmentOverrides ?? {})
        : mergeComponentOverrides(rawAssignmentOverrides, pfOverrides);
      const pfApplicable = cpfFromAssignment
        ? isCpfEnabledInAssignment(rawAssignmentOverrides)
        : isPfApplicable(pfSnapshot, periodEnd);

      const computed = this.formula.computeAll(
        components,
        basicPay,
        {
          LOAN_DEDUCTION: loanDeduction,
          PRORATION_FACTOR: att.prorationFactor,
        },
        assignmentOverrides,
      );

      const accommodationLines =
        isUgc || isState
          ? []
          : await this.accommodation.getDeductionsForStaff(
              user.tid,
              assignment.staffProfileId,
              run.month,
              run.year,
            );

      const earningGross = computed
        .filter((l) => l.componentType === 'EARNING')
        .reduce((s, l) => s + l.amount, 0);
      const applyPt =
        !isUgc &&
        !isState &&
        shouldApplyProfessionalTax(
          assignment.payScaleType,
          assignment.payStructureTemplate?.code,
        );
      const ptAmount = applyPt
        ? this.professionalTax.compute(
            earningGross,
            run.month,
            payrollSettings?.professionalTaxSlabs,
          )
        : 0;
      if (ptAmount > 0) {
        const ptIdx = computed.findIndex((l) => l.code === 'PROFESSIONAL_TAX');
        const ptLine = {
          code: 'PROFESSIONAL_TAX',
          name: 'Professional Tax',
          componentType: 'DEDUCTION',
          amount: ptAmount,
          formulaTrace: {
            op: 'PROFESSIONAL_TAX',
            value: ptAmount,
          } as FormulaNode,
        };
        if (ptIdx >= 0) computed[ptIdx] = { ...computed[ptIdx], ...ptLine };
        else computed.push(ptLine);
      }

      const tdsApplicable =
        !isUgc &&
        !isState &&
        (components.some((c) => c.code === 'TDS') ||
          ['CONTRACT', 'GUEST', 'VISITING'].includes(assignment.payScaleType));
      if (tdsApplicable) {
        const tdsAmount = this.tds.computeMonthlyTds(
          earningGross,
          payrollSettings?.tdsSlabs,
        );
        if (tdsAmount > 0 || components.some((c) => c.code === 'TDS')) {
          const tdsIdx = computed.findIndex((l) => l.code === 'TDS');
          const tdsLine = {
            code: 'TDS',
            name: 'Tax Deducted at Source',
            componentType: 'DEDUCTION',
            amount: tdsAmount,
            formulaTrace: { op: 'TDS', value: tdsAmount } as FormulaNode,
          };
          if (tdsIdx >= 0)
            computed[tdsIdx] = { ...computed[tdsIdx], ...tdsLine };
          else computed.push(tdsLine);
        }
      }

      let gross = 0;
      let deductions = 0;
      if (isUgc) {
        const ugcTotals = finalizeUgcPayslipTotals(computed);
        gross = ugcTotals.gross;
        deductions = ugcTotals.deductions;
      } else if (isState) {
        const stateTotals = finalizeStatePayslipTotals(computed);
        gross = stateTotals.gross;
        deductions = stateTotals.deductions;
      } else {
        for (const line of computed) {
          if (line.componentType === 'EARNING') gross += line.amount;
          else deductions += line.amount;
        }
        for (const line of accommodationLines) {
          deductions += line.amount;
        }
      }

      const arrearAmount =
        isUgc || isState ? 0 : (arrearMap.get(assignment.staffProfileId) ?? 0);
      if (arrearAmount > 0) {
        gross += arrearAmount;
      }

      const net = gross - deductions;

      const payslip = await this.prisma.payslip.create({
        data: {
          tenantId: user.tid,
          payrollRunId: runId,
          staffProfileId: assignment.staffProfileId,
          payScaleType: assignment.payScaleType,
          month: run.month,
          year: run.year,
          grossSalary: gross,
          totalDeductions: deductions,
          netSalary: net,
          workingDays: att.workingDays,
          lopDays: att.lopDays,
          prorationFactor: att.prorationFactor,
          verifyToken: randomBytes(16).toString('hex'),
          status: 'DRAFT',
        },
      });

      for (const line of computed) {
        if (shouldOmitPfPayslipLine(line.code, pfApplicable)) continue;
        if (isUgc && isUgcExcludedDeduction(line.code)) continue;
        if (isState && isStateExcludedDeduction(line.code)) continue;
        const comp = components.find((c) => c.code === line.code);
        await this.prisma.payslipLine.create({
          data: {
            tenantId: user.tid,
            payslipId: payslip.id,
            paySalaryComponentId:
              comp?.componentId ??
              (line.code === 'PROFESSIONAL_TAX'
                ? ptComponent?.id
                : line.code === 'TDS'
                  ? tdsComponent?.id
                  : undefined),
            componentCode: line.code,
            componentName: line.name,
            componentType: line.componentType,
            amount: line.amount,
            formulaTrace: line.formulaTrace as object,
            sortOrder: comp?.sortOrder ?? 100,
          },
        });
      }

      for (const line of accommodationLines) {
        await this.prisma.payslipLine.create({
          data: {
            tenantId: user.tid,
            payslipId: payslip.id,
            paySalaryComponentId: line.componentId ?? null,
            componentCode: line.code,
            componentName: line.name,
            componentType: 'DEDUCTION',
            amount: line.amount,
            formulaTrace: { source: 'ACCOMMODATION_MODULE' },
            sortOrder: line.sortOrder,
          },
        });
      }

      if (arrearAmount > 0) {
        await this.prisma.payslipLine.create({
          data: {
            tenantId: user.tid,
            payslipId: payslip.id,
            componentCode: 'SALARY_ARREAR',
            componentName: 'Salary Arrear',
            componentType: 'EARNING',
            amount: arrearAmount,
            formulaTrace: { source: 'ARREAR_BATCH' },
            sortOrder: 850,
          },
        });
      }

      await this.adjustments.applyAdjustmentsToPayslip(payslip.id, runId);

      await this.accommodation.markChargesRecovered(
        user.tid,
        assignment.staffProfileId,
        run.month,
        run.year,
        runId,
        payslip.id,
      );

      await this.pfCpf.recordFromPayslip(
        user.tid,
        payslip.id,
        assignment.staffProfileId,
        run.month,
        run.year,
        computed,
      );

      count++;
    }

    const includeSubstitutePayslips =
      !run.payScaleType ||
      run.payScaleType === 'GUEST' ||
      run.payScaleType === 'COLLEGE_TEACHING';
    if (includeSubstitutePayslips) {
      count += await this.substituteBridge.appendCollegePaidSubstitutePayslips(
        user,
        runId,
        run.month,
        run.year,
      );
    }

    await this.adjustments.recalcRunTotals(runId);
    const runTotals = await this.prisma.payrollRun.findUnique({
      where: { id: runId },
    });

    const updated = await this.prisma.payrollRun.update({
      where: { id: runId },
      data: { status: 'DRAFT' },
    });

    await this.audit.log({
      tenantId: user.tid,
      entityType: 'PAYROLL_RUN',
      entityId: runId,
      action: 'CALCULATED',
      newValue: {
        employeeCount: count,
        totalGross: Number(runTotals?.totalGross ?? 0),
        totalDeductions: Number(runTotals?.totalDeductions ?? 0),
        totalNet: Number(runTotals?.totalNet ?? 0),
      },
      userId: user.sub,
    });

    return updated;
  }

  async getRun(tenantId: string, runId: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, tenantId },
      include: {
        payslips: {
          include: {
            staffProfile: { select: { fullName: true, employeeCode: true } },
            lines: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    return run;
  }
}
