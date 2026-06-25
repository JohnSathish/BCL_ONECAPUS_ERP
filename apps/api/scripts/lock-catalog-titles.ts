/**
 * Lock all current course titles so db seed never overwrites them again.
 * Run once after correcting titles in the UI (local + live after deploy).
 *
 *   npx tsx scripts/lock-catalog-titles.ts
 *   npx tsx scripts/lock-catalog-titles.ts --tenant=demo
 */
import { PrismaClient } from '@prisma/client';
import { mergeCatalogSeedExclusions } from '../src/common/services/catalog-seed-exclusions.util';
import { buildArtsFyugpOddCourses } from '../src/modules/academic-engine/domain/arts-fyugp-odd-catalog';

const prisma = new PrismaClient();

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

async function main() {
  const tenantSlug = readArg('tenant') ?? 'demo';
  const tenant = await prisma.tenant.findFirst({ where: { slug: tenantSlug } });
  if (!tenant) throw new Error(`Tenant "${tenantSlug}" not found`);

  const artsCodes = buildArtsFyugpOddCourses().map((c) => c.code);
  const allCourses = await prisma.course.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
    select: { code: true, title: true },
    orderBy: { code: 'asc' },
  });

  const codes = [...new Set([...artsCodes, ...allCourses.map((c) => c.code)])];

  await mergeCatalogSeedExclusions(prisma, tenant.id, {
    catalogCustomizedCourseCodes: codes,
  });

  console.log(
    `Locked ${codes.length} course title(s) for tenant "${tenantSlug}".`,
  );
  console.log('Future Arts FYUGP seed runs will preserve existing titles.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
