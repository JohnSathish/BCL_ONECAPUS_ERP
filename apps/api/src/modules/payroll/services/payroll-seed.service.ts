import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { FormulaNode } from './formula-engine.service';

const DEFAULT_COMPONENTS = [
  {
    code: 'BASIC',
    name: 'Basic Pay',
    componentType: 'EARNING',
    category: 'CORE',
    sortOrder: 10,
  },
  {
    code: 'DA',
    name: 'Dearness Allowance',
    componentType: 'EARNING',
    category: 'ALLOWANCE',
    sortOrder: 20,
  },
  {
    code: 'CPF_EMPLOYER',
    name: 'CPF Employer Share',
    componentType: 'EARNING',
    category: 'STATUTORY',
    isStatutory: true,
    sortOrder: 25,
  },
  {
    code: 'PF_EARNING',
    name: 'PF (Legacy Gross Component)',
    componentType: 'EARNING',
    category: 'STATUTORY',
    isStatutory: true,
    sortOrder: 26,
  },
  {
    code: 'HRA',
    name: 'House Rent Allowance',
    componentType: 'EARNING',
    category: 'ALLOWANCE',
    sortOrder: 30,
  },
  {
    code: 'MA',
    name: 'Medical Allowance',
    componentType: 'EARNING',
    category: 'ALLOWANCE',
    sortOrder: 40,
  },
  {
    code: 'FIXED_ALLOWANCE',
    name: 'Fixed Allowance',
    componentType: 'EARNING',
    category: 'ALLOWANCE',
    sortOrder: 50,
  },
  {
    code: 'ALLOWANCE',
    name: 'Allowance',
    componentType: 'EARNING',
    category: 'ALLOWANCE',
    sortOrder: 55,
  },
  {
    code: 'TRANSPORT',
    name: 'Transport Allowance',
    componentType: 'EARNING',
    category: 'ALLOWANCE',
    sortOrder: 60,
  },
  {
    code: 'PF',
    name: 'Provident Fund',
    componentType: 'DEDUCTION',
    category: 'STATUTORY',
    isStatutory: true,
    sortOrder: 100,
  },
  {
    code: 'PPF',
    name: 'PPF Deduction',
    componentType: 'DEDUCTION',
    category: 'STATUTORY',
    isStatutory: true,
    sortOrder: 105,
  },
  {
    code: 'CPF',
    name: 'CPF Contribution',
    componentType: 'DEDUCTION',
    category: 'STATUTORY',
    isStatutory: true,
    sortOrder: 110,
  },
  {
    code: 'NPS',
    name: 'National Pension System',
    componentType: 'DEDUCTION',
    category: 'STATUTORY',
    isStatutory: true,
    sortOrder: 115,
  },
  {
    code: 'HOUSE_RENT',
    name: 'House Rent Deduction',
    componentType: 'DEDUCTION',
    category: 'DEDUCTION',
    sortOrder: 120,
  },
  {
    code: 'LOAN',
    name: 'Loan Deduction',
    componentType: 'DEDUCTION',
    category: 'LOAN',
    sortOrder: 130,
  },
  {
    code: 'TDS',
    name: 'Tax Deducted at Source',
    componentType: 'DEDUCTION',
    category: 'STATUTORY',
    isStatutory: true,
    sortOrder: 140,
  },
  {
    code: 'PROFESSIONAL_TAX',
    name: 'Professional Tax',
    componentType: 'DEDUCTION',
    category: 'STATUTORY',
    isStatutory: true,
    sortOrder: 150,
  },
  {
    code: 'DAILY_WAGE',
    name: 'Daily Wage',
    componentType: 'EARNING',
    category: 'CORE',
    sortOrder: 15,
  },
];

type StructureDef = {
  code: string;
  name: string;
  structureType: string;
  payScaleTypes: string[];
  components: Array<{ code: string; formula: FormulaNode }>;
};

const pct = (base: string, rate: number): FormulaNode => ({
  op: 'PERCENT_OF',
  base,
  rate,
  round: 'NEAREST_RUPEE',
});
const loan = (): FormulaNode => ({ op: 'LOAN_DEDUCTION' });
const basicRef = (): FormulaNode => ({
  op: 'ASSIGNED_BASIC',
  round: 'NEAREST_RUPEE',
});

const STRUCTURES: StructureDef[] = [
  {
    code: 'COLLEGE_TEACHING',
    name: 'College Teaching Staff',
    structureType: 'COLLEGE_TEACHING',
    payScaleTypes: ['COLLEGE_TEACHING'],
    components: [
      { code: 'BASIC', formula: basicRef() },
      { code: 'FIXED_ALLOWANCE', formula: pct('BASIC', 15) },
      { code: 'PF', formula: pct('BASIC', 12) },
      { code: 'LOAN', formula: loan() },
      { code: 'HOUSE_RENT', formula: pct('BASIC', 5) },
    ],
  },
  {
    code: 'COLLEGE_NON_TEACHING',
    name: 'College Non-Teaching Staff',
    structureType: 'COLLEGE_NON_TEACHING',
    payScaleTypes: ['COLLEGE_NON_TEACHING'],
    components: [
      { code: 'BASIC', formula: basicRef() },
      { code: 'ALLOWANCE', formula: pct('BASIC', 20) },
      { code: 'PF', formula: pct('BASIC', 12) },
      { code: 'LOAN', formula: loan() },
    ],
  },
  {
    code: 'UGC_SCALE',
    name: 'UGC Pay Scale',
    structureType: 'UGC',
    payScaleTypes: ['UGC'],
    components: [
      { code: 'BASIC', formula: basicRef() },
      { code: 'DA', formula: pct('BASIC', 58) },
      { code: 'CPF', formula: pct('BASIC', 10) },
      { code: 'HOUSE_RENT', formula: pct('BASIC', 10) },
      { code: 'LOAN', formula: loan() },
    ],
  },
  {
    code: 'STATE_SCALE',
    name: 'State Government Pay Scale',
    structureType: 'STATE',
    payScaleTypes: ['STATE'],
    components: [
      { code: 'BASIC', formula: basicRef() },
      { code: 'DA', formula: pct('BASIC', 58) },
      { code: 'HRA', formula: pct('BASIC', 15) },
      {
        code: 'MA',
        formula: { op: 'FIXED', value: 500, round: 'NEAREST_RUPEE' },
      },
      { code: 'CPF', formula: pct('BASIC', 10) },
      { code: 'NPS', formula: pct('BASIC', 10) },
      { code: 'LOAN', formula: loan() },
    ],
  },
  {
    code: 'CONTRACT',
    name: 'Contract Staff',
    structureType: 'CONTRACT',
    payScaleTypes: ['CONTRACT'],
    components: [
      { code: 'BASIC', formula: basicRef() },
      { code: 'FIXED_ALLOWANCE', formula: pct('BASIC', 10) },
      { code: 'TDS', formula: pct('BASIC', 10) },
    ],
  },
  {
    code: 'GUEST_FACULTY',
    name: 'Guest / Visiting Faculty',
    structureType: 'GUEST',
    payScaleTypes: ['GUEST', 'VISITING'],
    components: [
      { code: 'BASIC', formula: basicRef() },
      { code: 'FIXED_ALLOWANCE', formula: pct('BASIC', 5) },
      { code: 'TDS', formula: pct('BASIC', 10) },
    ],
  },
  {
    code: 'DAILY_WAGE',
    name: 'Daily Wage Staff',
    structureType: 'DAILY_WAGE',
    payScaleTypes: ['DAILY_WAGE'],
    components: [
      {
        code: 'DAILY_WAGE',
        formula: {
          op: 'PRORATE',
          args: [{ op: 'REFERENCE', ref: 'BASIC' }],
          round: 'NEAREST_RUPEE',
        },
      },
    ],
  },
];

@Injectable()
export class PayrollSeedService implements OnModuleInit {
  private readonly logger = new Logger(PayrollSeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      const tenants = await this.prisma.tenant.findMany({
        select: { id: true },
      });
      for (const tenant of tenants) {
        await this.seedTenant(tenant.id);
      }
    } catch (err) {
      this.logger.warn(
        `Payroll seed skipped: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  async seedTenant(tenantId: string) {
    const existing = await this.prisma.paySalaryComponent.count({
      where: { tenantId },
    });
    if (existing > 0) return;

    const componentMap = new Map<string, string>();
    for (const comp of DEFAULT_COMPONENTS) {
      const row = await this.prisma.paySalaryComponent.create({
        data: {
          tenantId,
          code: comp.code,
          name: comp.name,
          componentType: comp.componentType,
          category: comp.category,
          isStatutory: comp.isStatutory ?? false,
          sortOrder: comp.sortOrder,
        },
      });
      componentMap.set(comp.code, row.id);
    }

    for (const struct of STRUCTURES) {
      const template = await this.prisma.payStructureTemplate.create({
        data: {
          tenantId,
          code: struct.code,
          name: struct.name,
          structureType: struct.structureType,
          payScaleTypes: struct.payScaleTypes,
          status: 'ACTIVE',
        },
      });
      for (const [idx, comp] of struct.components.entries()) {
        const compId = componentMap.get(comp.code);
        if (!compId) continue;
        await this.prisma.payStructureComponent.create({
          data: {
            tenantId,
            payStructureTemplateId: template.id,
            paySalaryComponentId: compId,
            formulaJson: comp.formula as object,
            sortOrder: (idx + 1) * 10,
          },
        });
      }
    }

    await this.prisma.payrollSettings.upsert({
      where: { tenantId },
      create: {
        tenantId,
        defaultPfRate: 12,
        defaultCpfRate: 10,
        payslipFooter: 'This is a computer-generated payslip.',
      },
      update: {},
    });

    this.logger.log(`Payroll defaults seeded for tenant ${tenantId}`);
  }
}
