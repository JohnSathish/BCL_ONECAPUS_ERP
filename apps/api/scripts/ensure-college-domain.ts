/**
 * Ensure apex college website hosts are registered on the DBC tenant.
 *
 *   npx tsx scripts/ensure-college-domain.ts --tenant=demo
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const tenantSlug =
  process.argv
    .find((arg) => arg.startsWith('--tenant='))
    ?.slice('--tenant='.length) || 'demo';

const HOSTS = ['donboscocollege.ac.in', 'www.donboscocollege.ac.in'] as const;

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: tenantSlug, deletedAt: null },
  });
  if (!tenant) {
    throw new Error(`Tenant not found: ${tenantSlug}`);
  }

  for (const host of HOSTS) {
    await prisma.tenantDomain.upsert({
      where: { host },
      update: { tenantId: tenant.id, verified: true, deletedAt: null },
      create: { tenantId: tenant.id, host, verified: true },
    });
    console.log(`OK  ${host} → tenant ${tenant.slug} (${tenant.id})`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
