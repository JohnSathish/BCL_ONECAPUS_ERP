/**
 * Import St. Luke's register Excel into school SIS (Student + Enrollment).
 *
 *   npx tsx scripts/import-st-lukes-students.ts
 *   npx tsx scripts/import-st-lukes-students.ts --apply
 *
 * Does not touch college FYUP Student tables or TPS KG admissions.
 */
import ExcelJS from 'exceljs';
import { Prisma, PrismaClient } from '@prisma/client';
import { SCHOOL_ADMISSION_NUMBER_PREFIX } from '../src/modules/school-sis/school-sis.constants';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

const XI_PATH = String.raw`C:\Users\johnm\OneDrive\Desktop\ST.LUCK SCHOOL TURA\Students data\Class XI Students Details.xlsx`;
const NURSERY_PATH = String.raw`C:\Users\johnm\OneDrive\Desktop\ST.LUCK SCHOOL TURA\Students data\NURSERY to Class X Stundets details.xlsx`;

const GRADE_DEFS: { code: string; name: string; sortOrder: number }[] = [
  { code: 'NURSERY', name: 'Nursery', sortOrder: 0 },
  { code: 'UKG', name: 'UKG', sortOrder: 1 },
  { code: 'I', name: 'Class I', sortOrder: 2 },
  { code: 'II', name: 'Class II', sortOrder: 3 },
  { code: 'III', name: 'Class III', sortOrder: 4 },
  { code: 'IV', name: 'Class IV', sortOrder: 5 },
  { code: 'V', name: 'Class V', sortOrder: 6 },
  { code: 'VI', name: 'Class VI', sortOrder: 7 },
  { code: 'VII', name: 'Class VII', sortOrder: 8 },
  { code: 'VIII', name: 'Class VIII', sortOrder: 9 },
  { code: 'IX', name: 'Class IX', sortOrder: 10 },
  { code: 'X', name: 'Class X', sortOrder: 11 },
  { code: 'XI', name: 'Class XI', sortOrder: 12 },
];

type ParsedRow = {
  source: string;
  excelRow: number;
  fullName: string;
  fatherName: string;
  dob: Date | null;
  phone: string | null;
  house: string | null;
  addressLine: string;
  postOffice: string;
  district: string;
  gradeCode: string;
  sectionName: string;
  notes: string[];
};

function cell(v: unknown): string {
  if (v == null || v === '') return '';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object' && v && 'richText' in v) {
    return ((v as { richText: Array<{ text: string }> }).richText ?? [])
      .map((p) => p.text)
      .join('');
  }
  if (typeof v === 'object' && v && 'text' in v)
    return String((v as { text: string }).text ?? '');
  if (typeof v === 'object' && v && 'result' in v)
    return cell((v as { result: unknown }).result);
  if (typeof v === 'number' && Number.isFinite(v)) {
    if (v > 1e11) return String(Math.trunc(v));
    if (v > 1e9) return String(Math.trunc(v));
    return String(v);
  }
  return String(v).trim();
}

function collapse(s: string) {
  return s.replace(/\s+/g, ' ').trim();
}

function normalizeName(s: string) {
  return collapse(s).toUpperCase();
}

function parseDob(raw: unknown): Date | null {
  if (raw == null || raw === '') return null;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return new Date(
      Date.UTC(raw.getUTCFullYear(), raw.getUTCMonth(), raw.getUTCDate()),
    );
  }
  const text = cell(raw);
  if (!text) return null;
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return new Date(
      Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])),
    );
  }
  const dmy = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    return new Date(
      Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])),
    );
  }
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return new Date(
      Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()),
    );
  }
  return null;
}

function parsePhone(raw: unknown): string | null {
  const digits = cell(raw).replace(/\D/g, '');
  if (digits.length < 8) return null;
  return digits;
}

function normalizeHouse(raw: string): string | null {
  const t = collapse(raw).toUpperCase().replace(/`/g, '').replace(/\s+/g, '');
  if (!t) return null;
  if (t === 'RED' || t === 'R ED') return 'RED';
  if (t === 'BLUE') return 'BLUE';
  if (t === 'GREEN') return 'GREEN';
  if (t === 'YELLOW') return 'YELLOW';
  return collapse(raw).toUpperCase() || null;
}

function mapClass(
  raw: string,
  notes: string[],
): { gradeCode: string; sectionName: string } | null {
  const t = collapse(raw).toUpperCase().replace(/\s+/g, ' ');
  if (!t) return null;
  const xi = t.replace(/\s+/g, '').replace(/-/g, '');
  if (xi.startsWith('XI') && xi.includes('ART'))
    return { gradeCode: 'XI', sectionName: 'ARTS' };
  if (xi.startsWith('XI') && xi.includes('SCI'))
    return { gradeCode: 'XI', sectionName: 'SCIENCE' };
  if (xi.startsWith('XI') && (xi.includes('COM') || xi.includes('COMM'))) {
    return { gradeCode: 'XI', sectionName: 'COMMERCE' };
  }
  if (t === 'NURSERY' || t === 'NUR')
    return { gradeCode: 'NURSERY', sectionName: 'A' };
  if (t === 'LKG') return { gradeCode: 'LKG', sectionName: 'A' };
  if (t === 'UKG') return { gradeCode: 'UKG', sectionName: 'A' };
  const roman = t.replace(/^CLASS\s+/, '');
  const known = GRADE_DEFS.find((g) => g.code === roman);
  if (known) return { gradeCode: known.code, sectionName: 'A' };
  notes.push(`Unmapped class "${raw}"`);
  return null;
}

function fingerprint(row: ParsedRow) {
  const dob = row.dob ? row.dob.toISOString().slice(0, 10) : '';
  return `${normalizeName(row.fullName)}|${normalizeName(row.fatherName)}|${dob}|${row.gradeCode}`;
}

async function readSheet(
  path: string,
  kind: 'xi' | 'junior',
): Promise<ParsedRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const ws = wb.worksheets[0];
  const rows: ParsedRow[] = [];
  ws.eachRow({ includeEmpty: false }, (excelRow, n) => {
    if (n === 1) return;
    const vals = (excelRow.values as unknown[]).slice(1);
    const notes: string[] = [];
    let fullName = '';
    let fatherName = '';
    let dob: Date | null = null;
    let phone: string | null = null;
    let house: string | null = null;
    let addressLine = '';
    let postOffice = '';
    let district = '';
    let mapped: { gradeCode: string; sectionName: string } | null = null;

    if (kind === 'xi') {
      fullName = collapse(cell(vals[0]));
      fatherName = collapse(cell(vals[1]));
      dob = parseDob(vals[2]);
      phone = parsePhone(vals[3]);
      addressLine = collapse(cell(vals[4]));
      postOffice = collapse(cell(vals[5]));
      district = collapse(cell(vals[6]));
      mapped = mapClass(cell(vals[7]), notes);
    } else {
      fullName = collapse(cell(vals[0]));
      fatherName = collapse(cell(vals[1]));
      mapped = mapClass(cell(vals[2]), notes);
      dob = parseDob(vals[3]);
      phone = parsePhone(vals[4]);
      house = normalizeHouse(cell(vals[5]));
      addressLine = collapse(cell(vals[6]));
      postOffice = collapse(cell(vals[7]));
      district = collapse(cell(vals[8]));
    }

    if (!fullName) {
      notes.push('Skipped: no name');
      return;
    }
    if (!mapped) {
      mapped = { gradeCode: 'I', sectionName: 'A' };
      notes.push(
        'Class missing in register — placed in Class I A pending office confirmation',
      );
    }

    rows.push({
      source: kind,
      excelRow: n,
      fullName,
      fatherName,
      dob,
      phone,
      house,
      addressLine,
      postOffice,
      district,
      gradeCode: mapped.gradeCode,
      sectionName: mapped.sectionName,
      notes,
    });
  });
  return rows;
}

async function nextAdmission(
  tx: Prisma.TransactionClient,
  tenantId: string,
  academicYearId: string,
  yearCode: string,
) {
  const row = await tx.schoolIdSequence.upsert({
    where: {
      tenantId_academicYearId_kind: {
        tenantId,
        academicYearId,
        kind: 'ADMISSION',
      },
    },
    update: { lastValue: { increment: 1 } },
    create: { tenantId, academicYearId, kind: 'ADMISSION', lastValue: 1 },
  });
  return `${SCHOOL_ADMISSION_NUMBER_PREFIX}/${yearCode}/${String(row.lastValue).padStart(4, '0')}`;
}

async function main() {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: 'st-lukes-tura' },
  });
  if (!tenant) throw new Error('st-lukes-tura tenant not found');
  const year = await prisma.schoolAcademicYear.findFirst({
    where: { tenantId: tenant.id, deletedAt: null, status: 'CURRENT' },
    orderBy: { startDate: 'desc' },
  });
  if (!year) throw new Error('No CURRENT academic year for St. Luke’s');

  const gradeIds = new Map<string, string>();
  for (const g of GRADE_DEFS) {
    const row = await prisma.schoolGrade.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: g.code } },
      update: {
        name: g.name,
        sortOrder: g.sortOrder,
        active: true,
        deletedAt: null,
      },
      create: {
        tenantId: tenant.id,
        code: g.code,
        name: g.name,
        sortOrder: g.sortOrder,
      },
    });
    gradeIds.set(g.code, row.id);
  }

  const junior = await readSheet(NURSERY_PATH, 'junior');
  const xi = await readSheet(XI_PATH, 'xi');
  const all = [...junior, ...xi];

  const unique = new Map<string, ParsedRow>();
  const duplicates: ParsedRow[] = [];
  for (const row of all) {
    const key = fingerprint(row);
    if (unique.has(key)) duplicates.push(row);
    else unique.set(key, row);
  }
  const incoming = [...unique.values()];

  incoming.sort((a, b) => {
    const ga = GRADE_DEFS.find((g) => g.code === a.gradeCode)?.sortOrder ?? 99;
    const gb = GRADE_DEFS.find((g) => g.code === b.gradeCode)?.sortOrder ?? 99;
    if (ga !== gb) return ga - gb;
    if (a.sectionName !== b.sectionName)
      return a.sectionName.localeCompare(b.sectionName);
    return a.fullName.localeCompare(b.fullName, 'en', { sensitivity: 'base' });
  });

  const grouped = new Map<string, ParsedRow[]>();
  for (const row of incoming) {
    const key = `${row.gradeCode}::${row.sectionName}`;
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }

  const sectionByKey = new Map<string, string>();
  for (const [key, list] of grouped) {
    const [gradeCode, sectionName] = key.split('::');
    const gradeId = gradeIds.get(gradeCode!);
    if (!gradeId) throw new Error(`Missing grade ${gradeCode}`);
    const capacity = Math.max(40, list.length + 5);
    const section = await prisma.schoolSection.upsert({
      where: {
        tenantId_academicYearId_gradeId_name: {
          tenantId: tenant.id,
          academicYearId: year.id,
          gradeId,
          name: sectionName!,
        },
      },
      update: { deletedAt: null, capacity },
      create: {
        tenantId: tenant.id,
        academicYearId: year.id,
        gradeId,
        name: sectionName!,
        capacity,
      },
    });
    sectionByKey.set(key, section.id);
  }

  const existing = await prisma.schoolStudent.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
    include: {
      enrollments: {
        where: { academicYearId: year.id, deletedAt: null },
        include: { section: { include: { grade: true } } },
      },
      guardians: { include: { guardian: true } },
    },
  });
  const existingFp = new Set(
    existing.map((s) => {
      const enr = s.enrollments[0];
      const father = s.guardians[0]?.guardian.fullName ?? '';
      const dob = s.dateOfBirth ? s.dateOfBirth.toISOString().slice(0, 10) : '';
      return `${normalizeName(s.fullName)}|${normalizeName(father)}|${dob}|${enr?.section.grade.code ?? ''}`;
    }),
  );

  const existingRolls = new Map<string, Set<string>>();
  for (const s of existing) {
    for (const enr of s.enrollments) {
      if (!enr.rollNumber) continue;
      const set = existingRolls.get(enr.sectionId) ?? new Set<string>();
      set.add(enr.rollNumber);
      existingRolls.set(enr.sectionId, set);
    }
  }

  type Planned = ParsedRow & {
    rollNumber: string;
    sectionId: string;
    skip?: boolean;
  };
  const planned: Planned[] = [];
  for (const [key, list] of grouped) {
    const sectionId = sectionByKey.get(key)!;
    const used = existingRolls.get(sectionId) ?? new Set<string>();
    let seq = 1;
    const nextRoll = () => {
      let roll = String(seq).padStart(2, '0');
      while (used.has(roll)) {
        seq += 1;
        roll = String(seq).padStart(2, '0');
      }
      used.add(roll);
      seq += 1;
      return roll;
    };
    for (const row of list) {
      const skip = existingFp.has(fingerprint(row));
      planned.push({
        ...row,
        sectionId,
        rollNumber: skip ? '' : nextRoll(),
        skip,
      });
    }
    existingRolls.set(sectionId, used);
  }

  const toCreate = planned.filter((p) => !p.skip);
  const skipped = planned.filter((p) => p.skip);

  const counts = new Map<string, number>();
  for (const row of toCreate) {
    const k = `${row.gradeCode} ${row.sectionName}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Year: ${year.name} (${year.code})`);
  console.log(
    `Excel rows: ${all.length}  unique: ${incoming.length}  register dups skipped: ${duplicates.length}`,
  );
  console.log(`Already in SIS (fingerprint): ${skipped.length}`);
  console.log(`Will create: ${toCreate.length}`);
  console.log('By class/section:');
  for (const [k, n] of [...counts.entries()].sort())
    console.log(`  ${k}: ${n}`);
  if (duplicates.length) {
    console.log('Register duplicate rows (same name+father+DOB+class):');
    for (const d of duplicates) {
      console.log(`  ${d.source} row ${d.excelRow} ${d.fullName}`);
    }
  }
  const notes = toCreate.filter((r) => r.notes.length);
  if (notes.length) {
    console.log('Notes:');
    for (const r of notes)
      console.log(`  ${r.fullName} (${r.gradeCode}): ${r.notes.join('; ')}`);
  }

  if (!APPLY) {
    console.log('\nRe-run with --apply to write Student + Enrollment rows.');
    return;
  }

  let created = 0;
  for (const row of toCreate) {
    await prisma.$transaction(async (tx) => {
      const admissionNumber = await nextAdmission(
        tx,
        tenant.id,
        year.id,
        year.code,
      );
      const addressParts = [
        row.addressLine,
        row.postOffice,
        row.district,
      ].filter(Boolean);
      const remarkParts = [
        'Imported from school register 2026-09-07',
        row.house ? `House: ${row.house}` : '',
        ...row.notes,
      ].filter(Boolean);
      const student = await tx.schoolStudent.create({
        data: {
          tenantId: tenant.id,
          admissionNumber,
          fullName: row.fullName,
          dateOfBirth: row.dob,
          phone: row.phone,
          address: addressParts.join(', ') || null,
          currentAddress: {
            line1: row.addressLine || null,
            postOffice: row.postOffice || null,
            district: row.district || null,
            house: row.house || null,
          },
          remarks: remarkParts.join('\n'),
          nationality: 'Indian',
        },
      });
      if (row.fatherName) {
        const guardian = await tx.schoolGuardian.create({
          data: {
            tenantId: tenant.id,
            fullName: row.fatherName,
            relation: 'FATHER',
            phone: row.phone,
            isPrimary: true,
          },
        });
        await tx.schoolStudentGuardian.create({
          data: {
            studentId: student.id,
            guardianId: guardian.id,
            relationship: 'FATHER',
          },
        });
      }
      const enrollment = await tx.schoolEnrollment.create({
        data: {
          tenantId: tenant.id,
          studentId: student.id,
          academicYearId: year.id,
          sectionId: row.sectionId,
          rollNumber: row.rollNumber,
          status: 'ACTIVE',
          source: 'IMPORT',
        },
      });
      await tx.schoolEnrollmentEvent.create({
        data: {
          tenantId: tenant.id,
          studentId: student.id,
          enrollmentId: enrollment.id,
          type: 'CREATED',
          toSectionId: row.sectionId,
          note: `Register import · roll ${row.rollNumber}`,
        },
      });
    });
    created += 1;
    if (created % 50 === 0)
      console.log(`  created ${created}/${toCreate.length}`);
  }

  const verify = await prisma.schoolEnrollment.groupBy({
    by: ['sectionId', 'rollNumber'],
    where: {
      tenantId: tenant.id,
      academicYearId: year.id,
      deletedAt: null,
      rollNumber: { not: null },
    },
    _count: { _all: true },
  });
  const clashes = verify.filter((v) => (v._count._all ?? 0) > 1);
  console.log(`Created ${created} students.`);
  if (clashes.length) {
    console.error('Roll clashes detected:', clashes);
    throw new Error('Duplicate roll numbers within a section');
  }
  console.log('Roll uniqueness within section: OK');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
