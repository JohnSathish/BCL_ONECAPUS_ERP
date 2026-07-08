/**
 * Audit Sem 5 subject registrations for the 11 legacy override students.
 *
 *   npx ts-node --transpile-only scripts/audit-sem5-pending-11-registrations.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

type ExpectedStudent = {
  rollNumber: string;
  fullName: string;
  majorDepartment: string;
  minorDepartment: string;
};

const EXPECTED: ExpectedStudent[] = [
  {
    rollNumber: 'BA24-630',
    fullName: 'ENGLILY R SANGMA',
    majorDepartment: 'History',
    minorDepartment: 'Education',
  },
  {
    rollNumber: 'BA24-911',
    fullName: 'MIKKIMCHI M MARAK',
    majorDepartment: 'Education',
    minorDepartment: 'Political Science',
  },
  {
    rollNumber: 'BA24-918',
    fullName: 'TANGRIK M MARAK',
    majorDepartment: 'Political Science',
    minorDepartment: 'Garo',
  },
  {
    rollNumber: 'BA24-928',
    fullName: 'ANORI R MARAK',
    majorDepartment: 'Education',
    minorDepartment: 'Sociology',
  },
  {
    rollNumber: 'BA24-956',
    fullName: 'ANGELORY A SANGMA',
    majorDepartment: 'Garo',
    minorDepartment: 'Political Science',
  },
  {
    rollNumber: 'BA24-971',
    fullName: 'JUNMEA D SANGMA',
    majorDepartment: 'Education',
    minorDepartment: 'Sociology',
  },
  {
    rollNumber: 'BA24-973',
    fullName: 'LUCY R SANGMA',
    majorDepartment: 'Education',
    minorDepartment: 'Sociology',
  },
  {
    rollNumber: 'BA24-975',
    fullName: 'MITRA KOCH',
    majorDepartment: 'Education',
    minorDepartment: 'Sociology',
  },
  {
    rollNumber: 'BA24-976',
    fullName: 'MONGGIA R MARAK',
    majorDepartment: 'Garo',
    minorDepartment: 'Political Science',
  },
  {
    rollNumber: 'BA24-995',
    fullName: 'SILSENG B MARAK',
    majorDepartment: 'Garo',
    minorDepartment: 'Political Science',
  },
  {
    rollNumber: 'BA24-1002',
    fullName: 'WALCLINTON R SANGMA',
    majorDepartment: 'Garo',
    minorDepartment: 'Political Science',
  },
];

const MAJOR_CODE_PREFIX: Record<string, string[]> = {
  history: ['HIS'],
  education: ['EDN', 'EDU'],
  'political science': ['POL'],
  garo: ['GAR'],
  sociology: ['SOC'],
  economics: ['ECO'],
  philosophy: ['PHI'],
  geography: ['GEO'],
};

const prisma = new PrismaClient();

function normalizeLabel(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function deptPrefixes(department: string) {
  return MAJOR_CODE_PREFIX[normalizeLabel(department)] ?? [];
}

function courseDeptPrefix(code: string) {
  return code.split('-')[0]?.trim().toUpperCase() ?? '';
}

function matchesDeptPrefix(code: string, department: string) {
  const prefixes = deptPrefixes(department);
  if (!prefixes.length) return true;
  return prefixes.includes(courseDeptPrefix(code));
}

async function resolveTenant() {
  const tenantSlug = process.env.TENANT_SLUG?.trim();
  if (tenantSlug) {
    const tenant = await prisma.tenant.findFirst({
      where: { slug: tenantSlug },
      select: { id: true, name: true, slug: true },
    });
    if (!tenant) throw new Error(`Tenant slug "${tenantSlug}" not found`);
    return tenant;
  }
  return (
    (await prisma.tenant.findFirst({
      where: { slug: 'demo' },
      select: { id: true, name: true, slug: true },
    })) ??
    (await prisma.tenant.findFirst({
      where: { name: { contains: 'Don Bosco' } },
      select: { id: true, name: true, slug: true },
    }))
  );
}

async function main() {
  const tenant = await resolveTenant();
  if (!tenant) throw new Error('Tenant not found');
  console.log(`Tenant: ${tenant.name} (${tenant.slug ?? tenant.id})\n`);

  const rolls = EXPECTED.map((e) => e.rollNumber);
  const students = await prisma.student.findMany({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      rollNumber: { in: rolls },
    },
    select: {
      id: true,
      rollNumber: true,
      enrollmentNumber: true,
      programVersionId: true,
      masterProfile: { select: { fullName: true } },
      programChoices: {
        where: { status: 'active', deletedAt: null },
        select: { choiceType: true, subjectSlug: true },
      },
      majorMinorTrack: {
        select: {
          majorSubject: { select: { name: true, slug: true } },
          minorSubject: { select: { name: true, slug: true } },
        },
      },
      academicStanding: {
        select: { currentSemesterSequence: true },
      },
      semesterRegistrations: {
        where: { semesterSequence: 5 },
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          lines: {
            include: {
              offering: {
                include: {
                  course: {
                    select: {
                      code: true,
                      title: true,
                      deletedAt: true,
                      department: { select: { name: true, code: true } },
                    },
                  },
                },
              },
            },
            orderBy: [{ category: 'asc' }, { createdAt: 'asc' }],
          },
        },
      },
    },
  });

  const byRoll = new Map(
    students.map((s) => [String(s.rollNumber).toUpperCase(), s]),
  );

  type Issue = {
    roll: string;
    severity: 'OK' | 'WARN' | 'FAIL';
    issues: string[];
    majorCount: number;
    minorCount: number;
    internshipCount: number;
    lines: string[];
  };

  const results: Issue[] = [];
  let okCount = 0;
  let warnCount = 0;
  let failCount = 0;

  const bump = (
    current: Issue['severity'],
    next: Issue['severity'],
  ): Issue['severity'] => {
    const rank = { OK: 0, WARN: 1, FAIL: 2 } as const;
    return rank[next] > rank[current] ? next : current;
  };

  for (const expected of EXPECTED) {
    const student = byRoll.get(expected.rollNumber.toUpperCase());
    const issues: string[] = [];
    let severity: Issue['severity'] = 'OK';

    if (!student) {
      results.push({
        roll: expected.rollNumber,
        severity: 'FAIL',
        issues: ['Student not found in DB'],
        majorCount: 0,
        minorCount: 0,
        internshipCount: 0,
        lines: [],
      });
      failCount += 1;
      continue;
    }

    const standing = student.academicStanding?.currentSemesterSequence ?? null;
    if (standing !== 5) {
      issues.push(
        `Academic standing semester = ${standing ?? 'null'} (expected 5)`,
      );
      severity = bump(severity, 'WARN');
    }

    const majorChoice = student.programChoices.find(
      (c) => c.choiceType === 'MAJOR',
    );
    const minorChoice = student.programChoices.find(
      (c) => c.choiceType === 'MINOR',
    );
    const expectedMajorSlug = normalizeLabel(expected.majorDepartment).replace(
      /\s+/g,
      '-',
    );
    const expectedMinorSlug = normalizeLabel(expected.minorDepartment).replace(
      /\s+/g,
      '-',
    );

    if (!majorChoice) {
      issues.push('Missing active MAJOR program choice');
      severity = bump(severity, 'FAIL');
    } else if (
      normalizeLabel(majorChoice.subjectSlug) !==
      normalizeLabel(expectedMajorSlug)
    ) {
      issues.push(
        `MAJOR choice slug="${majorChoice.subjectSlug}" (expected ~${expectedMajorSlug})`,
      );
      severity = bump(severity, 'WARN');
    }

    if (!minorChoice) {
      issues.push('Missing active MINOR program choice');
      severity = bump(severity, 'FAIL');
    } else if (
      normalizeLabel(minorChoice.subjectSlug) !==
      normalizeLabel(expectedMinorSlug)
    ) {
      issues.push(
        `MINOR choice slug="${minorChoice.subjectSlug}" (expected ~${expectedMinorSlug})`,
      );
      severity = bump(severity, 'FAIL');
    }

    const track = student.majorMinorTrack;
    if (!track?.majorSubject) {
      issues.push('Missing StudentMajorMinorTrack major');
      severity = bump(severity, 'WARN');
    }
    if (!track?.minorSubject) {
      issues.push('Missing StudentMajorMinorTrack minor');
      severity = bump(severity, 'WARN');
    } else if (
      normalizeLabel(track.minorSubject.name) !==
        normalizeLabel(expected.minorDepartment) &&
      normalizeLabel(track.minorSubject.slug) !==
        normalizeLabel(expectedMinorSlug)
    ) {
      issues.push(
        `Track minor="${track.minorSubject.name}" (expected ${expected.minorDepartment})`,
      );
      severity = bump(severity, 'FAIL');
    }

    const reg = student.semesterRegistrations[0];
    if (!reg) {
      issues.push('No Semester 5 registration found');
      severity = bump(severity, 'FAIL');
      results.push({
        roll: expected.rollNumber,
        severity,
        issues,
        majorCount: 0,
        minorCount: 0,
        internshipCount: 0,
        lines: [],
      });
      failCount += 1;
      continue;
    }

    const lines = reg.lines ?? [];
    const lineLabels = lines.map((line) => {
      const code = line.offering?.course?.code ?? '?';
      const title = line.offering?.course?.title ?? '';
      const deleted = (
        line.offering?.course as { deletedAt?: Date | null } | undefined
      )?.deletedAt
        ? ' DELETED'
        : '';
      return `${line.category ?? '?'}: ${code} — ${title} [${line.status}]${deleted}`;
    });

    const majors = lines.filter(
      (l) => String(l.category ?? '').toUpperCase() === 'MAJOR',
    );
    const minors = lines.filter(
      (l) => String(l.category ?? '').toUpperCase() === 'MINOR',
    );
    const internships = lines.filter(
      (l) => String(l.category ?? '').toUpperCase() === 'INTERNSHIP',
    );

    if (majors.length < 3) {
      issues.push(`MAJOR papers: ${majors.length}/3`);
      severity = bump(severity, 'FAIL');
    } else if (majors.length > 3) {
      issues.push(`MAJOR papers: ${majors.length} (expected 3)`);
      severity = bump(severity, 'WARN');
    }

    for (const major of majors) {
      const course = major.offering?.course as
        | { code?: string; deletedAt?: Date | null }
        | undefined;
      const code = course?.code ?? '';
      if (!matchesDeptPrefix(code, expected.majorDepartment)) {
        issues.push(
          `MAJOR paper ${code} does not match expected major dept ${expected.majorDepartment}`,
        );
        severity = bump(severity, 'FAIL');
      }
      if (course?.deletedAt) {
        issues.push(
          `MAJOR paper ${code} points to soft-deleted course (expected active EDN-30x for Education)`,
        );
        severity = bump(severity, 'FAIL');
      }
    }

    if (minors.length !== 1) {
      issues.push(`MINOR papers: ${minors.length}/1`);
      severity = bump(severity, 'FAIL');
    } else {
      const course = minors[0].offering?.course as
        | { code?: string; deletedAt?: Date | null }
        | undefined;
      const code = course?.code ?? '';
      if (!matchesDeptPrefix(code, expected.minorDepartment)) {
        issues.push(
          `MINOR paper ${code} does not match expected override minor ${expected.minorDepartment}`,
        );
        severity = bump(severity, 'FAIL');
      }
      if (course?.deletedAt) {
        issues.push(`MINOR paper ${code} points to soft-deleted course`);
        severity = bump(severity, 'FAIL');
      }
    }

    if (internships.length !== 1) {
      issues.push(`INTERNSHIP papers: ${internships.length}/1`);
      severity = bump(severity, 'FAIL');
    } else {
      const course = internships[0].offering?.course as
        | { code?: string; deletedAt?: Date | null }
        | undefined;
      const code = course?.code ?? '';
      if (!matchesDeptPrefix(code, expected.majorDepartment)) {
        issues.push(
          `INTERNSHIP ${code} does not match major dept ${expected.majorDepartment}`,
        );
        severity = bump(severity, 'FAIL');
      }
      if (!/-303$/i.test(code.replace(/[\u2010-\u2015]/g, '-'))) {
        issues.push(`INTERNSHIP code ${code} does not look like *-303`);
        severity = bump(severity, 'WARN');
      }
      if (course?.deletedAt) {
        issues.push(`INTERNSHIP ${code} points to soft-deleted course`);
        severity = bump(severity, 'FAIL');
      }
    }

    const unexpected = lines.filter((l) => {
      const cat = String(l.category ?? '').toUpperCase();
      return !['MAJOR', 'MINOR', 'INTERNSHIP'].includes(cat);
    });
    if (unexpected.length) {
      issues.push(
        `Unexpected Sem5 categories present: ${unexpected
          .map((l) => l.category)
          .join(', ')}`,
      );
      severity = bump(severity, 'WARN');
    }

    if (severity === 'OK' && issues.length === 0) okCount += 1;
    else if (severity === 'WARN') warnCount += 1;
    else failCount += 1;

    results.push({
      roll: expected.rollNumber,
      severity,
      issues: issues.length ? issues : ['All Sem 5 checks passed'],
      majorCount: majors.length,
      minorCount: minors.length,
      internshipCount: internships.length,
      lines: lineLabels,
    });
  }

  console.log('=== Per-student Sem 5 audit ===\n');
  for (const expected of EXPECTED) {
    const row = results.find((r) => r.roll === expected.rollNumber)!;
    const student = byRoll.get(expected.rollNumber.toUpperCase());
    console.log(
      `[${row.severity}] ${expected.rollNumber} | ${student?.masterProfile?.fullName ?? expected.fullName}`,
    );
    console.log(
      `  Expected: Major=${expected.majorDepartment} / Minor=${expected.minorDepartment}`,
    );
    console.log(
      `  Counts: MAJOR=${row.majorCount} MINOR=${row.minorCount} INTERNSHIP=${row.internshipCount}`,
    );
    for (const issue of row.issues) console.log(`  - ${issue}`);
    if (row.lines.length) {
      console.log('  Registered lines:');
      for (const line of row.lines) console.log(`    • ${line}`);
    }
    console.log('');
  }

  console.log('=== Summary ===');
  console.log(`OK:   ${okCount}`);
  console.log(`WARN: ${warnCount}`);
  console.log(`FAIL: ${failCount}`);
  console.log(`Total audited: ${EXPECTED.length}`);

  if (failCount > 0) process.exitCode = 2;
  else if (warnCount > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
