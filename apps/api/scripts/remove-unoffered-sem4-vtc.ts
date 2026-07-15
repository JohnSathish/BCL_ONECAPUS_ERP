/**
 * Remove Sem-4 VTC Stage-II courses the college does NOT offer
 * (Traditional Music – II / VTC-265.5 and Beauty Care – II / VTC-267.1),
 * along with their pool memberships and offerings/sections/seat ledgers.
 *
 * Refuses to delete anything a student is registered in. Idempotent.
 *
 *   npx ts-node -r tsconfig-paths/register scripts/remove-unoffered-sem4-vtc.ts --dry-run
 *   npx ts-node -r tsconfig-paths/register scripts/remove-unoffered-sem4-vtc.ts
 */
import { PrismaClient } from '@prisma/client';

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

const dryRun = process.argv.includes('--dry-run');
const tenantSlug = readArg('tenant') ?? 'demo';
const CODES_TO_REMOVE = ['VTC-265.5', 'VTC-267.1'];
const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: tenantSlug, deletedAt: null },
    select: { id: true, slug: true },
  });
  if (!tenant) throw new Error(`Tenant not found: ${tenantSlug}`);
  const tenantId = tenant.id;

  console.log(
    `\nRemove un-offered Sem-4 VTC — tenant=${tenant.slug}${dryRun ? '  (DRY RUN)' : ''}\n`,
  );

  const stats = {
    coursesRemoved: 0,
    offeringsRemoved: 0,
    membershipsRemoved: 0,
    notFound: [] as string[],
    blocked: [] as string[],
  };

  for (const code of CODES_TO_REMOVE) {
    const course = await prisma.course.findFirst({
      where: { tenantId, code },
      select: { id: true, code: true, title: true },
    });
    if (!course) {
      stats.notFound.push(code);
      continue;
    }

    const offerings = await prisma.courseOffering.findMany({
      where: { tenantId, courseId: course.id },
      select: { id: true },
    });
    const offeringIds = offerings.map((o) => o.id);

    // Safety: never remove something a student is registered in.
    const regLines = offeringIds.length
      ? await prisma.semesterRegistrationLine.count({
          where: { tenantId, offeringId: { in: offeringIds } },
        })
      : 0;
    if (regLines > 0) {
      stats.blocked.push(`${code} (${regLines} registration line(s))`);
      continue;
    }

    console.log(
      `  - remove ${course.code} "${course.title}" ` +
        `(${offeringIds.length} offering(s))`,
    );

    if (!dryRun) {
      await prisma.categoryPoolCourse.deleteMany({
        where: { courseId: course.id },
      });
      // Cascade deletes sections + seat ledgers via schema onDelete: Cascade.
      await prisma.courseOffering.deleteMany({
        where: { tenantId, courseId: course.id },
      });
      await prisma.course.delete({ where: { id: course.id } });
    }

    stats.coursesRemoved++;
    stats.offeringsRemoved += offeringIds.length;
  }

  console.log('\nSummary');
  console.log(JSON.stringify(stats, null, 2));

  // Post-state: show remaining Sem-4 VTC pool sizes.
  for (const poolName of ['Day Shift Sem 4 VTC', 'Morning Shift Sem 4 VTC']) {
    const pool = await prisma.categoryPool.findFirst({
      where: { tenantId, poolName, active: true },
      include: { courses: { where: { active: true } } },
    });
    if (pool) console.log(`${poolName}: ${pool.courses.length} course(s)`);
  }

  if (dryRun) console.log('\nDry run — no rows deleted.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
