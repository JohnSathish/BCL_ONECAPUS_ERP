/**
 * Bulk-update shared pool offering + section capacities to the tenant default (200 by default).
 * Only touches rows still at legacy default (40). Skips lab courses and honours sections.
 *
 * Run:
 *   npx ts-node --transpile-only scripts/update-shared-pool-capacities.ts
 *   npx ts-node --transpile-only scripts/update-shared-pool-capacities.ts --tenant=demo
 *   npx ts-node --transpile-only scripts/update-shared-pool-capacities.ts --dry-run
 */
import { PrismaClient } from '@prisma/client';
import {
  DEFAULT_SHARED_POOL_SECTION_CAPACITY,
  readSharedPoolCapacityFromPolicy,
  SHARED_POOL_CAPACITY_CATEGORIES,
} from '../src/modules/academic-engine/domain/section-capacity';

const prisma = new PrismaClient();

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

async function main() {
  const tenantSlug = readArg('tenant');
  const dryRun = process.argv.includes('--dry-run');

  const tenant = tenantSlug
    ? await prisma.tenant.findFirst({ where: { slug: tenantSlug } })
    : null;

  if (tenantSlug && !tenant) {
    throw new Error(`Tenant not found: ${tenantSlug}`);
  }

  const settings = tenant
    ? await prisma.tenantAcademicSettings.findUnique({
        where: { tenantId: tenant.id },
        select: { creditPolicy: true },
      })
    : null;

  const targetCapacity = tenant
    ? readSharedPoolCapacityFromPolicy(settings?.creditPolicy)
    : DEFAULT_SHARED_POOL_SECTION_CAPACITY;

  const categories = [...SHARED_POOL_CAPACITY_CATEGORIES];
  const tenantFilter = tenant ? { tenantId: tenant.id } : {};

  const offerings = await prisma.courseOffering.findMany({
    where: {
      ...tenantFilter,
      deletedAt: null,
      mappingSource: 'SHARED_POOL',
      category: { in: categories },
      capacity: 40,
      course: { labRequired: false },
    },
    select: { id: true, category: true, course: { select: { code: true } } },
  });

  const sections = await prisma.offeringSection.findMany({
    where: {
      ...tenantFilter,
      deletedAt: null,
      capacity: 40,
      OR: [
        { studentGroup: null },
        { studentGroup: { notIn: ['Honours', 'HONOURS', 'HONOR', 'HONORS'] } },
      ],
      courseOffering: {
        deletedAt: null,
        mappingSource: 'SHARED_POOL',
        category: { in: categories },
        course: { labRequired: false },
      },
    },
    select: {
      id: true,
      sectionCode: true,
      courseOffering: {
        select: { category: true, course: { select: { code: true } } },
      },
    },
  });

  console.log(`Target capacity: ${targetCapacity}`);
  console.log(`Offerings to update: ${offerings.length}`);
  console.log(`Sections to update: ${sections.length}`);

  if (dryRun) {
    for (const row of offerings.slice(0, 10)) {
      console.log(`  offering ${row.course.code} (${row.category})`);
    }
    for (const row of sections.slice(0, 10)) {
      console.log(
        `  section ${row.courseOffering.course.code} · ${row.sectionCode} (${row.courseOffering.category})`,
      );
    }
    return;
  }

  if (offerings.length) {
    await prisma.courseOffering.updateMany({
      where: { id: { in: offerings.map((o) => o.id) } },
      data: { capacity: targetCapacity },
    });
  }

  if (sections.length) {
    await prisma.offeringSection.updateMany({
      where: { id: { in: sections.map((s) => s.id) } },
      data: { capacity: targetCapacity },
    });
  }

  console.log('Done.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
