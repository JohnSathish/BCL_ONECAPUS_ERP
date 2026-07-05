/**
 * Fix Morning Shift Sem 3 import Excel and save with ExcelJS (ERP-compatible).
 *
 *   npx ts-node --transpile-only scripts/fix-morning-shift-import.ts
 *   npx ts-node --transpile-only scripts/fix-morning-shift-import.ts --validate
 */
import * as fs from 'fs';
import * as path from 'path';
import ExcelJS from 'exceljs';
import { NestFactory } from '@nestjs/core';
import { parseFlexibleDate } from '../src/common/utils/parse-flexible-date';
import { DBC_SEM3_COURSE_TITLES } from '../src/modules/academic-engine/domain/dbc-morning-sem3-catalog';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { StudentImportService } from '../src/modules/students/import/student-import.service';

/**
 * Titles as stored on Course rows for Morning Shift Sem 3 import resolution.
 * Desktop Publishing / Computerized Accounting use the live course-master titles
 * (VTC: 243.2 / VTC: 243.3) so import dropdown resolution matches exactly.
 */
const IMPORT_PAPER_TITLES: Record<string, string> = {
  ...DBC_SEM3_COURSE_TITLES,
  'VTC-243.2': 'Desktop Publishing -I',
  'VTC-243.3': 'Computerized Accounting-I',
};

/** Morning Sem 3 VTC pool — includes papers students actually take. */
const MORNING_IMPORT_VTC_CODES = [
  'VTC-240.3',
  'VTC-241.2',
  'VTC-243.2',
  'VTC-243.3',
  'VTC-244.2',
  'VTC-245.3',
  'VTC-246.1',
  'VTC-248.1',
] as const;

const MORNING_VTC_TITLES = new Set(
  MORNING_IMPORT_VTC_CODES.map((code) => IMPORT_PAPER_TITLES[code]),
);

const CANONICAL_PAPER_TITLES = [
  ...Object.values(IMPORT_PAPER_TITLES),
  ...Object.values(DBC_SEM3_COURSE_TITLES),
];

const SOURCE = path.join(
  process.env.USERPROFILE ?? '',
  'OneDrive',
  'Desktop',
  'Import Live 1-3-5',
  'Morning Shift',
  'MORNING SHIFT IMPORT DATA 2026.xlsx',
);
const OUTPUT = SOURCE.replace('.xlsx', ' - READY.xlsx');
const REPORT = SOURCE.replace('.xlsx', ' - VALIDATION REPORT.txt');
const validate = process.argv.includes('--validate');

function normalizePaperLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalizePaperTitle(value: ExcelJS.CellValue): string | null {
  const raw = cellText(value);
  if (!raw) return null;
  const normalized = normalizePaperLabel(raw);
  const exact = CANONICAL_PAPER_TITLES.find(
    (title) => normalizePaperLabel(title) === normalized,
  );
  if (exact) return exact;

  const partial = CANONICAL_PAPER_TITLES.filter((title) => {
    const candidate = normalizePaperLabel(title);
    return candidate.includes(normalized) || normalized.includes(candidate);
  });
  if (partial.length === 1) return partial[0];

  const aliasFixes: Record<string, string> = {
    'baking and confectionary i': IMPORT_PAPER_TITLES['VTC-246.1'],
    'baking and confectionery i': IMPORT_PAPER_TITLES['VTC-246.1'],
    'bee keeping i': IMPORT_PAPER_TITLES['VTC-240.3'],
    'bee keeping - i': IMPORT_PAPER_TITLES['VTC-240.3'],
    'mushroom cultivation i': IMPORT_PAPER_TITLES['VTC-241.2'],
    'guitar i': IMPORT_PAPER_TITLES['VTC-245.3'],
    'event management i': IMPORT_PAPER_TITLES['VTC-244.2'],
    'desktop publishing': IMPORT_PAPER_TITLES['VTC-243.2'],
    'desktop publishing i': IMPORT_PAPER_TITLES['VTC-243.2'],
    'computerized accounting': IMPORT_PAPER_TITLES['VTC-243.3'],
    'computerized accounting i': IMPORT_PAPER_TITLES['VTC-243.3'],
  };
  if (aliasFixes[normalized]) return aliasFixes[normalized];

  return raw;
}

const PROGRAM_SEM3_DEFAULTS: Record<
  string,
  { mdc: string; sec: string; vtc: string }
> = {
  'BA-EDU': {
    mdc: IMPORT_PAPER_TITLES['MDC-211'],
    sec: IMPORT_PAPER_TITLES['SEC-230'],
    vtc: IMPORT_PAPER_TITLES['VTC-241.2'],
  },
  'BA-ENG': {
    mdc: IMPORT_PAPER_TITLES['MDC-211'],
    sec: IMPORT_PAPER_TITLES['SEC-230'],
    vtc: IMPORT_PAPER_TITLES['VTC-246.1'],
  },
  'BA-POL': {
    mdc: IMPORT_PAPER_TITLES['MDC-212'],
    sec: IMPORT_PAPER_TITLES['SEC-230'],
    vtc: IMPORT_PAPER_TITLES['VTC-245.3'],
  },
  'BA-ECO': {
    mdc: IMPORT_PAPER_TITLES['MDC-212'],
    sec: IMPORT_PAPER_TITLES['SEC-230'],
    vtc: IMPORT_PAPER_TITLES['VTC-244.2'],
  },
  'BA-GAR': {
    mdc: IMPORT_PAPER_TITLES['MDC-211'],
    sec: IMPORT_PAPER_TITLES['SEC-230'],
    vtc: IMPORT_PAPER_TITLES['VTC-245.3'],
  },
  'BA-HIS': {
    mdc: IMPORT_PAPER_TITLES['MDC-211'],
    sec: IMPORT_PAPER_TITLES['SEC-230'],
    vtc: IMPORT_PAPER_TITLES['VTC-241.2'],
  },
  'BA-SOC': {
    mdc: IMPORT_PAPER_TITLES['MDC-211'],
    sec: IMPORT_PAPER_TITLES['SEC-230'],
    vtc: IMPORT_PAPER_TITLES['VTC-241.2'],
  },
};

const KNOWN_DOB_FIXES: Record<string, string> = {
  '22.06.32007': '22.06.2007',
  '14.1.02005': '14.10.2005',
  '30.102005': '30.10.2005',
  '1.0702004': '01.07.2004',
};

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if ('result' in value && value.result != null)
      return cellText(value.result);
    if ('text' in value && value.text) return String(value.text);
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text ?? '').join('');
    }
  }
  return String(value).trim();
}

function isBlank(value: ExcelJS.CellValue): boolean {
  const text = cellText(value);
  return !text || text.toLowerCase() === 'nan';
}

function repairDobText(raw: string): string {
  if (KNOWN_DOB_FIXES[raw]) return KNOWN_DOB_FIXES[raw];
  const longYear = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4,})$/);
  if (longYear) {
    const [, day, month, yearPart] = longYear;
    return `${day.padStart(2, '0')}.${month.padStart(2, '0')}.${yearPart.slice(-4)}`;
  }
  const missingDot = raw.match(/^(\d{1,2})\.(\d{2})(\d{4})$/);
  if (missingDot) {
    const [, day, month, year] = missingDot;
    if (Number(month) >= 1 && Number(month) <= 12) {
      return `${day.padStart(2, '0')}.${month.padStart(2, '0')}.${year}`;
    }
  }
  return raw;
}

function normalizeDate(value: ExcelJS.CellValue): string | null {
  if (value instanceof Date) {
    return parseFlexibleDate(value);
  }
  const raw = cellText(value);
  if (!raw) return null;
  return parseFlexibleDate(repairDobText(raw));
}

function normalizeGender(value: ExcelJS.CellValue): string | null {
  const raw = cellText(value);
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (upper === 'MALE' || upper === 'M') return 'Male';
  if (upper === 'FEMALE' || upper === 'F') return 'Female';
  if (upper === 'OTHER' || upper === 'O') return 'Other';
  return raw;
}

function normalizeCategory(value: ExcelJS.CellValue): string | null {
  const raw = cellText(value);
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (upper === 'GEN' || upper === 'GENERAL') return 'GENERAL';
  return upper;
}

function rollToEmail(roll: string): string {
  const slug = roll.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${slug}@student.donboscocollege.ac.in`;
}

function headerMap(sheet: ExcelJS.Worksheet): Map<string, number> {
  const map = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, col) => {
    const header = cellText(cell.value);
    if (header) map.set(header, col);
  });
  return map;
}

function setCell(row: ExcelJS.Row, col: number | undefined, value: string) {
  if (!col) return;
  row.getCell(col).value = value;
}

async function main() {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`Source file not found: ${SOURCE}`);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(SOURCE);
  const sheet = workbook.getWorksheet('Students');
  if (!sheet) throw new Error('Students sheet not found');

  const columns = headerMap(sheet);
  const required = [
    'Registration Number',
    'Roll Number',
    'Full Name',
    'Email Address',
    'Date of Birth',
    'Programme',
    'MDC (Sem 3)',
    'AEC (Sem 3)',
    'SEC (Sem 3)',
    'VTC',
    'Student Status',
    'Gender',
    'Category',
    'Admission Date',
  ];
  for (const header of required) {
    if (!columns.has(header)) {
      throw new Error(`Missing expected column: ${header}`);
    }
  }

  const stats = {
    rows: 0,
    registrationFilled: 0,
    dobFixed: 0,
    emailGenerated: 0,
    renewalAssigned: 0,
    vtcRemapped: 0,
    statusFilled: 0,
    duplicatesRemoved: 0,
    issues: [] as string[],
  };

  const dataStartRow = cellText(
    sheet.getRow(2).getCell(columns.get('Registration Number')!).value,
  ).startsWith('College')
    ? 3
    : 2;

  for (let rowNumber = dataStartRow; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const roll = cellText(row.getCell(columns.get('Roll Number')!).value);
    const name = cellText(row.getCell(columns.get('Full Name')!).value);
    if (!roll && !name) continue;
    stats.rows += 1;

    const regCol = columns.get('Registration Number')!;
    if (isBlank(row.getCell(regCol).value) && roll) {
      row.getCell(regCol).value = roll;
      stats.registrationFilled += 1;
    }

    const dobCol = columns.get('Date of Birth')!;
    const dobBefore = cellText(row.getCell(dobCol).value);
    const dobNormalized = normalizeDate(row.getCell(dobCol).value);
    if (dobNormalized) {
      if (dobBefore !== dobNormalized) {
        row.getCell(dobCol).value = dobNormalized;
        stats.dobFixed += 1;
      }
    } else if (isBlank(row.getCell(dobCol).value)) {
      stats.issues.push(`Row ${rowNumber}: missing Date of Birth (${name})`);
    } else {
      stats.issues.push(
        `Row ${rowNumber}: unparseable DOB '${dobBefore}' (${name})`,
      );
    }

    const admCol = columns.get('Admission Date')!;
    const admNormalized = normalizeDate(row.getCell(admCol).value);
    if (admNormalized) row.getCell(admCol).value = admNormalized;

    const emailCol = columns.get('Email Address')!;
    if (isBlank(row.getCell(emailCol).value)) {
      if (roll) {
        row.getCell(emailCol).value = rollToEmail(roll);
        stats.emailGenerated += 1;
      } else {
        stats.issues.push(`Row ${rowNumber}: missing email and roll (${name})`);
      }
    } else {
      row.getCell(emailCol).value = cellText(
        row.getCell(emailCol).value,
      ).toLowerCase();
    }

    const programme = cellText(row.getCell(columns.get('Programme')!).value);
    const defaults = PROGRAM_SEM3_DEFAULTS[programme];
    if (isBlank(row.getCell(columns.get('MDC (Sem 3)')!).value) && defaults) {
      setCell(row, columns.get('MDC (Sem 3)'), defaults.mdc);
      setCell(row, columns.get('SEC (Sem 3)'), defaults.sec);
      setCell(row, columns.get('VTC'), defaults.vtc);
      stats.renewalAssigned += 1;
    }

    if (isBlank(row.getCell(columns.get('AEC (Sem 3)')!).value)) {
      setCell(row, columns.get('AEC (Sem 3)'), IMPORT_PAPER_TITLES['AEC-222']);
    }

    for (const header of [
      'MDC (Sem 3)',
      'AEC (Sem 3)',
      'SEC (Sem 3)',
      'VTC',
    ] as const) {
      const col = columns.get(header);
      if (!col) continue;
      let canonical = canonicalizePaperTitle(row.getCell(col).value);
      if (header === 'VTC' && canonical) {
        const inMorningPool = [...MORNING_VTC_TITLES].some(
          (title) =>
            normalizePaperLabel(title) === normalizePaperLabel(canonical!),
        );
        if (!inMorningPool) {
          const replacement = defaults?.vtc ?? IMPORT_PAPER_TITLES['VTC-248.1'];
          if (
            normalizePaperLabel(canonical) !== normalizePaperLabel(replacement)
          ) {
            stats.vtcRemapped += 1;
            stats.issues.push(
              `Row ${rowNumber}: VTC "${canonical}" not in Morning pool → "${replacement}" (${name})`,
            );
          }
          canonical = replacement;
        }
      }
      if (canonical) row.getCell(col).value = canonical;
    }

    const fatherCol = columns.get("Father's Name");
    const motherCol = columns.get("Mother's Name");
    const guardianCol = columns.get('Guardian Name');
    const guardian = guardianCol
      ? cellText(row.getCell(guardianCol).value)
      : '';
    if (fatherCol && isBlank(row.getCell(fatherCol).value)) {
      row.getCell(fatherCol).value = guardian || 'Not Provided';
    }
    if (motherCol && isBlank(row.getCell(motherCol).value)) {
      row.getCell(motherCol).value = guardian || 'Not Provided';
    }

    const tribeCol = columns.get('Tribe / Race');
    if (tribeCol) {
      const tribe = cellText(row.getCell(tribeCol).value).toUpperCase();
      if (tribe === 'RABHA' || tribe === 'SHIL') {
        row.getCell(tribeCol).value = '';
      }
    }

    const statusCol = columns.get('Student Status')!;
    if (isBlank(row.getCell(statusCol).value)) {
      row.getCell(statusCol).value = 'STUDYING';
      stats.statusFilled += 1;
    }

    const genderCol = columns.get('Gender')!;
    const gender = normalizeGender(row.getCell(genderCol).value);
    if (gender) row.getCell(genderCol).value = gender;

    const categoryCol = columns.get('Category')!;
    const category = normalizeCategory(row.getCell(categoryCol).value);
    if (category) row.getCell(categoryCol).value = category;

    const mobileCol = columns.get('Student Mobile Number');
    if (mobileCol && isBlank(row.getCell(mobileCol).value)) {
      stats.issues.push(`Row ${rowNumber}: missing mobile number (${name})`);
    }
  }

  const uniRollCol = columns.get('University Roll Number');
  if (uniRollCol) {
    const winners = new Map<
      string,
      { rowNumber: number; score: number; name: string }
    >();
    for (
      let rowNumber = dataStartRow;
      rowNumber <= sheet.rowCount;
      rowNumber++
    ) {
      const row = sheet.getRow(rowNumber);
      const uniRoll = cellText(row.getCell(uniRollCol).value);
      if (!uniRoll) continue;
      const score =
        (isBlank(row.getCell(columns.get('Student Mobile Number')!).value)
          ? 0
          : 1) +
        (isBlank(row.getCell(columns.get('Date of Birth')!).value) ? 0 : 1) +
        (isBlank(row.getCell(columns.get('Email Address')!).value) ? 0 : 1);
      const name = cellText(row.getCell(columns.get('Full Name')!).value);
      const existing = winners.get(uniRoll);
      if (!existing || score > existing.score) {
        winners.set(uniRoll, { rowNumber, score, name });
      }
    }

    const rowsToDelete: number[] = [];
    for (
      let rowNumber = dataStartRow;
      rowNumber <= sheet.rowCount;
      rowNumber++
    ) {
      const row = sheet.getRow(rowNumber);
      const uniRoll = cellText(row.getCell(uniRollCol).value);
      if (!uniRoll) continue;
      const winner = winners.get(uniRoll);
      if (winner && winner.rowNumber !== rowNumber) {
        rowsToDelete.push(rowNumber);
        stats.duplicatesRemoved += 1;
        stats.issues.push(
          `Removed duplicate university roll ${uniRoll} at row ${rowNumber} (kept row ${winner.rowNumber}, ${winner.name})`,
        );
      }
    }
    rowsToDelete
      .sort((a, b) => b - a)
      .forEach((rowNumber) => {
        sheet.spliceRows(rowNumber, 1);
      });
    stats.rows -= stats.duplicatesRemoved;
  }

  await workbook.xlsx.writeFile(OUTPUT);

  const report = [
    'Morning Shift Import — Validation & Fix Report',
    '='.repeat(60),
    `Source: ${SOURCE}`,
    `Output: ${OUTPUT}`,
    '',
    `Student rows processed: ${stats.rows}`,
    `Registration Number filled from Roll Number: ${stats.registrationFilled}`,
    `Date of Birth normalized to YYYY-MM-DD: ${stats.dobFixed}`,
    `Portal emails generated: ${stats.emailGenerated}`,
    `Sem 3 MDC/SEC/VTC assigned (no renewal): ${stats.renewalAssigned}`,
    `VTC remapped to Morning pool: ${stats.vtcRemapped}`,
    `Duplicate university-roll rows removed: ${stats.duplicatesRemoved}`,
    `Student Status set to STUDYING: ${stats.statusFilled}`,
    '',
    stats.issues.length
      ? ['Remaining warnings:', ...stats.issues.map((i) => `  - ${i}`)]
      : ['No blocking issues found. File is ready for ERP import.'],
  ].flat();

  fs.writeFileSync(REPORT, report.join('\n'), 'utf8');
  console.log(report.join('\n'));
  console.log(`\nSaved: ${OUTPUT}`);

  if (validate) {
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error', 'warn'],
    });
    try {
      const prisma = app.get(PrismaService);
      const importService = app.get(StudentImportService);
      const tenant =
        (await prisma.tenant.findFirst({ where: { slug: 'demo' } })) ??
        (await prisma.tenant.findFirst({
          where: { name: { contains: 'Don Bosco' } },
        }));
      if (!tenant) throw new Error('Tenant not found');
      const admin = await prisma.user.findFirst({
        where: { tenantId: tenant.id, isActive: true },
        orderBy: { createdAt: 'asc' },
      });
      if (!admin) throw new Error('Admin user not found');
      const buffer = fs.readFileSync(OUTPUT);
      const preview = await importService.validateUpload(
        tenant.id,
        admin.id,
        path.basename(OUTPUT),
        buffer,
        { importMode: 'CREATE' },
      );
      console.log('\n=== ERP Validation ===');
      console.log(
        `Total: ${preview.summary.total}, Valid: ${preview.summary.valid}, Invalid: ${preview.summary.invalid}`,
      );
      const invalid = preview.rows
        .filter((r) => r.status !== 'VALID')
        .slice(0, 10);
      for (const row of invalid) {
        console.log(`Row ${row.rowNumber}: ${row.errors.join('; ')}`);
      }
    } finally {
      await app.close();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
