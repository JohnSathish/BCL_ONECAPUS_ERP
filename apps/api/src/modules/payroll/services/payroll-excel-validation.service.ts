import { BadRequestException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { PrismaService } from '../../../database/prisma.service';
import {
  buildUgcBreakdownFromLines,
  computeUgcGross,
  computeUgcNet,
  type UgcSalaryBreakdown,
} from './ugc-payroll-formulas';
import {
  buildStateBreakdownFromLines,
  computeStateGross,
  computeStateNet,
  type StateSalaryBreakdown,
} from './state-payroll-formulas';

export const UGC_SALARY_SHEET_NAME = 'Teaching UGC Salary';
export const STATE_SALARY_SHEET_NAME = 'State Scale Non-Teaching';

export function normalizeStaffName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').replace(/[.']/g, '').toUpperCase();
}

export function parseNum(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'object' && value && 'result' in value) {
    return parseNum((value as { result: unknown }).result);
  }
  const n = Number(
    String(value ?? '')
      .replace(/,/g, '')
      .replace(/[^\d.-]/g, ''),
  );
  return Number.isFinite(n) ? n : 0;
}

export function cellStr(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'object' && 'result' in (value as object)) {
    return String((value as { result: unknown }).result ?? '').trim();
  }
  if (typeof value === 'object' && 'richText' in (value as object)) {
    return ((value as { richText: { text: string }[] }).richText ?? [])
      .map((part) => part.text)
      .join('')
      .trim();
  }
  return String(value).trim();
}

export type UgcExcelSalaryRow = {
  rowNumber: number;
  name: string;
  basic: number;
  da: number;
  cpfEmployer: number;
  gross: number;
  cpfDed: number;
  tds: number;
  loan: number;
  houseRent: number;
  net: number;
};

export function parseUgcSalarySheet(
  sheet: ExcelJS.Worksheet,
): UgcExcelSalaryRow[] {
  const rows: UgcExcelSalaryRow[] = [];
  let headerRow = 0;

  sheet.eachRow((row, rowNumber) => {
    const col1 = cellStr(row.getCell(1).value);
    const col2 = cellStr(row.getCell(2).value).toUpperCase();
    if (col2 === 'NAME' && col1.toUpperCase().includes('SL'))
      headerRow = rowNumber;
  });
  if (!headerRow) return rows;

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRow) return;
    const sl = cellStr(row.getCell(1).value);
    const name = cellStr(row.getCell(2).value);
    if (
      !name ||
      name.toUpperCase().startsWith('TOTAL') ||
      sl.toUpperCase().includes('TOTAL')
    )
      return;

    const basic = parseNum(row.getCell(3).value);
    if (basic <= 0) return;

    const da = parseNum(row.getCell(4).value);
    const cpfEmployer = parseNum(row.getCell(5).value);
    const grossRaw = parseNum(row.getCell(6).value);
    const cpfDed = parseNum(row.getCell(7).value);
    const tds = parseNum(row.getCell(8).value);
    const loan = parseNum(row.getCell(9).value);
    const houseRent = parseNum(row.getCell(10).value);
    const netRaw = parseNum(row.getCell(11).value);

    const gross =
      grossRaw > 0 ? grossRaw : computeUgcGross(basic, da, cpfEmployer);
    const net =
      netRaw > 0 ? netRaw : computeUgcNet(gross, cpfDed, houseRent, loan, tds);

    rows.push({
      rowNumber,
      name,
      basic,
      da,
      cpfEmployer,
      gross,
      cpfDed,
      tds,
      loan,
      houseRent,
      net,
    });
  });

  return rows;
}

export type StateExcelSalaryRow = {
  rowNumber: number;
  name: string;
  basic: number;
  cpfEmployer: number;
  da: number;
  hca: number;
  hra: number;
  ma: number;
  gross: number;
  cpfDed: number;
  loan: number;
  net: number;
};

export function parseStateSalarySheet(
  sheet: ExcelJS.Worksheet,
): StateExcelSalaryRow[] {
  const rows: StateExcelSalaryRow[] = [];
  let headerRow = 0;

  sheet.eachRow((row, rowNumber) => {
    const col1 = cellStr(row.getCell(1).value);
    const col2 = cellStr(row.getCell(2).value).toUpperCase();
    if (
      col2 === 'NAME' &&
      (col1.toUpperCase().includes('SL') || col1.toUpperCase().includes('S.NO'))
    ) {
      headerRow = rowNumber;
    }
  });
  if (!headerRow) return rows;

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRow) return;
    const sl = cellStr(row.getCell(1).value);
    const name = cellStr(row.getCell(2).value);
    if (
      !name ||
      name.toUpperCase().startsWith('TOTAL') ||
      sl.toUpperCase().includes('TOTAL')
    )
      return;

    const basic = parseNum(row.getCell(3).value);
    if (basic <= 0) return;

    const cpfEmployer = parseNum(row.getCell(4).value);
    const da = parseNum(row.getCell(5).value);
    const hca = parseNum(row.getCell(6).value);
    const hra = parseNum(row.getCell(7).value);
    const ma = parseNum(row.getCell(8).value);
    const grossRaw = parseNum(row.getCell(9).value);
    const cpfDed = parseNum(row.getCell(10).value);
    const loan = parseNum(row.getCell(11).value);
    const netRaw = parseNum(row.getCell(12).value);

    const gross =
      grossRaw > 0
        ? grossRaw
        : computeStateGross(basic, cpfEmployer, da, hca, hra, ma);
    const net = netRaw > 0 ? netRaw : computeStateNet(gross, cpfDed, loan, 0);

    rows.push({
      rowNumber,
      name,
      basic,
      cpfEmployer,
      da,
      hca,
      hra,
      ma,
      gross,
      cpfDed,
      loan,
      net,
    });
  });

  return rows;
}

export type PayrollSalaryBreakdown = UgcSalaryBreakdown | StateSalaryBreakdown;

export type PayrollExcelValidationRow = {
  payslipId: string;
  employeeCode: string;
  name: string;
  erp: PayrollSalaryBreakdown;
  excel: PayrollSalaryBreakdown | null;
  deltaNet: number;
  mismatch: boolean;
  mismatchFields: string[];
  matchMethod: string | null;
};

export type PayrollExcelValidationResult = {
  sheetName: string | null;
  matched: number;
  mismatches: PayrollExcelValidationRow[];
  excelOnly: string[];
  erpOnly: string[];
};

function excelRowToBreakdown(row: UgcExcelSalaryRow): UgcSalaryBreakdown {
  return buildUgcBreakdownFromLines(
    [
      { componentCode: 'BASIC', componentType: 'EARNING', amount: row.basic },
      { componentCode: 'DA', componentType: 'EARNING', amount: row.da },
      {
        componentCode: 'CPF_EMPLOYER',
        componentType: 'EARNING',
        amount: row.cpfEmployer,
      },
      { componentCode: 'CPF', componentType: 'DEDUCTION', amount: row.cpfDed },
      { componentCode: 'TDS', componentType: 'DEDUCTION', amount: row.tds },
      { componentCode: 'LOAN', componentType: 'DEDUCTION', amount: row.loan },
      {
        componentCode: 'HOUSE_RENT',
        componentType: 'DEDUCTION',
        amount: row.houseRent,
      },
    ],
    row.gross,
    row.net,
  );
}

function compareUgcBreakdowns(
  erp: UgcSalaryBreakdown,
  excel: UgcSalaryBreakdown,
): { deltaNet: number; mismatch: boolean; mismatchFields: string[] } {
  const fields: Array<{ key: keyof UgcSalaryBreakdown; label: string }> = [
    { key: 'basic', label: 'Basic' },
    { key: 'da', label: 'DA' },
    { key: 'cpfEmployer', label: 'CPF Employer' },
    { key: 'gross', label: 'Gross' },
    { key: 'cpfDed', label: 'CPF Deduction' },
    { key: 'tds', label: 'TDS' },
    { key: 'houseRent', label: 'House Rent' },
    { key: 'loan', label: 'Loan' },
    { key: 'net', label: 'Net Salary' },
  ];

  const mismatchFields: string[] = [];
  for (const field of fields) {
    const erpVal = erp[field.key];
    const excelVal = excel[field.key];
    if (
      typeof erpVal === 'number' &&
      typeof excelVal === 'number' &&
      erpVal !== excelVal
    ) {
      mismatchFields.push(field.label);
    }
  }

  const deltaNet = erp.net - excel.net;
  const mismatch = Math.abs(deltaNet) >= 1 || mismatchFields.length > 0;

  return { deltaNet, mismatch, mismatchFields };
}

function compareStateBreakdowns(
  erp: StateSalaryBreakdown,
  excel: StateSalaryBreakdown,
): { deltaNet: number; mismatch: boolean; mismatchFields: string[] } {
  const fields: Array<{ key: keyof StateSalaryBreakdown; label: string }> = [
    { key: 'basic', label: 'Basic' },
    { key: 'cpfEmployer', label: 'CPF Employer' },
    { key: 'da', label: 'DA' },
    { key: 'hca', label: 'HCA' },
    { key: 'hra', label: 'HR' },
    { key: 'ma', label: 'MA' },
    { key: 'gross', label: 'Gross' },
    { key: 'cpfDed', label: 'CPF Deduction' },
    { key: 'loan', label: 'Loan' },
    { key: 'net', label: 'Net Salary' },
  ];

  const mismatchFields: string[] = [];
  for (const field of fields) {
    const erpVal = erp[field.key];
    const excelVal = excel[field.key];
    if (
      typeof erpVal === 'number' &&
      typeof excelVal === 'number' &&
      erpVal !== excelVal
    ) {
      mismatchFields.push(field.label);
    }
  }

  const deltaNet = erp.net - excel.net;
  const mismatch = Math.abs(deltaNet) >= 1 || mismatchFields.length > 0;

  return { deltaNet, mismatch, mismatchFields };
}

function stateExcelRowToBreakdown(
  row: StateExcelSalaryRow,
): StateSalaryBreakdown {
  return buildStateBreakdownFromLines(
    [
      { componentCode: 'BASIC', componentType: 'EARNING', amount: row.basic },
      {
        componentCode: 'CPF_EMPLOYER',
        componentType: 'EARNING',
        amount: row.cpfEmployer,
      },
      { componentCode: 'DA', componentType: 'EARNING', amount: row.da },
      { componentCode: 'HCA', componentType: 'EARNING', amount: row.hca },
      { componentCode: 'HRA', componentType: 'EARNING', amount: row.hra },
      { componentCode: 'MA', componentType: 'EARNING', amount: row.ma },
      { componentCode: 'CPF', componentType: 'DEDUCTION', amount: row.cpfDed },
      { componentCode: 'LOAN', componentType: 'DEDUCTION', amount: row.loan },
    ],
    row.gross,
    row.net,
  );
}

@Injectable()
export class PayrollExcelValidationService {
  constructor(private readonly prisma: PrismaService) {}

  async validateRunAgainstExcel(
    tenantId: string,
    runId: string,
    buffer: Buffer,
  ): Promise<PayrollExcelValidationResult> {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, tenantId },
      select: { payScaleType: true },
    });
    if (!run) throw new BadRequestException('Payroll run not found');
    if (run.payScaleType === 'STATE') {
      return this.validateStateRunAgainstExcel(tenantId, runId, buffer);
    }
    if (run.payScaleType === 'UGC') {
      return this.validateUgcRunAgainstExcel(tenantId, runId, buffer);
    }
    throw new BadRequestException(
      'Excel formula validation is available for UGC and STATE payroll runs only',
    );
  }

  async validateStateRunAgainstExcel(
    tenantId: string,
    runId: string,
    buffer: Buffer,
  ): Promise<PayrollExcelValidationResult> {
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
    if (!run) throw new BadRequestException('Payroll run not found');
    if (run.payScaleType !== 'STATE') {
      throw new BadRequestException(
        'Excel formula validation is available for STATE payroll runs only',
      );
    }

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const sheet =
      wb.getWorksheet(STATE_SALARY_SHEET_NAME) ??
      wb.worksheets.find(
        (ws) =>
          ws.name.toLowerCase().includes('state') &&
          ws.name.toLowerCase().includes('salary'),
      ) ??
      wb.worksheets.find((ws) => ws.name.toLowerCase().includes('state'));
    if (!sheet) {
      throw new BadRequestException(
        `State Scale salary worksheet not found. Upload the college State Scale Excel file.`,
      );
    }

    const excelRows = parseStateSalarySheet(sheet);
    if (!excelRows.length) {
      throw new BadRequestException(
        'No salary rows found in the State Scale worksheet',
      );
    }

    const excelByName = new Map<string, StateExcelSalaryRow>();
    for (const row of excelRows) {
      excelByName.set(normalizeStaffName(row.name), row);
    }

    const mismatches: PayrollExcelValidationRow[] = [];
    let matched = 0;

    for (const payslip of run.payslips) {
      const name = payslip.staffProfile?.fullName ?? '';
      const key = normalizeStaffName(name);
      const excelRow = excelByName.get(key) ?? null;
      const erp = buildStateBreakdownFromLines(
        (payslip.lines ?? []).map((line) => ({
          componentCode: line.componentCode,
          componentName: line.componentName,
          componentType: line.componentType,
          amount: Number(line.amount),
        })),
        undefined,
        Number(payslip.netSalary),
      );

      if (!excelRow) {
        mismatches.push({
          payslipId: payslip.id,
          employeeCode: payslip.staffProfile?.employeeCode ?? '',
          name,
          erp,
          excel: null,
          deltaNet: 0,
          mismatch: true,
          mismatchFields: ['Not found in Excel sheet'],
          matchMethod: null,
        });
        continue;
      }

      matched++;
      const excel = stateExcelRowToBreakdown(excelRow);
      const comparison = compareStateBreakdowns(erp, excel);
      mismatches.push({
        payslipId: payslip.id,
        employeeCode: payslip.staffProfile?.employeeCode ?? '',
        name,
        erp,
        excel,
        deltaNet: comparison.deltaNet,
        mismatch: comparison.mismatch,
        mismatchFields: comparison.mismatchFields,
        matchMethod: 'exact_name',
      });
    }

    const erpNames = new Set(
      run.payslips.map((p) =>
        normalizeStaffName(p.staffProfile?.fullName ?? ''),
      ),
    );
    const excelOnly = excelRows
      .map((row) => row.name)
      .filter((name) => !erpNames.has(normalizeStaffName(name)));
    const erpOnly = run.payslips
      .filter(
        (p) =>
          !excelByName.has(normalizeStaffName(p.staffProfile?.fullName ?? '')),
      )
      .map((p) => p.staffProfile?.fullName ?? 'Unknown');

    return {
      sheetName: sheet.name,
      matched,
      mismatches,
      excelOnly,
      erpOnly,
    };
  }

  async validateUgcRunAgainstExcel(
    tenantId: string,
    runId: string,
    buffer: Buffer,
  ): Promise<PayrollExcelValidationResult> {
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
    if (!run) throw new BadRequestException('Payroll run not found');
    if (run.payScaleType !== 'UGC') {
      throw new BadRequestException(
        'Excel formula validation is available for UGC payroll runs only',
      );
    }

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const sheet =
      wb.getWorksheet(UGC_SALARY_SHEET_NAME) ??
      wb.worksheets.find((ws) => ws.name.toLowerCase().includes('ugc'));
    if (!sheet) {
      throw new BadRequestException(
        `Worksheet "${UGC_SALARY_SHEET_NAME}" not found. Upload the college UGC salary Excel file.`,
      );
    }

    const excelRows = parseUgcSalarySheet(sheet);
    if (!excelRows.length) {
      throw new BadRequestException(
        'No salary rows found in the UGC worksheet',
      );
    }

    const excelByName = new Map<string, UgcExcelSalaryRow>();
    for (const row of excelRows) {
      excelByName.set(normalizeStaffName(row.name), row);
    }

    const mismatches: PayrollExcelValidationRow[] = [];
    let matched = 0;

    for (const payslip of run.payslips) {
      const name = payslip.staffProfile?.fullName ?? '';
      const key = normalizeStaffName(name);
      const excelRow = excelByName.get(key) ?? null;
      const erp = buildUgcBreakdownFromLines(
        (payslip.lines ?? []).map((line) => ({
          componentCode: line.componentCode,
          componentName: line.componentName,
          componentType: line.componentType,
          amount: Number(line.amount),
        })),
        undefined,
        Number(payslip.netSalary),
      );

      if (!excelRow) {
        mismatches.push({
          payslipId: payslip.id,
          employeeCode: payslip.staffProfile?.employeeCode ?? '',
          name,
          erp,
          excel: null,
          deltaNet: 0,
          mismatch: true,
          mismatchFields: ['Not found in Excel sheet'],
          matchMethod: null,
        });
        continue;
      }

      matched++;
      const excel = excelRowToBreakdown(excelRow);
      const comparison = compareUgcBreakdowns(erp, excel);
      mismatches.push({
        payslipId: payslip.id,
        employeeCode: payslip.staffProfile?.employeeCode ?? '',
        name,
        erp,
        excel,
        deltaNet: comparison.deltaNet,
        mismatch: comparison.mismatch,
        mismatchFields: comparison.mismatchFields,
        matchMethod: 'exact_name',
      });
    }

    const erpNames = new Set(
      run.payslips.map((p) =>
        normalizeStaffName(p.staffProfile?.fullName ?? ''),
      ),
    );
    const excelOnly = excelRows
      .map((row) => row.name)
      .filter((name) => !erpNames.has(normalizeStaffName(name)));
    const erpOnly = run.payslips
      .filter(
        (p) =>
          !excelByName.has(normalizeStaffName(p.staffProfile?.fullName ?? '')),
      )
      .map((p) => p.staffProfile?.fullName ?? 'Unknown');

    return {
      sheetName: sheet.name,
      matched,
      mismatches,
      excelOnly,
      erpOnly,
    };
  }
}
