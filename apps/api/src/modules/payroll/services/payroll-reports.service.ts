import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { PrismaService } from '../../../database/prisma.service';
import { PayrollExcelStylesService } from './payroll-excel-styles.service';
import { buildStateBreakdownFromLines } from './state-payroll-formulas';
import { buildUgcBreakdownFromLines } from './ugc-payroll-formulas';

const DEFAULT_LAYOUTS: Record<string, string[]> = {
  COLLEGE_TEACHING: [
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
  COLLEGE_NON_TEACHING: [
    'Sl',
    'Employee Code',
    'Name',
    'Department',
    'Basic',
    'Allowance',
    'Gross',
    'PF',
    'House Rent',
    'Loan',
    'Net',
  ],
  UGC: [
    'Sl',
    'Employee Code',
    'Name',
    'Basic',
    'DA',
    'CPF Employer',
    'Gross',
    'CPF Deduction',
    'TDS',
    'House Rent',
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
    'TDS',
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
  STATE: [
    'Sl',
    'Employee Code',
    'Name',
    'Department',
    'Basic',
    'DA',
    'HRA',
    'MA',
    'CPF',
    'Loan',
    'Gross',
    'Net',
  ],
};

const HEADER_VALUE: Record<
  string,
  (
    ps: {
      payScaleType?: string;
      grossSalary: unknown;
      netSalary: unknown;
      staffProfile: {
        employeeCode: string;
        fullName: string;
        department?: { name: string } | null;
      };
      lines: Array<{
        componentCode: string;
        componentName?: string;
        componentType?: string;
        amount: unknown;
      }>;
    },
    sl: number,
  ) => string | number
> = {
  Sl: (_ps, sl) => sl,
  'Employee Code': (ps) => ps.staffProfile.employeeCode,
  Name: (ps) => ps.staffProfile.fullName,
  Department: (ps) => ps.staffProfile.department?.name ?? '',
  Basic: (ps) => lineAmt(ps.lines, 'BASIC'),
  'PF Employer': (ps) => lineAmt(ps.lines, 'PF_EMPLOYER', 'PF_EARNING', 'PF'),
  'PF Earning': (ps) => lineAmt(ps.lines, 'PF_EMPLOYER', 'PF_EARNING', 'PF'),
  PF: (ps) => lineAmt(ps.lines, 'PF', 'PF_EMPLOYEE'),
  PPF: (ps) => {
    const emp = lineAmt(ps.lines, 'PF_EMPLOYEE');
    const er = lineAmt(ps.lines, 'PPF');
    if (emp + er > 0) return emp + er;
    const employer = lineAmt(ps.lines, 'PF_EMPLOYER', 'PF_EARNING', 'PF');
    return employer * 2;
  },
  'House Rent': (ps) => lineAmt(ps.lines, 'HOUSE_RENT'),
  Loan: (ps) => lineAmt(ps.lines, 'LOAN'),
  Allowance: (ps) => lineAmt(ps.lines, 'ALLOWANCE', 'FIXED_ALLOWANCE'),
  'Fixed Allowance': (ps) => lineAmt(ps.lines, 'ALLOWANCE', 'FIXED_ALLOWANCE'),
  DA: (ps) => lineAmt(ps.lines, 'DA'),
  HRA: (ps) => lineAmt(ps.lines, 'HRA'),
  MA: (ps) => lineAmt(ps.lines, 'MA'),
  'CPF Employer': (ps) => lineAmt(ps.lines, 'CPF_EMPLOYER'),
  HCA: (ps) => lineAmt(ps.lines, 'HCA'),
  'CPF Deduction': (ps) => lineAmt(ps.lines, 'CPF'),
  CPF: (ps) => lineAmt(ps.lines, 'CPF'),
  TDS: (ps) => lineAmt(ps.lines, 'TDS'),
  NPS: (ps) => lineAmt(ps.lines, 'NPS'),
  Gross: (ps) => {
    if (ps.payScaleType === 'UGC') {
      return buildUgcBreakdownFromLines(
        ps.lines.map((line) => ({
          componentCode: line.componentCode,
          componentName: line.componentName,
          componentType: line.componentType ?? 'EARNING',
          amount: Number(line.amount),
        })),
      ).gross;
    }
    if (ps.payScaleType === 'STATE') {
      return buildStateBreakdownFromLines(
        ps.lines.map((line) => ({
          componentCode: line.componentCode,
          componentName: line.componentName,
          componentType: line.componentType ?? 'EARNING',
          amount: Number(line.amount),
        })),
      ).gross;
    }
    return Number(ps.grossSalary);
  },
  Net: (ps) => {
    if (ps.payScaleType === 'UGC') {
      return buildUgcBreakdownFromLines(
        ps.lines.map((line) => ({
          componentCode: line.componentCode,
          componentName: line.componentName,
          componentType: line.componentType ?? 'EARNING',
          amount: Number(line.amount),
        })),
      ).net;
    }
    if (ps.payScaleType === 'STATE') {
      return buildStateBreakdownFromLines(
        ps.lines.map((line) => ({
          componentCode: line.componentCode,
          componentName: line.componentName,
          componentType: line.componentType ?? 'EARNING',
          amount: Number(line.amount),
        })),
      ).net;
    }
    return Number(ps.netSalary);
  },
  'Professional Tax': (ps) => lineAmt(ps.lines, 'PROFESSIONAL_TAX'),
};

function lineAmt(
  lines: Array<{ componentCode: string; amount: unknown }>,
  ...codes: string[]
) {
  for (const code of codes) {
    const row = lines.find((l) => l.componentCode === code);
    if (row != null) return Number(row.amount) || 0;
  }
  return 0;
}

@Injectable()
export class PayrollReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly excelStyles: PayrollExcelStylesService,
  ) {}

  async salaryRegisterBuffer(tenantId: string, runId: string): Promise<Buffer> {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, tenantId },
      include: {
        payslips: {
          include: {
            staffProfile: { include: { department: true } },
            lines: true,
          },
        },
      },
    });
    if (!run) throw new Error('Run not found');

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Salary Register');
    await this.excelStyles.applyReportHeader(
      ws,
      tenantId,
      'Salary Register',
      `${run.label ?? `${run.month}/${run.year}`} · ${run.payScaleType ?? 'ALL'}`,
    );

    const headers = [
      'Employee Code',
      'Name',
      'Department',
      'Gross',
      'Deductions',
      'Net',
      'LOP Days',
    ];
    const headerRow = ws.addRow(headers);
    this.excelStyles.styleTableHeaderRow(headerRow, headers.length);

    let sl = 0;
    let totalGross = 0;
    let totalDed = 0;
    let totalNet = 0;
    for (const ps of run.payslips) {
      sl += 1;
      const gross = Number(ps.grossSalary);
      const ded = Number(ps.totalDeductions);
      const net = Number(ps.netSalary);
      totalGross += gross;
      totalDed += ded;
      totalNet += net;
      const row = ws.addRow([
        ps.staffProfile.employeeCode,
        ps.staffProfile.fullName,
        ps.staffProfile.department?.name ?? '',
        gross,
        ded,
        net,
        ps.lopDays ?? 0,
      ]);
      this.excelStyles.styleDataRow(row, headers.length, sl % 2 === 0);
    }

    ws.addRow([]);
    const totalsRow = ws.addRow([
      '',
      '',
      'TOTAL',
      totalGross,
      totalDed,
      totalNet,
      '',
    ]);
    this.excelStyles.styleTotalsRow(totalsRow, headers.length);
    this.excelStyles.applyCurrencyFormat(ws, [4, 5, 6]);
    ws.getColumn(1).width = 14;
    ws.getColumn(2).width = 28;
    ws.getColumn(3).width = 22;

    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async bulkSalarySheetBuffer(
    tenantId: string,
    runId: string,
    payScaleType: string,
    layoutKey?: string,
  ): Promise<Buffer> {
    const settings = await this.prisma.payrollSettings.findUnique({
      where: { tenantId },
    });
    const layouts = (settings?.exportLayouts ?? {}) as Record<string, string[]>;
    const layout = layoutKey ?? payScaleType;
    const headers =
      layouts[layout] ??
      DEFAULT_LAYOUTS[layout] ??
      DEFAULT_LAYOUTS[payScaleType] ??
      DEFAULT_LAYOUTS.COLLEGE_TEACHING;

    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, tenantId },
      include: {
        payslips: {
          where: { payScaleType },
          include: {
            staffProfile: { include: { department: true } },
            lines: true,
          },
        },
      },
    });
    if (!run) throw new Error('Run not found');

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(`${payScaleType} Statement`);
    await this.excelStyles.applyReportHeader(
      ws,
      tenantId,
      `${payScaleType.replace(/_/g, ' ')} Salary Statement`,
      `Period: ${run.month}/${run.year} · ${run.payslips.length} employees`,
    );

    const headerRow = ws.addRow(headers);
    this.excelStyles.styleTableHeaderRow(headerRow, headers.length);

    let sl = 0;
    const totals = new Array(headers.length).fill(0) as number[];
    for (const ps of run.payslips) {
      sl += 1;
      const rowValues = headers.map((h, idx) => {
        const resolver = HEADER_VALUE[h];
        const val = resolver
          ? resolver(ps, sl)
          : lineAmt(ps.lines, h.toUpperCase().replace(/ /g, '_'));
        if (typeof val === 'number' && idx > 2)
          totals[idx] = (totals[idx] ?? 0) + val;
        return val;
      });
      const row = ws.addRow(rowValues);
      this.excelStyles.styleDataRow(row, headers.length, sl % 2 === 0);
    }

    ws.addRow([]);
    const totalLabelRow = headers.map((h, i) => {
      if (i === 0) return '';
      if (i === 1) return 'TOTAL';
      if (i === 2) return `${run.payslips.length} staff`;
      return totals[i] || '';
    });
    const totalsRow = ws.addRow(totalLabelRow);
    this.excelStyles.styleTotalsRow(totalsRow, headers.length);

    const currencyCols = headers
      .map((h, i) => ({ h, i: i + 1 }))
      .filter(({ h }) =>
        [
          'Basic',
          'Gross',
          'Net',
          'PF',
          'PPF',
          'Loan',
          'Allowance',
          'DA',
          'HRA',
          'MA',
          'CPF',
          'NPS',
        ].some((k) => h.includes(k) || h === k),
      )
      .map(({ i }) => i);
    if (currencyCols.length)
      this.excelStyles.applyCurrencyFormat(ws, currencyCols);
    ws.getColumn(1).width = 6;
    ws.getColumn(2).width = 14;
    ws.getColumn(3).width = 28;

    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async departmentWise(tenantId: string, month: number, year: number) {
    const payslips = await this.prisma.payslip.findMany({
      where: { tenantId, month, year, status: 'PUBLISHED' },
      include: { staffProfile: { include: { department: true } } },
    });
    const byDept = new Map<
      string,
      { count: number; gross: number; net: number }
    >();
    for (const ps of payslips) {
      const dept = ps.staffProfile.department?.name ?? 'Unassigned';
      const cur = byDept.get(dept) ?? { count: 0, gross: 0, net: 0 };
      cur.count++;
      cur.gross += Number(ps.grossSalary);
      cur.net += Number(ps.netSalary);
      byDept.set(dept, cur);
    }
    return Array.from(byDept.entries()).map(([department, stats]) => ({
      department,
      ...stats,
    }));
  }

  async importExcelLayouts(
    tenantId: string,
    layouts: Record<string, string[]>,
  ) {
    return this.prisma.payrollSettings.upsert({
      where: { tenantId },
      create: { tenantId, exportLayouts: layouts },
      update: { exportLayouts: layouts },
    });
  }

  async bankTransferData(tenantId: string, runId: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, tenantId },
      include: {
        payslips: {
          include: {
            staffProfile: {
              select: {
                fullName: true,
                employeeCode: true,
                accountNumber: true,
                ifsc: true,
                bankName: true,
              },
            },
          },
          orderBy: { staffProfile: { fullName: 'asc' } },
        },
      },
    });
    if (!run) throw new Error('Payroll run not found');

    const rows = run.payslips.map((ps) => {
      const net = Number(ps.netSalary);
      const account = ps.staffProfile.accountNumber?.trim() ?? '';
      const ifsc = ps.staffProfile.ifsc?.trim() ?? '';
      const issues: string[] = [];
      if (!account) issues.push('Missing account number');
      if (!ifsc) issues.push('Missing IFSC');
      if (net <= 0) issues.push('Zero or negative net salary');
      return {
        employeeName: ps.staffProfile.fullName,
        employeeCode: ps.staffProfile.employeeCode,
        accountNumber: account,
        bankName: ps.staffProfile.bankName ?? '',
        ifsc,
        amount: net,
        narration: `Salary ${run.month}/${run.year}`,
        issues,
        valid: issues.length === 0,
      };
    });

    return {
      run: {
        id: run.id,
        label: run.label,
        month: run.month,
        year: run.year,
        status: run.status,
      },
      summary: {
        totalEmployees: rows.length,
        validRows: rows.filter((r) => r.valid).length,
        invalidRows: rows.filter((r) => !r.valid).length,
        totalNetPayment: rows.reduce((s, r) => s + (r.valid ? r.amount : 0), 0),
      },
      rows,
    };
  }

  async bankFileExcelBuffer(tenantId: string, runId: string): Promise<Buffer> {
    const data = await this.bankTransferData(tenantId, runId);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Bank Transfer');

    await this.excelStyles.applyReportHeader(
      ws,
      tenantId,
      'Salary Disbursement — Bank Transfer File',
      `${data.run.label ?? `${data.run.month}/${data.run.year}`} · Valid: ${data.summary.validRows}/${data.summary.totalEmployees}`,
    );

    const headers = [
      'Employee Name',
      'Employee Code',
      'Account Number',
      'Bank Name',
      'IFSC',
      'Net Salary',
      'Narration',
      'Status',
    ];
    const headerRow = ws.addRow(headers);
    this.excelStyles.styleTableHeaderRow(headerRow, headers.length);

    let sl = 0;
    for (const r of data.rows) {
      sl += 1;
      const row = ws.addRow([
        r.employeeName,
        r.employeeCode,
        r.accountNumber,
        r.bankName,
        r.ifsc,
        r.amount,
        r.narration,
        r.valid ? 'OK' : r.issues.join('; '),
      ]);
      this.excelStyles.styleDataRow(row, headers.length, sl % 2 === 0);
      if (!r.valid) row.getCell(8).font = { color: { argb: 'FFDC2626' } };
    }

    ws.addRow([]);
    const totalsRow = ws.addRow([
      'Total Valid Payment',
      '',
      '',
      '',
      '',
      data.summary.totalNetPayment,
      '',
      '',
    ]);
    this.excelStyles.styleTotalsRow(totalsRow, headers.length);
    this.excelStyles.applyCurrencyFormat(ws, [6]);
    ws.getColumn(1).width = 26;
    ws.getColumn(3).width = 20;
    ws.getColumn(8).width = 24;

    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  bankFileCsv(data: {
    rows: Array<{
      valid: boolean;
      employeeName: string;
      accountNumber: string;
      ifsc: string;
      amount: number;
      narration: string;
    }>;
  }): string {
    const lines = [
      'Beneficiary Name,Account Number,IFSC,Amount,Narration',
      ...data.rows
        .filter((r) => r.valid)
        .map((r) =>
          [r.employeeName, r.accountNumber, r.ifsc, r.amount, r.narration]
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(','),
        ),
    ];
    return lines.join('\n');
  }

  /** @deprecated use bankTransferData + export endpoints */
  bankFileScaffold(_tenantId: string, _bankCode: string) {
    return {
      supported: ['SBI', 'HDFC', 'ICICI'],
      columns: [
        'Beneficiary Name',
        'Account Number',
        'IFSC',
        'Amount',
        'Narration',
      ],
      note: 'Use GET /payroll/reports/bank-file?runId=... for full bank transfer data.',
      rows: [],
    };
  }
}
