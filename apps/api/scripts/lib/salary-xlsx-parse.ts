import ExcelJS from 'exceljs';

export const DEFAULT_SALARY_XLSX_PATH =
  'E:/Projects/1505NEWERP/Staff SALARY-.xlsx';

export const LEGACY_TEACHING_SHEET_NAME = 'Teaching College Manangement Sa';

/** Salary sheet names to skip (not in ERP / user excluded). */
export const EXCLUDED_SALARY_NAMES = new Set(
  [
    'SENBACHI CH MOMIN',
    'VICKY S SANGMA',
    'CHELSEA D SANGMA',
    'BRILLIANT N MARAK',
    'ZAKKUL D SANGMA',
  ].map((n) => normalizeName(n)),
);

export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').replace(/[.']/g, '').toUpperCase();
}

export function parseNum(v: unknown): number {
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

export function cellStr(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'object' && 'result' in (v as object)) {
    return String((v as { result: unknown }).result ?? '').trim();
  }
  if (typeof v === 'object' && 'richText' in (v as object)) {
    return ((v as { richText: { text: string }[] }).richText ?? [])
      .map((r) => r.text)
      .join('')
      .trim();
  }
  return String(v).trim();
}

export type LegacyTeachingSheetRow = {
  sheet: string;
  rowNumber: number;
  legacyCode?: string;
  name: string;
  basic: number;
  pfEmployer: number;
  gross: number;
  ppf: number;
  houseRent: number;
  loan: number;
  net: number;
  pfExempt: boolean;
};

function deriveLegacyAmounts(
  basic: number,
  pfEmployer: number,
  grossRaw: number,
  ppfRaw: number,
  houseRent: number,
  loan: number,
  netRaw: number,
) {
  const gross = grossRaw > 0 ? grossRaw : basic + pfEmployer;
  const ppf = ppfRaw > 0 ? ppfRaw : pfEmployer > 0 ? pfEmployer * 2 : 0;
  const net = netRaw > 0 ? netRaw : gross - ppf - houseRent - loan;
  return { gross, ppf, net };
}

export function parseLegacyTeachingSheet(
  sheet: ExcelJS.Worksheet,
): LegacyTeachingSheetRow[] {
  const rows: LegacyTeachingSheetRow[] = [];
  let headerRow = 0;
  sheet.eachRow((row, rowNumber) => {
    const c = cellStr(row.getCell(3).value).toUpperCase();
    if (c === 'NAME') headerRow = rowNumber;
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
    const grossRaw = parseNum(row.getCell(6).value);
    const ppfRaw = parseNum(row.getCell(7).value);
    const houseRent = parseNum(row.getCell(8).value);
    const loan = parseNum(row.getCell(9).value);
    const netRaw = parseNum(row.getCell(10).value);
    const derived = deriveLegacyAmounts(
      basic,
      pfEmployer,
      grossRaw,
      ppfRaw,
      houseRent,
      loan,
      netRaw,
    );

    rows.push({
      sheet: LEGACY_TEACHING_SHEET_NAME,
      rowNumber,
      legacyCode,
      name,
      basic,
      pfEmployer,
      gross: derived.gross,
      ppf: derived.ppf,
      houseRent,
      loan,
      net: derived.net,
      pfExempt: pfEmployer <= 0,
    });
  });

  return rows;
}

export async function loadLegacyTeachingRows(
  filePath = DEFAULT_SALARY_XLSX_PATH,
): Promise<LegacyTeachingSheetRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const sheet = wb.getWorksheet(LEGACY_TEACHING_SHEET_NAME) ?? wb.worksheets[0];
  if (!sheet) throw new Error('Teaching salary worksheet not found');
  return parseLegacyTeachingSheet(sheet);
}

export function legacyRowsByName(
  rows: LegacyTeachingSheetRow[],
): Map<string, LegacyTeachingSheetRow> {
  const map = new Map<string, LegacyTeachingSheetRow>();
  for (const row of rows) {
    map.set(normalizeName(row.name), row);
  }
  return map;
}

export function levenshtein(a: string, b: string): number {
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

export type StaffLookupEntry = {
  id: string;
  employeeCode: string;
  fullName: string;
};

export type StaffMatchResult = {
  staff: StaffLookupEntry;
  method: string;
  warnings: string[];
};

export type StaffLookup = {
  byName: Map<string, StaffLookupEntry[]>;
  byCode: Map<string, StaffLookupEntry>;
};

export function buildStaffLookup(staff: StaffLookupEntry[]): StaffLookup {
  const byName = new Map<string, StaffLookupEntry[]>();
  const byCode = new Map<string, StaffLookupEntry>();
  for (const s of staff) {
    const key = normalizeName(s.fullName);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(s);
    byCode.set(s.employeeCode.toUpperCase(), s);
    byCode.set(s.employeeCode.replace(/-/g, '').toUpperCase(), s);
  }
  return { byName, byCode };
}

export function matchStaffToSheetRow(
  row: Pick<LegacyTeachingSheetRow, 'name' | 'legacyCode'>,
  lookup: StaffLookup,
  allStaff: StaffLookupEntry[],
): StaffMatchResult | null {
  const warnings: string[] = [];
  let match: StaffLookupEntry | undefined;
  let method = '';

  if (row.legacyCode) {
    const codeKey = row.legacyCode.toUpperCase();
    match =
      lookup.byCode.get(codeKey) ??
      lookup.byCode.get(codeKey.replace(/-/g, ''));
    if (match) method = 'legacy_code';
  }

  if (!match) {
    const key = normalizeName(row.name);
    const exact = lookup.byName.get(key);
    if (exact?.length === 1) {
      match = exact[0];
      method = 'exact_name';
    } else if (exact && exact.length > 1) {
      warnings.push('Multiple staff with same normalized name');
      match = exact[0];
      method = 'exact_name_first';
    }
  }

  if (!match) {
    const key = normalizeName(row.name);
    let best: StaffLookupEntry | undefined;
    let bestDist = Infinity;
    for (const s of allStaff) {
      const dist = levenshtein(key, normalizeName(s.fullName));
      if (dist < bestDist) {
        bestDist = dist;
        best = s;
      }
    }
    if (best && bestDist <= 4) {
      match = best;
      method = `fuzzy_name(d=${bestDist})`;
      warnings.push(`Fuzzy matched to ${best.fullName}`);
    }
  }

  if (!match) return null;
  return { staff: match, method, warnings };
}
