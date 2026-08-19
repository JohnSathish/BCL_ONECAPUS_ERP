/**
 * Map the office Morning Shift B.A. Semester 5 register onto the official
 * Sem 5 admission import template.
 *
 *   npx ts-node --transpile-only scripts/map-sem5-morning-ba-import.ts
 *   npx ts-node --transpile-only scripts/map-sem5-morning-ba-import.ts "C:\\path\\morning 5 sem.xlsx"
 */
import * as fs from 'fs';
import * as path from 'path';
import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import {
  canonicalDbcMajorName,
  DBC_MAJOR_MINOR_DEPT_CODE,
  isAllowedDbcMajorMinorPair,
} from '../src/modules/academic-engine/domain/dbc-major-minor-matrix';
import {
  SEM5_ADMISSION_TEMPLATE_HEADERS,
  SEM5_ADMISSION_TEMPLATE_HELPERS,
} from '../src/modules/students/migration/sem5-admission-template';

const SOURCE =
  process.argv.find((arg) => arg.endsWith('.xlsx') && !arg.includes('READY')) ??
  path.join(
    process.env.USERPROFILE ?? '',
    'OneDrive',
    'Desktop',
    'Import Live 1-3-5',
    'V Sem Morning',
    'morning 5 sem.xlsx',
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
    const text = cellText(cell.value);
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
    book.getWorksheet('5 SEM') ??
    book.getWorksheet('V SEM') ??
    book.worksheets.find((sheet) => /5\s*sem/i.test(sheet.name));
  const sheet = named ?? book.worksheets[0];
  if (!sheet) throw new Error('Source sheet not found');
  return sheet;
}

function digitsOnly(raw: string): string {
  return raw.replace(/\.0$/, '').replace(/[^\d]/g, '');
}

function emailBase(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function uniqueEmail(seed: string, used: Set<string>): string {
  const base = emailBase(seed) || 'sem5morn';
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

function religionFromDenomination(raw: string): string {
  const upper = raw.trim().toUpperCase();
  if (!upper) return '';
  if (
    ['MALE', 'FEMALE', 'FEMAL', 'BOY', 'GIRL', 'M', 'F', 'FM'].includes(upper)
  ) {
    return '';
  }
  if (
    [
      'CHRISTIAN',
      'CHRISTIANITY',
      'CHRISTISN',
      'CATHOLIC',
      'BAPTIST',
      'PRESBYTERIAN',
    ].includes(upper)
  ) {
    return 'Christian';
  }
  if (['HINDU', 'HINDUISM'].includes(upper)) return 'Hindu';
  if (['MUSLIM', 'ISLAM'].includes(upper)) return 'Muslim';
  if (['BUDDHIST', 'BUDDHISM'].includes(upper)) return 'Buddhist';
  if (['OTHER', 'OTHERS'].includes(upper)) return 'Other';
  return titleCaseWords(raw);
}

function internshipLabel(major: string): string {
  const code = DBC_MAJOR_MINOR_DEPT_CODE[major];
  return code ? `${code}-303 — Internship` : '';
}

function mapShift(raw: string): {
  code: string;
  include: boolean;
  note?: string;
} {
  const key = normalizeLabel(raw);
  if (!key) {
    return {
      code: 'MORNING',
      include: true,
      note: 'Shift blank — defaulted to MORNING (this is the Morning workbook)',
    };
  }
  if (key.includes('morning')) return { code: 'MORNING', include: true };
  if (key.includes('evening') || key.includes('shift ii')) {
    return {
      code: 'MORNING',
      include: true,
      note: 'Office listed Evening Shift; Arts Shift II is inactive in ERP so imported as MORNING',
    };
  }
  if (key.includes('day')) {
    return {
      code: 'MORNING',
      include: true,
      note: 'Office listed Day Shift — imported as MORNING per office instruction',
    };
  }
  return {
    code: 'MORNING',
    include: true,
    note: `Unknown shift "${raw}" defaulted to MORNING`,
  };
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
  let batchCode = 'BATCH-2024';

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
          batchCode: { equals: 'BATCH-2024', mode: 'insensitive' },
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
    const name = collapseSpaces(
      srcAny(row, headers, ['Name', 'Name of The Candidate', 'Full Name']),
    );
    if (!name) continue;

    const flags: Flag[] = [];
    const roll = collapseSpaces(
      srcAny(row, headers, ['ROLL NO', 'ROLL NO.', 'Roll No.']),
    ).toUpperCase();
    const majorRaw = srcAny(row, headers, ['MAJOR', 'Major Subject']);
    const minorRaw = srcAny(row, headers, ['MINOR', 'Minor Subject']);
    const major = canonicalDbcMajorName(majorRaw) ?? titleCaseWords(majorRaw);
    const minor = canonicalDbcMajorName(minorRaw) ?? titleCaseWords(minorRaw);
    const programme = PROGRAMME_BY_MAJOR[major] ?? '';
    if (!programme) {
      flags.push({
        severity: 'block',
        reason: `Unknown major "${majorRaw}" — cannot assign programme`,
      });
    }
    if (!minor) {
      flags.push({ severity: 'block', reason: 'Minor department missing' });
    }

    let principalException = '';
    if (major && minor && !isAllowedDbcMajorMinorPair(major, minor)) {
      principalException = 'PRINCIPAL';
      flags.push({
        severity: 'warn',
        reason: `Unofficial pair ${major} + ${minor} kept under Principal exception (not added to the college-wide table)`,
      });
    }

    const internship = internshipLabel(major);
    if (!internship) {
      flags.push({
        severity: 'block',
        reason: `Cannot build internship course for major "${majorRaw}"`,
      });
    }

    const shiftInfo = mapShift(srcAt(row, headers, 'Shift'));
    if (!shiftInfo.include) {
      flags.push({
        severity: 'block',
        reason:
          shiftInfo.note ?? `Shift ${shiftInfo.code} excluded from this file`,
      });
    } else if (shiftInfo.note) {
      flags.push({ severity: 'warn', reason: shiftInfo.note });
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
      email = uniqueEmail(roll || `sem5morn${rowNumber}`, usedEmails);
      flags.push({
        severity: 'warn',
        reason: `Generated login email ${email} - replace with the student's real address`,
      });
    }
    usedEmails.add(email);

    let mobile = digitsOnly(
      srcAny(row, headers, ['Mobile', 'Mobile Number'], 'last'),
    );
    if (!mobile) mobile = digitsOnly(srcAny(row, headers, ['Mobile'], 'first'));
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
        reason: `Registration ${roll} already exists in ERP — wipe the Sem 5 cohort before CREATE import`,
      });
    }

    const religion = religionFromDenomination(
      srcAny(row, headers, ['DENOMINATION', 'Religion'], 'first'),
    );

    const values: Record<string, string> = {
      'Registration Number': roll,
      'Full Name': name,
      Email: email,
      Mobile: mobile,
      ABC_ID: abc,
      Programme: programme,
      'Admission Batch': batchCode,
      Stream: 'ARTS',
      Shift: shiftInfo.code,
      'Academic Session': academicSession,
      'Current Semester': '5',
      'Major Department': major,
      'Minor Department': minor,
      'Internship Area': internship,
      'Section Code': '',
      Category: normalizeCategory(
        srcAny(row, headers, ['Category Status', 'Category'], 'first'),
      ),
      Religion: religion,
      'Father Name': fatherName,
      'Mother Name': motherName,
      'Principal Combination Exception': principalException,
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
    ...SEM5_ADMISSION_TEMPLATE_HEADERS,
    'Principal Combination Exception',
    'Import Review Flag',
  ];
  students.addRow([...studentHeaders]);
  students.addRow(
    studentHeaders.map((header) => {
      if (header === 'Principal Combination Exception') {
        return 'PRINCIPAL only — named exception, does not change the official combination table';
      }
      if (header === 'Import Review Flag') {
        return 'Office use — extra column, ignored by ERP import';
      }
      return SEM5_ADMISSION_TEMPLATE_HELPERS[header] ?? '';
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
    'Shift',
    'Major',
    'Minor',
    'Internship',
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
      entry.values?.Shift ?? '',
      entry.values?.['Major Department'] ?? '',
      entry.values?.['Minor Department'] ?? '',
      entry.values?.['Internship Area'] ?? '',
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
  const eveningAsMorningCount = importRows.filter((e) =>
    e.flags.some((f) => f.reason.includes('Evening Shift')),
  ).length;
  const dayAsMorningCount = importRows.filter((e) =>
    e.flags.some((f) => f.reason.includes('Day Shift')),
  ).length;
  const blankAsMorningCount = importRows.filter((e) =>
    e.flags.some((f) => f.reason.includes('Shift blank')),
  ).length;
  const principalCount = importRows.filter(
    (e) => e.values['Principal Combination Exception'] === 'PRINCIPAL',
  ).length;
  notes.addRow(['Morning Shift B.A. Semester 5 — mapped ERP import']);
  notes.addRow([]);
  notes.addRow(['Source', SOURCE]);
  notes.addRow(['Output', OUTPUT]);
  notes.addRow(['ERP sheet', 'Students (upload this sheet)']);
  notes.addRow(['Header row', '1']);
  notes.addRow(['Helper row', '2 (skipped by ERP)']);
  notes.addRow(['Data starts', 'Row 3']);
  notes.addRow([]);
  notes.addRow(['Students on CREATE import sheet', importRows.length]);
  notes.addRow(['Evening students mapped as Morning', eveningAsMorningCount]);
  notes.addRow(['Day students mapped as Morning', dayAsMorningCount]);
  notes.addRow(['Blank-shift students mapped as Morning', blankAsMorningCount]);
  notes.addRow(['Principal exceptions', principalCount]);
  notes.addRow(['Rows excluded / blocked', blocked.length]);
  notes.addRow([]);
  notes.addRow(['Constants applied']);
  notes.addRow(['Stream', 'ARTS']);
  notes.addRow(['Semester', '5']);
  notes.addRow(['Admission Batch', batchCode]);
  notes.addRow([
    'Academic Session',
    academicSession || '(batch entry session)',
  ]);
  notes.addRow([
    'Internship',
    'Filled from major as {DEPT}-303 — Internship (no internship column in office Excel)',
  ]);
  notes.columns.forEach((col) => {
    col.width = 42;
  });

  await out.xlsx.writeFile(OUTPUT);

  const lines = [
    'Morning Shift B.A. Semester 5 — mapping report',
    '='.repeat(72),
    `Source: ${SOURCE}`,
    `Output: ${OUTPUT}`,
    `Sheet: ${sourceSheet.name}`,
    `Batch: ${batchCode}`,
    `Academic session: ${academicSession || '(blank — import uses batch entry session)'}`,
    `Mapped CREATE rows: ${importRows.length}`,
    `  Morning: ${importRows.filter((e) => e.values.Shift === 'MORNING').length}`,
    `  Evening listed in Excel, mapped as Morning: ${eveningAsMorningCount}`,
    `  Day listed in Excel, mapped as Morning: ${dayAsMorningCount}`,
    `  Blank shift, mapped as Morning: ${blankAsMorningCount}`,
    `Principal exceptions: ${principalCount}`,
    `Blocked / excluded: ${blocked.length}`,
    '',
    blocked.length ? 'Blocked / excluded rows' : 'No blocked rows.',
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
