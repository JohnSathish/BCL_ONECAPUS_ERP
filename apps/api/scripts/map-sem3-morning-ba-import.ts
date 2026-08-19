/**
 * Map the office Morning Shift B.A. Semester 3 register onto the official
 * Sem 3 admission import template.
 *
 *   npx ts-node --transpile-only scripts/map-sem3-morning-ba-import.ts
 *   npx ts-node --transpile-only scripts/map-sem3-morning-ba-import.ts "C:\\path\\morning shift-1-3-5 (1).xlsx"
 */
import * as fs from 'fs';
import * as path from 'path';
import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import { DBC_DAY_SEM3_COURSE_TITLES } from '../src/modules/academic-engine/domain/dbc-day-sem3-electives-catalog';
import {
  MORNING_SEM3_MDC_CODES,
  MORNING_SEM3_SEC_CODES,
  MORNING_SEM3_VTC_CODES,
} from '../src/modules/academic-engine/domain/dbc-morning-sem3-catalog';
import { canonicalDbcMajorName } from '../src/modules/academic-engine/domain/dbc-major-minor-matrix';
import {
  SEM3_ADMISSION_TEMPLATE_HEADERS,
  SEM3_ADMISSION_TEMPLATE_HELPERS,
} from '../src/modules/students/migration/sem3-admission-template';

const SOURCE =
  process.argv.find((arg) => arg.endsWith('.xlsx') && !arg.includes('READY')) ??
  path.join(
    process.env.USERPROFILE ?? '',
    'OneDrive',
    'Desktop',
    'Import Live 1-3-5',
    'III Sem Morning Shift',
    'morning shift-1-3-5 (1).xlsx',
  );
const SOURCE_STEM = path
  .basename(SOURCE, path.extname(SOURCE))
  .replace(/\s*\(\d+\)\s*$/, '')
  .trim();
const OUTPUT = path.join(
  path.dirname(SOURCE),
  `${SOURCE_STEM} - READY TO IMPORT.xlsx`,
);
const REPORT = path.join(
  path.dirname(SOURCE),
  `${SOURCE_STEM} - MAPPING REPORT.txt`,
);

const PROGRAMME_BY_MAJOR: Record<string, string> = {
  Economics: 'BA-ECO',
  Education: 'BA-EDU',
  English: 'BA-ENG',
  Garo: 'BA-GAR',
  Geography: 'BA-GEO',
  History: 'BA-HIS',
  Philosophy: 'BA-PHI',
  'Political Science': 'BA-POL',
  Sociology: 'BA-SOC',
};

const PAPER_ALIASES: Record<string, string> = {
  'dev of edu in n e india': 'Development of Education in North-East India',
  'dev of education in north east india':
    'Development of Education in North-East India',
  'english proficiency soft skill development':
    'English Proficiency and Soft Skill Development',
  'eng proficiency soft skill dev':
    'English Proficiency and Soft Skill Development',
  'goods service tax': 'Goods and Service Tax (GST)',
  'baking confectionary': 'Baking and Confectionery – I',
  'baking confectionery': 'Baking and Confectionery – I',
  'bee keeping': 'Bee Keeping – I',
  'desktop publishing': 'Desktop Publishing – I',
  'event management': 'Event Management – I',
  guitar: 'Guitar – I',
  'mushroom cultivation': 'Mushroom Cultivation – I',
  photography: 'Photography',
  'computerized accounting': 'Computerized Accounting',
  'financial literacy': 'Financial Literacy',
  'gender studies': 'Gender Studies',
  'national service scheme': 'National Service Scheme',
  'conflict resolution': 'Conflict Resolution',
  'introduction to translation': 'Introduction to Translation',
  'introduction to academic writing': 'Introduction to Academic Writing (Arts)',
};

const MORNING_PAPER_TITLES = [
  ...MORNING_SEM3_MDC_CODES,
  ...MORNING_SEM3_SEC_CODES,
  ...MORNING_SEM3_VTC_CODES,
].map((code) => DBC_DAY_SEM3_COURSE_TITLES[code] ?? code);

type Flag = { severity: 'warn' | 'block'; reason: string };

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (Number.isInteger(value) || Math.abs(value) >= 1e10) {
      return String(Math.round(value));
    }
    return String(value);
  }
  if (value instanceof Date) return '';
  if (typeof value === 'object') {
    if ('result' in value && value.result != null) {
      return cellText(value.result as ExcelJS.CellValue);
    }
    if ('text' in value && value.text) return String(value.text).trim();
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText
        .map((part) => part.text ?? '')
        .join('')
        .trim();
    }
  }
  return String(value).trim();
}

function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCaseWords(value: string): string {
  return collapseSpaces(value)
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function sourceHeaderMap(sheet: ExcelJS.Worksheet, headerRow = 2) {
  const map = new Map<string, number>();
  sheet.getRow(headerRow).eachCell((cell, col) => {
    const text = cellText(cell.value);
    if (text) map.set(text, col);
  });
  return map;
}

function src(
  row: ExcelJS.Row,
  headers: Map<string, number>,
  name: string,
): string {
  const col = headers.get(name);
  if (!col) return '';
  return cellText(row.getCell(col).value);
}

function srcAny(
  row: ExcelJS.Row,
  headers: Map<string, number>,
  names: string[],
): string {
  for (const name of names) {
    const text = src(row, headers, name);
    if (text) return text;
  }
  return '';
}

function pickSourceSheet(book: ExcelJS.Workbook): ExcelJS.Worksheet {
  const named =
    book.getWorksheet('3 SEM') ??
    book.getWorksheet('III SEM') ??
    book.worksheets.find((sheet) => /3\s*sem/i.test(sheet.name));
  const sheet = named ?? book.worksheets[0];
  if (!sheet) throw new Error('Source sheet not found');
  return sheet;
}

function expandPaperTitle(raw: string): string {
  const text = collapseSpaces(raw);
  if (!text) return '';
  const key = normalizeLabel(text);
  if (PAPER_ALIASES[key]) return PAPER_ALIASES[key];
  const official = MORNING_PAPER_TITLES.find(
    (title) => normalizeLabel(title) === key,
  );
  if (official) return official;
  const partial = MORNING_PAPER_TITLES.filter(
    (title) =>
      normalizeLabel(title).includes(key) ||
      key.includes(normalizeLabel(title)),
  );
  if (partial.length === 1) return partial[0];
  return text;
}

function digitsOnly(raw: string): string {
  return raw.replace(/\.0$/, '').replace(/[^\d]/g, '');
}

function emailBase(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function uniqueEmail(seed: string, used: Set<string>): string {
  const base = emailBase(seed) || 'sem3morn';
  let candidate = `${base}@student.donboscocollege.ac.in`;
  let n = 1;
  while (used.has(candidate)) {
    n += 1;
    candidate = `${base}${n}@student.donboscocollege.ac.in`;
  }
  return candidate;
}

function normalizeCategory(raw: string): string {
  const upper = raw.trim().toUpperCase();
  if (!upper || /^\d+$/.test(upper)) return '';
  if (upper === 'GEN' || upper === 'GENERAL') return 'GENERAL';
  if (['ST', 'SC', 'OBC', 'EWS'].includes(upper)) return upper;
  return collapseSpaces(raw).toUpperCase();
}

function normalizeReligion(raw: string): string {
  const upper = raw.trim().toUpperCase();
  if (!upper) return '';
  if (['CHRISTIAN', 'CHRISTIANITY', 'CHRISTISN'].includes(upper)) {
    return 'Christian';
  }
  if (['HINDU', 'HINDUISM'].includes(upper)) return 'Hindu';
  if (['MUSLIM', 'ISLAM'].includes(upper)) return 'Muslim';
  if (['BUDDHIST', 'BUDDHISM'].includes(upper)) return 'Buddhist';
  if (['OTHER', 'OTHERS'].includes(upper)) return 'Other';
  return titleCaseWords(raw);
}

async function main() {
  if (!fs.existsSync(SOURCE)) throw new Error(`File not found: ${SOURCE}`);

  const sourceBook = new ExcelJS.Workbook();
  await sourceBook.xlsx.readFile(SOURCE);
  const sourceSheet = pickSourceSheet(sourceBook);
  const headers = sourceHeaderMap(sourceSheet, 2);

  const usedEmails = new Set<string>();
  const usedMobiles = new Set<string>();
  const usedAbcs = new Set<string>();
  const existingRegs = new Set<string>();
  let academicSession = '';
  let batchCode = 'BATCH-2025';

  const prisma = new PrismaClient();
  try {
    const tenant =
      (await prisma.tenant.findFirst({ where: { slug: 'demo' } })) ??
      (await prisma.tenant.findFirst({
        where: { name: { contains: 'Don Bosco' } },
      }));
    if (tenant) {
      const batch = await prisma.admissionBatch.findFirst({
        where: {
          tenantId: tenant.id,
          batchCode: { equals: 'BATCH-2025', mode: 'insensitive' },
        },
        include: { entrySession: { select: { name: true } } },
      });
      if (batch) {
        batchCode = batch.batchCode;
        academicSession = batch.entrySession?.name ?? '';
      }
      const existing = await prisma.student.findMany({
        where: { tenantId: tenant.id, deletedAt: null },
        select: {
          enrollmentNumber: true,
          user: { select: { email: true } },
          masterProfile: { select: { mobileNumber: true } },
          abcAccount: { select: { abcId: true } },
          academicProfile: {
            select: {
              admissionBatch: { select: { batchCode: true } },
            },
          },
        },
      });
      for (const student of existing) {
        const batchCodeUpper = (
          student.academicProfile?.admissionBatch?.batchCode ?? ''
        )
          .trim()
          .toUpperCase();
        // Sem 3 (BATCH-2025) and Sem 5 (BATCH-2024) will be wiped before CREATE.
        const wipeCohort =
          batchCodeUpper === 'BATCH-2025' || batchCodeUpper === 'BATCH-2024';
        const email = student.user?.email?.trim().toLowerCase();
        if (email && !wipeCohort) usedEmails.add(email);
        const mobile = digitsOnly(student.masterProfile?.mobileNumber ?? '');
        if (mobile && !wipeCohort) usedMobiles.add(mobile);
        const abc = student.abcAccount?.abcId?.trim().toUpperCase();
        if (abc && !wipeCohort) usedAbcs.add(abc);
        if (student.enrollmentNumber) {
          existingRegs.add(student.enrollmentNumber.trim().toUpperCase());
        }
      }
    }
  } catch (error) {
    console.warn(
      'Could not load existing ERP identifiers; file-only uniqueness will be applied.',
      error instanceof Error ? error.message : error,
    );
  } finally {
    await prisma.$disconnect();
  }

  const importRows: Array<{
    sourceRow: number;
    values: Record<string, string>;
    flags: Flag[];
  }> = [];
  const flaggedOnly: Array<{
    sourceRow: number;
    name: string;
    roll: string;
    flags: Flag[];
    values?: Record<string, string>;
  }> = [];

  for (let rowNumber = 3; rowNumber <= sourceSheet.rowCount; rowNumber += 1) {
    const row = sourceSheet.getRow(rowNumber);
    const name = collapseSpaces(
      srcAny(row, headers, ['Name of The Candidate', 'Full Name']),
    );
    if (!name) continue;

    const flags: Flag[] = [];
    const roll = collapseSpaces(
      srcAny(row, headers, ['ROLL NO.', 'ROLL NO', 'Roll No.']),
    );
    const majorRaw = src(row, headers, 'Major Subject');
    const major = canonicalDbcMajorName(majorRaw) ?? titleCaseWords(majorRaw);
    const programme = PROGRAMME_BY_MAJOR[major] ?? '';
    if (!programme) {
      flags.push({
        severity: 'block',
        reason: `Unknown major "${majorRaw}" — cannot assign programme`,
      });
    }

    const mdc = expandPaperTitle(src(row, headers, 'MDC'));
    const sec = expandPaperTitle(src(row, headers, 'SEC'));
    const vtc = expandPaperTitle(src(row, headers, 'VTC'));
    if (!mdc) flags.push({ severity: 'block', reason: 'MDC paper missing' });
    if (!sec) flags.push({ severity: 'block', reason: 'SEC paper missing' });
    if (!vtc) flags.push({ severity: 'block', reason: 'VTC paper missing' });
    if (mdc && !MORNING_PAPER_TITLES.includes(mdc)) {
      flags.push({
        severity: 'block',
        reason: `MDC "${mdc}" is not in the Morning Sem 3 pool`,
      });
    }
    if (sec && !MORNING_PAPER_TITLES.includes(sec)) {
      flags.push({
        severity: 'block',
        reason: `SEC "${sec}" is not in the Morning Sem 3 pool`,
      });
    }
    if (vtc && !MORNING_PAPER_TITLES.includes(vtc)) {
      flags.push({
        severity: 'block',
        reason: `VTC "${vtc}" is not in the Morning Sem 3 pool`,
      });
    }
    if (
      major === 'English' &&
      normalizeLabel(mdc).includes('english proficiency')
    ) {
      flags.push({
        severity: 'warn',
        reason:
          'English major + English Proficiency MDC is excluded in the Morning Sem 3 pool rules',
      });
    }
    if (
      major === 'Education' &&
      normalizeLabel(mdc).includes('development of education')
    ) {
      flags.push({
        severity: 'warn',
        reason:
          'Education major + Development of Education in North-East India MDC is excluded in the Morning Sem 3 pool rules',
      });
    }

    let email = src(row, headers, 'Email').trim().toLowerCase();
    if (email.includes('@')) {
      if (usedEmails.has(email)) {
        const generated = uniqueEmail(roll || name, usedEmails);
        flags.push({
          severity: 'warn',
          reason: `Duplicate email "${email}" replaced with ${generated}`,
        });
        email = generated;
      }
    } else {
      email = uniqueEmail(roll || `sem3morn${rowNumber}`, usedEmails);
      flags.push({
        severity: 'warn',
        reason: `Generated login email ${email} - replace with the student's real address`,
      });
    }
    usedEmails.add(email);

    let mobile = digitsOnly(src(row, headers, 'Mobile'));
    if (mobile.length === 11 && mobile.startsWith('0'))
      mobile = mobile.slice(1);
    if (mobile.length !== 10) {
      if (mobile) {
        flags.push({
          severity: 'warn',
          reason: `Cleared invalid mobile "${mobile}"`,
        });
      }
      mobile = '';
    } else if (usedMobiles.has(mobile)) {
      flags.push({
        severity: 'warn',
        reason: `Duplicate mobile ${mobile} cleared (kept on the first student)`,
      });
      mobile = '';
    } else {
      usedMobiles.add(mobile);
    }

    let abc = digitsOnly(srcAny(row, headers, ['ABC ID', 'ABC_ID']));
    if (abc && abc.length !== 12) {
      flags.push({
        severity: 'warn',
        reason: `Cleared ABC ID "${abc}" (must be 12 digits)`,
      });
      abc = '';
    } else if (abc && usedAbcs.has(abc)) {
      flags.push({
        severity: 'warn',
        reason: `Duplicate ABC ID ${abc} cleared (kept on the first student / existing ERP record)`,
      });
      abc = '';
    } else if (abc) {
      usedAbcs.add(abc);
    }

    const fatherName =
      collapseSpaces(srcAny(row, headers, ["Father's Name", 'Father Name'])) ||
      'Not Provided';
    const motherName =
      collapseSpaces(srcAny(row, headers, ["Mother's Name", 'Mother Name'])) ||
      'Not Provided';
    if (fatherName === 'Not Provided') {
      flags.push({
        severity: 'warn',
        reason: "Father's Name missing - filled Not Provided",
      });
    }
    if (motherName === 'Not Provided') {
      flags.push({
        severity: 'warn',
        reason: "Mother's Name missing - filled Not Provided",
      });
    }

    if (roll && existingRegs.has(roll.toUpperCase())) {
      flags.push({
        severity: 'warn',
        reason: `Registration ${roll} already exists in ERP — wipe the Sem 3 cohort before CREATE import`,
      });
    }

    const values: Record<string, string> = {
      'Registration Number': roll,
      'Full Name': name,
      Email: email,
      Mobile: mobile,
      ABC_ID: abc,
      Programme: programme,
      'Admission Batch': batchCode,
      Stream: 'ARTS',
      Shift: 'MORNING',
      'Academic Session': academicSession,
      'Current Semester': '3',
      'Major Department': major,
      'MDC Paper': mdc,
      'SEC Paper': sec,
      'VTC Paper': vtc,
      'Section Code': '',
      Category: normalizeCategory(src(row, headers, 'Category')),
      Religion: normalizeReligion(src(row, headers, 'Religion')),
      'Father Name': fatherName,
      'Mother Name': motherName,
      'Import Review Flag': flags.map((f) => f.reason).join(' | '),
    };

    if (flags.some((f) => f.severity === 'block')) {
      flaggedOnly.push({
        sourceRow: rowNumber,
        name,
        roll,
        flags,
        values,
      });
      continue;
    }

    importRows.push({ sourceRow: rowNumber, values, flags });
    if (flags.length) {
      flaggedOnly.push({
        sourceRow: rowNumber,
        name,
        roll,
        flags,
        values,
      });
    }
  }

  const out = new ExcelJS.Workbook();
  const students = out.addWorksheet('Students');
  const studentHeaders = [
    ...SEM3_ADMISSION_TEMPLATE_HEADERS,
    'Import Review Flag',
  ];
  students.addRow([...studentHeaders]);
  students.addRow(
    studentHeaders.map((header) => {
      if (header === 'Import Review Flag') {
        return 'Office use — extra column, ignored by ERP import';
      }
      return (
        SEM3_ADMISSION_TEMPLATE_HELPERS[
          header as keyof typeof SEM3_ADMISSION_TEMPLATE_HELPERS
        ] ?? ''
      );
    }),
  );
  students.getRow(1).font = { bold: true };
  students.getRow(2).font = { italic: true, color: { argb: 'FF666666' } };
  students.views = [{ state: 'frozen', ySplit: 2 }];

  const warnFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFF3CD' },
  };
  for (const entry of importRows) {
    const added = students.addRow(
      studentHeaders.map((header) => entry.values[header] ?? ''),
    );
    if (entry.flags.length) {
      added.eachCell((cell) => {
        cell.fill = warnFill;
      });
    }
  }
  students.columns.forEach((col) => {
    col.width = 22;
  });

  const flagged = out.addWorksheet('Flagged');
  flagged.addRow([
    'Source Row',
    'On Students sheet?',
    'Severity',
    'Registration / Roll',
    'Full Name',
    'Programme',
    'Major',
    'MDC',
    'SEC',
    'VTC',
    'Email',
    'Issue',
  ]);
  flagged.getRow(1).font = { bold: true };
  const blockFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF8D7DA' },
  };
  for (const entry of flaggedOnly) {
    const onStudents = entry.flags.every((f) => f.severity !== 'block');
    const severity = entry.flags.some((f) => f.severity === 'block')
      ? 'BLOCK'
      : 'WARN';
    const added = flagged.addRow([
      entry.sourceRow,
      onStudents ? 'Yes (highlighted)' : 'No - excluded',
      severity,
      entry.roll,
      entry.name,
      entry.values?.Programme ?? '',
      entry.values?.['Major Department'] ?? '',
      entry.values?.['MDC Paper'] ?? '',
      entry.values?.['SEC Paper'] ?? '',
      entry.values?.['VTC Paper'] ?? '',
      entry.values?.Email ?? '',
      entry.flags.map((f) => f.reason).join(' | '),
    ]);
    added.eachCell((cell) => {
      cell.fill = severity === 'BLOCK' ? blockFill : warnFill;
    });
  }
  flagged.columns.forEach((col) => {
    col.width = 28;
  });

  const notes = out.addWorksheet('Import Notes');
  const blocked = flaggedOnly.filter((e) =>
    e.flags.some((f) => f.severity === 'block'),
  );
  notes.addRow(['Morning Shift B.A. Semester 3 — mapped ERP import']);
  notes.addRow([]);
  notes.addRow(['Source', SOURCE]);
  notes.addRow(['Output', OUTPUT]);
  notes.addRow(['ERP sheet', 'Students (upload this sheet)']);
  notes.addRow(['Header row', '1']);
  notes.addRow(['Helper row', '2 (skipped by ERP)']);
  notes.addRow(['Data starts', 'Row 3']);
  notes.addRow([]);
  notes.addRow(['Students on CREATE import sheet', importRows.length]);
  notes.addRow([
    'Rows with warnings (still importable)',
    flaggedOnly.filter((e) => e.flags.every((f) => f.severity !== 'block'))
      .length,
  ]);
  notes.addRow(['Rows excluded / blocked', blocked.length]);
  notes.addRow([]);
  notes.addRow(['Constants applied']);
  notes.addRow(['Shift', 'MORNING']);
  notes.addRow(['Stream', 'ARTS']);
  notes.addRow(['Semester', '3']);
  notes.addRow(['Admission Batch', batchCode]);
  notes.addRow([
    'Academic Session',
    academicSession || '(batch entry session)',
  ]);
  notes.addRow([
    'AEC',
    'Auto-assigned Introduction to Academic Writing (Arts)',
  ]);
  notes.columns.forEach((col) => {
    col.width = 42;
  });

  await out.xlsx.writeFile(OUTPUT);

  const lines = [
    'Morning Shift B.A. Semester 3 — mapping report',
    '='.repeat(72),
    `Source: ${SOURCE}`,
    `Output: ${OUTPUT}`,
    `Sheet: ${sourceSheet.name}`,
    `Batch: ${batchCode}`,
    `Academic session: ${academicSession || '(blank — import uses batch entry session)'}`,
    `Mapped CREATE rows: ${importRows.length}`,
    `Blocked: ${blocked.length}`,
    `Warned: ${flaggedOnly.filter((e) => e.flags.every((f) => f.severity !== 'block')).length}`,
    '',
    blocked.length ? 'Blocked rows' : 'No blocked rows.',
    ...blocked.map(
      (entry) =>
        `  Excel row ${entry.sourceRow}  ${entry.roll}  ${entry.name}  ${entry.flags.map((f) => f.reason).join(' | ')}`,
    ),
  ];
  fs.writeFileSync(REPORT, lines.join('\n'), 'utf8');
  console.log(lines.join('\n'));
  console.log(`\nReport: ${REPORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
