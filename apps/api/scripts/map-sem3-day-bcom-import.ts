/**
 * Map the office Day Shift B.Com Semester 3 register onto the official
 * Sem 3 admission import template.
 *
 *   npx ts-node --transpile-only scripts/map-sem3-day-bcom-import.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import {
  DAY_SEM3_AEC_CODES,
  DAY_SEM3_MDC_CODES,
  DAY_SEM3_SEC_CODES,
  DAY_SEM3_VTC_CODES,
  DBC_DAY_SEM3_COURSE_TITLES,
} from '../src/modules/academic-engine/domain/dbc-day-sem3-electives-catalog';
import {
  SEM3_ADMISSION_TEMPLATE_HEADERS,
  SEM3_ADMISSION_TEMPLATE_HELPERS,
} from '../src/modules/students/migration/sem3-admission-template';
import { readOfficeIdentity } from './lib/office-identity-fields';

const SOURCE =
  process.argv.find((arg) => arg.endsWith('.xlsx') && !arg.includes('READY')) ??
  path.join(
    process.env.USERPROFILE ?? '',
    'OneDrive',
    'Desktop',
    'Import Live 1-3-5',
    'III Sem B.Com',
    'III SEM B.COM 2025 - FINAL.xlsx',
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

const PAPER_ALIASES: Record<string, string> = {
  'dev of education in north east india':
    'Development of Education in North-East India',
  'dev of edu in n e india': 'Development of Education in North-East India',
  'eng proficiency soft skill dev':
    'English Proficiency and Soft Skill Development',
  'english proficiency soft skill development':
    'English Proficiency and Soft Skill Development',
  'goods service tax': 'Goods and Service Tax (GST)',
  'baking confectionary': 'Baking and Confectionery – I',
  'baking confectionery': 'Baking and Confectionery – I',
  'event management': 'Event Management – I',
  guitar: 'Guitar – I',
  vocals: 'Vocals – I',
  'mushroom cultivation': 'Mushroom Cultivation – I',
  photography: 'Photography',
  'computerized accounting': 'Computerized Accounting',
  'financial literacy': 'Financial Literacy',
  'gender studies': 'Gender Studies',
  'national service scheme': 'National Service Scheme',
  'conflict resolution': 'Conflict Resolution',
  'introduction to translation': 'Introduction to Translation',
  'analytical thinking': 'Analytical Thinking',
  'introduction to academic writing':
    'Introduction to Academic Writing (Commerce)',
};

const DAY_PAPER_TITLES = [
  ...DAY_SEM3_MDC_CODES,
  ...DAY_SEM3_AEC_CODES,
  ...DAY_SEM3_SEC_CODES,
  ...DAY_SEM3_VTC_CODES,
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

function sourceHeaderCols(sheet: ExcelJS.Worksheet, headerRow = 2) {
  const map = new Map<string, number[]>();
  sheet.getRow(headerRow).eachCell((cell, col) => {
    const text = collapseSpaces(cellText(cell.value));
    if (!text) return;
    const list = map.get(text) ?? [];
    list.push(col);
    map.set(text, list);
  });
  return map;
}

function srcAt(
  row: ExcelJS.Row,
  headers: Map<string, number[]>,
  name: string,
  which: 'first' | 'last' = 'first',
): string {
  const cols = headers.get(name);
  if (!cols?.length) return '';
  const col = which === 'last' ? cols[cols.length - 1]! : cols[0]!;
  return cellText(row.getCell(col).value);
}

function srcAny(
  row: ExcelJS.Row,
  headers: Map<string, number[]>,
  names: string[],
  which: 'first' | 'last' = 'first',
): string {
  for (const name of names) {
    const text = srcAt(row, headers, name, which);
    if (text) return text;
  }
  return '';
}

function pickSourceSheet(book: ExcelJS.Workbook): ExcelJS.Worksheet {
  const named =
    book.getWorksheet('III SEM B.COM 2025') ??
    book.worksheets.find((sheet) => /b\.?com/i.test(sheet.name));
  const sheet = named ?? book.worksheets[0];
  if (!sheet) throw new Error('Source sheet not found');
  return sheet;
}

function expandPaperTitle(raw: string): string {
  const text = collapseSpaces(raw);
  if (!text) return '';
  const key = normalizeLabel(text);
  if (PAPER_ALIASES[key]) return PAPER_ALIASES[key];
  const official = DAY_PAPER_TITLES.find(
    (title) => normalizeLabel(title) === key,
  );
  if (official) return official;
  const partial = DAY_PAPER_TITLES.filter(
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
  const base = emailBase(seed) || 'sem3bcom';
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
  const headers = sourceHeaderCols(sourceSheet, 2);

  const usedEmails = new Set<string>();
  const usedMobiles = new Set<string>();
  const usedAbcs = new Set<string>();
  const existingRegs = new Set<string>();
  const wipeEmailOwner = new Map<string, string>();
  const wipeMobileOwner = new Map<string, string>();
  const wipeAbcOwner = new Map<string, string>();
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
        const wipeCohort =
          batchCodeUpper === 'BATCH-2025' || batchCodeUpper === 'BATCH-2024';
        const enrollment = student.enrollmentNumber?.trim().toUpperCase() ?? '';
        const email = student.user?.email?.trim().toLowerCase();
        const mobile = digitsOnly(student.masterProfile?.mobileNumber ?? '');
        const abc = student.abcAccount?.abcId?.trim().toUpperCase();
        if (wipeCohort) {
          if (email && enrollment) wipeEmailOwner.set(email, enrollment);
          if (mobile && enrollment) wipeMobileOwner.set(mobile, enrollment);
          if (abc && enrollment) wipeAbcOwner.set(abc, enrollment);
        } else {
          if (email) usedEmails.add(email);
          if (mobile) usedMobiles.add(mobile);
          if (abc) usedAbcs.add(abc);
        }
        if (enrollment) existingRegs.add(enrollment);
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
    const name = collapseSpaces(srcAny(row, headers, ['Name', 'Full Name']));
    if (!name) continue;

    const flags: Flag[] = [];
    const roll = collapseSpaces(
      srcAny(row, headers, ['Roll No.', 'ROLL NO.', 'ROLL NO'], 'first'),
    ).toUpperCase();
    const majorRaw = srcAny(row, headers, ['Major Subject', 'MAJOR']);
    const major =
      /business environment|corporate accounting|commerce|b\.?com/i.test(
        majorRaw,
      )
        ? 'Commerce'
        : titleCaseWords(majorRaw);
    const programme = major === 'Commerce' ? 'BCOM' : '';
    if (!programme) {
      flags.push({
        severity: 'block',
        reason: `Unknown major "${majorRaw}" — B.Com Sem 3 expects Commerce`,
      });
    }

    const mdc = expandPaperTitle(srcAny(row, headers, ['MDC']));
    const aec =
      expandPaperTitle(srcAny(row, headers, ['AEC', 'AEC Paper'])) ||
      'Introduction to Academic Writing (Commerce)';
    const sec = expandPaperTitle(srcAny(row, headers, ['SEC']));
    const vtc = expandPaperTitle(srcAny(row, headers, ['VTC']));
    if (!mdc) flags.push({ severity: 'block', reason: 'MDC paper missing' });
    if (!aec) flags.push({ severity: 'block', reason: 'AEC paper missing' });
    if (!sec) flags.push({ severity: 'block', reason: 'SEC paper missing' });
    if (!vtc) flags.push({ severity: 'block', reason: 'VTC paper missing' });
    if (mdc && !DAY_PAPER_TITLES.includes(mdc)) {
      flags.push({
        severity: 'block',
        reason: `MDC "${mdc}" is not in the Day Sem 3 pool`,
      });
    }
    if (aec && !DAY_PAPER_TITLES.includes(aec)) {
      flags.push({
        severity: 'block',
        reason: `AEC "${aec}" is not in the Day Sem 3 pool`,
      });
    }
    if (sec && !DAY_PAPER_TITLES.includes(sec)) {
      flags.push({
        severity: 'block',
        reason: `SEC "${sec}" is not in the Day Sem 3 pool`,
      });
    }
    if (vtc && !DAY_PAPER_TITLES.includes(vtc)) {
      flags.push({
        severity: 'block',
        reason: `VTC "${vtc}" is not in the Day Sem 3 pool`,
      });
    }
    if (normalizeLabel(mdc) === 'national service scheme') {
      flags.push({
        severity: 'warn',
        reason:
          'National Service Scheme is listed as Arts-only in the Day Sem 3 MDC rules — kept because it is on the office Excel',
      });
    }

    let email = srcAt(row, headers, 'Email').trim().toLowerCase();
    if (email.includes('@')) {
      const otherWipeOwner = wipeEmailOwner.get(email);
      if (
        usedEmails.has(email) ||
        (otherWipeOwner && otherWipeOwner !== roll)
      ) {
        const generated = uniqueEmail(roll || name, usedEmails);
        flags.push({
          severity: 'warn',
          reason: `Duplicate email "${email}" replaced with ${generated}`,
        });
        email = generated;
      }
    } else {
      email = uniqueEmail(roll || `sem3bcom${rowNumber}`, usedEmails);
      flags.push({
        severity: 'warn',
        reason: `Generated login email ${email} - replace with the student's real address`,
      });
    }
    usedEmails.add(email);

    let mobile = digitsOnly(srcAny(row, headers, ['Mobile'], 'first'));
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
    } else {
      const otherWipeOwner = wipeMobileOwner.get(mobile);
      if (
        usedMobiles.has(mobile) ||
        (otherWipeOwner && otherWipeOwner !== roll)
      ) {
        flags.push({
          severity: 'warn',
          reason: `Duplicate mobile ${mobile} cleared (kept on the first student)`,
        });
        mobile = '';
      } else {
        usedMobiles.add(mobile);
      }
    }

    let abc = digitsOnly(srcAny(row, headers, ['ABC ID', 'ABC_ID']));
    if (abc && abc.length !== 12) {
      flags.push({
        severity: 'warn',
        reason: `Cleared ABC ID "${abc}" (must be 12 digits)`,
      });
      abc = '';
    } else if (abc) {
      const otherWipeOwner = wipeAbcOwner.get(abc);
      if (usedAbcs.has(abc) || (otherWipeOwner && otherWipeOwner !== roll)) {
        flags.push({
          severity: 'warn',
          reason: `Duplicate ABC ID ${abc} cleared (kept on the first student / existing ERP record)`,
        });
        abc = '';
      } else {
        usedAbcs.add(abc);
      }
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

    const { nehuRoll, nehuReg } = readOfficeIdentity(
      row,
      headers,
      cellText,
      roll,
    );

    const values: Record<string, string> = {
      'Registration Number': roll,
      'Roll Number': roll,
      'University Roll Number': nehuRoll,
      'University Registration Number': nehuReg,
      'Full Name': name,
      Email: email,
      Mobile: mobile,
      ABC_ID: abc,
      Programme: programme,
      'Admission Batch': batchCode,
      Stream: 'COMMERCE',
      Shift: 'DAY',
      'Academic Session': academicSession,
      'Current Semester': '3',
      'Major Department': major,
      'MDC Paper': mdc,
      'AEC Paper': aec,
      'SEC Paper': sec,
      'VTC Paper': vtc,
      'Section Code': '',
      Category: normalizeCategory(
        srcAny(row, headers, ['Category', 'Category Status']),
      ),
      Religion: normalizeReligion(srcAny(row, headers, ['Religion'])),
      'Father Name': fatherName,
      'Mother Name': motherName,
      'Import Review Flag': flags.map((f) => f.reason).join(' | '),
    };

    if (flags.some((f) => f.severity === 'block')) {
      flaggedOnly.push({ sourceRow: rowNumber, name, roll, flags, values });
      continue;
    }

    importRows.push({ sourceRow: rowNumber, values, flags });
    if (flags.length) {
      flaggedOnly.push({ sourceRow: rowNumber, name, roll, flags, values });
    }
  }

  const out = new ExcelJS.Workbook();
  const students = out.addWorksheet('Students');
  const studentHeaders = [
    ...SEM3_ADMISSION_TEMPLATE_HEADERS.slice(
      0,
      SEM3_ADMISSION_TEMPLATE_HEADERS.indexOf('SEC Paper'),
    ),
    'AEC Paper',
    ...SEM3_ADMISSION_TEMPLATE_HEADERS.slice(
      SEM3_ADMISSION_TEMPLATE_HEADERS.indexOf('SEC Paper'),
    ),
    'Import Review Flag',
  ];
  students.addRow([...studentHeaders]);
  students.addRow(
    studentHeaders.map((header) => {
      if (header === 'Import Review Flag') {
        return 'Office use — extra column, ignored by ERP import';
      }
      if (header === 'AEC Paper') {
        return 'Day B.Com has several AEC options — filled from office Excel';
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
  notes.addRow(['Day Shift B.Com Semester 3 — mapped ERP import']);
  notes.addRow([]);
  notes.addRow(['Source', SOURCE]);
  notes.addRow(['Output', OUTPUT]);
  notes.addRow(['ERP sheet', 'Students (upload this sheet)']);
  notes.addRow(['Students on CREATE import sheet', importRows.length]);
  notes.addRow(['Rows excluded / blocked', blocked.length]);
  notes.addRow(['Shift', 'DAY']);
  notes.addRow(['Stream', 'COMMERCE']);
  notes.addRow(['Semester', '3']);
  notes.addRow(['Admission Batch', batchCode]);
  notes.addRow([
    'Academic Session',
    academicSession || '(batch entry session)',
  ]);
  notes.addRow([
    'AEC',
    'Auto-assigned Introduction to Academic Writing (Commerce)',
  ]);
  notes.addRow([
    'Major / Minor in office Excel',
    'Business Environment / Corporate Accounting mapped to Major Department = Commerce. Sem 3 template has no minor column — ERP assigns Commerce major papers automatically.',
  ]);
  notes.columns.forEach((col) => {
    col.width = 42;
  });

  await out.xlsx.writeFile(OUTPUT);

  const lines = [
    'Day Shift B.Com Semester 3 — mapping report',
    '='.repeat(72),
    `Source: ${SOURCE}`,
    `Output: ${OUTPUT}`,
    `Sheet: ${sourceSheet.name}`,
    `Batch: ${batchCode}`,
    `Academic session: ${academicSession || '(blank — import uses batch entry session)'}`,
    `Mapped CREATE rows: ${importRows.length}`,
    `Blocked: ${blocked.length}`,
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
