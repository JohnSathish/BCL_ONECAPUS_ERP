/**
 * Load Don Bosco College Odd Semester 2026 NEHU practical routine
 * (Annexure I, 47 sittings) into the university exam timetable,
 * and turn on legacy university exam mode for that tenant.
 *
 * Idempotent: re-running replaces only this session's papers.
 *
 * Usage (from apps/api):
 *   npx tsx scripts/load-nehu-odd-2026-practical-routine.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

function loadEnv() {
  const path = resolve(__dirname, '../.env');
  const text = readFileSync(path, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = value;
  }
}

loadEnv();

const prisma = new PrismaClient();

const SESSION_NAME = 'NEHU Odd Semester Practical 2026';
const SOURCE = 'DBC_ODD_2026_PRACTICAL_ROUTINE';

type Sitting = {
  date: string;
  semesterNo: number;
  category: 'MAJOR' | 'MINOR' | 'SEC' | 'VTC';
  baseCode: string;
  batch: string;
  paperName: string;
  students: number;
};

/** Annexure I — Practical Examination Routine, Odd Semester 2026. */
const SITTINGS: Sitting[] = [
  // 1st Semester MAJOR
  {
    date: '2026-11-25',
    semesterNo: 1,
    category: 'MAJOR',
    baseCode: 'ZOO-100',
    batch: 'G4A',
    paperName: 'Taxonomy and Animal Diversity',
    students: 15,
  },
  {
    date: '2026-11-25',
    semesterNo: 1,
    category: 'MAJOR',
    baseCode: 'BOT-100',
    batch: 'G1',
    paperName: 'Plant Diversity-I Algae Bryophytes and Pteridophytes',
    students: 25,
  },
  {
    date: '2026-11-25',
    semesterNo: 1,
    category: 'MAJOR',
    baseCode: 'CHE-100',
    batch: 'G2',
    paperName: 'Introductory Chemistry-I',
    students: 20,
  },
  {
    date: '2026-11-25',
    semesterNo: 1,
    category: 'MAJOR',
    baseCode: 'PHY-100',
    batch: 'G3',
    paperName: 'Mathematical Physics, Properties of Matter and Waves',
    students: 12,
  },
  {
    date: '2026-11-26',
    semesterNo: 1,
    category: 'MAJOR',
    baseCode: 'ZOO-100',
    batch: 'G4B',
    paperName: 'Taxonomy and Animal Diversity',
    students: 15,
  },
  // 1st Semester MINOR
  {
    date: '2026-11-27',
    semesterNo: 1,
    category: 'MINOR',
    baseCode: 'CHE-100',
    batch: 'G14A',
    paperName: 'Introductory Chemistry-I (MINOR)',
    students: 17,
  },
  {
    date: '2026-11-27',
    semesterNo: 1,
    category: 'MINOR',
    baseCode: 'PHY-100',
    batch: 'G16A',
    paperName: 'Mathematical Physics, Properties of Matter and Waves (MINOR)',
    students: 11,
  },
  {
    date: '2026-11-27',
    semesterNo: 1,
    category: 'MINOR',
    baseCode: 'BOT-100',
    batch: 'G12',
    paperName: 'Plant Diversity-I Algae Bryophytes and Pteridophytes (MINOR)',
    students: 14,
  },
  {
    date: '2026-11-27',
    semesterNo: 1,
    category: 'MINOR',
    baseCode: 'ZOO-100',
    batch: 'G17',
    paperName: 'Taxonomy and Animal Diversity (MINOR)',
    students: 15,
  },
  {
    date: '2026-11-28',
    semesterNo: 1,
    category: 'MINOR',
    baseCode: 'CHE-100',
    batch: 'G14B',
    paperName: 'Introductory Chemistry-I (MINOR)',
    students: 17,
  },
  {
    date: '2026-11-28',
    semesterNo: 1,
    category: 'MINOR',
    baseCode: 'PHY-100',
    batch: 'G16B',
    paperName: 'Mathematical Physics, Properties of Matter and Waves (MINOR)',
    students: 11,
  },
  // 3rd Semester MAJOR
  {
    date: '2026-11-16',
    semesterNo: 3,
    category: 'MAJOR',
    baseCode: 'PHY-200',
    batch: 'G9A1',
    paperName: 'Mathematical Physics II',
    students: 9,
  },
  {
    date: '2026-11-16',
    semesterNo: 3,
    category: 'MAJOR',
    baseCode: 'BOT-200',
    batch: 'G5A',
    paperName: 'Economic Botany and Ethnobotany',
    students: 18,
  },
  {
    date: '2026-11-16',
    semesterNo: 3,
    category: 'MAJOR',
    baseCode: 'CHE-200',
    batch: 'G7',
    paperName: 'Chemistry-III (MAJOR)',
    students: 13,
  },
  {
    date: '2026-11-16',
    semesterNo: 3,
    category: 'MAJOR',
    baseCode: 'ZOO-200',
    batch: 'G10A',
    paperName: 'Introductory Cell Biology and Genetics',
    students: 19,
  },
  {
    date: '2026-11-17',
    semesterNo: 3,
    category: 'MAJOR',
    baseCode: 'PHY-200',
    batch: 'G9A2',
    paperName: 'Mathematical Physics II',
    students: 9,
  },
  {
    date: '2026-11-18',
    semesterNo: 3,
    category: 'MAJOR',
    baseCode: 'PHY-201',
    batch: 'G9B1',
    paperName: 'Heat & Thermodynamics and Experimental Physics IV',
    students: 9,
  },
  {
    date: '2026-11-18',
    semesterNo: 3,
    category: 'MAJOR',
    baseCode: 'BOT-201',
    batch: 'G5B',
    paperName: 'Angiosperm Taxonomy',
    students: 18,
  },
  {
    date: '2026-11-18',
    semesterNo: 3,
    category: 'MAJOR',
    baseCode: 'ZOO-201',
    batch: 'G10B',
    paperName: 'Introductory Biochemistry and Immunology',
    students: 19,
  },
  {
    date: '2026-11-19',
    semesterNo: 3,
    category: 'MAJOR',
    baseCode: 'PHY-201',
    batch: 'G9B2',
    paperName: 'Heat & Thermodynamics and Experimental Physics IV',
    students: 9,
  },
  // 3rd Semester SEC
  {
    date: '2026-11-06',
    semesterNo: 3,
    category: 'SEC',
    baseCode: 'SEC-233',
    batch: 'G28',
    paperName: 'Goods and Service Tax',
    students: 122,
  },
  // 3rd Semester VTC
  {
    date: '2026-11-04',
    semesterNo: 3,
    category: 'VTC',
    baseCode: 'VTC:241.2',
    batch: 'G20A',
    paperName: 'MUSHROOM CULTIVATION',
    students: 60,
  },
  {
    date: '2026-11-04',
    semesterNo: 3,
    category: 'VTC',
    baseCode: 'VTC:245.3',
    batch: 'G21A',
    paperName: 'GUITAR',
    students: 61,
  },
  {
    date: '2026-11-04',
    semesterNo: 3,
    category: 'VTC',
    baseCode: 'VTC:243.3',
    batch: 'G19',
    paperName: 'COMPUTERIZED ACCOUNTING',
    students: 13,
  },
  {
    date: '2026-11-04',
    semesterNo: 3,
    category: 'VTC',
    baseCode: 'VTC:244.2',
    batch: 'G22',
    paperName: 'EVENT MANAGEMENT',
    students: 95,
  },
  {
    date: '2026-11-04',
    semesterNo: 3,
    category: 'VTC',
    baseCode: 'VTC:248.1',
    batch: 'G23',
    paperName: 'PHOTOGRAPHY',
    students: 80,
  },
  {
    date: '2026-11-04',
    semesterNo: 3,
    category: 'VTC',
    baseCode: 'VTC:246.1',
    batch: 'G24',
    paperName: 'BAKING & CONFECTIONARY',
    students: 48,
  },
  {
    date: '2026-11-04',
    semesterNo: 3,
    category: 'VTC',
    baseCode: 'VTC:240.3',
    batch: 'G25',
    paperName: 'BEE KEEPING',
    students: 34,
  },
  {
    date: '2026-11-04',
    semesterNo: 3,
    category: 'VTC',
    baseCode: 'VTC:245.4',
    batch: 'G26',
    paperName: 'VOCALS',
    students: 14,
  },
  {
    date: '2026-11-04',
    semesterNo: 3,
    category: 'VTC',
    baseCode: 'VTC:243.1',
    batch: 'G27',
    paperName: 'WEB DESIGNING',
    students: 9,
  },
  {
    date: '2026-11-05',
    semesterNo: 3,
    category: 'VTC',
    baseCode: 'VTC:241.2',
    batch: 'G20B',
    paperName: 'MUSHROOM CULTIVATION',
    students: 60,
  },
  {
    date: '2026-11-05',
    semesterNo: 3,
    category: 'VTC',
    baseCode: 'VTC:245.3',
    batch: 'G21B',
    paperName: 'GUITAR',
    students: 61,
  },
  {
    date: '2026-11-06',
    semesterNo: 3,
    category: 'VTC',
    baseCode: 'VTC:241.2',
    batch: 'G20C',
    paperName: 'MUSHROOM CULTIVATION',
    students: 60,
  },
  {
    date: '2026-11-06',
    semesterNo: 3,
    category: 'VTC',
    baseCode: 'VTC:245.3',
    batch: 'G21C',
    paperName: 'GUITAR',
    students: 61,
  },
  // 5th Semester MAJOR
  {
    date: '2026-11-03',
    semesterNo: 5,
    category: 'MAJOR',
    baseCode: 'ZOO-300',
    batch: 'G11A1',
    paperName: 'Animal Physiology',
    students: 8,
  },
  {
    date: '2026-11-03',
    semesterNo: 5,
    category: 'MAJOR',
    baseCode: 'BOT-300',
    batch: 'G6A',
    paperName: 'Plant Physiology',
    students: 10,
  },
  {
    date: '2026-11-04',
    semesterNo: 5,
    category: 'MAJOR',
    baseCode: 'ZOO-300',
    batch: 'G11A2',
    paperName: 'Animal Physiology',
    students: 8,
  },
  {
    date: '2026-11-05',
    semesterNo: 5,
    category: 'MAJOR',
    baseCode: 'ZOO-301',
    batch: 'G11B1',
    paperName: 'Biochemistry and Immunology',
    students: 8,
  },
  {
    date: '2026-11-05',
    semesterNo: 5,
    category: 'MAJOR',
    baseCode: 'BOT-301',
    batch: 'G6B',
    paperName: 'Plant Biochemistry',
    students: 10,
  },
  {
    date: '2026-11-06',
    semesterNo: 5,
    category: 'MAJOR',
    baseCode: 'ZOO-301',
    batch: 'G11B2',
    paperName: 'Biochemistry and Immunology',
    students: 8,
  },
  {
    date: '2026-11-09',
    semesterNo: 5,
    category: 'MAJOR',
    baseCode: 'ZOO-302',
    batch: 'G11C1',
    paperName: 'Introductory Development Biology and Endocrinology',
    students: 8,
  },
  {
    date: '2026-11-09',
    semesterNo: 5,
    category: 'MAJOR',
    baseCode: 'BOT-302',
    batch: 'G6C',
    paperName: 'Plant Ecology',
    students: 10,
  },
  {
    date: '2026-11-09',
    semesterNo: 5,
    category: 'MAJOR',
    baseCode: 'CHE-302',
    batch: 'G8',
    paperName: 'Chemistry-V',
    students: 16,
  },
  {
    date: '2026-11-10',
    semesterNo: 5,
    category: 'MAJOR',
    baseCode: 'ZOO-302',
    batch: 'G11C2',
    paperName: 'Introductory Development Biology and Endocrinology',
    students: 8,
  },
  // 5th Semester MINOR
  {
    date: '2026-11-11',
    semesterNo: 5,
    category: 'MINOR',
    baseCode: 'BOT-302',
    batch: 'G13',
    paperName: 'Angiosperm Taxonomy, Ecology and Economic Botany',
    students: 7,
  },
  {
    date: '2026-11-11',
    semesterNo: 5,
    category: 'MINOR',
    baseCode: 'CHE-302',
    batch: 'G15',
    paperName: 'Chemistry-III (MINOR)',
    students: 24,
  },
  {
    date: '2026-11-11',
    semesterNo: 5,
    category: 'MINOR',
    baseCode: 'ZOO-302',
    batch: 'G18',
    paperName: 'Economic and Applied Zoology',
    students: 6,
  },
];

function paperCode(row: Sitting) {
  return `${row.baseCode} ${row.category} (${row.batch})`.toUpperCase();
}

function dateOnly(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

function timeOnly(hours: number, minutes = 0) {
  const date = new Date(0);
  date.setUTCHours(hours, minutes, 0, 0);
  return date;
}

function codeKeys(code: string) {
  const upper = code.trim().toUpperCase();
  const compact = upper.replace(/[^A-Z0-9]/g, '');
  return [upper, compact];
}

async function main() {
  if (SITTINGS.length !== 47) {
    throw new Error(`Expected 47 sittings, found ${SITTINGS.length}`);
  }
  const codes = SITTINGS.map(paperCode);
  if (new Set(codes).size !== codes.length) {
    throw new Error('Paper codes are not unique');
  }

  const tenants = await prisma.tenant.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, slug: true },
  });
  const tenant =
    tenants.find((row) => /don[\s-]?bosco/i.test(row.name)) ??
    tenants.find((row) => row.slug === 'demo') ??
    null;
  if (!tenant) {
    throw new Error(
      `Don Bosco tenant not found. Tenants: ${tenants.map((row) => row.slug).join(', ')}`,
    );
  }

  const years = await prisma.academicYear.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
    orderBy: { startDate: 'desc' },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      status: true,
      isPrimarySession: true,
    },
  });
  const year =
    years.find(
      (row) =>
        row.startDate <= dateOnly('2026-11-03') &&
        row.endDate >= dateOnly('2026-11-28'),
    ) ??
    years.find((row) => /2026/.test(row.name)) ??
    null;

  const courses = await prisma.course.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
    select: { id: true, code: true, title: true },
  });
  const byKey = new Map<string, Array<{ id: string; code: string }>>();
  for (const course of courses) {
    for (const key of codeKeys(course.code)) {
      const list = byKey.get(key) ?? [];
      list.push(course);
      byKey.set(key, list);
    }
  }

  const settings = await prisma.tenantExaminationSettings.upsert({
    where: { tenantId: tenant.id },
    create: { tenantId: tenant.id, legacyUniversityExamMode: true },
    update: { legacyUniversityExamMode: true },
    select: { legacyUniversityExamMode: true },
  });

  const existing = await prisma.examSession.findFirst({
    where: { tenantId: tenant.id, name: SESSION_NAME, deletedAt: null },
  });

  const session = existing
    ? await prisma.examSession.update({
        where: { id: existing.id },
        data: {
          examType: 'SEMESTER_END',
          semesterNo: null,
          academicYearId: year?.id ?? existing.academicYearId,
          startDate: dateOnly('2026-11-03'),
          endDate: dateOnly('2026-11-28'),
          status: 'SCHEDULED',
          instructions:
            'NEHU Odd Semester 2026 practical examination routine (Annexure I). All sittings 09:00–16:00. Batches are part of the paper code.',
          metadata: {
            source: SOURCE,
            annexure: 'I',
            kind: 'NEHU_PRACTICAL',
            paperCount: SITTINGS.length,
            dayCount: 15,
          },
        },
      })
    : await prisma.examSession.create({
        data: {
          tenantId: tenant.id,
          name: SESSION_NAME,
          examType: 'SEMESTER_END',
          academicYearId: year?.id,
          startDate: dateOnly('2026-11-03'),
          endDate: dateOnly('2026-11-28'),
          status: 'SCHEDULED',
          instructions:
            'NEHU Odd Semester 2026 practical examination routine (Annexure I). All sittings 09:00–16:00. Batches are part of the paper code.',
          metadata: {
            source: SOURCE,
            annexure: 'I',
            kind: 'NEHU_PRACTICAL',
            paperCount: SITTINGS.length,
            dayCount: 15,
          },
        },
      });

  await prisma.examPaperSchedule.deleteMany({
    where: { tenantId: tenant.id, sessionId: session.id },
  });

  const unmatched: string[] = [];
  let linked = 0;
  for (const row of SITTINGS) {
    const keys = codeKeys(row.baseCode);
    const matches = new Map<string, { id: string; code: string }>();
    for (const key of keys) {
      for (const course of byKey.get(key) ?? []) matches.set(course.id, course);
    }
    const courseId = matches.size === 1 ? [...matches.values()][0].id : null;
    if (!courseId) unmatched.push(row.baseCode);
    else linked += 1;

    await prisma.examPaperSchedule.create({
      data: {
        tenantId: tenant.id,
        sessionId: session.id,
        courseId,
        paperCode: paperCode(row),
        paperName: row.paperName,
        examDate: dateOnly(row.date),
        startTime: timeOnly(9, 0),
        endTime: timeOnly(16, 0),
        semesterNo: row.semesterNo,
        expectedCount: row.students,
        status: 'SCHEDULED',
        metadata: {
          source: SOURCE,
          category: row.category,
          batch: row.batch,
          baseCode: row.baseCode,
          durationHours: 6,
        },
      },
    });
  }

  const stored = await prisma.examPaperSchedule.count({
    where: { tenantId: tenant.id, sessionId: session.id, deletedAt: null },
  });

  console.log(
    JSON.stringify(
      {
        tenant: tenant.slug,
        academicYear: year?.name ?? null,
        legacyUniversityExamMode: settings.legacyUniversityExamMode,
        sessionId: session.id,
        sessionName: session.name,
        papers: stored,
        linkedCourses: linked,
        unmatchedCodes: [...new Set(unmatched)].sort(),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
