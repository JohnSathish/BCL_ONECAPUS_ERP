/**
 * Map a college Semester 1 register (Arts / Commerce / Science) onto the ERP
 * Full Admission import template.
 *
 *   npx ts-node --transpile-only scripts/map-sem1-ba-arts-import.ts
 *   npx ts-node --transpile-only scripts/map-sem1-ba-arts-import.ts "C:\\path\\I SEM COMMERCE (1).xlsx"
 */
import * as path from 'path';
import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import { parseFlexibleDate } from '../src/common/utils/parse-flexible-date';
import { DBC_DAY_SEM1_COURSE_TITLES } from '../src/modules/academic-engine/domain/dbc-day-sem1-electives-catalog';
import { DBC_MORNING_SEM1_COURSE_TITLES } from '../src/modules/academic-engine/domain/dbc-morning-sem1-electives-catalog';
import {
  canonicalDbcMajorName,
  isAllowedDbcMajorMinorPair,
} from '../src/modules/academic-engine/domain/dbc-major-minor-matrix';
import {
  FULL_ADMISSION_IMPORT_HEADERS,
  FULL_ADMISSION_IMPORT_HELPERS,
} from '../src/modules/students/import/student-import-field-registry';

const SOURCE =
  process.argv.find((arg) => arg.endsWith('.xlsx') && !arg.includes('READY')) ??
  path.join(
    process.env.USERPROFILE ?? '',
    'OneDrive',
    'Desktop',
    'Import Live 1-3-5',
    'I Sem B.A',
    'I SEM ARTS.xlsx',
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
const MERGE_OUTPUT = path.join(
  path.dirname(SOURCE),
  `${SOURCE_STEM} - MERGE EXISTING.xlsx`,
);

function detectAdmissionStream(
  sourcePath: string,
): 'ARTS' | 'COMMERCE' | 'SCIENCE' {
  const text = sourcePath.toLowerCase();
  if (
    text.includes('commerce') ||
    text.includes('b.com') ||
    text.includes('bcom')
  ) {
    return 'COMMERCE';
  }
  if (text.includes('science')) return 'SCIENCE';
  return 'ARTS';
}

function detectAdmissionShift(sourcePath: string): 'DAY' | 'MORNING' {
  return sourcePath.toLowerCase().includes('morning') ? 'MORNING' : 'DAY';
}

const ADMISSION_STREAM = detectAdmissionStream(SOURCE);
const ADMISSION_SHIFT = detectAdmissionShift(SOURCE);

const PROGRAMME_BY_ROLL_PREFIX: Record<string, string> = {
  EC: 'BA-ECO',
  ED: 'BA-EDU',
  EN: 'BA-ENG',
  GA: 'BA-GAR',
  GE: 'BA-GEO',
  HI: 'BA-HIS',
  PHI: 'BA-PHI',
  PS: 'BA-POL',
  SO: 'BA-SOC',
  COM: 'BCOM',
  BOT: 'BSC-BOT',
  CHE: 'BSC-CHE',
  MAT: 'BSC-MTH',
  PHY: 'BSC-PHY',
  ZOO: 'BSC-ZOO',
};

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
  Commerce: 'BCOM',
  Botany: 'BSC-BOT',
  Chemistry: 'BSC-CHE',
  Mathematics: 'BSC-MTH',
  Physics: 'BSC-PHY',
  Zoology: 'BSC-ZOO',
};

const PAPER_ALIASES: Record<string, string> = {
  'culture society': 'Culture and Society',
  'philosophy of culture': 'Philosophy of Culture',
  'fundamentals of comp sys': 'Fundamentals of Computer Systems',
  'intro to life sciences': 'Introduction to Life Sciences',
  'introduction to n c c': 'Introduction to National Cadet Corps',
  'introduction to ncc': 'Introduction to National Cadet Corps',
  'comm arith ele stats': 'Commercial Arithmetic & Elementary Statistics',
  'mathematics in daily life': 'Mathematics in Daily Life',
  'mil garo': 'MIL-I: Garo',
  'alt english': 'Alternative English',
  'personality dev': 'Personality Development',
  motivation: 'Motivation',
  'public speaking': 'Public Speaking',
  'env studies': 'Environmental Studies',
  'environment studies': 'Environmental Studies',
  'pol science': 'Political Science',
};

const OFFICIAL_PAPER_TITLES = [
  ...new Set([
    ...Object.values(DBC_DAY_SEM1_COURSE_TITLES),
    ...Object.values(DBC_MORNING_SEM1_COURSE_TITLES),
  ]),
];

type ExistingStudentRef = {
  enrollment: string;
  email: string;
  mobile: string;
  name: string;
  aadhaar: string;
  application: string;
};

function namesMatch(left: string, right: string): boolean {
  return normalizeLabel(left) === normalizeLabel(right);
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (value instanceof Date) return parseFlexibleDate(value) ?? '';
  if (typeof value === 'object') {
    if ('result' in value && value.result != null)
      return cellText(value.result as ExcelJS.CellValue);
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

function sourceHeaderMap(
  sheet: ExcelJS.Worksheet,
  headerRow = 2,
): Map<string, number> {
  const map = new Map<string, number>();
  sheet.getRow(headerRow).eachCell((cell, col) => {
    const text = cellText(cell.value);
    if (text) map.set(text, col);
  });
  return map;
}

function detectHeaderRow(sheet: ExcelJS.Worksheet): number {
  for (const rowNumber of [2, 3, 4]) {
    const map = sourceHeaderMap(sheet, rowNumber);
    if (map.has('Name of the Student') || map.has('Full Name'))
      return rowNumber;
  }
  throw new Error(
    `Expected student name header on row 2, 3, or 4 of ${sheet.name}`,
  );
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

function srcRaw(
  row: ExcelJS.Row,
  headers: Map<string, number>,
  name: string,
): ExcelJS.CellValue {
  const col = headers.get(name);
  return col ? row.getCell(col).value : null;
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
    book.getWorksheet('I SEM COMMERCE') ??
    book.getWorksheet('I SEM SCIENCE') ??
    book.getWorksheet('I SEM ARTS DAY SHIFT') ??
    book.getWorksheet('1 SEM') ??
    book.worksheets.find((sheet) => /sem/i.test(sheet.name));
  const sheet = named ?? book.worksheets[0];
  if (!sheet) throw new Error('Source sheet not found');
  return sheet;
}

function expandPaperTitle(raw: string, kind: 'mdc' | 'aec' | 'sec'): string {
  const text = collapseSpaces(raw);
  if (!text) return '';
  const key = normalizeLabel(text);
  const aliased = PAPER_ALIASES[key];
  if (aliased) return aliased;
  const official = OFFICIAL_PAPER_TITLES.find(
    (title) => normalizeLabel(title) === key,
  );
  if (official) return official;
  if (kind === 'mdc' || kind === 'aec' || kind === 'sec') {
    return text;
  }
  return text;
}

function expandDepartment(raw: string): string {
  const text = collapseSpaces(raw);
  if (!text) return '';
  return canonicalDbcMajorName(text) ?? titleCaseWords(text);
}

function programmeFromRoll(roll: string): string {
  const match = roll
    .trim()
    .toUpperCase()
    .match(/^([A-Z]{2,3})\d{2}/);
  if (!match) return '';
  return PROGRAMME_BY_ROLL_PREFIX[match[1]] ?? '';
}

function normalizeGender(raw: string): string {
  const upper = raw.trim().toUpperCase();
  if (['MALE', 'M', 'BOY', 'MLAE'].includes(upper)) return 'Male';
  if (['FEMALE', 'FEMAL', 'F', 'GIRL'].includes(upper)) return 'Female';
  if (['OTHER', 'O'].includes(upper)) return 'Other';
  return collapseSpaces(raw);
}

function normalizeCategory(raw: string): string {
  const upper = raw.trim().toUpperCase();
  if (!upper || /^\d+$/.test(upper)) return '';
  if (upper === 'GEN' || upper === 'GENERAL') return 'GENERAL';
  if (['ST', 'SC', 'OBC', 'EWS'].includes(upper)) return upper;
  return collapseSpaces(raw).toUpperCase();
}

function normalizeReligion(raw: string): { religion: string; note?: string } {
  const upper = raw.trim().toUpperCase();
  if (!upper) return { religion: '' };
  if (['CHRISTIAN', 'CHRISTIANITY', 'CHRISTISN'].includes(upper)) {
    return { religion: 'Christian' };
  }
  if (['HINDU', 'HINDUISM'].includes(upper)) return { religion: 'Hindu' };
  if (upper === 'BAPTIST') {
    return {
      religion: 'Christian',
      note: 'Religion "BAPTIST" mapped to Christian',
    };
  }
  if (['MUSLIM', 'ISLAM'].includes(upper)) return { religion: 'Muslim' };
  if (['BUDDHIST', 'BUDDHISM'].includes(upper)) return { religion: 'Buddhist' };
  if (['OTHER', 'OTHERS'].includes(upper)) return { religion: 'Other' };
  if (['MALE', 'FEMALE', 'FEMAL', 'BOY', 'GIRL'].includes(upper)) {
    return {
      religion: '',
      note: `Cleared religion "${raw}" (value belongs in another column)`,
    };
  }
  return { religion: titleCaseWords(raw) };
}

function normalizeDenomination(raw: string, religion: string): string {
  const upper = raw.trim().toUpperCase();
  if (!upper) return '';
  if (upper === 'OTHERS' || upper === 'OTHER') return 'Other';
  if (upper === 'BAPTST') return 'Baptist';
  if (['HINDU', 'HINDUISM'].includes(upper)) return '';
  if (upper.includes('SHIFT') || upper === 'DS' || upper === 'MS') return '';
  if (religion === 'Hindu' && ['HINDU', 'HINDUISM'].includes(upper)) return '';
  return titleCaseWords(raw);
}

function normalizeTribe(raw: string): { tribe: string; note?: string } {
  const upper = raw.trim().toUpperCase();
  if (!upper) return { tribe: '' };
  if (upper === 'GRAO' || upper === 'GARAO') {
    return { tribe: 'Garo', note: `Tribe ${upper} -> Garo` };
  }
  if (
    ['HINDU', 'TRIBE', 'B.COM', 'BCOM'].includes(upper) ||
    /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(upper)
  ) {
    return { tribe: '', note: `Cleared non-tribe value "${raw}"` };
  }
  const known = new Set([
    'GARO',
    'KHASI',
    'HAJONG',
    'KOCH',
    'JAINTIA',
    'BENGALI',
    'NEPALI',
  ]);
  const titled = titleCaseWords(raw);
  if (!known.has(upper)) {
    return {
      tribe: '',
      note: `Cleared tribe "${titled}" (not in ERP lookup). Add the lookup then restore.`,
    };
  }
  return { tribe: titled };
}

function normalizeMappedBloodGroup(raw: string): string {
  const compact = collapseSpaces(raw)
    .replace(/\s+/g, '')
    .replace(/\u2212/g, '-');
  if (!compact) return '';
  const upper = compact.toUpperCase();
  if (['NOTCHECKED', 'NA', 'N/A', 'UNKNOWN', 'NIL'].includes(upper)) return '';
  if (/^(A|B|O|AB)\+VE$/i.test(compact)) {
    return `${compact.replace(/\+VE$/i, '').toUpperCase()}+`;
  }
  if (/^(A|B|O|AB)\+V$/i.test(compact)) {
    return `${compact.replace(/\+V$/i, '').toUpperCase()}+`;
  }
  if (/^(A|B|O|AB)$/i.test(compact)) return `${upper}+`;
  if (/^(A|B|O|AB)[+-]$/i.test(compact)) {
    const group = compact.slice(0, -1).toUpperCase();
    return compact.endsWith('-') ? `${group}-` : `${group}+`;
  }
  return compact;
}

function normalizeBoard(raw: string): string {
  const upper = collapseSpaces(raw).toUpperCase();
  if (!upper) return '';
  if (upper === 'CBSC') return 'CBSE';
  if (upper === 'ASSED' || upper === 'ASSAM BOARD') return 'ASSEB';
  if (['RURAL', 'URBAN', 'UNMARRIED', 'MARRIED'].includes(upper)) return '';
  return collapseSpaces(raw).toUpperCase();
}

function normalizeDivision(raw: string): string {
  const key = normalizeLabel(raw);
  if (!key) return '';
  if (['1', '1st', '1 st', 'i', 'first'].includes(key)) return '1ST';
  if (['2', '2nd', '2 nd', '2d', 'ii', 'second'].includes(key)) return '2ND';
  if (['3', '3rd', '3 rd', 'iii', 'third'].includes(key)) return '3RD';
  return collapseSpaces(raw).toUpperCase();
}

function normalizeRegistrationType(raw: string): string {
  const key = normalizeLabel(raw);
  if (!key) return '';
  if (key.includes('private') || key.includes('non regular')) return 'PRIVATE';
  if (key.includes('regular')) return 'REGULAR';
  return collapseSpaces(raw).toUpperCase();
}

function normalizePercentage(value: ExcelJS.CellValue): string {
  if (value == null || value === '') return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    const pct = value > 0 && value <= 1 ? value * 100 : value;
    return String(Math.round(pct * 10) / 10);
  }
  const text = cellText(value).replace('%', '');
  const num = Number(text);
  if (!Number.isFinite(num)) return collapseSpaces(text);
  const pct = num > 0 && num <= 1 ? num * 100 : num;
  return String(Math.round(pct * 10) / 10);
}

function digitsOnly(raw: string): string {
  return raw.replace(/\.0$/, '').replace(/[^\d]/g, '');
}

function emailBase(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function uniqueEmail(seed: string, used: Set<string>): string {
  const base = emailBase(seed) || 'sem1ba';
  let candidate = `${base}@student.donboscocollege.ac.in`;
  let n = 1;
  while (used.has(candidate)) {
    n += 1;
    candidate = `${base}${n}@student.donboscocollege.ac.in`;
  }
  return candidate;
}

function isPlaceholderName(name: string): boolean {
  const key = normalizeLabel(name);
  return key.includes('shifted to morning') || key === 'name of the student';
}

function isMovedToMorning(name: string): boolean {
  return /ds\s*>\s*ms/i.test(name);
}

function cleanDisplayName(name: string): string {
  return collapseSpaces(name.replace(/\(ds\s*>\s*ms[^)]*\)/gi, ''));
}

function isPhoneValue(raw: string): boolean {
  return /^\d{10,12}$/.test(digitsOnly(raw));
}

function isDateLike(raw: string): boolean {
  return /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(raw.trim());
}

function isGenderWord(raw: string): boolean {
  return ['MALE', 'FEMALE', 'FEMAL', 'F', 'M', 'BOY', 'GIRL'].includes(
    raw.trim().toUpperCase(),
  );
}

/** Recover Katrina-style rows where personal fields slipped several columns right. */
function salvageShiftedPersonalFields(
  row: ExcelJS.Row,
  headers: Map<string, number>,
): Record<string, string> | undefined {
  const category = src(row, headers, 'Category');
  const tribe = src(row, headers, 'Race/Tribe');
  const religion = src(row, headers, 'Religion');
  const gender = src(row, headers, 'Gender');
  const dob = src(row, headers, 'Date of Birth');
  const email = src(row, headers, 'Email');
  const mobile = src(row, headers, 'Mobile Number');
  if (gender || dob || email || mobile) return undefined;
  if (
    !(isPhoneValue(category) && isDateLike(tribe) && isGenderWord(religion))
  ) {
    return undefined;
  }
  const aadhaarCandidate = src(row, headers, 'Mother Name');
  const boardCandidate = src(row, headers, 'Aadhaar Number');
  return {
    mobile: digitsOnly(category),
    dob: tribe,
    gender: religion,
    blood: src(row, headers, 'Class XII Stream'),
    category: src(row, headers, 'Differently Abled'),
    tribe: src(row, headers, 'Economically Weaker'),
    religion: src(row, headers, 'Address in Tura'),
    denomination: src(row, headers, 'Home Address'),
    board: boardCandidate,
    fatherName: src(row, headers, 'Mother Occupation'),
    fatherMobile: digitsOnly(src(row, headers, 'Local Guardian Age')),
    motherName: src(row, headers, 'Local Guardian Occupation'),
    motherMobile: digitsOnly(src(row, headers, 'Board Roll Number')),
    aadhaar: /^\d{12}$/.test(digitsOnly(aadhaarCandidate))
      ? digitsOnly(aadhaarCandidate)
      : '',
    presentAddress: src(row, headers, 'Father Contact'),
    state: src(row, headers, 'Mother Age'),
    percentage: src(row, headers, 'Class XII  Garo MIL'),
    division: src(row, headers, 'Class XII Garo MIL  Marks'),
  };
}

async function main() {
  const sourceBook = new ExcelJS.Workbook();
  await sourceBook.xlsx.readFile(SOURCE);
  const sourceSheet = pickSourceSheet(sourceBook);
  const headerRow = detectHeaderRow(sourceSheet);
  const headers = sourceHeaderMap(sourceSheet, headerRow);
  const dataStartRow = headerRow + 1;

  const usedEmails = new Set<string>();
  const usedMobiles = new Set<string>();
  const usedApplications = new Set<string>();
  const existingByApp = new Map<string, ExistingStudentRef>();
  const existingByAadhaar = new Map<string, ExistingStudentRef>();
  const existingByEmail = new Map<string, ExistingStudentRef>();

  const prisma = new PrismaClient();
  try {
    const tenant =
      (await prisma.tenant.findFirst({ where: { slug: 'demo' } })) ??
      (await prisma.tenant.findFirst({
        where: { name: { contains: 'Don Bosco' } },
      }));
    if (tenant) {
      const existing = await prisma.student.findMany({
        where: { tenantId: tenant.id, deletedAt: null },
        select: {
          applicationNumber: true,
          enrollmentNumber: true,
          user: { select: { email: true } },
          masterProfile: {
            select: { mobileNumber: true, fullName: true, nationalId: true },
          },
        },
      });
      for (const student of existing) {
        const email = student.user?.email?.trim().toLowerCase();
        if (email) usedEmails.add(email);
        const mobile = digitsOnly(student.masterProfile?.mobileNumber ?? '');
        if (mobile) usedMobiles.add(mobile);
        const application = digitsOnly(student.applicationNumber ?? '');
        const ref: ExistingStudentRef = {
          enrollment: student.enrollmentNumber,
          email: email ?? '',
          mobile,
          name: student.masterProfile?.fullName ?? '',
          aadhaar: digitsOnly(student.masterProfile?.nationalId ?? ''),
          application,
        };
        if (application) {
          usedApplications.add(application);
          existingByApp.set(application, ref);
        }
        if (ref.aadhaar) existingByAadhaar.set(ref.aadhaar, ref);
        if (ref.email) existingByEmail.set(ref.email, ref);
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
  const mergeRows: Array<{
    sourceRow: number;
    values: Record<string, string>;
    flags: Flag[];
  }> = [];

  for (
    let rowNumber = dataStartRow;
    rowNumber <= sourceSheet.rowCount;
    rowNumber += 1
  ) {
    const row = sourceSheet.getRow(rowNumber);
    const rawName = srcAny(row, headers, ['Name of the Student', 'Full Name']);
    if (!rawName) continue;
    if (isPlaceholderName(rawName)) {
      flaggedOnly.push({
        sourceRow: rowNumber,
        name: rawName,
        roll: srcAny(row, headers, ['Roll No.', 'ROLL NO']),
        flags: [
          {
            severity: 'block',
            reason: 'Not a student row (SHIFTED TO MORNING note)',
          },
        ],
      });
      continue;
    }

    const flags: Flag[] = [];
    const name = cleanDisplayName(rawName);
    const salvage = salvageShiftedPersonalFields(row, headers);
    if (salvage) {
      flags.push({
        severity: 'warn',
        reason:
          'Personal columns were shifted; identity fields were recovered from neighbouring cells',
      });
    }
    const roll = collapseSpaces(
      srcAny(row, headers, ['Roll No.', 'ROLL NO']),
    ).toUpperCase();
    const appNo = digitsOnly(src(row, headers, 'App No.'));
    const major = expandDepartment(src(row, headers, 'Major Subject'));
    const minor = expandDepartment(src(row, headers, 'Minor Subject'));
    const mdc = expandPaperTitle(
      srcAny(row, headers, [
        'MDC',
        'Multidisciplinary Course',
        'Multidisciplinary Choice',
      ]),
      'mdc',
    );
    const aec = expandPaperTitle(
      srcAny(row, headers, ['AEC', 'Ability Enhancement Course']),
      'aec',
    );
    const sec = expandPaperTitle(
      srcAny(row, headers, [
        'SEC',
        'Skill Enhancement Course',
        'Skill Enhancement Choice',
      ]),
      'sec',
    );

    if (ADMISSION_SHIFT === 'DAY' && isMovedToMorning(rawName)) {
      flaggedOnly.push({
        sourceRow: rowNumber,
        name,
        roll,
        flags: [
          {
            severity: 'block',
            reason:
              'Marked DS>MS (moved Day to Morning). Do not import on the Day Shift file.',
          },
        ],
      });
      continue;
    }

    let programme = programmeFromRoll(roll);
    if (!programme && major) {
      programme = PROGRAMME_BY_MAJOR[major] ?? '';
    }
    if (!programme) {
      flags.push({
        severity: 'block',
        reason: 'Could not derive Programme from roll prefix or major',
      });
    }

    const sourceEmail = src(row, headers, 'Email').toLowerCase();
    const aadhaarForMatch =
      salvage?.aadhaar || digitsOnly(src(row, headers, 'Aadhaar Number'));
    const byApp = appNo ? existingByApp.get(appNo) : undefined;
    const byAadhaar = aadhaarForMatch
      ? existingByAadhaar.get(aadhaarForMatch)
      : undefined;
    const byEmail = sourceEmail.includes('@')
      ? existingByEmail.get(sourceEmail)
      : undefined;
    const existingStudent = [byApp, byAadhaar, byEmail].find(
      (match) => match && namesMatch(match.name, name),
    );
    let registration = roll || (appNo ? `APP-${appNo}` : '');
    if (existingStudent) {
      registration = existingStudent.enrollment;
      flags.push({
        severity: 'warn',
        reason: `Already in ERP as ${existingStudent.enrollment} - MERGE to attach Morning roll ${roll || '(none)'}`,
      });
    } else if (!roll) {
      flags.push({
        severity: 'warn',
        reason: `No college roll number - using ${registration || '(blank)'} as Registration Number`,
      });
    }

    let principalException = '';
    if (major && minor && !isAllowedDbcMajorMinorPair(major, minor)) {
      principalException = 'PRINCIPAL';
      flags.push({
        severity: 'warn',
        reason: `Unofficial pair ${major} + ${minor} kept under Principal exception (not added to the college-wide table)`,
      });
    }

    let email = sourceEmail.includes('@') ? sourceEmail : '';
    if (existingStudent) {
      email = existingStudent.email || email;
      if (!email) {
        email = uniqueEmail(roll || registration || name, usedEmails);
        flags.push({
          severity: 'warn',
          reason: `Generated login email ${email} - replace with the student's real address`,
        });
      }
    } else if (email) {
      if (usedEmails.has(email)) {
        const generated = uniqueEmail(roll || registration || name, usedEmails);
        flags.push({
          severity: 'warn',
          reason: `Duplicate email "${email}" replaced with ${generated}`,
        });
        email = generated;
      }
    } else {
      email = uniqueEmail(
        roll || registration || `sem1ba${rowNumber}`,
        usedEmails,
      );
      flags.push({
        severity: 'warn',
        reason: `Generated login email ${email} - replace with the student's real address`,
      });
    }
    usedEmails.add(email);

    let mobile =
      salvage?.mobile || digitsOnly(src(row, headers, 'Mobile Number'));
    if (mobile) {
      if (!existingStudent && usedMobiles.has(mobile)) {
        flags.push({
          severity: 'warn',
          reason: `Duplicate mobile ${mobile} cleared (kept on the first student)`,
        });
        mobile = '';
      } else {
        usedMobiles.add(mobile);
      }
    }

    let applicationNumber = appNo || existingStudent?.application || '';
    if (applicationNumber && !existingStudent) {
      if (usedApplications.has(applicationNumber)) {
        flags.push({
          severity: 'warn',
          reason: `Duplicate application number ${applicationNumber} cleared (kept on the first student)`,
        });
        applicationNumber = '';
      } else {
        usedApplications.add(applicationNumber);
      }
    }

    const fatherName = collapseSpaces(
      salvage?.fatherName || src(row, headers, 'Father Name'),
    );
    const motherName = collapseSpaces(
      salvage?.motherName || src(row, headers, 'Mother Name'),
    );
    const resolvedFather = fatherName || 'Not Provided';
    const resolvedMother = motherName || 'Not Provided';
    if (!fatherName) {
      flags.push({
        severity: 'warn',
        reason: "Father's Name missing - filled Not Provided",
      });
    }
    if (!motherName) {
      flags.push({
        severity: 'warn',
        reason: "Mother's Name missing - filled Not Provided",
      });
    }

    const genderRaw = salvage?.gender || src(row, headers, 'Gender');
    const gender = normalizeGender(genderRaw);
    if (
      genderRaw.toUpperCase() === 'MLAE' ||
      genderRaw.toUpperCase() === 'FEMAL'
    ) {
      flags.push({
        severity: 'warn',
        reason: `Gender typo ${genderRaw} corrected to ${gender}`,
      });
    }

    const religionInfo = normalizeReligion(
      salvage?.religion || src(row, headers, 'Religion'),
    );
    const denominationRaw =
      salvage?.denomination || src(row, headers, 'Denomination');
    let denomination = normalizeDenomination(
      denominationRaw,
      religionInfo.religion,
    );
    if (denominationRaw.trim().toUpperCase() === 'BAPTST') {
      flags.push({
        severity: 'warn',
        reason: 'Denomination typo BAPTST corrected to Baptist',
      });
    }
    if (religionInfo.note) {
      flags.push({ severity: 'warn', reason: religionInfo.note });
      if (!denomination) denomination = 'Baptist';
    }
    const tribeInfo = normalizeTribe(
      salvage?.tribe || src(row, headers, 'Race/Tribe'),
    );
    if (tribeInfo.note) {
      flags.push({ severity: 'warn', reason: tribeInfo.note });
    }

    const dob =
      parseFlexibleDate(
        salvage?.dob || srcRaw(row, headers, 'Date of Birth'),
      ) ?? '';
    const percentage = salvage?.percentage
      ? normalizePercentage(salvage.percentage)
      : normalizePercentage(srcRaw(row, headers, 'Board Percentage'));
    const pctRaw = srcRaw(row, headers, 'Board Percentage');
    if (typeof pctRaw === 'number' && pctRaw > 0 && pctRaw <= 1) {
      flags.push({
        severity: 'warn',
        reason: `Board percentage ${pctRaw} converted to ${percentage}`,
      });
    }

    const boardName = normalizeBoard(
      salvage?.board ||
        src(row, headers, 'Board Name') ||
        src(row, headers, 'Class XII Board'),
    );
    const state =
      titleCaseWords(salvage?.state || src(row, headers, 'State')) ||
      'Meghalaya';

    const values: Record<string, string> = {
      'Academic Year': '2026-27',
      'Admission Date': '',
      'Admission Status': 'ACTIVE',
      'Admission Number': '',
      'Application Number': applicationNumber,
      'Form Number': '',
      'Registration Number': registration,
      'Roll Number': roll,
      'University Roll Number': '',
      'University Registration Number': '',
      'ABC ID': '',
      Shift: ADMISSION_SHIFT,
      Programme: programme,
      Department: '',
      'Admission Batch': 'BATCH-2026',
      Stream: ADMISSION_STREAM,
      Semester: '1',
      'Full Name': name,
      Gender: gender,
      'Date of Birth': dob,
      'Blood Group': normalizeMappedBloodGroup(
        salvage?.blood || src(row, headers, 'Blood Group'),
      ),
      Category: normalizeCategory(
        salvage?.category || src(row, headers, 'Category'),
      ),
      'Tribe / Race': tribeInfo.tribe,
      Religion: religionInfo.religion,
      Denomination: denomination,
      Nationality: 'Indian',
      'Aadhaar Number':
        salvage?.aadhaar || digitsOnly(src(row, headers, 'Aadhaar Number')),
      'Email Address': email,
      'Student Mobile Number': mobile,
      'WhatsApp Number': '',
      'Photo File Name': '',
      "Father's Name": resolvedFather,
      "Father's Mobile":
        salvage?.fatherMobile ||
        digitsOnly(src(row, headers, 'Father Contact')),
      "Father's Occupation": collapseSpaces(
        src(row, headers, 'Father Occupation'),
      ),
      "Mother's Name": resolvedMother,
      "Mother's Mobile":
        salvage?.motherMobile ||
        digitsOnly(src(row, headers, 'Mother Contact')),
      "Mother's Occupation": collapseSpaces(
        src(row, headers, 'Mother Occupation'),
      ),
      'Guardian Name': collapseSpaces(src(row, headers, 'Local Guardian Name')),
      'Guardian Mobile': digitsOnly(
        src(row, headers, 'Local Guardian Contact'),
      ),
      'Present Address': collapseSpaces(
        salvage?.presentAddress || src(row, headers, 'Address in Tura'),
      ),
      'Present Village / Town': '',
      'Present Police Station': '',
      'Present District': '',
      'Present State': state,
      'Present PIN Code': '',
      'Permanent Address': collapseSpaces(src(row, headers, 'Home Address')),
      'Permanent Village / Town': '',
      'Permanent District': '',
      'Permanent State': state,
      'Permanent PIN Code': '',
      'Institution Last Attended': collapseSpaces(
        src(row, headers, 'Last Institution Attended'),
      ),
      'Board / University': boardName,
      'Registration / Private': normalizeRegistrationType(
        src(row, headers, 'Board Registration Type'),
      ),
      'Year of Passing': collapseSpaces(src(row, headers, 'Board Year')),
      'Total Marks': collapseSpaces(src(row, headers, 'Board Total Marks')),
      Percentage: percentage,
      Division: normalizeDivision(
        salvage?.division || src(row, headers, 'Board Division'),
      ),
      'CUET Marks': '',
      'CUET Roll Number': '',
      'Major Department': major,
      'Minor Department': minor,
      MDC: mdc,
      AEC: aec,
      SEC: sec,
      'Major Department (Sem 3)': '',
      'Second Major Department': '',
      'MDC (Sem 3)': '',
      'AEC (Sem 3)': '',
      'SEC (Sem 3)': '',
      VTC: '',
      'Major Department (Sem 5)': '',
      'Minor Department (Sem 5)': '',
      'Internship Subject': '',
      'RFID Number': '',
      'Library Card Number': '',
      Hostel: 'NO',
      Transport: 'NO',
      'Scholarship Category': '',
      'Student Status': 'STUDYING',
      'Section Code': '',
      'Principal Combination Exception': principalException,
      'Import Review Flag': flags.map((f) => f.reason).join(' | '),
    };

    if (flags.some((f) => f.severity === 'block')) {
      flaggedOnly.push({
        sourceRow: rowNumber,
        name,
        roll: roll || registration,
        flags,
        values,
      });
      continue;
    }

    if (existingStudent) {
      mergeRows.push({ sourceRow: rowNumber, values, flags });
    } else {
      importRows.push({ sourceRow: rowNumber, values, flags });
    }
    if (flags.length) {
      flaggedOnly.push({
        sourceRow: rowNumber,
        name,
        roll: roll || registration,
        flags,
        values,
      });
    }
  }

  const out = new ExcelJS.Workbook();
  const students = out.addWorksheet('Students');
  const studentHeaders = [
    ...FULL_ADMISSION_IMPORT_HEADERS,
    'Principal Combination Exception',
    'Import Review Flag',
  ];
  students.addRow(studentHeaders);
  students.addRow(
    studentHeaders.map((header) => {
      if (header === 'Principal Combination Exception') {
        return 'PRINCIPAL only — named exception, does not change the official combination table';
      }
      if (header === 'Import Review Flag') {
        return 'Office use - extra column, ignored by ERP import';
      }
      return (
        FULL_ADMISSION_IMPORT_HELPERS[header] ??
        'Optional — stored in student profile when supported'
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
    'Minor',
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
      entry.values?.['Minor Department'] ?? '',
      entry.values?.['Email Address'] ?? '',
      entry.flags.map((f) => f.reason).join(' | '),
    ]);
    if (severity === 'BLOCK') {
      added.eachCell((cell) => {
        cell.fill = blockFill;
      });
    } else {
      added.eachCell((cell) => {
        cell.fill = warnFill;
      });
    }
  }
  flagged.columns.forEach((col) => {
    col.width = 28;
  });

  const notes = out.addWorksheet('Import Notes');
  const blocked = flaggedOnly.filter((e) =>
    e.flags.some((f) => f.severity === 'block'),
  );
  const warned = importRows.filter((e) => e.flags.length);
  notes.addRow([
    `Semester 1 ${ADMISSION_STREAM} ${ADMISSION_SHIFT} Shift — mapped ERP import`,
  ]);
  notes.addRow([]);
  notes.addRow(['Source', SOURCE]);
  notes.addRow(['Output', OUTPUT]);
  notes.addRow(['ERP sheet', 'Students (upload this sheet)']);
  notes.addRow(['Header row', '1']);
  notes.addRow(['Helper row', '2 (skipped by ERP)']);
  notes.addRow(['Data starts', 'Row 3']);
  notes.addRow([]);
  notes.addRow(['Students on CREATE import sheet', importRows.length]);
  notes.addRow(['Students on MERGE existing sheet', mergeRows.length]);
  notes.addRow(['Rows with warnings (still importable)', warned.length]);
  notes.addRow(['Rows excluded / blocked', blocked.length]);
  notes.addRow([]);
  notes.addRow(['Constants applied']);
  notes.addRow(['Shift', ADMISSION_SHIFT]);
  notes.addRow(['Stream', ADMISSION_STREAM]);
  notes.addRow(['Semester', '1']);
  notes.addRow(['Admission Batch', 'BATCH-2026']);
  notes.addRow(['Academic Year', '2026-27']);
  notes.addRow(['VAC', 'Auto-assigned Environmental Studies — no VAC column']);
  notes.addRow([]);
  notes.addRow(['Blocked rows (not on Students sheet)']);
  for (const entry of blocked) {
    notes.addRow([
      `Source row ${entry.sourceRow}`,
      entry.name,
      entry.flags.map((f) => f.reason).join(' | '),
    ]);
  }
  notes.columns.forEach((col) => {
    col.width = 42;
  });

  await out.xlsx.writeFile(OUTPUT);

  if (mergeRows.length) {
    const mergeBook = new ExcelJS.Workbook();
    const mergeSheet = mergeBook.addWorksheet('Students');
    mergeSheet.addRow(studentHeaders);
    mergeSheet.addRow(
      studentHeaders.map((header) => {
        if (header === 'Principal Combination Exception') {
          return 'PRINCIPAL only — named exception, does not change the official combination table';
        }
        if (header === 'Import Review Flag') {
          return 'Office use - extra column, ignored by ERP import';
        }
        return (
          FULL_ADMISSION_IMPORT_HELPERS[header] ??
          'Optional — stored in student profile when supported'
        );
      }),
    );
    mergeSheet.getRow(1).font = { bold: true };
    mergeSheet.getRow(2).font = { italic: true, color: { argb: 'FF666666' } };
    mergeSheet.views = [{ state: 'frozen', ySplit: 2 }];
    for (const entry of mergeRows) {
      const added = mergeSheet.addRow(
        studentHeaders.map((header) => entry.values[header] ?? ''),
      );
      added.eachCell((cell) => {
        cell.fill = warnFill;
      });
    }
    mergeSheet.columns.forEach((col) => {
      col.width = 22;
    });
    await mergeBook.xlsx.writeFile(MERGE_OUTPUT);
  }

  const report = [
    `I SEM ${ADMISSION_STREAM} ${ADMISSION_SHIFT} → ERP Full Admission mapping`,
    '='.repeat(60),
    `Source: ${SOURCE}`,
    `Output: ${OUTPUT}`,
    mergeRows.length ? `Merge existing: ${MERGE_OUTPUT}` : '',
    '',
    `CREATE students: ${importRows.length}`,
    `MERGE existing students: ${mergeRows.length}`,
    `Warnings (still on Students sheet): ${warned.length}`,
    `Blocked / excluded: ${blocked.length}`,
    '',
    'MERGE existing',
    ...mergeRows.map(
      (e) =>
        `  Row ${e.sourceRow}  ${e.values['Roll Number'] || '-'}  ${e.values['Full Name']}  ${e.values['Registration Number']}`,
    ),
    'Blocked',
    ...blocked.map(
      (e) =>
        `  Row ${e.sourceRow}  ${e.roll || '-'}  ${e.name}  ${e.flags.map((f) => f.reason).join(' | ')}`,
    ),
    '',
    'Upload Students sheet via Student Import (Full Admission / Sem 1).',
    'Correct blocked rows, then re-import them separately.',
  ];
  const fs = await import('fs');
  fs.writeFileSync(REPORT, report.join('\n'), 'utf8');
  console.log(report.join('\n'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
