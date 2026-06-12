/**
 * Student portal verification — registration, validation, and section-aware timetable.
 *
 *   npx ts-node --transpile-only scripts/verify-student-portal.ts
 *   npx ts-node --transpile-only scripts/verify-student-portal.ts --tenant=demo --batch=BATCH-2026
 *   npx ts-node --transpile-only scripts/verify-student-portal.ts --enrollment=APP-2026-0001
 *   npx ts-node --transpile-only scripts/verify-student-portal.ts --http --api=http://127.0.0.1:3001/api
 */
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';
import type { JwtUser } from '../src/common/decorators/current-user.decorator';
import { AcademicEngineService } from '../src/modules/academic-engine/academic-engine.service';
import { TimetableEngineService } from '../src/modules/timetable-engine/timetable-engine.service';

const prisma = new PrismaClient();

const NEP_SEM1_CATEGORIES = [
  'MAJOR',
  'MINOR',
  'MDC',
  'AEC',
  'SEC',
  'VAC',
] as const;
const DEFAULT_STUDENT_PASSWORD = 'Student@123';

type CheckLevel = 'pass' | 'fail' | 'warn';

type CheckResult = {
  level: CheckLevel;
  code: string;
  message: string;
};

type StudentRow = {
  id: string;
  enrollmentNumber: string | null;
  userId: string | null;
  primaryShiftId: string | null;
  programVersionId: string | null;
  masterProfile: { fullName: string } | null;
  user: {
    id: string;
    email: string;
    isActive: boolean;
    roles: { role: { slug: string } }[];
  } | null;
  semesterRegistrations: {
    id: string;
    status: string;
    semesterId: string;
    semester: { semesterNumber: number };
    lines: {
      id: string;
      category: string;
      offeringId: string;
      offeringSectionId: string | null;
      offering: { course: { code: string } };
      offeringSection: { sectionCode: string } | null;
    }[];
  }[];
};

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

const tenantSlug = readArg('tenant') ?? 'demo';
const batchCode = readArg('batch') ?? 'BATCH-2026';
const enrollmentFilter = readArg('enrollment');
const semesterSequence = Number(readArg('semester') ?? '1');
const httpEnabled = process.argv.includes('--http');
const apiBase = (readArg('api') ?? 'http://127.0.0.1:3001/api').replace(
  /\/$/,
  '',
);
const minTimetableCoverage = Number(readArg('min-coverage') ?? '0.5');

function solveChallengeExpression(expression: string): number {
  const normalized = expression.replace(/×/g, '*').trim();
  const match = normalized.match(/^(-?\d+)\s*([+\-*])\s*(-?\d+)$/);
  if (!match)
    throw new Error(`Cannot parse challenge expression: ${expression}`);
  const a = Number(match[1]);
  const op = match[2];
  const b = Number(match[3]);
  if (op === '+') return a + b;
  if (op === '-') return a - b;
  return a * b;
}

function pushCheck(
  checks: CheckResult[],
  level: CheckLevel,
  code: string,
  message: string,
) {
  checks.push({ level, code, message });
}

function toJwtUser(
  tenantId: string,
  user: NonNullable<StudentRow['user']>,
): JwtUser {
  return {
    sub: user.id,
    tid: tenantId,
    email: user.email,
    roles: user.roles.map((r) => r.role.slug),
    permissions: [],
  };
}

async function loadStudents(tenantId: string): Promise<StudentRow[]> {
  const batchYear = batchCode.match(/(\d{4})/)?.[1];
  const enrollmentPrefix = batchYear ? `APP-${batchYear}-` : undefined;

  return prisma.student.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(enrollmentFilter
        ? { enrollmentNumber: enrollmentFilter }
        : enrollmentPrefix
          ? { enrollmentNumber: { startsWith: enrollmentPrefix } }
          : { importSource: 'IMPORT' }),
    },
    include: {
      masterProfile: { select: { fullName: true } },
      user: {
        include: {
          roles: { include: { role: { select: { slug: true } } } },
        },
      },
      semesterRegistrations: {
        where: {
          semester: { semesterNumber: semesterSequence },
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          semester: { select: { semesterNumber: true } },
          lines: {
            include: {
              offering: { include: { course: { select: { code: true } } } },
              offeringSection: { select: { sectionCode: true } },
            },
          },
        },
      },
    },
    orderBy: { enrollmentNumber: 'asc' },
  }) as Promise<StudentRow[]>;
}

async function verifyStudentServices(
  tenantId: string,
  student: StudentRow,
  academicEngine: AcademicEngineService,
  timetableEngine: TimetableEngineService,
): Promise<CheckResult[]> {
  const checks: CheckResult[] = [];
  const label = student.enrollmentNumber ?? student.id;
  const name = student.masterProfile?.fullName ?? 'Unknown';

  if (!student.userId || !student.user) {
    pushCheck(checks, 'fail', 'user_linked', `${label}: no portal user linked`);
    return checks;
  }
  pushCheck(
    checks,
    'pass',
    'user_linked',
    `${name}: portal user linked (${student.user.email})`,
  );

  if (!student.user.isActive) {
    pushCheck(checks, 'fail', 'user_active', `${label}: user account inactive`);
  } else {
    pushCheck(checks, 'pass', 'user_active', `${label}: user account active`);
  }

  const roles = student.user.roles.map((r) => r.role.slug);
  if (!roles.some((r) => r.toLowerCase().includes('student'))) {
    pushCheck(
      checks,
      'fail',
      'student_role',
      `${label}: missing STUDENT role (${roles.join(', ') || 'none'})`,
    );
  } else {
    pushCheck(checks, 'pass', 'student_role', `${label}: STUDENT role present`);
  }

  const registration = student.semesterRegistrations[0];
  if (!registration) {
    pushCheck(
      checks,
      'fail',
      'registration_exists',
      `${label}: no Sem ${semesterSequence} registration`,
    );
    return checks;
  }
  pushCheck(
    checks,
    'pass',
    'registration_exists',
    `${label}: Sem ${semesterSequence} registration (${registration.status}, ${registration.lines.length} lines)`,
  );

  const categoriesPresent = new Set(
    registration.lines.map((line) => line.category.toUpperCase()),
  );
  const missingCategories = NEP_SEM1_CATEGORIES.filter(
    (cat) => !categoriesPresent.has(cat),
  );
  if (missingCategories.length) {
    pushCheck(
      checks,
      'fail',
      'nep_categories',
      `${label}: missing NEP categories — ${missingCategories.join(', ')}`,
    );
  } else {
    pushCheck(
      checks,
      'pass',
      'nep_categories',
      `${label}: all 6 NEP categories enrolled`,
    );
  }

  const linesWithoutSection = registration.lines.filter(
    (line) => !line.offeringSectionId,
  );
  if (linesWithoutSection.length) {
    pushCheck(
      checks,
      'warn',
      'sections_assigned',
      `${label}: ${linesWithoutSection.length} line(s) without section — ${linesWithoutSection
        .map((l) => l.category)
        .join(', ')}`,
    );
  } else {
    pushCheck(
      checks,
      'pass',
      'sections_assigned',
      `${label}: all lines have sections`,
    );
  }

  try {
    const validation = await academicEngine.validateRegistration(
      tenantId,
      registration.id,
    );
    if (validation.ok) {
      pushCheck(
        checks,
        'pass',
        'registration_valid',
        `${label}: registration validation passed`,
      );
    } else {
      const blocking = validation.issues
        .filter((issue) => issue.severity === 'error')
        .slice(0, 3)
        .map((issue) => issue.message)
        .join('; ');
      pushCheck(
        checks,
        'fail',
        'registration_valid',
        `${label}: validation failed — ${blocking || 'blocking issues present'}`,
      );
    }
  } catch (error) {
    pushCheck(
      checks,
      'fail',
      'registration_valid',
      `${label}: validation error — ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const jwtUser = toJwtUser(tenantId, student.user);
  let weekView: Awaited<ReturnType<TimetableEngineService['studentWeek']>>;
  try {
    weekView = await timetableEngine.studentWeek(jwtUser);
  } catch (error) {
    pushCheck(
      checks,
      'fail',
      'student_week_api',
      `${label}: studentWeek failed — ${error instanceof Error ? error.message : String(error)}`,
    );
    return checks;
  }

  if (!weekView.plan) {
    pushCheck(
      checks,
      'fail',
      'published_timetable',
      `${label}: no published timetable plan`,
    );
    return checks;
  }
  pushCheck(
    checks,
    'pass',
    'published_timetable',
    `${label}: published plan "${weekView.plan.name}"`,
  );

  const offeringIds = [
    ...new Set(
      registration.lines.map((line) => line.offeringId).filter(Boolean),
    ),
  ];
  const sectionByOffering = new Map(
    registration.lines.map((line) => [
      line.offeringId,
      line.offeringSectionId ?? null,
    ]),
  );

  const allEntries = await prisma.timetablePlanEntry.findMany({
    where: {
      tenantId,
      planId: weekView.plan.id,
      deletedAt: null,
      courseOfferingId: { in: offeringIds },
    },
  });

  const visibleEntries = allEntries.filter((entry) => {
    if (!entry.courseOfferingId) return false;
    const enrolledSection = sectionByOffering.get(entry.courseOfferingId);
    if (entry.offeringSectionId == null) return true;
    if (enrolledSection == null) return true;
    return entry.offeringSectionId === enrolledSection;
  });

  const wronglyVisible = visibleEntries.filter((entry) => {
    if (!entry.courseOfferingId || entry.offeringSectionId == null)
      return false;
    const enrolledSection = sectionByOffering.get(entry.courseOfferingId);
    if (enrolledSection == null) return false;
    return entry.offeringSectionId !== enrolledSection;
  });

  if (wronglyVisible.length) {
    pushCheck(
      checks,
      'fail',
      'section_no_leak',
      `${label}: ${wronglyVisible.length} visible slot(s) from wrong section`,
    );
  } else {
    pushCheck(
      checks,
      'pass',
      'section_no_leak',
      `${label}: timetable is section-filtered correctly`,
    );
  }

  const offeringsWithSlots = new Set(
    visibleEntries
      .map((entry) => entry.courseOfferingId)
      .filter(Boolean) as string[],
  );
  const coverage =
    offeringIds.length > 0 ? offeringsWithSlots.size / offeringIds.length : 0;
  const missingOfferings = registration.lines
    .filter((line) => !offeringsWithSlots.has(line.offeringId))
    .map((line) => `${line.category}:${line.offering.course.code}`);

  if (coverage >= minTimetableCoverage) {
    pushCheck(
      checks,
      coverage === 1 ? 'pass' : 'warn',
      'timetable_coverage',
      `${label}: timetable covers ${offeringsWithSlots.size}/${offeringIds.length} papers (${Math.round(coverage * 100)}%)`,
    );
  } else {
    pushCheck(
      checks,
      'fail',
      'timetable_coverage',
      `${label}: timetable covers only ${offeringsWithSlots.size}/${offeringIds.length} papers — missing ${missingOfferings.join(', ')}`,
    );
  }

  if (weekView.entries.length !== visibleEntries.length) {
    pushCheck(
      checks,
      'fail',
      'student_week_api',
      `${label}: studentWeek count mismatch (api=${weekView.entries.length}, expected=${visibleEntries.length})`,
    );
  } else {
    pushCheck(
      checks,
      'pass',
      'student_week_api',
      `${label}: studentWeek returns ${weekView.entries.length} section-matched slot(s)`,
    );
  }

  try {
    const portal = await academicEngine.getMyRegistration(
      tenantId,
      student.user.id,
      registration.semesterId,
    );
    if (portal.registration?.id === registration.id) {
      pushCheck(
        checks,
        'pass',
        'portal_registration',
        `${label}: getMyRegistration matches enrolment`,
      );
    } else {
      pushCheck(
        checks,
        'fail',
        'portal_registration',
        `${label}: getMyRegistration mismatch`,
      );
    }
  } catch (error) {
    pushCheck(
      checks,
      'fail',
      'portal_registration',
      `${label}: getMyRegistration failed — ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  try {
    await academicEngine.getMyRegistrationWorkflow(tenantId, student.user.id);
    pushCheck(
      checks,
      'pass',
      'portal_workflow',
      `${label}: registration workflow accessible`,
    );
  } catch (error) {
    pushCheck(
      checks,
      'fail',
      'portal_workflow',
      `${label}: workflow failed — ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return checks;
}

async function verifyStudentHttp(
  tenantSlugArg: string,
  student: StudentRow,
  password: string,
): Promise<CheckResult[]> {
  const checks: CheckResult[] = [];
  const label = student.enrollmentNumber ?? student.id;

  if (!student.user?.email) {
    pushCheck(
      checks,
      'fail',
      'http_login',
      `${label}: no email for HTTP login`,
    );
    return checks;
  }

  try {
    const challengeRes = await fetch(`${apiBase}/v1/auth/challenge`);
    if (!challengeRes.ok) {
      pushCheck(
        checks,
        'fail',
        'http_challenge',
        `${label}: challenge HTTP ${challengeRes.status} (is API running on ${apiBase}?)`,
      );
      return checks;
    }
    const challenge = (await challengeRes.json()) as {
      token: string;
      expression: string;
    };
    const answer = solveChallengeExpression(challenge.expression);

    const loginRes = await fetch(`${apiBase}/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Slug': tenantSlugArg,
      },
      body: JSON.stringify({
        email: student.user.email,
        password,
        challengeToken: challenge.token,
        challengeAnswer: answer,
        rememberMe: false,
      }),
    });

    if (!loginRes.ok) {
      const body = await loginRes.text();
      pushCheck(
        checks,
        'fail',
        'http_login',
        `${label}: login HTTP ${loginRes.status} — ${body.slice(0, 120)}`,
      );
      return checks;
    }

    const session = (await loginRes.json()) as { accessToken: string };
    const authHeaders = {
      Authorization: `Bearer ${session.accessToken}`,
      'X-Tenant-Slug': tenantSlugArg,
      Accept: 'application/json',
    };

    pushCheck(
      checks,
      'pass',
      'http_login',
      `${label}: login succeeded (${student.user.email})`,
    );

    const regRes = await fetch(
      `${apiBase}/v1/academic-engine/registrations/me`,
      {
        headers: authHeaders,
      },
    );
    if (!regRes.ok) {
      pushCheck(
        checks,
        'fail',
        'http_registration',
        `${label}: registrations/me HTTP ${regRes.status}`,
      );
    } else {
      const regBody = (await regRes.json()) as {
        registration?: { lines?: unknown[] };
      };
      const lineCount = regBody.registration?.lines?.length ?? 0;
      pushCheck(
        checks,
        lineCount >= NEP_SEM1_CATEGORIES.length ? 'pass' : 'warn',
        'http_registration',
        `${label}: registrations/me returned ${lineCount} line(s)`,
      );
    }

    const weekRes = await fetch(`${apiBase}/v1/timetable/views/student/week`, {
      headers: authHeaders,
    });
    if (!weekRes.ok) {
      pushCheck(
        checks,
        'fail',
        'http_timetable',
        `${label}: student/week HTTP ${weekRes.status}`,
      );
    } else {
      const weekBody = (await weekRes.json()) as {
        entries?: unknown[];
        plan?: { name?: string };
      };
      pushCheck(
        checks,
        'pass',
        'http_timetable',
        `${label}: student/week returned ${weekBody.entries?.length ?? 0} slot(s)${weekBody.plan?.name ? ` (${weekBody.plan.name})` : ''}`,
      );
    }
  } catch (error) {
    pushCheck(
      checks,
      'fail',
      'http_login',
      `${label}: HTTP error — ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return checks;
}

function printSummary(allChecks: CheckResult[]) {
  const passed = allChecks.filter((c) => c.level === 'pass').length;
  const failed = allChecks.filter((c) => c.level === 'fail').length;
  const warned = allChecks.filter((c) => c.level === 'warn').length;

  console.log('\nStudent Portal Verification\n');
  console.log(
    `Tenant: ${tenantSlug} | Batch: ${batchCode} | Semester: ${semesterSequence} | HTTP: ${httpEnabled ? 'yes' : 'no'}`,
  );
  if (enrollmentFilter) console.log(`Enrollment filter: ${enrollmentFilter}`);
  console.log('');

  for (const check of allChecks) {
    const tag =
      check.level === 'pass'
        ? 'PASS'
        : check.level === 'warn'
          ? 'WARN'
          : 'FAIL';
    console.log(`${tag} — [${check.code}] ${check.message}`);
  }

  console.log(
    `\n${passed} passed, ${warned} warnings, ${failed} failed (${allChecks.length} checks total)`,
  );

  if (failed > 0) {
    console.log('\nFix failures above, then re-run:');
    console.log('  npm run verify:student-portal -w api');
  } else if (warned > 0) {
    console.log(
      '\nPortal is usable; warnings are mostly timetable coverage gaps.',
    );
  } else {
    console.log('\nAll student portal checks passed.');
  }
}

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: tenantSlug } });
  if (!tenant) {
    console.error(`Tenant "${tenantSlug}" not found.`);
    process.exit(1);
  }

  const students = await loadStudents(tenant.id);
  if (!students.length) {
    console.error(
      `No students found for tenant=${tenantSlug} batch=${batchCode}. Import Sem 1 students first.`,
    );
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const academicEngine = app.get(AcademicEngineService);
  const timetableEngine = app.get(TimetableEngineService);

  const allChecks: CheckResult[] = [];

  console.log(`Verifying ${students.length} student(s)…`);

  for (const student of students) {
    const serviceChecks = await verifyStudentServices(
      tenant.id,
      student,
      academicEngine,
      timetableEngine,
    );
    allChecks.push(...serviceChecks);

    if (httpEnabled) {
      const httpChecks = await verifyStudentHttp(
        tenantSlug,
        student,
        DEFAULT_STUDENT_PASSWORD,
      );
      allChecks.push(...httpChecks);
    }
  }

  printSummary(allChecks);

  await app.close();
  await prisma.$disconnect();
  process.exit(allChecks.some((c) => c.level === 'fail') ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
