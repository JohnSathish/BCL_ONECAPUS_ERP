import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  currentFinancialYearStart,
  financialYearBounds,
  financialYearLabel,
} from '../utils/financial-year.util';

type GroupSeed = {
  code: string;
  name: string;
  nature: string;
  sortOrder: number;
  children?: GroupSeed[];
};

type LedgerSeed = {
  groupCode: string;
  code: string;
  name: string;
  ledgerType?: string;
  isCash?: boolean;
  isBank?: boolean;
  bankName?: string;
};

const DEFAULT_GROUPS: GroupSeed[] = [
  {
    code: 'ASSETS',
    name: 'Assets',
    nature: 'ASSET',
    sortOrder: 10,
    children: [
      {
        code: 'CURRENT_ASSETS',
        name: 'Current Assets',
        nature: 'ASSET',
        sortOrder: 11,
      },
      {
        code: 'FIXED_ASSETS',
        name: 'Fixed Assets',
        nature: 'ASSET',
        sortOrder: 12,
      },
    ],
  },
  {
    code: 'LIABILITIES',
    name: 'Liabilities',
    nature: 'LIABILITY',
    sortOrder: 20,
    children: [
      {
        code: 'CURRENT_LIABILITIES',
        name: 'Current Liabilities',
        nature: 'LIABILITY',
        sortOrder: 21,
      },
    ],
  },
  {
    code: 'INCOME',
    name: 'Income',
    nature: 'INCOME',
    sortOrder: 30,
    children: [
      {
        code: 'FEE_INCOME',
        name: 'Fee Income',
        nature: 'INCOME',
        sortOrder: 31,
      },
      {
        code: 'OTHER_INCOME',
        name: 'Other Income',
        nature: 'INCOME',
        sortOrder: 32,
      },
    ],
  },
  {
    code: 'EXPENSES',
    name: 'Expenses',
    nature: 'EXPENSE',
    sortOrder: 40,
    children: [
      {
        code: 'OPERATING_EXPENSES',
        name: 'Operating Expenses',
        nature: 'EXPENSE',
        sortOrder: 41,
      },
    ],
  },
];

const DEFAULT_LEDGERS: LedgerSeed[] = [
  {
    groupCode: 'CURRENT_ASSETS',
    code: 'CASH',
    name: 'Cash',
    ledgerType: 'CASH',
    isCash: true,
  },
  {
    groupCode: 'CURRENT_ASSETS',
    code: 'SBI-CA',
    name: 'SBI Current Account',
    ledgerType: 'BANK',
    isBank: true,
    bankName: 'State Bank of India',
  },
  {
    groupCode: 'CURRENT_ASSETS',
    code: 'BOB-CA',
    name: 'Bank of Baroda',
    ledgerType: 'BANK',
    isBank: true,
    bankName: 'Bank of Baroda',
  },
  {
    groupCode: 'FEE_INCOME',
    code: 'ADM-FEES',
    name: 'Admission Fees',
  },
  {
    groupCode: 'FEE_INCOME',
    code: 'TUITION-FEES',
    name: 'Tuition Fees',
  },
  {
    groupCode: 'FEE_INCOME',
    code: 'EXAM-FEES',
    name: 'Examination Fees',
  },
  {
    groupCode: 'FEE_INCOME',
    code: 'HOSTEL-FEES',
    name: 'Hostel Fees',
  },
  {
    groupCode: 'FEE_INCOME',
    code: 'LIBRARY-FEES',
    name: 'Library Fees',
  },
  {
    groupCode: 'OTHER_INCOME',
    code: 'GRANTS',
    name: 'Government Grants',
  },
  {
    groupCode: 'OTHER_INCOME',
    code: 'DONATIONS',
    name: 'Donations',
  },
  {
    groupCode: 'CURRENT_LIABILITIES',
    code: 'SALARY-PAYABLE',
    name: 'Salary Payable',
  },
  {
    groupCode: 'CURRENT_LIABILITIES',
    code: 'VENDOR-PAYABLE',
    name: 'Vendor Payable',
  },
  {
    groupCode: 'OPERATING_EXPENSES',
    code: 'SALARIES',
    name: 'Salaries',
  },
  {
    groupCode: 'OPERATING_EXPENSES',
    code: 'ELECTRICITY',
    name: 'Electricity',
  },
  {
    groupCode: 'OPERATING_EXPENSES',
    code: 'INTERNET',
    name: 'Internet',
  },
  {
    groupCode: 'OPERATING_EXPENSES',
    code: 'STATIONERY',
    name: 'Stationery',
  },
  {
    groupCode: 'OPERATING_EXPENSES',
    code: 'MAINTENANCE',
    name: 'Maintenance',
  },
  {
    groupCode: 'FIXED_ASSETS',
    code: 'FA-FURNITURE',
    name: 'Furniture & Fixtures',
  },
  {
    groupCode: 'FIXED_ASSETS',
    code: 'FA-COMPUTERS',
    name: 'Computers & Equipment',
  },
  {
    groupCode: 'FIXED_ASSETS',
    code: 'ACCUM-DEP',
    name: 'Accumulated Depreciation',
  },
  {
    groupCode: 'OPERATING_EXPENSES',
    code: 'DEPRECIATION',
    name: 'Depreciation Expense',
  },
  {
    groupCode: 'CURRENT_LIABILITIES',
    code: 'PF-PAYABLE',
    name: 'PF Payable',
  },
  {
    groupCode: 'CURRENT_LIABILITIES',
    code: 'PT-PAYABLE',
    name: 'Professional Tax Payable',
  },
  {
    groupCode: 'CURRENT_LIABILITIES',
    code: 'TDS-PAYABLE',
    name: 'TDS Payable',
  },
  {
    groupCode: 'CURRENT_LIABILITIES',
    code: 'PAYROLL-DEDUCTIONS',
    name: 'Other Payroll Deductions',
  },
];

const DEFAULT_VOUCHER_TYPES = [
  { code: 'RECEIPT', name: 'Receipt Voucher', prefix: 'RV', sortOrder: 1 },
  { code: 'PAYMENT', name: 'Payment Voucher', prefix: 'PV', sortOrder: 2 },
  { code: 'JOURNAL', name: 'Journal Voucher', prefix: 'JV', sortOrder: 3 },
  { code: 'CONTRA', name: 'Contra Voucher', prefix: 'CV', sortOrder: 4 },
  { code: 'OPENING', name: 'Opening Balance', prefix: 'OB', sortOrder: 5 },
];

@Injectable()
export class AccountingBootstrapService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureTenantSetup(tenantId: string) {
    const existing = await this.prisma.accountingFinancialYear.count({
      where: { tenantId },
    });
    if (existing > 0) {
      await this.seedIntegrationDefaults(tenantId);
      return { bootstrapped: false };
    }

    await this.seedGroups(tenantId);
    await this.seedLedgers(tenantId);
    await this.seedVoucherTypes(tenantId);
    const fy = await this.seedCurrentFinancialYear(tenantId);
    await this.seedIntegrationDefaults(tenantId);
    return { bootstrapped: true, financialYearId: fy.id };
  }

  async seedIntegrationDefaults(tenantId: string) {
    await this.ensureMissingLedgers(tenantId);
    const ledgers = await this.prisma.accountingLedgerAccount.findMany({
      where: { tenantId },
    });
    const byCode = new Map(ledgers.map((l) => [l.code, l.id]));
    const cashId = byCode.get('CASH');
    const bankId = byCode.get('SBI-CA');
    const tuitionId = byCode.get('TUITION-FEES');
    const salariesId = byCode.get('SALARIES');
    const salaryPayableId = byCode.get('SALARY-PAYABLE');
    const payrollDeductionsId = byCode.get('PAYROLL-DEDUCTIONS');

    await this.prisma.accountingSettings.upsert({
      where: { tenantId },
      create: {
        tenantId,
        autoPostFees: true,
        autoPostPayroll: true,
        defaultCashLedgerId: cashId,
        defaultBankLedgerId: bankId,
        defaultIncomeLedgerId: tuitionId,
        salaryExpenseLedgerId: salariesId,
        salaryPayableLedgerId: salaryPayableId,
        payrollDeductionsLedgerId: payrollDeductionsId,
      },
      update: {
        defaultCashLedgerId: cashId ?? undefined,
        defaultBankLedgerId: bankId ?? undefined,
        defaultIncomeLedgerId: tuitionId ?? undefined,
        salaryExpenseLedgerId: salariesId ?? undefined,
        salaryPayableLedgerId: salaryPayableId ?? undefined,
        payrollDeductionsLedgerId: payrollDeductionsId ?? undefined,
      },
    });

    const feeMappings = [
      ['ADM-FEES', 'ADM-FEES'],
      ['TUITION-FEES', 'TUITION-FEES'],
      ['EXAM-FEES', 'EXAM-FEES'],
      ['HOSTEL-FEES', 'HOSTEL-FEES'],
      ['LIBRARY-FEES', 'LIBRARY-FEES'],
      ['SESSION-FEE', 'TUITION-FEES'],
      ['MONTHLY-FEE', 'TUITION-FEES'],
    ] as const;

    for (const [sourceKey, ledgerCode] of feeMappings) {
      const incomeLedgerId = byCode.get(ledgerCode);
      if (!incomeLedgerId) continue;
      await this.prisma.accountingFeeHeadMapping.upsert({
        where: { tenantId_sourceKey: { tenantId, sourceKey } },
        create: { tenantId, sourceKey, incomeLedgerId },
        update: { incomeLedgerId, isActive: true },
      });
    }

    const paymentModes = [
      ['CASH', cashId],
      ['CHEQUE', bankId],
      ['DD', bankId],
      ['NEFT', bankId],
      ['RTGS', bankId],
      ['UPI', bankId],
      ['BANK_TRANSFER', bankId],
      ['GATEWAY', bankId],
      ['ONLINE', bankId],
    ] as const;

    for (const [paymentMode, debitLedgerId] of paymentModes) {
      if (!debitLedgerId) continue;
      await this.prisma.accountingPaymentModeMapping.upsert({
        where: { tenantId_paymentMode: { tenantId, paymentMode } },
        create: { tenantId, paymentMode, debitLedgerId },
        update: { debitLedgerId, isActive: true },
      });
    }

    const payrollMappings = [
      ['PF', 'PF-PAYABLE'],
      ['EPF', 'PF-PAYABLE'],
      ['CPF', 'PF-PAYABLE'],
      ['PT', 'PT-PAYABLE'],
      ['TDS', 'TDS-PAYABLE'],
      ['LOAN', 'PAYROLL-DEDUCTIONS'],
    ] as const;

    for (const [componentCode, ledgerCode] of payrollMappings) {
      const ledgerAccountId = byCode.get(ledgerCode);
      if (!ledgerAccountId) continue;
      await this.prisma.accountingPayrollComponentMapping.upsert({
        where: { tenantId_componentCode: { tenantId, componentCode } },
        create: { tenantId, componentCode, ledgerAccountId },
        update: { ledgerAccountId, isActive: true },
      });
    }
  }

  private async ensureMissingLedgers(tenantId: string) {
    const groups = await this.prisma.accountingAccountGroup.findMany({
      where: { tenantId },
    });
    const groupByCode = new Map(groups.map((g) => [g.code, g.id]));

    for (const ledger of DEFAULT_LEDGERS) {
      const groupId = groupByCode.get(ledger.groupCode);
      if (!groupId) continue;

      await this.prisma.accountingLedgerAccount.upsert({
        where: { tenantId_code: { tenantId, code: ledger.code } },
        create: {
          tenantId,
          groupId,
          code: ledger.code,
          name: ledger.name,
          ledgerType: ledger.ledgerType ?? 'GENERAL',
          isCash: ledger.isCash ?? false,
          isBank: ledger.isBank ?? false,
          bankName: ledger.bankName,
        },
        update: {},
      });
    }
  }

  private async seedGroups(tenantId: string) {
    for (const root of DEFAULT_GROUPS) {
      const parent = await this.prisma.accountingAccountGroup.upsert({
        where: { tenantId_code: { tenantId, code: root.code } },
        create: {
          tenantId,
          code: root.code,
          name: root.name,
          nature: root.nature,
          sortOrder: root.sortOrder,
          isSystem: true,
        },
        update: {},
      });

      for (const child of root.children ?? []) {
        await this.prisma.accountingAccountGroup.upsert({
          where: { tenantId_code: { tenantId, code: child.code } },
          create: {
            tenantId,
            parentId: parent.id,
            code: child.code,
            name: child.name,
            nature: child.nature,
            sortOrder: child.sortOrder,
            isSystem: true,
          },
          update: {},
        });
      }
    }
  }

  private async seedLedgers(tenantId: string) {
    const groups = await this.prisma.accountingAccountGroup.findMany({
      where: { tenantId },
    });
    const byCode = new Map(groups.map((g) => [g.code, g.id]));

    for (const ledger of DEFAULT_LEDGERS) {
      const groupId = byCode.get(ledger.groupCode);
      if (!groupId) continue;

      await this.prisma.accountingLedgerAccount.upsert({
        where: { tenantId_code: { tenantId, code: ledger.code } },
        create: {
          tenantId,
          groupId,
          code: ledger.code,
          name: ledger.name,
          ledgerType: ledger.ledgerType ?? 'GENERAL',
          isCash: ledger.isCash ?? false,
          isBank: ledger.isBank ?? false,
          bankName: ledger.bankName,
        },
        update: {},
      });
    }
  }

  private async seedVoucherTypes(tenantId: string) {
    for (const vt of DEFAULT_VOUCHER_TYPES) {
      await this.prisma.accountingVoucherType.upsert({
        where: { tenantId_code: { tenantId, code: vt.code } },
        create: {
          tenantId,
          code: vt.code,
          name: vt.name,
          prefix: vt.prefix,
          sortOrder: vt.sortOrder,
          isSystem: true,
        },
        update: {},
      });
    }
  }

  private async seedCurrentFinancialYear(tenantId: string) {
    const startYear = currentFinancialYearStart();
    const bounds = financialYearBounds(startYear);
    const label = financialYearLabel(startYear);

    const fy = await this.prisma.accountingFinancialYear.create({
      data: {
        tenantId,
        label,
        startYear,
        startDate: bounds.startDate,
        endDate: bounds.endDate,
        status: 'OPEN',
        isActive: true,
      },
    });

    const voucherTypes = await this.prisma.accountingVoucherType.findMany({
      where: { tenantId },
    });
    for (const vt of voucherTypes) {
      await this.prisma.accountingVoucherSequence.create({
        data: {
          tenantId,
          voucherTypeId: vt.id,
          financialYearId: fy.id,
          currentNo: 0,
        },
      });
    }

    return fy;
  }
}
