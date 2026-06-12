import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import type { FormulaNode } from './formula-engine.service';

const pct = (base: string, rate: number): FormulaNode => ({
  op: 'PERCENT_OF',
  base,
  rate,
  round: 'NEAREST_RUPEE',
});
const fixed = (value: number): FormulaNode => ({
  op: 'FIXED',
  value,
  round: 'NEAREST_RUPEE',
});
const ref = (code: string): FormulaNode => ({ op: 'REFERENCE', ref: code });
const loan = (): FormulaNode => ({ op: 'LOAN_DEDUCTION' });
const basicRef = (): FormulaNode => ({
  op: 'ASSIGNED_BASIC',
  round: 'NEAREST_RUPEE',
});
const doubleRef = (code: string): FormulaNode => ({
  op: 'SUM',
  round: 'NEAREST_RUPEE',
  args: [ref(code), ref(code)],
});

/** PF = min(12% of basic, ₹780) — DBC legacy teaching sheet */
const legacyPfEarning = (): FormulaNode => ({
  op: 'MIN',
  round: 'NEAREST_RUPEE',
  args: [pct('BASIC', 12), fixed(780)],
});

const EXTRA_COMPONENTS = [
  {
    code: 'CPF_EMPLOYER',
    name: 'CPF Employer Share',
    componentType: 'EARNING',
    category: 'STATUTORY',
    isStatutory: true,
    sortOrder: 25,
  },
  {
    code: 'PF_EMPLOYER',
    name: 'Employer PF Contribution',
    componentType: 'EARNING',
    category: 'STATUTORY',
    isStatutory: true,
    sortOrder: 26,
  },
  {
    code: 'PF_EMPLOYEE',
    name: 'Employee PF Contribution',
    componentType: 'DEDUCTION',
    category: 'STATUTORY',
    isStatutory: true,
    sortOrder: 106,
  },
  {
    code: 'PPF',
    name: 'Employer PF Recovery (PPF)',
    componentType: 'DEDUCTION',
    category: 'STATUTORY',
    isStatutory: true,
    sortOrder: 107,
  },
];

type StructureSeed = {
  code: string;
  name: string;
  structureType: string;
  payScaleTypes: string[];
  description?: string;
  components: Array<{ code: string; formula: FormulaNode }>;
};

const DBC_STRUCTURES: StructureSeed[] = [
  {
    code: 'DBC_UGC_7TH',
    name: 'DBC UGC 7th Pay (DA 58%)',
    structureType: 'UGC',
    payScaleTypes: ['UGC'],
    description:
      'Don Bosco College UGC scale — DA 58%, CPF 10%/8% (override per staff)',
    components: [
      { code: 'BASIC', formula: basicRef() },
      { code: 'DA', formula: pct('BASIC', 58) },
      { code: 'CPF_EMPLOYER', formula: pct('BASIC', 10) },
      { code: 'CPF', formula: doubleRef('CPF_EMPLOYER') },
      { code: 'HOUSE_RENT', formula: fixed(0) },
      { code: 'LOAN', formula: loan() },
    ],
  },
  {
    code: 'DBC_TEACHING_LEGACY',
    name: 'DBC Legacy Teaching (PF cap ₹780)',
    structureType: 'COLLEGE_TEACHING',
    payScaleTypes: ['COLLEGE_TEACHING'],
    description:
      'Legacy teaching — Employer PF added to gross; employee + employer PF deducted (PPF)',
    components: [
      { code: 'BASIC', formula: basicRef() },
      { code: 'PF_EMPLOYER', formula: legacyPfEarning() },
      { code: 'PF_EMPLOYEE', formula: ref('PF_EMPLOYER') },
      { code: 'PPF', formula: ref('PF_EMPLOYER') },
      { code: 'HOUSE_RENT', formula: fixed(0) },
      { code: 'LOAN', formula: loan() },
    ],
  },
  {
    code: 'DBC_NON_TEACHING',
    name: 'DBC Non-Teaching (Basic + Fixed Allowance)',
    structureType: 'COLLEGE_NON_TEACHING',
    payScaleTypes: ['COLLEGE_NON_TEACHING'],
    description:
      'Non-teaching staff — individual Basic and Fixed Allowance per person; PF 12% of basic; PT auto-applied',
    components: [
      { code: 'BASIC', formula: basicRef() },
      { code: 'ALLOWANCE', formula: pct('BASIC', 20) },
      { code: 'PF', formula: pct('BASIC', 12) },
      { code: 'LOAN', formula: loan() },
    ],
  },
];

@Injectable()
export class DbcPayrollSetupService implements OnModuleInit {
  private readonly logger = new Logger(DbcPayrollSetupService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      const tenants = await this.prisma.tenant.findMany({
        select: { id: true },
      });
      for (const tenant of tenants) {
        await this.ensureTenant(tenant.id);
      }
    } catch (err) {
      this.logger.warn(
        `DBC payroll setup skipped: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  async ensureTenant(tenantId: string) {
    const componentMap = await this.ensureComponents(tenantId);
    await this.fixBasicCircularFormulas(tenantId);
    for (const struct of DBC_STRUCTURES) {
      await this.ensureStructure(tenantId, struct, componentMap);
    }
    await this.ensureExportLayouts(tenantId);
    await this.ensurePayslipDefaults(tenantId);
  }

  /** Default payslip footer and header hints for DBC. */
  private async ensurePayslipDefaults(tenantId: string) {
    const settings = await this.prisma.payrollSettings.findUnique({
      where: { tenantId },
    });
    const layouts = (settings?.exportLayouts ?? {}) as Record<string, unknown>;
    const existingHeader = (layouts._payslipHeader ?? {}) as Record<
      string,
      string | undefined
    >;
    const payslipHeader = {
      institutionName: 'DON BOSCO COLLEGE, TURA',
      addressLine: 'Tura, West Garo Hills, Meghalaya – 794002',
      affiliationLine: 'Affiliated to NEHU, Shillong',
      accreditationLine: 'NAAC Accredited',
      websiteUrl: 'https://erp.donboscocollege.ac.in',
      signatoryLabel: 'Authorized Signatory',
      signatoryTitle: 'Accounts Officer',
      signatoryName: '',
      signatories: {
        prepared: {
          label: 'Prepared By',
          designation: 'Accounts Officer',
          name: '',
        },
        verified: {
          label: 'Verified By',
          designation: 'Administrative Officer',
          name: '',
        },
        approved: { label: 'Approved By', designation: 'Principal', name: '' },
      },
      ...existingHeader,
    };

    const exportLayouts: Prisma.InputJsonValue = {
      ...layouts,
      _payslipHeader: payslipHeader,
    };

    await this.prisma.payrollSettings.upsert({
      where: { tenantId },
      create: {
        tenantId,
        payslipFooter:
          'This is a computer-generated payslip. For queries contact the Accounts Office, Don Bosco College Tura.',
        exportLayouts,
      },
      update: {
        payslipFooter:
          settings?.payslipFooter ??
          'This is a computer-generated payslip. For queries contact the Accounts Office, Don Bosco College Tura.',
        exportLayouts,
      },
    });
  }

  /** Seed DBC-specific Excel column layouts when not already configured. */
  private async ensureExportLayouts(tenantId: string) {
    const settings = await this.prisma.payrollSettings.findUnique({
      where: { tenantId },
    });
    const existing = (settings?.exportLayouts ?? {}) as Record<
      string,
      string[]
    >;
    const defaults: Record<string, string[]> = {
      DBC_NON_TEACHING: [
        'Sl',
        'Employee Code',
        'Name',
        'Department',
        'Basic',
        'Fixed Allowance',
        'Gross',
        'PF',
        'Professional Tax',
        'Loan',
        'Net',
      ],
      DBC_UGC_7TH: [
        'Sl',
        'Employee Code',
        'Name',
        'Basic',
        'DA',
        'CPF Employer',
        'Gross',
        'CPF Deduction',
        'House Rent',
        'Loan',
        'Net',
      ],
      DBC_TEACHING_LEGACY: [
        'Sl',
        'Employee Code',
        'Name',
        'Basic',
        'PF Employer',
        'Gross',
        'PPF',
        'House Rent',
        'Loan',
        'Net',
      ],
    };

    const merged = { ...existing };
    let changed = false;
    for (const [key, columns] of Object.entries(defaults)) {
      if (!merged[key]?.length) {
        merged[key] = columns;
        changed = true;
      }
    }
    if (!changed) return;

    await this.prisma.payrollSettings.upsert({
      where: { tenantId },
      create: { tenantId, exportLayouts: merged },
      update: { exportLayouts: merged },
    });
    this.logger.log(`Ensured DBC export layouts for tenant ${tenantId}`);
  }

  /** Replace self-referencing BASIC formulas that break payroll calculation. */
  private async fixBasicCircularFormulas(tenantId: string) {
    const rows = await this.prisma.payStructureComponent.findMany({
      where: { tenantId, paySalaryComponent: { code: 'BASIC' } },
      select: { id: true, formulaJson: true },
    });
    for (const row of rows) {
      const fj = row.formulaJson as FormulaNode;
      if (
        fj?.op?.toUpperCase() !== 'REFERENCE' ||
        String(fj.ref ?? '').toUpperCase() !== 'BASIC'
      )
        continue;
      await this.prisma.payStructureComponent.update({
        where: { id: row.id },
        data: { formulaJson: { op: 'ASSIGNED_BASIC', round: 'NEAREST_RUPEE' } },
      });
    }
  }

  private async ensureComponents(tenantId: string) {
    const existing = await this.prisma.paySalaryComponent.findMany({
      where: { tenantId, deletedAt: null },
    });
    const map = new Map(existing.map((c) => [c.code, c.id]));

    for (const comp of EXTRA_COMPONENTS) {
      if (map.has(comp.code)) continue;
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
      map.set(comp.code, row.id);
      this.logger.log(
        `Added salary component ${comp.code} for tenant ${tenantId}`,
      );
    }

    return map;
  }

  private async ensureStructure(
    tenantId: string,
    struct: StructureSeed,
    componentMap: Map<string, string>,
  ) {
    const allComponents = await this.prisma.paySalaryComponent.findMany({
      where: { tenantId, deletedAt: null },
    });
    for (const c of allComponents) componentMap.set(c.code, c.id);

    let template = await this.prisma.payStructureTemplate.findFirst({
      where: { tenantId, code: struct.code, deletedAt: null },
    });

    if (!template) {
      template = await this.prisma.payStructureTemplate.create({
        data: {
          tenantId,
          code: struct.code,
          name: struct.name,
          structureType: struct.structureType,
          payScaleTypes: struct.payScaleTypes,
          description: struct.description,
          status: 'ACTIVE',
        },
      });
      this.logger.log(
        `Created pay structure ${struct.code} for tenant ${tenantId}`,
      );
    } else if (struct.description) {
      await this.prisma.payStructureTemplate.update({
        where: { id: template.id },
        data: { name: struct.name, description: struct.description },
      });
    }

    await this.syncStructureComponents(
      tenantId,
      template.id,
      struct,
      componentMap,
    );
  }

  /** Keep DBC structure formulas aligned with institution salary rules. */
  private async syncStructureComponents(
    tenantId: string,
    templateId: string,
    struct: StructureSeed,
    componentMap: Map<string, string>,
  ) {
    const expectedCodes = new Set(struct.components.map((c) => c.code));
    const existing = await this.prisma.payStructureComponent.findMany({
      where: { payStructureTemplateId: templateId },
      include: { paySalaryComponent: true },
    });

    for (const row of existing) {
      if (!expectedCodes.has(row.paySalaryComponent.code)) {
        await this.prisma.payStructureComponent.delete({
          where: { id: row.id },
        });
      }
    }

    for (const [idx, comp] of struct.components.entries()) {
      const compId = componentMap.get(comp.code);
      if (!compId) {
        this.logger.warn(
          `Skipping ${struct.code} component ${comp.code} — not found`,
        );
        continue;
      }
      const sortOrder = (idx + 1) * 10;
      const existingRow = await this.prisma.payStructureComponent.findFirst({
        where: {
          payStructureTemplateId: templateId,
          paySalaryComponentId: compId,
        },
      });
      if (existingRow) {
        await this.prisma.payStructureComponent.update({
          where: { id: existingRow.id },
          data: { formulaJson: comp.formula as object, sortOrder },
        });
      } else {
        await this.prisma.payStructureComponent.create({
          data: {
            tenantId,
            payStructureTemplateId: templateId,
            paySalaryComponentId: compId,
            formulaJson: comp.formula as object,
            sortOrder,
          },
        });
      }
    }
  }
}
