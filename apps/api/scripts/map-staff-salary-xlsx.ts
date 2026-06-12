import ExcelJS from 'exceljs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { createWorkbookWithSheets } from '../src/common/import/excel.util';
import { writeFile } from 'fs/promises';
import path from 'path';

const SOURCE = 'E:/Projects/1505NEWERP/Staff SALARY-.xlsx';
const OUT_DIR = 'E:/Projects/1505NEWERP';

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, ' ').replace(/[.']/g, '').toUpperCase();
}

/** Salary sheet names to skip (not in ERP / user excluded). */
const EXCLUDED_SALARY_NAMES = new Set(
  [
    'SENBACHI CH MOMIN',
    'VICKY S SANGMA',
    'CHELSEA D SANGMA',
    'BRILLIANT N MARAK',
    'ZAKKUL D SANGMA',
  ].map(normalizeName),
);

function parseNum(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'object' && v && 'result' in v)
    return parseNum((v as { result: unknown }).result);
  const n = Number(
    String(v ?? '')
      .replace(/,/g, '')
      .replace(/[^\d.-]/g, ''),
  );
  return Number.isFinite(n) ? n : 0;
}

function cellStr(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'object' && 'result' in (v as object))
    return String((v as { result: unknown }).result ?? '').trim();
  if (typeof v === 'object' && 'richText' in (v as object)) {
    return ((v as { richText: { text: string }[] }).richText ?? [])
      .map((r) => r.text)
      .join('')
      .trim();
  }
  return String(v).trim();
}

type ParsedRow = {
  sheet: string;
  rowNumber: number;
  legacyCode?: string;
  name: string;
  basic: number;
  pfEmployer?: number;
  cpfRate?: number;
  houseRent?: number;
  loan?: number;
  pfExempt?: boolean;
};

function parseLegacySheet(sheet: ExcelJS.Worksheet): ParsedRow[] {
  const rows: ParsedRow[] = [];
  let headerRow = 0;
  sheet.eachRow((row, rowNumber) => {
    const c2 = cellStr(row.getCell(3).value).toUpperCase();
    if (c2 === 'NAME') headerRow = rowNumber;
  });
  if (!headerRow) return rows;

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRow) return;
    const name = cellStr(row.getCell(3).value);
    if (!name || name.toUpperCase().startsWith('TOTAL')) return;
    const basic = parseNum(row.getCell(4).value);
    if (basic <= 0) return;
    const legacyCode = cellStr(row.getCell(2).value) || undefined;
    const pfEmployer = parseNum(row.getCell(5).value);
    const houseRent = parseNum(row.getCell(8).value);
    const loan = parseNum(row.getCell(9).value);
    rows.push({
      sheet: 'Teaching College Manangement Sa',
      rowNumber,
      legacyCode,
      name,
      basic,
      pfEmployer,
      pfExempt: pfEmployer <= 0,
      houseRent: houseRent > 0 ? houseRent : undefined,
      loan: loan > 0 ? loan : undefined,
    });
  });
  return rows;
}

function parseUgcSheet(sheet: ExcelJS.Worksheet): ParsedRow[] {
  const rows: ParsedRow[] = [];
  let headerRow = 0;
  sheet.eachRow((row, rowNumber) => {
    const c1 = cellStr(row.getCell(1).value);
    const c2 = cellStr(row.getCell(2).value).toUpperCase();
    if (c2 === 'NAME' && c1.toUpperCase().includes('SL')) headerRow = rowNumber;
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
    const cpfCol = parseNum(row.getCell(5).value);
    const cpfRate =
      basic > 0 && cpfCol > 0 ? Math.round((cpfCol / basic) * 100) : undefined;
    const houseRent = parseNum(row.getCell(10).value);
    rows.push({
      sheet: 'Teaching UGC Salary',
      rowNumber,
      name,
      basic,
      cpfRate:
        cpfRate === 8 || cpfRate === 10
          ? cpfRate
          : cpfRate && cpfRate <= 11
            ? 10
            : cpfRate && cpfRate <= 9
              ? 8
              : undefined,
      houseRent: houseRent > 0 ? houseRent : undefined,
    });
  });
  return rows;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[m][n];
}

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(SOURCE);

  const legacySheet = wb.getWorksheet('Teaching College Manangement Sa');
  const ugcSheet = wb.getWorksheet('Teaching UGC Salary');
  if (!legacySheet || !ugcSheet)
    throw new Error('Expected worksheets not found');

  const parsed = [...parseLegacySheet(legacySheet), ...parseUgcSheet(ugcSheet)];

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const prisma = app.get(PrismaService);

  const tenant = await prisma.tenant.findFirst({
    where: { name: { contains: 'Don Bosco', mode: 'insensitive' } },
  });
  if (!tenant) throw new Error('Don Bosco tenant not found');

  const staff = await prisma.staffProfile.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
    select: { id: true, employeeCode: true, fullName: true, staffType: true },
  });

  const byName = new Map<string, typeof staff>();
  const byCode = new Map<string, (typeof staff)[0]>();
  for (const s of staff) {
    const key = normalizeName(s.fullName);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(s);
    byCode.set(s.employeeCode.toUpperCase(), s);
    byCode.set(s.employeeCode.replace(/-/g, '').toUpperCase(), s);
  }

  type Mapped = {
    name: string;
    basic: number;
    employeeCode: string;
    matchMethod: string;
    payStructureCode: string;
    payScaleType: string;
    effectiveFrom: string;
    cpfRate?: number;
    houseRent?: number;
    pfExempt?: boolean;
    legacyCode?: string;
    sheet: string;
    rowNumber: number;
    warnings: string[];
  };

  const mapped: Mapped[] = [];
  const unmatched: ParsedRow[] = [];

  for (const row of parsed) {
    if (EXCLUDED_SALARY_NAMES.has(normalizeName(row.name))) continue;

    const warnings: string[] = [];
    let match: (typeof staff)[0] | undefined;
    let matchMethod = '';

    if (row.legacyCode) {
      const codeKey = row.legacyCode.toUpperCase();
      match = byCode.get(codeKey) ?? byCode.get(codeKey.replace(/-/g, ''));
      if (match) matchMethod = 'legacy_code';
    }

    if (!match) {
      const key = normalizeName(row.name);
      const exact = byName.get(key);
      if (exact?.length === 1) {
        match = exact[0];
        matchMethod = 'exact_name';
      } else if (exact && exact.length > 1) {
        warnings.push('Multiple staff with same normalized name');
        match = exact[0];
        matchMethod = 'exact_name_first';
      }
    }

    if (!match) {
      const key = normalizeName(row.name);
      let best: (typeof staff)[0] | undefined;
      let bestDist = Infinity;
      for (const s of staff) {
        const dist = levenshtein(key, normalizeName(s.fullName));
        if (dist < bestDist) {
          bestDist = dist;
          best = s;
        }
      }
      if (best && bestDist <= 4) {
        match = best;
        matchMethod = `fuzzy_name(d=${bestDist})`;
        warnings.push(`Fuzzy matched to ${best.fullName}`);
      }
    }

    if (!match) {
      unmatched.push(row);
      continue;
    }

    const isUgc = row.sheet.includes('UGC');
    mapped.push({
      name: row.name,
      basic: row.basic,
      employeeCode: match.employeeCode,
      matchMethod,
      payStructureCode: isUgc ? 'DBC_UGC_7TH' : 'DBC_TEACHING_LEGACY',
      payScaleType: isUgc ? 'UGC' : 'COLLEGE_TEACHING',
      effectiveFrom: isUgc ? '2026-02-01' : '2026-05-01',
      cpfRate: row.cpfRate,
      houseRent: row.houseRent,
      pfExempt: row.pfExempt,
      legacyCode: row.legacyCode,
      sheet: row.sheet,
      rowNumber: row.rowNumber,
      warnings,
    });
  }

  const importRows = mapped.map((m) => [
    m.employeeCode,
    m.payStructureCode,
    m.payScaleType,
    m.basic,
    m.effectiveFrom,
    m.cpfRate ?? '',
    m.houseRent ?? '',
    m.pfExempt ? 'Y' : '',
    `Imported: ${m.name}`,
  ]);

  const reportRows = mapped.map((m) => [
    m.name,
    m.legacyCode ?? '',
    m.employeeCode,
    m.matchMethod,
    m.basic,
    m.payStructureCode,
    m.warnings.join('; '),
  ]);

  const unmatchedRows = unmatched.map((u) => [
    u.sheet,
    u.rowNumber,
    u.legacyCode ?? '',
    u.name,
    u.basic,
  ]);

  const importBuf = await createWorkbookWithSheets([
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
        'pf_exempt',
        'reason',
      ],
      rows: importRows,
    },
  ]);

  const reportBuf = await createWorkbookWithSheets([
    {
      name: 'Mapping Report',
      headers: [
        'Salary Name',
        'Legacy Code',
        'ERP Employee Code',
        'Match Method',
        'Basic',
        'Structure',
        'Warnings',
      ],
      rows: reportRows,
    },
    {
      name: 'Unmatched',
      headers: ['Sheet', 'Row', 'Legacy Code', 'Name', 'Basic'],
      rows: unmatchedRows,
    },
  ]);

  const importPath = path.join(OUT_DIR, 'staff-pay-assignments-import.xlsx');
  const reportPath = path.join(OUT_DIR, 'staff-pay-mapping-report.xlsx');
  await writeFile(importPath, importBuf);
  await writeFile(reportPath, reportBuf);

  console.log(
    JSON.stringify(
      {
        tenant: tenant.name,
        staffInDb: staff.length,
        salaryRows: parsed.length,
        mapped: mapped.length,
        unmatched: unmatched.length,
        importPath,
        reportPath,
        unmatchedNames: unmatched.map((u) => u.name),
      },
      null,
      2,
    ),
  );

  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
