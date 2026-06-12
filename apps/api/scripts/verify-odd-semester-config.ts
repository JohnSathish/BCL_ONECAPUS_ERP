/**
 * Verifies ODD-semester configuration for batches 2024/2025/2026 and curriculum sem 1/3/5.
 * Run: npx ts-node --transpile-only scripts/verify-odd-semester-config.ts
 */
import { PrismaClient } from '@prisma/client';

const ODD_SEMESTERS = [1, 3, 5] as const;
const BATCH_EXPECTATIONS = [
  { code: 'BATCH-2024', semester: 5 },
  { code: 'BATCH-2025', semester: 3 },
  { code: 'BATCH-2026', semester: 1 },
] as const;

const prisma = new PrismaClient();

type CheckResult = { ok: boolean; message: string };

async function countCurriculumByCategory(
  tenantId: string,
  programVersionId: string,
  semesterSequence: number,
): Promise<Record<string, number>> {
  const offeringCounts: Record<string, number> = {};

  const direct = await prisma.courseOffering.findMany({
    where: {
      tenantId,
      programVersionId,
      semesterSequence,
      deletedAt: null,
      mappingSource: 'DIRECT',
    },
    select: { category: true },
  });
  for (const o of direct) {
    const cat = (o.category ?? '').toUpperCase();
    if (cat) offeringCounts[cat] = (offeringCounts[cat] ?? 0) + 1;
  }

  const assignments = await prisma.programmePoolAssignment.findMany({
    where: {
      tenantId,
      programVersionId,
      semesterNo: semesterSequence,
      active: true,
      pool: { active: true },
    },
    select: { poolId: true },
  });
  const poolIds = assignments.map((a) => a.poolId);
  if (!poolIds.length) return offeringCounts;

  const exclusions = await prisma.programmePoolCourseExclusion.findMany({
    where: {
      tenantId,
      programVersionId,
      poolId: { in: poolIds },
      active: true,
    },
    select: { poolId: true, courseId: true },
  });
  const excluded = new Map<string, Set<string>>();
  for (const row of exclusions) {
    const set = excluded.get(row.poolId) ?? new Set<string>();
    set.add(row.courseId);
    excluded.set(row.poolId, set);
  }

  const poolOfferings = await prisma.courseOffering.findMany({
    where: {
      tenantId,
      deletedAt: null,
      mappingSource: 'SHARED_POOL',
      categoryPoolId: { in: poolIds },
      semesterSequence,
    },
    select: { category: true, categoryPoolId: true, courseId: true },
  });

  for (const o of poolOfferings) {
    if (!o.categoryPoolId) continue;
    if (excluded.get(o.categoryPoolId)?.has(o.courseId)) continue;
    const cat = (o.category ?? '').toUpperCase();
    if (cat) offeringCounts[cat] = (offeringCounts[cat] ?? 0) + 1;
  }

  return offeringCounts;
}

async function main() {
  const results: CheckResult[] = [];

  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) {
    console.error('Demo tenant not found. Run db:seed first.');
    process.exit(1);
  }

  const config = await prisma.institutionAcademicConfig.findFirst({
    where: { tenantId: tenant.id },
  });
  results.push({
    ok: config?.currentCycle === 'ODD',
    message: `Institution currentCycle is ODD (actual: ${config?.currentCycle ?? 'none'})`,
  });

  for (const semNum of ODD_SEMESTERS) {
    const sem = await prisma.semester.findFirst({
      where: {
        tenantId: tenant.id,
        semesterNumber: semNum,
        deletedAt: null,
      },
    });
    results.push({
      ok: Boolean(
        sem?.status === 'ACTIVE' && sem.isActive && sem.registrationOpen,
      ),
      message: `Semester ${semNum} ACTIVE with registrationOpen (status=${sem?.status}, open=${sem?.registrationOpen})`,
    });
  }

  for (const batch of BATCH_EXPECTATIONS) {
    const row = await prisma.admissionBatch.findFirst({
      where: { tenantId: tenant.id, batchCode: batch.code, deletedAt: null },
      include: { semesterMapping: true },
    });
    results.push({
      ok: row?.currentSemester === batch.semester && row.isActive === true,
      message: `${batch.code} currentSemester=${row?.currentSemester ?? 'missing'} (expected ${batch.semester})`,
    });
    results.push({
      ok: row?.semesterMapping?.semesterNumber === batch.semester,
      message: `${batch.code} batch mapping semester=${row?.semesterMapping?.semesterNumber ?? 'missing'}`,
    });
  }

  const programVersion = await prisma.programVersion.findFirst({
    where: { tenantId: tenant.id, deletedAt: null, status: 'PUBLISHED' },
  });

  if (programVersion) {
    for (const semNum of ODD_SEMESTERS) {
      const rule = await prisma.semesterStructureRule.findFirst({
        where: {
          programVersionId: programVersion.id,
          semesterSequence: semNum,
        },
      });
      const counts = (rule?.categoryCounts ?? {}) as Record<string, number>;

      const offeringCounts = await countCurriculumByCategory(
        tenant.id,
        programVersion.id,
        semNum,
      );

      let semOk = true;
      for (const [cat, expected] of Object.entries(counts)) {
        const actual = offeringCounts[cat] ?? 0;
        if (actual < expected) {
          semOk = false;
          results.push({
            ok: false,
            message: `Sem ${semNum} ${cat}: need ≥${expected} offerings, found ${actual}`,
          });
        }
      }
      if (semOk) {
        results.push({
          ok: true,
          message: `Sem ${semNum} curriculum offerings (direct + pool) satisfy structure rule`,
        });
      }
    }
  } else {
    results.push({ ok: false, message: 'No published program version found' });
  }

  const failed = results.filter((r) => !r.ok);
  console.log('\nODD Semester Configuration Verification\n');
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'} — ${r.message}`);
  }
  console.log(
    `\n${results.length - failed.length}/${results.length} checks passed`,
  );
  await prisma.$disconnect();
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
