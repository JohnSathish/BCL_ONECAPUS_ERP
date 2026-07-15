/**
 * Fix Semester 4 VTC catalog: replace the wrongly reused Stage-I courses
 * (VTC-24x, "– I") with the correct NEHU Stage-II courses (VTC-26x, "– II"),
 * and tag every VTC course (Sem 3/4/6) with a stable track group + stage so
 * promotion continuity (e.g. Desktop Publishing-I -> II -> III) is reliable.
 *
 * Idempotent. Safe to re-run. Nothing is enrolled in Sem-4 VTC yet.
 *
 * Usage (from apps/api):
 *   npx ts-node -r tsconfig-paths/register scripts/fix-sem4-vtc-stage2.ts --dry-run
 *   npx ts-node -r tsconfig-paths/register scripts/fix-sem4-vtc-stage2.ts
 *   npx ts-node -r tsconfig-paths/register scripts/fix-sem4-vtc-stage2.ts --tenant=demo
 */
import { PrismaClient } from '@prisma/client';

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

const dryRun = process.argv.includes('--dry-run');
const tenantSlug = readArg('tenant') ?? 'demo';
const prisma = new PrismaClient();

type Vocation = {
  group: string;
  /** Sem 3 Stage-I course code (already present). */
  stage1: string;
  /** Sem 4 Stage-II course code (created if missing). */
  stage2: string;
  stage2Title: string;
  /** Sem 6 Stage-III course code (already present) — tagged only. */
  stage3?: string;
};

const VOCATIONS: Vocation[] = [
  {
    group: 'BEE_KEEPING',
    stage1: 'VTC-240.3',
    stage2: 'VTC-260.3',
    stage2Title: 'Bee Keeping – II',
    stage3: 'VTC-360.3',
  },
  {
    group: 'MUSHROOM_CULTIVATION',
    stage1: 'VTC-241.2',
    stage2: 'VTC-261.2',
    stage2Title: 'Mushroom Cultivation – II',
    stage3: 'VTC-361.2',
  },
  {
    group: 'ELECTRICAL',
    stage1: 'VTC-242.2',
    stage2: 'VTC-262.2',
    stage2Title: 'Electrical – II',
    stage3: 'VTC-362.2',
  },
  {
    group: 'WEB_DESIGNING',
    stage1: 'VTC-243.1',
    stage2: 'VTC-263.1',
    stage2Title: 'Web Designing – II',
    stage3: 'VTC-363.1',
  },
  {
    group: 'DESKTOP_PUBLISHING',
    stage1: 'VTC-243.2',
    stage2: 'VTC-263.2',
    stage2Title: 'Desktop Publishing – II',
    stage3: 'VTC-363.2',
  },
  {
    group: 'COMPUTERIZED_ACCOUNTING',
    stage1: 'VTC-243.3',
    stage2: 'VTC-263.3',
    stage2Title: 'Computerized Accounting – II',
    stage3: 'VTC-363.3',
  },
  {
    group: 'EVENT_MANAGEMENT',
    stage1: 'VTC-244.2',
    stage2: 'VTC-264.2',
    stage2Title: 'Event Management – II',
    stage3: 'VTC-364.2',
  },
  {
    group: 'GUITAR',
    stage1: 'VTC-245.3',
    stage2: 'VTC-265.3',
    stage2Title: 'Guitar – II',
    stage3: 'VTC-365.3',
  },
  {
    group: 'VOCALS',
    stage1: 'VTC-245.4',
    stage2: 'VTC-265.4',
    stage2Title: 'Vocals – II',
    stage3: 'VTC-365.4',
  },
  {
    group: 'BAKING_CONFECTIONERY',
    stage1: 'VTC-246.1',
    stage2: 'VTC-266.1',
    stage2Title: 'Baking and Confectionery – II',
    stage3: 'VTC-366.1',
  },
  {
    group: 'PHOTOGRAPHY',
    stage1: 'VTC-248.1',
    stage2: 'VTC-269.1',
    stage2Title: 'Photography – II',
    stage3: 'VTC-369.1',
  },
  // Traditional Music (VTC-245.5) and Beauty Care (VTC-247.1) are NOT offered
  // in Sem 4 — no Stage-II course. See remove-unoffered-sem4-vtc.ts.
];

const SEM4_POOL_NAMES = ['Day Shift Sem 4 VTC', 'Morning Shift Sem 4 VTC'];

const stats = {
  stage2Created: 0,
  stage2Existing: 0,
  coursesTagged: 0,
  offeringsRepointed: 0,
  offeringsCreated: 0,
  membershipsRepointed: 0,
  membershipsCreated: 0,
  sectionsCreated: 0,
  warnings: [] as string[],
};

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: tenantSlug, deletedAt: null },
    select: { id: true, slug: true, name: true },
  });
  if (!tenant) throw new Error(`Tenant not found: ${tenantSlug}`);
  const tenantId = tenant.id;

  console.log(
    `\nFix Sem-4 VTC Stage-II — tenant=${tenant.slug}${dryRun ? '  (DRY RUN — no writes)' : ''}\n`,
  );

  // ---- 1. Ensure Stage-II courses exist + tag every stage ----------------
  const stage2IdByGroup = new Map<string, string>();

  for (const v of VOCATIONS) {
    const stage1 = await prisma.course.findFirst({
      where: { tenantId, code: v.stage1, deletedAt: null },
    });
    if (!stage1) {
      stats.warnings.push(
        `Stage-I course ${v.stage1} not found — skipping ${v.group}`,
      );
      continue;
    }

    // Tag Stage-I (stage 1) + Stage-III (stage 3) with the shared group.
    await tagCourse(stage1.id, v.group, 1);
    if (v.stage3) {
      const stage3 = await prisma.course.findFirst({
        where: { tenantId, code: v.stage3, deletedAt: null },
      });
      if (stage3) await tagCourse(stage3.id, v.group, 3);
      else
        stats.warnings.push(
          `Stage-III course ${v.stage3} not found (${v.group})`,
        );
    }

    // Create/refresh Stage-II course by cloning Stage-I academic attributes.
    const existing = await prisma.course.findFirst({
      where: { tenantId, code: v.stage2, deletedAt: null },
    });
    if (existing) {
      stats.stage2Existing++;
      stage2IdByGroup.set(v.group, existing.id);
      await tagCourse(existing.id, v.group, 2, {
        title: v.stage2Title,
        status: 'ACTIVE',
      });
    } else {
      stats.stage2Created++;
      console.log(`  + create ${v.stage2}  "${v.stage2Title}"  [${v.group}]`);
      if (!dryRun) {
        const created = await prisma.course.create({
          data: {
            tenantId,
            departmentId: stage1.departmentId,
            code: v.stage2,
            title: v.stage2Title,
            credits: stage1.credits,
            deliveryType: stage1.deliveryType,
            creditCalculationMode: stage1.creditCalculationMode,
            requiresTheorySplit: stage1.requiresTheorySplit,
            requiresPracticalSplit: stage1.requiresPracticalSplit,
            attendanceMode: stage1.attendanceMode,
            labRequired: stage1.labRequired,
            requiresTimetableSlots: stage1.requiresTimetableSlots,
            hasPractical: stage1.hasPractical,
            examPaperType: stage1.examPaperType,
            theoryCredits: stage1.theoryCredits,
            practicalCredits: stage1.practicalCredits,
            theoryHoursPerWeek: stage1.theoryHoursPerWeek,
            practicalHoursPerWeek: stage1.practicalHoursPerWeek,
            totalTheoryContactHours: stage1.totalTheoryContactHours,
            totalPracticalContactHours: stage1.totalPracticalContactHours,
            totalContactHours: stage1.totalContactHours,
            courseType: stage1.courseType,
            subjectSlug: stage1.subjectSlug,
            isMandatoryVac: stage1.isMandatoryVac,
            eligibilityRules: stage1.eligibilityRules ?? {},
            description: stage1.description,
            status: 'ACTIVE',
            syllabusVersion: stage1.syllabusVersion,
            vtcTrackGroupCode: v.group,
            vtcTrackStage: 2,
          },
        });
        stage2IdByGroup.set(v.group, created.id);
      }
    }
  }

  // ---- 2. Re-point Sem-4 pools/offerings to the Stage-II courses ---------
  for (const poolName of SEM4_POOL_NAMES) {
    const pool = await prisma.categoryPool.findFirst({
      where: { tenantId, poolName, active: true },
    });
    if (!pool) {
      stats.warnings.push(`Pool "${poolName}" not found`);
      continue;
    }
    console.log(`\n  Pool: ${poolName}`);

    let nextOrder =
      ((
        await prisma.categoryPoolCourse.aggregate({
          where: { poolId: pool.id },
          _max: { displayOrder: true },
        })
      )._max.displayOrder ?? -1) + 1;

    for (const v of VOCATIONS) {
      const stage1 = await prisma.course.findFirst({
        where: { tenantId, code: v.stage1, deletedAt: null },
        select: { id: true },
      });
      const stage2Id =
        stage2IdByGroup.get(v.group) ??
        (
          await prisma.course.findFirst({
            where: { tenantId, code: v.stage2, deletedAt: null },
            select: { id: true },
          })
        )?.id;
      if (!stage2Id) {
        stats.warnings.push(
          `No Stage-II course id for ${v.group} — skip in pool`,
        );
        continue;
      }

      const order = await repointPoolMembership(
        pool.id,
        stage1?.id ?? null,
        stage2Id,
        nextOrder,
      );
      if (order === nextOrder) nextOrder++;

      await repointOffering(
        tenantId,
        pool.id,
        pool.shiftId,
        stage1?.id ?? null,
        stage2Id,
        order,
      );
    }
  }

  // ---- 3. Report ---------------------------------------------------------
  console.log('\nSummary');
  console.log(JSON.stringify(stats, null, 2));

  // Post-state (read-only)
  for (const poolName of SEM4_POOL_NAMES) {
    const pool = await prisma.categoryPool.findFirst({
      where: { tenantId, poolName, active: true },
      include: {
        courses: {
          where: { active: true },
          include: {
            course: {
              select: { code: true, title: true, vtcTrackStage: true },
            },
          },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });
    if (!pool) continue;
    console.log(`\n${poolName} now:`);
    for (const row of pool.courses) {
      console.log(
        `  ${row.course.code}  ${row.course.title}  (stage ${row.course.vtcTrackStage ?? '-'})`,
      );
    }
  }

  if (dryRun)
    console.log(
      '\nDry run — no rows written. Re-run without --dry-run to apply.',
    );
}

async function tagCourse(
  courseId: string,
  group: string,
  stage: number,
  extra?: { title?: string; status?: string },
) {
  stats.coursesTagged++;
  if (dryRun) return;
  await prisma.course.update({
    where: { id: courseId },
    data: {
      vtcTrackGroupCode: group,
      vtcTrackStage: stage,
      ...(extra?.title ? { title: extra.title } : {}),
      ...(extra?.status ? { status: extra.status } : {}),
    },
  });
}

/** Ensure the pool contains stage2 (not stage1). Returns the display order used. */
async function repointPoolMembership(
  poolId: string,
  stage1Id: string | null,
  stage2Id: string,
  fallbackOrder: number,
): Promise<number> {
  const stage2Member = await prisma.categoryPoolCourse.findUnique({
    where: { poolId_courseId: { poolId, courseId: stage2Id } },
  });
  const stage1Member = stage1Id
    ? await prisma.categoryPoolCourse.findUnique({
        where: { poolId_courseId: { poolId, courseId: stage1Id } },
      })
    : null;

  if (stage2Member) {
    // Already re-pointed on a prior run; drop any stale stage1 membership.
    if (stage1Member && !dryRun) {
      await prisma.categoryPoolCourse.delete({
        where: { id: stage1Member.id },
      });
    }
    return stage2Member.displayOrder ?? fallbackOrder;
  }

  if (stage1Member) {
    stats.membershipsRepointed++;
    if (!dryRun) {
      await prisma.categoryPoolCourse.update({
        where: { id: stage1Member.id },
        data: { courseId: stage2Id },
      });
    }
    return stage1Member.displayOrder ?? fallbackOrder;
  }

  // Missing vocation (Traditional Music / Beauty Care) — add fresh membership.
  stats.membershipsCreated++;
  if (!dryRun) {
    await prisma.categoryPoolCourse.create({
      data: {
        poolId,
        courseId: stage2Id,
        displayOrder: fallbackOrder,
        active: true,
      },
    });
  }
  return fallbackOrder;
}

/** Ensure a SHARED_POOL offering (+section+ledger) exists for stage2 in this pool. */
async function repointOffering(
  tenantId: string,
  poolId: string,
  shiftId: string | null,
  stage1Id: string | null,
  stage2Id: string,
  displayOrder: number,
) {
  const stage2Offering = await prisma.courseOffering.findUnique({
    where: {
      categoryPoolId_courseId: { categoryPoolId: poolId, courseId: stage2Id },
    },
  });
  const stage1Offering = stage1Id
    ? await prisma.courseOffering.findUnique({
        where: {
          categoryPoolId_courseId: {
            categoryPoolId: poolId,
            courseId: stage1Id,
          },
        },
      })
    : null;

  if (stage2Offering) {
    if (stage2Offering.deletedAt && !dryRun) {
      await prisma.courseOffering.update({
        where: { id: stage2Offering.id },
        data: { deletedAt: null },
      });
    }
    if (stage1Offering && !dryRun) {
      await prisma.courseOffering.update({
        where: { id: stage1Offering.id },
        data: { deletedAt: new Date() },
      });
    }
    return;
  }

  if (stage1Offering) {
    // Re-point in place; keeps the existing section + seat ledger attached.
    stats.offeringsRepointed++;
    if (!dryRun) {
      await prisma.courseOffering.update({
        where: { id: stage1Offering.id },
        data: {
          courseId: stage2Id,
          semesterSequence: 4,
          category: 'VTC',
          displayOrder,
          deletedAt: null,
        },
      });
    }
    return;
  }

  // New offering for a missing vocation — create offering + section + ledger.
  stats.offeringsCreated++;
  if (dryRun) return;
  if (!shiftId) {
    stats.warnings.push(
      `Pool ${poolId} has no shiftId — cannot create section`,
    );
    return;
  }
  const offering = await prisma.courseOffering.create({
    data: {
      tenantId,
      categoryPoolId: poolId,
      mappingSource: 'SHARED_POOL',
      courseId: stage2Id,
      semesterSequence: 4,
      category: 'VTC',
      displayOrder,
      programVersionId: null,
      capacity: 200,
    },
  });
  const section = await prisma.offeringSection.create({
    data: {
      tenantId,
      courseOfferingId: offering.id,
      shiftId,
      sectionCode: 'A',
      capacity: 200,
      status: 'active',
    },
  });
  stats.sectionsCreated++;
  await prisma.offeringSeatLedger.create({
    data: {
      offeringSectionId: section.id,
      tenantId,
      confirmedCount: 0,
      waitlistCount: 0,
    },
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
