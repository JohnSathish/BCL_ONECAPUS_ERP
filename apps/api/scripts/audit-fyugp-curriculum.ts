/**
 * Audit DB curriculum vs finalized FYUGP Sem 1–6 catalogs.
 *   npx tsx scripts/audit-fyugp-curriculum.ts
 */
import { PrismaClient } from '@prisma/client';
import {
  DAY_SEM1_MDC_CODES,
  DAY_SEM1_AEC_CODES,
  DAY_SEM1_SEC_CODES,
  DAY_SEM1_VAC_CODES,
} from '../src/modules/academic-engine/domain/dbc-day-sem1-electives-catalog';
import {
  MORNING_SEM1_MDC_CODES,
  MORNING_SEM1_AEC_CODES,
  MORNING_SEM1_SEC_CODES,
  MORNING_SEM1_VAC_CODES,
} from '../src/modules/academic-engine/domain/dbc-morning-sem1-electives-catalog';
import {
  DAY_SEM2_MDC_CODES,
  DAY_SEM2_AEC_CODES,
  DAY_SEM2_SEC_CODES,
  DAY_SEM2_VAC_CODES,
} from '../src/modules/academic-engine/domain/dbc-day-sem2-electives-catalog';
import {
  MORNING_SEM2_MDC_CODES,
  MORNING_SEM2_AEC_CODES,
  MORNING_SEM2_SEC_CODES,
  MORNING_SEM2_VAC_CODES,
} from '../src/modules/academic-engine/domain/dbc-morning-sem2-electives-catalog';
import {
  DAY_SEM3_MDC_CODES,
  DAY_SEM3_AEC_CODES,
  DAY_SEM3_SEC_CODES,
  DAY_SEM3_VTC_CODES,
} from '../src/modules/academic-engine/domain/dbc-day-sem3-electives-catalog';
import {
  MORNING_SEM3_MDC_CODES,
  MORNING_SEM3_AEC_CODES,
  MORNING_SEM3_SEC_CODES,
  MORNING_SEM3_VTC_CODES,
} from '../src/modules/academic-engine/domain/dbc-morning-sem3-catalog';
import { DAY_SEM4_VTC_CODES } from '../src/modules/academic-engine/domain/dbc-sem4-vtc-electives-catalog';
import { DAY_SEM6_VTC_CODES } from '../src/modules/academic-engine/domain/dbc-day-sem6-vtc-electives-catalog';
import { MORNING_SEM6_VTC_CODES } from '../src/modules/academic-engine/domain/dbc-morning-sem6-vtc-electives-catalog';
import {
  buildCanonicalCourseCodeSet,
  CANONICAL_POOL_NAMES,
  poolCodesForName,
} from '../src/modules/academic-engine/domain/fyugp-canonical-catalog.util';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('demo tenant not found');

  const canonicalCodes = buildCanonicalCourseCodeSet();
  console.log(`Canonical course codes: ${canonicalCodes.size}`);

  const activeCourses = await prisma.course.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
    select: { id: true, code: true, title: true },
    orderBy: { code: 'asc' },
  });
  const obsoleteCourses = activeCourses.filter(
    (c) => !canonicalCodes.has(c.code),
  );
  console.log(`\n=== Obsolete active courses (${obsoleteCourses.length}) ===`);
  for (const c of obsoleteCourses.slice(0, 50)) {
    const offeringCount = await prisma.courseOffering.count({
      where: { courseId: c.id, deletedAt: null },
    });
    const regCount = await prisma.semesterRegistrationLine.count({
      where: {
        offering: { courseId: c.id },
        status: { in: ['confirmed', 'pending', 'waitlisted'] },
      },
    });
    console.log(
      `  ${c.code} | offerings=${offeringCount} regs=${regCount} | ${c.title}`,
    );
  }
  if (obsoleteCourses.length > 50)
    console.log(`  ... and ${obsoleteCourses.length - 50} more`);

  const activePools = await prisma.categoryPool.findMany({
    where: { tenantId: tenant.id, active: true },
    select: { id: true, poolName: true, semesterNo: true, categoryType: true },
    orderBy: [{ semesterNo: 'asc' }, { poolName: 'asc' }],
  });
  const legacyPools = activePools.filter(
    (p) => !CANONICAL_POOL_NAMES.has(p.poolName),
  );
  console.log(`\n=== Non-canonical active pools (${legacyPools.length}) ===`);
  for (const p of legacyPools) {
    console.log(`  ${p.poolName} (sem ${p.semesterNo}, ${p.categoryType})`);
  }

  const inactiveMembership = await prisma.categoryPoolCourse.findMany({
    where: {
      active: false,
      pool: {
        tenantId: tenant.id,
        active: true,
        poolName: { in: [...CANONICAL_POOL_NAMES] },
      },
    },
    include: {
      course: { select: { code: true } },
      pool: { select: { poolName: true } },
    },
    take: 20,
  });
  const staleOfferings = await prisma.courseOffering.findMany({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      mappingSource: 'SHARED_POOL',
      categoryPool: {
        active: true,
        poolName: { in: [...CANONICAL_POOL_NAMES] },
      },
      course: {
        code: {
          in: inactiveMembership.map((r) => r.course.code),
        },
      },
    },
    include: {
      course: { select: { code: true } },
      categoryPool: { select: { poolName: true } },
    },
    take: 30,
  });
  console.log(`\n=== Stale SHARED_POOL offerings (inactive membership) ===`);
  for (const o of staleOfferings) {
    const regs = await prisma.semesterRegistrationLine.count({
      where: {
        offeringId: o.id,
        status: { in: ['confirmed', 'pending', 'waitlisted'] },
      },
    });
    console.log(
      `  ${o.course.code} @ ${o.categoryPool?.poolName} regs=${regs}`,
    );
  }

  const extraActivePoolCourses = await prisma.categoryPoolCourse.findMany({
    where: {
      active: true,
      pool: {
        tenantId: tenant.id,
        active: true,
        poolName: { in: [...CANONICAL_POOL_NAMES] },
      },
    },
    include: {
      course: { select: { code: true } },
      pool: { select: { poolName: true } },
    },
  });
  const poolExtras: string[] = [];
  for (const row of extraActivePoolCourses) {
    const poolName = row.pool.poolName;
    const code = row.course.code;
    let allowed: readonly string[] = [];
    if (poolName === 'Day Shift Sem 1 MDC') allowed = DAY_SEM1_MDC_CODES;
    else if (poolName === 'Day Shift Sem 1 AEC') allowed = DAY_SEM1_AEC_CODES;
    else if (poolName === 'Day Shift Sem 1 SEC') allowed = DAY_SEM1_SEC_CODES;
    else if (poolName === 'Day Shift Sem 1 VAC') allowed = DAY_SEM1_VAC_CODES;
    else if (poolName === 'Morning Shift Sem 1 MDC')
      allowed = MORNING_SEM1_MDC_CODES;
    else if (poolName === 'Morning Shift Sem 1 AEC')
      allowed = MORNING_SEM1_AEC_CODES;
    else if (poolName === 'Morning Shift Sem 1 SEC')
      allowed = MORNING_SEM1_SEC_CODES;
    else if (poolName === 'Morning Shift Sem 1 VAC')
      allowed = MORNING_SEM1_VAC_CODES;
    else if (poolName === 'Day Shift Sem 2 MDC') allowed = DAY_SEM2_MDC_CODES;
    else if (poolName === 'Day Shift Sem 2 AEC') allowed = DAY_SEM2_AEC_CODES;
    else if (poolName === 'Day Shift Sem 2 SEC') allowed = DAY_SEM2_SEC_CODES;
    else if (poolName === 'Day Shift Sem 2 VAC') allowed = DAY_SEM2_VAC_CODES;
    else if (poolName === 'Morning Shift Sem 2 MDC')
      allowed = MORNING_SEM2_MDC_CODES;
    else if (poolName === 'Morning Shift Sem 2 AEC')
      allowed = MORNING_SEM2_AEC_CODES;
    else if (poolName === 'Morning Shift Sem 2 SEC')
      allowed = MORNING_SEM2_SEC_CODES;
    else if (poolName === 'Morning Shift Sem 2 VAC')
      allowed = MORNING_SEM2_VAC_CODES;
    else if (poolName === 'Day Shift Sem 3 MDC') allowed = DAY_SEM3_MDC_CODES;
    else if (poolName === 'Day Shift Sem 3 AEC') allowed = DAY_SEM3_AEC_CODES;
    else if (poolName === 'Day Shift Sem 3 SEC') allowed = DAY_SEM3_SEC_CODES;
    else if (poolName === 'Day Shift Sem 3 VTC') allowed = DAY_SEM3_VTC_CODES;
    else if (poolName === 'Morning Shift Sem 3 MDC')
      allowed = MORNING_SEM3_MDC_CODES;
    else if (poolName === 'Morning Shift Sem 3 AEC')
      allowed = MORNING_SEM3_AEC_CODES;
    else if (poolName === 'Morning Shift Sem 3 SEC')
      allowed = MORNING_SEM3_SEC_CODES;
    else if (poolName === 'Morning Shift Sem 3 VTC')
      allowed = MORNING_SEM3_VTC_CODES;
    else if (
      poolName === 'Day Shift Sem 4 VTC' ||
      poolName === 'Morning Shift Sem 4 VTC'
    )
      allowed = DAY_SEM4_VTC_CODES;
    else if (poolName === 'Day Shift Sem 6 VTC') allowed = DAY_SEM6_VTC_CODES;
    else if (poolName === 'Morning Shift Sem 6 VTC')
      allowed = MORNING_SEM6_VTC_CODES;

    if (allowed.length && !allowed.includes(code as never)) {
      poolExtras.push(`${poolName}: ${code}`);
    }
  }
  console.log(
    `\n=== Extra active courses in canonical pools (${poolExtras.length}) ===`,
  );
  for (const e of poolExtras) console.log(`  ${e}`);

  const regsOnObsolete = await prisma.semesterRegistrationLine.count({
    where: {
      status: { in: ['confirmed', 'pending', 'waitlisted'] },
      offering: {
        course: { code: { notIn: [...canonicalCodes] }, deletedAt: null },
        deletedAt: null,
      },
    },
  });
  console.log(
    `\n=== Active registrations on non-canonical courses: ${regsOnObsolete} ===`,
  );

  const settings = await prisma.tenantAcademicSettings.findUnique({
    where: { tenantId: tenant.id },
    select: { nepProfile: true },
  });
  const profile = (settings?.nepProfile as Record<string, unknown>) ?? {};
  const excluded = Array.isArray(profile.excludedCourseCodes)
    ? profile.excludedCourseCodes.length
    : 0;
  console.log(`\nSeed exclusions: ${excluded} course codes already excluded`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
