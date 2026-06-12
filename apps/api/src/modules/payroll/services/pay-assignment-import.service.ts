import { BadRequestException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import {
  createWorkbookWithSheets,
  parseExcelDataSheet,
} from '../../../common/import/excel.util';
import { mapRowHeaders } from '../../../common/import/import-column-map';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { StaffPayAssignmentService } from './staff-pay-assignment.service';
import { buildAssignmentOverrides } from './pay-statutory-overrides';

type ImportRow = {
  rowNumber: number;
  employeeCode: string;
  staffName?: string;
  payStructureCode: string;
  payScaleType: string;
  basicPay: number;
  effectiveFrom: string;
  notes?: string;
  componentOverrides?: Record<
    string,
    { rate?: number; value?: number; disabled?: boolean }
  >;
  pfExempt?: boolean;
  errors: string[];
};

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
}

function parseNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const cleaned = String(value ?? '')
    .replace(/,/g, '')
    .replace(/[^\d.-]/g, '')
    .trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function pickRaw(raw: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (raw[key] != null && String(raw[key]).trim() !== '') return raw[key];
  }
  return undefined;
}

function detectDbcSalarySheet(headers: string[]): boolean {
  const normalized = headers.map((h) => h.trim().toUpperCase());
  const hasName = normalized.some(
    (h) => h === 'NAME' || h === 'STAFF NAME' || h === 'EMPLOYEE NAME',
  );
  const hasBasic = normalized.some(
    (h) => h === 'BASIC' || h.startsWith('BASIC'),
  );
  return hasName && hasBasic;
}

/** Non-teaching salary sheet: Name + Basic + Allowance column, no CPF rate column. */
function detectDbcNonTeachingSheet(headers: string[]): boolean {
  const normalized = headers.map((h) => h.trim().toUpperCase());
  const hasAllowance = normalized.some(
    (h) =>
      h === 'ALLOWANCE' ||
      h === 'FIXED ALLOWANCE' ||
      h === 'FIXED_ALLOWANCE' ||
      h.startsWith('FIXED ALLOW'),
  );
  const hasCpf = normalized.some(
    (h) => h.includes('CPF') && h.includes('RATE'),
  );
  return detectDbcSalarySheet(headers) && hasAllowance && !hasCpf;
}

function defaultEffectiveFrom(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

@Injectable()
export class PayAssignmentImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assignments: StaffPayAssignmentService,
  ) {}

  async downloadTemplate(): Promise<Buffer> {
    return createWorkbookWithSheets([
      {
        name: 'Pay Assignments',
        headers: [
          'employee_code',
          'pay_structure_code',
          'pay_scale_type',
          'basic_pay',
          'effective_from',
          'cpf_rate',
          'house_rent',
          'fixed_allowance',
          'pf_exempt',
          'reason',
        ],
        rows: [
          [
            'DBCTCH-26-001',
            'DBC_UGC_7TH',
            'UGC',
            198700,
            '2026-02-01',
            10,
            6500,
            '',
            '',
            'UGC 7th Pay',
          ],
          [
            'DBCTCH-26-023',
            'DBC_TEACHING_LEGACY',
            'COLLEGE_TEACHING',
            35280,
            '2026-05-01',
            '',
            '',
            '',
            '',
            'Legacy teaching',
          ],
          [
            'DBCNTE-26-001',
            'DBC_NON_TEACHING',
            'COLLEGE_NON_TEACHING',
            12500,
            '2026-05-01',
            '',
            '',
            8500,
            '',
            'Non-teaching',
          ],
        ],
        notes: [
          'Required: employee_code, pay_structure_code, pay_scale_type, basic_pay, effective_from',
          'DBC structures: DBC_UGC_7TH, DBC_TEACHING_LEGACY, DBC_NON_TEACHING',
          'Optional: cpf_rate (8 or 10 for UGC), house_rent, fixed_allowance (overrides 20% allowance formula)',
        ],
      },
      {
        name: 'DBC Salary Sheet',
        headers: [
          'Name',
          'Basic',
          'cpf_rate',
          'house_rent',
          'fixed_allowance',
          'pay_structure_code',
          'effective_from',
        ],
        rows: [
          ['Madhusudhan Saha', 198700, 10, 0, '', 'DBC_UGC_7TH', '2026-02-01'],
          [
            'Andrew B Sangma',
            35280,
            '',
            0,
            '',
            'DBC_TEACHING_LEGACY',
            '2026-05-01',
          ],
        ],
        notes: [
          'Paste your college salary sheet here — match by staff Name',
          'Auto-detects UGC vs legacy teaching when pay_structure_code is blank',
        ],
      },
      {
        name: 'DBC Non-Teaching Sheet',
        headers: ['Name', 'Basic', 'Fixed Allowance', 'effective_from'],
        rows: [
          ['Example Staff A', 12500, 8500, '2026-05-01'],
          ['Example Staff B', 25500, 20200, '2026-05-01'],
          ['Example Staff C', 7500, 0, '2026-05-01'],
        ],
        notes: [
          'Paste May salary sheet rows — Name + Basic + Fixed Allowance',
          'Uses DBC_NON_TEACHING structure; allowance 0 falls back to 20% formula',
          'effective_from optional — defaults to 1st of current month',
        ],
      },
    ]);
  }

  async validate(user: JwtUser, buffer: Buffer) {
    const parsed = await this.parseRows(user.tid, buffer);
    const valid = parsed.filter((r) => r.errors.length === 0);
    const invalid = parsed.filter((r) => r.errors.length > 0);
    return {
      total: parsed.length,
      valid: valid.length,
      invalid: invalid.length,
      rows: parsed,
    };
  }

  async commit(user: JwtUser, buffer: Buffer) {
    const parsed = await this.parseRows(user.tid, buffer);
    const valid = parsed.filter((r) => r.errors.length === 0);
    if (!valid.length) throw new BadRequestException('No valid rows to import');

    let created = 0;
    let skipped = 0;
    for (const row of valid) {
      try {
        const staff = await this.prisma.staffProfile.findFirst({
          where: {
            tenantId: user.tid,
            deletedAt: null,
            employeeCode: row.employeeCode,
          },
        });
        const structure = await this.prisma.payStructureTemplate.findFirst({
          where: {
            tenantId: user.tid,
            code: row.payStructureCode,
            deletedAt: null,
          },
        });
        if (!staff || !structure) {
          skipped += 1;
          continue;
        }
        await this.assignments.create(user, {
          staffProfileId: staff.id,
          payStructureTemplateId: structure.id,
          payScaleType: row.payScaleType,
          basicPay: row.basicPay,
          effectiveFrom: row.effectiveFrom,
          notes: row.notes,
          componentOverrides: row.componentOverrides,
        });
        created += 1;
      } catch {
        skipped += 1;
      }
    }
    return { created, skipped, total: valid.length };
  }

  private async parseRows(
    tenantId: string,
    buffer: Buffer,
  ): Promise<ImportRow[]> {
    let raw = await parseExcelDataSheet(buffer, 'Pay Assignments');
    if (!raw.length)
      raw = await parseExcelDataSheet(buffer, 'DBC Non-Teaching Sheet');
    if (!raw.length)
      raw = await parseExcelDataSheet(buffer, 'DBC Salary Sheet');
    if (!raw.length) {
      raw = await this.parseFirstDataSheet(buffer);
    }
    if (!raw.length) return [];

    const headers = Object.keys(raw[0]?.raw ?? {});
    const isDbcSheet = detectDbcSalarySheet(headers);
    const isNonTeachingSheet = detectDbcNonTeachingSheet(headers);

    const structures = await this.prisma.payStructureTemplate.findMany({
      where: { tenantId, deletedAt: null },
      select: { code: true },
    });
    const structureCodes = new Set(structures.map((s) => s.code.toUpperCase()));

    const staffRows = await this.prisma.staffProfile.findMany({
      where: { tenantId, deletedAt: null },
      select: { employeeCode: true, fullName: true },
    });
    const staffCodes = new Set(
      staffRows.map((s) => s.employeeCode.toUpperCase()),
    );
    const staffByName = new Map(
      staffRows.map((s) => [normalizeName(s.fullName), s.employeeCode]),
    );

    return raw.map((row) => {
      const errors: string[] = [];
      const rawRow = row.raw as Record<string, unknown>;

      let employeeCode = String(
        pickRaw(rawRow, [
          'employee_code',
          'employeeCode',
          'Employee Code',
          'EMP CODE',
        ]) ?? '',
      ).trim();

      const staffName = String(
        pickRaw(rawRow, ['name', 'Name', 'NAME', 'staff_name', 'Staff Name']) ??
          '',
      ).trim();

      if (!employeeCode && staffName) {
        employeeCode = staffByName.get(normalizeName(staffName)) ?? '';
        if (!employeeCode)
          errors.push(`No staff match for name "${staffName}"`);
      }

      let payStructureCode = String(
        pickRaw(rawRow, [
          'pay_structure_code',
          'payStructureCode',
          'structure',
        ]) ?? '',
      ).trim();

      const basicPay = parseNumber(
        pickRaw(rawRow, ['basic_pay', 'basicPay', 'Basic', 'BASIC']),
      );
      let payScaleType = String(
        pickRaw(rawRow, ['pay_scale_type', 'payScaleType']) ?? '',
      )
        .trim()
        .toUpperCase();

      let effectiveFrom = String(
        pickRaw(rawRow, [
          'effective_from',
          'effectiveFrom',
          'Effective From',
        ]) ?? '',
      ).trim();
      if (!effectiveFrom) effectiveFrom = defaultEffectiveFrom();

      const cpfRate = parseNumber(
        pickRaw(rawRow, ['cpf_rate', 'cpfRate', 'CPF Rate']),
      );
      const houseRent = parseNumber(
        pickRaw(rawRow, [
          'house_rent',
          'houseRent',
          'HOUSE RENT',
          'H. Rent',
          'H Rent',
        ]),
      );
      const fixedAllowance = parseNumber(
        pickRaw(rawRow, [
          'fixed_allowance',
          'fixedAllowance',
          'Fixed Allowance',
          'FIXED ALLOWANCE',
          'Allowance',
          'ALLOWANCE',
        ]),
      );

      if (!payStructureCode && isDbcSheet) {
        if (isNonTeachingSheet) {
          payStructureCode = 'DBC_NON_TEACHING';
          payScaleType = 'COLLEGE_NON_TEACHING';
        } else if (cpfRate === 8 || cpfRate === 10) {
          payStructureCode = 'DBC_UGC_7TH';
          payScaleType = 'UGC';
        } else {
          payStructureCode = 'DBC_TEACHING_LEGACY';
          payScaleType = 'COLLEGE_TEACHING';
        }
      }

      if (
        !payScaleType &&
        payStructureCode.toUpperCase().includes('NON_TEACHING')
      ) {
        payScaleType = 'COLLEGE_NON_TEACHING';
      }
      if (!payScaleType && payStructureCode.toUpperCase().includes('UGC'))
        payScaleType = 'UGC';
      if (
        !payScaleType &&
        payStructureCode.toUpperCase().includes('TEACHING')
      ) {
        payScaleType = 'COLLEGE_TEACHING';
      }

      const notes =
        String(pickRaw(rawRow, ['reason', 'notes', 'Notes']) ?? '').trim() ||
        (staffName ? `Imported for ${staffName}` : undefined);

      const pfExemptRaw = pickRaw(rawRow, [
        'pf_exempt',
        'pfExempt',
        'PF Exempt',
        'pf_excluded',
      ]);
      const pfExempt =
        pfExemptRaw != null && String(pfExemptRaw).trim() !== ''
          ? ['Y', 'YES', '1', 'TRUE', 'EXEMPT'].includes(
              String(pfExemptRaw).trim().toUpperCase(),
            )
          : false;

      const componentOverrides = buildAssignmentOverrides({
        pfExempt,
        houseRent: houseRent > 0 ? houseRent : houseRent === 0 ? 0 : undefined,
        cpfRate: cpfRate === 8 || cpfRate === 10 ? cpfRate : undefined,
        fixedAllowance: fixedAllowance > 0 ? fixedAllowance : undefined,
      });

      if (!employeeCode) errors.push('employee_code or Name required');
      else if (!staffCodes.has(employeeCode.toUpperCase()))
        errors.push('Unknown employee_code');

      if (!payStructureCode) errors.push('pay_structure_code required');
      else if (!structureCodes.has(payStructureCode.toUpperCase())) {
        errors.push(`Unknown pay_structure_code (${payStructureCode})`);
      }

      if (!payScaleType) errors.push('pay_scale_type required');
      if (!basicPay || basicPay <= 0) errors.push('basic_pay must be > 0');

      return {
        rowNumber: row.rowNumber,
        employeeCode,
        staffName: staffName || undefined,
        payStructureCode,
        payScaleType,
        basicPay,
        effectiveFrom,
        notes,
        componentOverrides: componentOverrides ?? undefined,
        pfExempt,
        errors,
      };
    });
  }

  private async parseFirstDataSheet(buffer: Buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) return [];

    const headers: string[] = [];
    let headerRowNum = 0;

    sheet.eachRow((row, rowNumber) => {
      const values = (row.values as unknown[])
        .slice(1)
        .map((v) => String(v ?? '').trim());
      if (detectDbcSalarySheet(values)) {
        headers.splice(0, headers.length, ...values);
        headerRowNum = rowNumber;
      }
    });

    if (!headers.length) {
      return parseExcelDataSheet(buffer, sheet.name);
    }

    const rows: Awaited<ReturnType<typeof parseExcelDataSheet>> = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRowNum) return;
      const values = (row.values as unknown[]).slice(1);
      const allEmpty = values.every(
        (v) => v == null || String(v).trim() === '',
      );
      if (allEmpty) return;
      const nameIdx = headers.findIndex((h) => h.toUpperCase() === 'NAME');
      const nameVal = String(
        nameIdx >= 0 ? (values[nameIdx] ?? '') : '',
      ).trim();
      if (nameVal.toUpperCase() === 'TOTAL' || nameVal.startsWith('TOTAL '))
        return;
      rows.push({
        rowNumber,
        raw: mapRowHeaders(headers, values),
      });
    });
    return rows;
  }
}
