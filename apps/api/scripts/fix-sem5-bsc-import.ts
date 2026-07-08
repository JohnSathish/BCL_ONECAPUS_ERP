/**
 * Fix B.Sc Sem 5 bulk import Excel and optionally validate against ERP.
 *
 *   npx ts-node --transpile-only scripts/fix-sem5-bsc-import.ts
 *   npx ts-node --transpile-only scripts/fix-sem5-bsc-import.ts --validate
 */
import * as fs from 'fs';
import * as path from 'path';
import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { StudentImportService } from '../src/modules/students/import/student-import.service';
import { Sem5ImportCurriculumService } from '../src/modules/students/import/sem5-import-curriculum.service';
import { parseFlexibleDate } from '../src/common/utils/parse-flexible-date';
import 'dotenv/config';

const SOURCE =
  process.argv.find((arg) => arg.endsWith('.xlsx')) ??
  path.join(
    process.env.USERPROFILE ?? '',
    'OneDrive',
    'Desktop',
    'Import Live 1-3-5',
    'V SEM',
    'B.Sc 5 Semester Students Bulk import.xlsx',
  );
const OUTPUT = SOURCE.replace(/\.xlsx$/i, ' - READY TO IMPORT.xlsx');
const REPORT = SOURCE.replace(/\.xlsx$/i, ' - FIX REPORT.txt');
const validate = process.argv.includes('--validate');

const VALID_BSC_PROGRAMMES = new Set([
  'BSC-MTH',
  'BSC-ZOO',
  'BSC-CHE',
  'BSC-BOT',
  'BSC-PHY',
]);

const EXPECTED_MAJOR_BY_PROGRAMME: Record<string, string> = {
  'BSC-MTH': 'Mathematics',
  'BSC-ZOO': 'Zoology',
  'BSC-CHE': 'Chemistry',
  'BSC-BOT': 'Botany',
  'BSC-PHY': 'Physics',
};

type IdMaps = {
  dbRegs: Set<string>;
  dbRolls: Set<string>;
  dbEmails: Set<string>;
  dbAdmissions: Set<string>;
  dbApplications: Set<string>;
  dbUniRolls: Set<string>;
  dbUniRegs: Set<string>;
  dbAadhaars: Set<string>;
  dbMobiles: Set<string>;
};

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if ('result' in value && value.result != null)
      return cellText(value.result);
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

function normalizeDate(value: ExcelJS.CellValue): string {
  if (value instanceof Date) return parseFlexibleDate(value) ?? '';
  const raw = cellText(value);
  if (!raw) return '';
  const repaired = repairDobText(raw);
  const parsed = parseFlexibleDate(repaired);
  return parsed ?? '';
}

function upper(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickFirst(...values: string[]): string {
  for (const value of values) {
    const text = value.trim();
    if (text) return text;
  }
  return '';
}

function toEmailBase(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function uniqueBySuffix(
  seed: string,
  used: Set<string>,
  normalize: (v: string) => string,
): string {
  const base = seed.trim();
  let next = base;
  let counter = 1;
  while (!next || used.has(normalize(next))) {
    counter += 1;
    next = `${base}-${counter}`;
  }
  return next;
}

function repairDobText(raw: string): string {
  const text = raw.trim();
  if (!text) return text;
  const usDotted = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (usDotted) {
    const [, month, day, year] = usDotted;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  const dotted = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dotted) {
    let [, day, month, year] = dotted;
    let mm = Number(month);
    if (mm > 12 && mm - 10 >= 1 && mm - 10 <= 12) {
      mm -= 10;
      month = String(mm).padStart(2, '0');
    }
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  const justDigits = text.replace(/\D/g, '');
  if (justDigits.length === 8) {
    const day = justDigits.slice(0, 2);
    const month = justDigits.slice(2, 4);
    const year = justDigits.slice(4, 8);
    const mm = Number(month);
    const dd = Number(day);
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return `${year}-${month}-${day}`;
    }
  }
  if (justDigits.length === 7) {
    const firstTwo = Number(justDigits.slice(0, 2));
    const day = firstTwo > 31 ? justDigits.slice(0, 1) : justDigits.slice(0, 2);
    const month =
      firstTwo > 31 ? justDigits.slice(1, 3) : justDigits.slice(2, 4);
    const year =
      firstTwo > 31 ? justDigits.slice(3, 7) : `20${justDigits.slice(4)}`;
    return `${year}-${month}-${day}`;
  }
  return text;
}

function headerMap(sheet: ExcelJS.Worksheet): Map<string, number> {
  const map = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, col) => {
    const text = cellText(cell.value);
    if (text) map.set(text, col);
  });
  return map;
}

async function loadDbIdentifiers(prisma: PrismaClient): Promise<IdMaps> {
  const tenant =
    (await prisma.tenant.findFirst({ where: { slug: 'demo' } })) ??
    (await prisma.tenant.findFirst({
      where: { name: { contains: 'Don Bosco' } },
    }));
  if (!tenant) {
    throw new Error(
      'Tenant not found (expected slug "demo" or Don Bosco tenant).',
    );
  }

  const students = await prisma.student.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
    select: {
      enrollmentNumber: true,
      rollNumber: true,
      admissionNumber: true,
      applicationNumber: true,
      universityRollNumber: true,
      universityRegistrationNumber: true,
      user: { select: { email: true } },
    },
  });

  const dbRegs = new Set<string>();
  const dbRolls = new Set<string>();
  const dbEmails = new Set<string>();
  const dbAdmissions = new Set<string>();
  const dbApplications = new Set<string>();
  const dbUniRolls = new Set<string>();
  const dbUniRegs = new Set<string>();
  const dbAadhaars = new Set<string>();
  const dbMobiles = new Set<string>();

  for (const student of students) {
    if (student.enrollmentNumber) dbRegs.add(upper(student.enrollmentNumber));
    if (student.rollNumber) dbRolls.add(upper(student.rollNumber));
    if (student.admissionNumber)
      dbAdmissions.add(upper(student.admissionNumber));
    if (student.applicationNumber)
      dbApplications.add(upper(student.applicationNumber));
    if (student.universityRollNumber)
      dbUniRolls.add(upper(student.universityRollNumber));
    if (student.universityRegistrationNumber)
      dbUniRegs.add(upper(student.universityRegistrationNumber));
    if (student.user?.email)
      dbEmails.add(student.user.email.trim().toLowerCase());
  }

  const profiles = await prisma.studentProfile.findMany({
    where: { tenantId: tenant.id },
    select: { nationalId: true, mobileNumber: true },
  });
  for (const profile of profiles) {
    if (profile.nationalId) dbAadhaars.add(upper(profile.nationalId));
    if (profile.mobileNumber) dbMobiles.add(upper(profile.mobileNumber));
  }

  return {
    dbRegs,
    dbRolls,
    dbEmails,
    dbAdmissions,
    dbApplications,
    dbUniRolls,
    dbUniRegs,
    dbAadhaars,
    dbMobiles,
  };
}

async function loadValidTribeLabels(
  prisma: PrismaClient,
): Promise<Set<string>> {
  const tenant =
    (await prisma.tenant.findFirst({ where: { slug: 'demo' } })) ??
    (await prisma.tenant.findFirst({
      where: { name: { contains: 'Don Bosco' } },
    }));
  if (!tenant) return new Set();
  const tribes = await prisma.masterLookup.findMany({
    where: { tenantId: tenant.id, lookupType: 'TRIBE', isActive: true },
    select: { label: true, code: true },
  });
  const labels = new Set<string>();
  for (const tribe of tribes) {
    labels.add(normalizeLabel(tribe.label));
    labels.add(normalizeLabel(tribe.code));
  }
  return labels;
}

async function loadSem5MinorByMajor(prisma: PrismaClient) {
  const tenant =
    (await prisma.tenant.findFirst({ where: { slug: 'demo' } })) ??
    (await prisma.tenant.findFirst({
      where: { name: { contains: 'Don Bosco' } },
    }));
  if (!tenant) {
    throw new Error('Tenant not found for Sem 5 minor mapping.');
  }
  const dayShift = await prisma.shift.findFirst({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      code: { equals: 'DAY', mode: 'insensitive' },
      status: 'ACTIVE',
    },
    select: { id: true },
  });
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const sem5Curriculum = app.get(Sem5ImportCurriculumService);
    return await sem5Curriculum.buildTenantMinorByMajor(
      tenant.id,
      dayShift?.id,
    );
  } finally {
    await app.close();
  }
}

function isTemplateSampleRow(input: {
  fullName: string;
  roll: string;
  programme: string;
  reg: string;
  email: string;
}): boolean {
  if (input.reg.toUpperCase() === 'REG2026001') return true;
  if (input.email.toLowerCase() === 'student@example.edu') return true;
  if (input.fullName.toLowerCase().startsWith('e.g.')) return true;
  if (!input.fullName && !input.roll && !input.programme) return true;
  return false;
}

async function main() {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`Source file not found: ${SOURCE}`);
  }

  const prisma = new PrismaClient();
  const db = await loadDbIdentifiers(prisma);
  const validTribes = await loadValidTribeLabels(prisma);
  const sem5MinorByMajor = await loadSem5MinorByMajor(prisma);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(SOURCE);
  const sheet = workbook.getWorksheet('Students') ?? workbook.worksheets[0];
  if (!sheet) throw new Error('Students sheet not found');
  const headers = headerMap(sheet);

  const requiredHeaders = [
    'Registration Number',
    'Roll Number',
    'Full Name',
    'Email Address',
    'Date of Birth',
    'Programme',
    'Shift',
    'Major Department (Sem 5)',
    'Minor Department (Sem 5)',
    'Internship Subject',
  ];
  for (const name of requiredHeaders) {
    if (!headers.has(name)) throw new Error(`Missing required header: ${name}`);
  }

  const fileRegs = new Set<string>();
  const fileRolls = new Set<string>();
  const fileEmails = new Set<string>();
  const fileAdmissions = new Set<string>();
  const fileApplications = new Set<string>();
  const fileUniRolls = new Set<string>();
  const fileUniRegs = new Set<string>();
  const fileAadhaars = new Set<string>();
  const fileMobiles = new Set<string>();
  const knownInternshipByMajor = new Map<string, string>();

  const sem5MajorCol = headers.get('Major Department (Sem 5)')!;
  const sem5MinorCol = headers.get('Minor Department (Sem 5)')!;
  const sem5InternshipCol = headers.get('Internship Subject')!;
  for (let rowNumber = 3; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const major = cellText(row.getCell(sem5MajorCol).value);
    const internship = cellText(row.getCell(sem5InternshipCol).value);
    if (major && internship) {
      knownInternshipByMajor.set(normalizeLabel(major), internship);
    }
  }

  const notes: string[] = [];
  const rowsToDelete: number[] = [];
  let processed = 0;
  let fixedDob = 0;
  let fixedAdmissionDate = 0;
  let generatedEmail = 0;
  let registrationChanged = 0;
  let rollChanged = 0;
  let optionalCleared = 0;
  let sem5MinorFixed = 0;
  let departmentCleared = 0;
  let fatherMotherFilled = 0;
  let aadhaarCleared = 0;
  let mobileCleared = 0;
  let religionNormalized = 0;
  let internshipFilled = 0;
  let programmeFixed = 0;
  let shiftFixed = 0;
  let semesterFixed = 0;
  let streamFixed = 0;
  let majorFixed = 0;
  let templateRowsRemoved = 0;
  let tribeCleared = 0;

  for (let rowNumber = 3; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);

    const fullName = cellText(row.getCell(headers.get('Full Name')!).value);
    const rollRaw = cellText(row.getCell(headers.get('Roll Number')!).value);
    const regRaw = cellText(
      row.getCell(headers.get('Registration Number')!).value,
    );
    const admissionRaw = headers.get('Admission Number')
      ? cellText(row.getCell(headers.get('Admission Number')!).value)
      : '';
    const applicationRaw = headers.get('Application Number')
      ? cellText(row.getCell(headers.get('Application Number')!).value)
      : '';
    const programmeRaw = cellText(row.getCell(headers.get('Programme')!).value);
    const emailRaw = cellText(row.getCell(headers.get('Email Address')!).value);
    if (!fullName && !rollRaw && !regRaw && !admissionRaw && !applicationRaw)
      continue;

    if (
      isTemplateSampleRow({
        fullName,
        roll: rollRaw,
        programme: programmeRaw,
        reg: regRaw,
        email: emailRaw,
      })
    ) {
      rowsToDelete.push(rowNumber);
      templateRowsRemoved += 1;
      notes.push(
        `Row ${rowNumber}: removed template/sample row (${fullName || 'blank'})`,
      );
      continue;
    }

    processed += 1;

    const programmeCol = headers.get('Programme')!;
    const programme = upper(programmeRaw);
    if (!VALID_BSC_PROGRAMMES.has(programme)) {
      throw new Error(
        `Row ${rowNumber}: unsupported programme "${programmeRaw}". Expected one of ${[...VALID_BSC_PROGRAMMES].join(', ')}`,
      );
    }
    if (programme !== programmeRaw) {
      row.getCell(programmeCol).value = programme;
      programmeFixed += 1;
    }

    const shiftCol = headers.get('Shift')!;
    const shiftRaw = cellText(row.getCell(shiftCol).value);
    if (upper(shiftRaw) !== 'DAY') {
      row.getCell(shiftCol).value = 'DAY';
      shiftFixed += 1;
    }

    const semesterCol = headers.get('Semester');
    if (semesterCol && cellText(row.getCell(semesterCol).value) !== '5') {
      row.getCell(semesterCol).value = '5';
      semesterFixed += 1;
    }

    const streamCol = headers.get('Stream');
    if (
      streamCol &&
      upper(cellText(row.getCell(streamCol).value)) !== 'SCIENCE'
    ) {
      row.getCell(streamCol).value = 'SCIENCE';
      streamFixed += 1;
    }

    const departmentCol = headers.get('Department');
    if (departmentCol && cellText(row.getCell(departmentCol).value)) {
      row.getCell(departmentCol).value = '';
      departmentCleared += 1;
    }

    const expectedMajor = EXPECTED_MAJOR_BY_PROGRAMME[programme];
    const majorRaw = cellText(row.getCell(sem5MajorCol).value);
    if (expectedMajor && majorRaw !== expectedMajor) {
      row.getCell(sem5MajorCol).value = expectedMajor;
      notes.push(
        `Row ${rowNumber}: major "${majorRaw}" corrected to "${expectedMajor}" for ${programme}`,
      );
      majorFixed += 1;
    }

    const dobCol = headers.get('Date of Birth')!;
    const dobBefore = cellText(row.getCell(dobCol).value);
    const dobNormalized = normalizeDate(row.getCell(dobCol).value);
    if (dobNormalized && dobNormalized !== dobBefore) {
      row.getCell(dobCol).value = dobNormalized;
      fixedDob += 1;
    }

    const admissionDateCol = headers.get('Admission Date');
    if (admissionDateCol) {
      const admissionDateBefore = cellText(row.getCell(admissionDateCol).value);
      const admissionDateNormalized = normalizeDate(
        row.getCell(admissionDateCol).value,
      );
      if (
        admissionDateNormalized &&
        admissionDateNormalized !== admissionDateBefore
      ) {
        row.getCell(admissionDateCol).value = admissionDateNormalized;
        fixedAdmissionDate += 1;
      }
    }

    let registration = pickFirst(regRaw, rollRaw, admissionRaw, applicationRaw);
    if (!registration) {
      registration = `TMP-BSC5-${String(rowNumber).padStart(4, '0')}`;
      notes.push(
        `Row ${rowNumber}: created temporary registration ${registration}`,
      );
    }
    const regKey = upper(registration);
    if (db.dbRegs.has(regKey) || fileRegs.has(regKey)) {
      const old = registration;
      registration = uniqueBySuffix(
        registration,
        new Set([...db.dbRegs, ...fileRegs]),
        upper,
      );
      registrationChanged += 1;
      notes.push(
        `Row ${rowNumber}: registration "${old}" already exists, changed to "${registration}"`,
      );
    }
    row.getCell(headers.get('Registration Number')!).value = registration;
    fileRegs.add(upper(registration));

    let roll = rollRaw.trim();
    if (roll) {
      const rollKey = upper(roll);
      if (db.dbRolls.has(rollKey) || fileRolls.has(rollKey)) {
        const old = roll;
        roll = uniqueBySuffix(
          roll,
          new Set([...db.dbRolls, ...fileRolls]),
          upper,
        );
        rollChanged += 1;
        notes.push(
          `Row ${rowNumber}: roll "${old}" existed, changed to "${roll}"`,
        );
      }
      row.getCell(headers.get('Roll Number')!).value = roll;
      fileRolls.add(upper(roll));
    }

    const emailCol = headers.get('Email Address')!;
    let email = cellText(row.getCell(emailCol).value).toLowerCase();
    if (!email || !email.includes('@')) {
      const seed = toEmailBase(
        pickFirst(roll, registration, `bsc5${rowNumber}`),
      );
      let candidate = `${seed || `bsc5${rowNumber}`}@student.donboscocollege.ac.in`;
      let index = 1;
      while (db.dbEmails.has(candidate) || fileEmails.has(candidate)) {
        index += 1;
        candidate = `${seed || `bsc5${rowNumber}`}${index}@student.donboscocollege.ac.in`;
      }
      email = candidate;
      generatedEmail += 1;
      notes.push(`Row ${rowNumber}: generated dummy email "${email}"`);
    } else if (db.dbEmails.has(email) || fileEmails.has(email)) {
      const prefix = toEmailBase(
        email.split('@')[0] || pickFirst(roll, registration),
      );
      let candidate = `${prefix || `bsc5${rowNumber}`}@student.donboscocollege.ac.in`;
      let index = 1;
      while (db.dbEmails.has(candidate) || fileEmails.has(candidate)) {
        index += 1;
        candidate = `${prefix || `bsc5${rowNumber}`}${index}@student.donboscocollege.ac.in`;
      }
      notes.push(
        `Row ${rowNumber}: duplicate email "${email}" changed to "${candidate}"`,
      );
      email = candidate;
      generatedEmail += 1;
    }
    row.getCell(emailCol).value = email;
    fileEmails.add(email);

    const uniqueOptional = [
      ['Admission Number', db.dbAdmissions, fileAdmissions],
      ['Application Number', db.dbApplications, fileApplications],
      ['University Roll Number', db.dbUniRolls, fileUniRolls],
      ['University Registration Number', db.dbUniRegs, fileUniRegs],
    ] as const;
    for (const [header, dbSet, fileSet] of uniqueOptional) {
      const col = headers.get(header);
      if (!col) continue;
      const current = cellText(row.getCell(col).value);
      if (!current) continue;
      const key = upper(current);
      if (dbSet.has(key) || fileSet.has(key)) {
        row.getCell(col).value = '';
        optionalCleared += 1;
        notes.push(
          `Row ${rowNumber}: cleared duplicate ${header} "${current}"`,
        );
      } else {
        fileSet.add(key);
      }
    }

    const major = cellText(row.getCell(sem5MajorCol).value);
    let minor = cellText(row.getCell(sem5MinorCol).value);
    const allowed = sem5MinorByMajor[normalizeLabel(major)] ?? [];
    const minorAllowed =
      !minor ||
      allowed.some((item) => normalizeLabel(item) === normalizeLabel(minor));
    if (major && allowed.length && !minorAllowed) {
      const replacement =
        allowed.find((item) => normalizeLabel(item) === 'physics') ??
        allowed.find((item) => normalizeLabel(item) === 'mathematics') ??
        allowed[0];
      notes.push(
        `Row ${rowNumber}: invalid minor "${minor || '(blank)'}" for major "${major}", changed to "${replacement}"`,
      );
      row.getCell(sem5MinorCol).value = replacement;
      sem5MinorFixed += 1;
    } else if (major && !minor && allowed.length) {
      row.getCell(sem5MinorCol).value = allowed[0];
      sem5MinorFixed += 1;
      notes.push(
        `Row ${rowNumber}: filled Minor Department (Sem 5) as "${allowed[0]}" for major "${major}"`,
      );
    }

    const tribeCol = headers.get('Tribe / Race');
    if (tribeCol) {
      const tribe = cellText(row.getCell(tribeCol).value);
      const tribeUpper = tribe.toUpperCase();
      if (
        tribeUpper === 'TRIBE' ||
        tribeUpper === 'RABHA' ||
        tribeUpper === 'GHOSH' ||
        tribeUpper === 'SHIL'
      ) {
        row.getCell(tribeCol).value = '';
        tribeCleared += 1;
      } else if (tribe && !validTribes.has(normalizeLabel(tribe))) {
        row.getCell(tribeCol).value = '';
        tribeCleared += 1;
        notes.push(`Row ${rowNumber}: cleared unknown tribe "${tribe}"`);
      }
    }

    const categoryCol = headers.get('Category');
    if (categoryCol) {
      const category = cellText(row.getCell(categoryCol).value);
      if (/\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/.test(category)) {
        row.getCell(categoryCol).value = 'GENERAL';
      }
    }

    const denominationCol = headers.get('Denomination');
    const genderCol = headers.get('Gender');
    if (denominationCol && genderCol) {
      const denomination = cellText(row.getCell(denominationCol).value);
      const dUpper = denomination.toUpperCase();
      if (dUpper === 'MALE' || dUpper === 'FEMALE' || dUpper === 'OTHER') {
        row.getCell(genderCol).value =
          dUpper === 'MALE' ? 'Male' : dUpper === 'FEMALE' ? 'Female' : 'Other';
        row.getCell(denominationCol).value = '';
      }
    }

    const religionCol = headers.get('Religion');
    if (religionCol && denominationCol) {
      const denomination = cellText(row.getCell(denominationCol).value);
      const denomUpper = denomination.toUpperCase();
      if (denomUpper === 'ISLAM' || denomUpper === 'MUSLIM') {
        row.getCell(denominationCol).value = '';
        if (!cellText(row.getCell(religionCol).value)) {
          row.getCell(religionCol).value = 'Muslim';
        }
        religionNormalized += 1;
        notes.push(
          `Row ${rowNumber}: mapped denomination "${denomination}" to Religion Muslim`,
        );
      }
      const religion = cellText(row.getCell(religionCol).value).toUpperCase();
      if (religion === 'BAPTIST' || religion === 'CATHOLIC') {
        row.getCell(religionCol).value = 'Christian';
        if (!cellText(row.getCell(denominationCol).value)) {
          row.getCell(denominationCol).value =
            religion === 'BAPTIST' ? 'Baptist' : 'Catholic';
        }
        religionNormalized += 1;
      }
    }

    const fatherCol = headers.get("Father's Name");
    const motherCol = headers.get("Mother's Name");
    const guardianCol = headers.get('Guardian Name');
    const guardian = guardianCol
      ? cellText(row.getCell(guardianCol).value)
      : '';
    if (fatherCol && !cellText(row.getCell(fatherCol).value)) {
      row.getCell(fatherCol).value = guardian || 'Not Provided';
      fatherMotherFilled += 1;
    }
    if (motherCol && !cellText(row.getCell(motherCol).value)) {
      row.getCell(motherCol).value = guardian || 'Not Provided';
      fatherMotherFilled += 1;
    }

    const aadhaarCol = headers.get('Aadhaar Number');
    if (aadhaarCol) {
      const aadhaar = cellText(row.getCell(aadhaarCol).value);
      if (aadhaar) {
        const key = upper(aadhaar);
        if (db.dbAadhaars.has(key) || fileAadhaars.has(key)) {
          row.getCell(aadhaarCol).value = '';
          aadhaarCleared += 1;
        } else {
          fileAadhaars.add(key);
        }
      }
    }

    const mobileCol = headers.get('Student Mobile Number');
    if (mobileCol) {
      const mobile = cellText(row.getCell(mobileCol).value);
      if (mobile) {
        const key = upper(mobile);
        if (db.dbMobiles.has(key) || fileMobiles.has(key)) {
          row.getCell(mobileCol).value = '';
          mobileCleared += 1;
        } else {
          fileMobiles.add(key);
        }
      }
    }

    if (!cellText(row.getCell(sem5InternshipCol).value) && major) {
      const fallback = knownInternshipByMajor.get(normalizeLabel(major));
      if (fallback) {
        row.getCell(sem5InternshipCol).value = fallback;
        internshipFilled += 1;
      }
    }
  }

  for (const rowNumber of rowsToDelete.sort((a, b) => b - a)) {
    sheet.spliceRows(rowNumber, 1);
  }

  await workbook.xlsx.writeFile(OUTPUT);
  const report = [
    'B.Sc Sem 5 Day Shift Import Fix Report',
    '='.repeat(60),
    `Source: ${SOURCE}`,
    `Output: ${OUTPUT}`,
    '',
    `Rows processed: ${processed}`,
    `Template/sample rows removed: ${templateRowsRemoved}`,
    `Programme normalized: ${programmeFixed}`,
    `Shift set to DAY: ${shiftFixed}`,
    `Semester set to 5: ${semesterFixed}`,
    `Stream set to SCIENCE: ${streamFixed}`,
    `Major corrected from programme: ${majorFixed}`,
    `DOB normalized: ${fixedDob}`,
    `Admission Date normalized: ${fixedAdmissionDate}`,
    `Dummy/updated email count: ${generatedEmail}`,
    `Registration changed due to duplicates: ${registrationChanged}`,
    `Roll changed due to duplicates: ${rollChanged}`,
    `Optional duplicate IDs cleared: ${optionalCleared}`,
    `Sem 5 minor filled/fixed from curriculum: ${sem5MinorFixed}`,
    `Department code cleared: ${departmentCleared}`,
    `Father/Mother defaults filled: ${fatherMotherFilled}`,
    `Duplicate Aadhaar cleared: ${aadhaarCleared}`,
    `Duplicate mobile cleared: ${mobileCleared}`,
    `Religion normalized (Baptist/Catholic): ${religionNormalized}`,
    `Unknown tribe cleared: ${tribeCleared}`,
    `Missing internship filled from major map: ${internshipFilled}`,
    '',
    notes.length ? 'Detailed changes:' : 'No additional row-level notes.',
    ...notes.map((n) => `- ${n}`),
  ];
  fs.writeFileSync(REPORT, report.join('\n'), 'utf8');
  console.log(report.slice(0, 28).join('\n'));
  console.log(`\nSaved file: ${OUTPUT}`);
  console.log(`Saved report: ${REPORT}`);

  if (validate) {
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error', 'warn'],
    });
    try {
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
        { importMode: 'MERGE' },
      );
      console.log('\n=== ERP Validation (MERGE) ===');
      console.log(
        `Total: ${preview.summary.total}, Valid: ${preview.summary.valid}, Invalid: ${preview.summary.invalid}`,
      );
      const invalid = preview.rows.filter((r) => r.status !== 'VALID');
      for (const row of invalid.slice(0, 30)) {
        console.log(`Row ${row.rowNumber}: ${row.errors.join('; ')}`);
      }
      if (invalid.length > 30) {
        console.log(`... and ${invalid.length - 30} more invalid rows`);
      }
    } finally {
      await app.close();
    }
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
