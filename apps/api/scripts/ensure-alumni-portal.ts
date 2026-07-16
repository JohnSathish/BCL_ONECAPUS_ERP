/**
 * Ensure alumni portal tenant domains exist.
 *
 *   npx tsx scripts/ensure-alumni-portal.ts
 *   npx tsx scripts/ensure-alumni-portal.ts --tenant=demo
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

const tenantSlug = readArg('tenant') ?? 'demo';
const ALUMNI_HOSTS = ['alumni.demo.localhost', 'alumni.donboscocollege.ac.in'];

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: tenantSlug, deletedAt: null },
  });
  if (!tenant) throw new Error(`Tenant not found: ${tenantSlug}`);

  for (const host of ALUMNI_HOSTS) {
    await prisma.tenantDomain.upsert({
      where: { host },
      update: { tenantId: tenant.id, verified: true, deletedAt: null },
      create: { tenantId: tenant.id, host, verified: true },
    });
    console.log(`✓ Domain registered: ${host}`);
  }

  console.log(`✓ Alumni portal hosts configured for tenant "${tenantSlug}"`);
  console.log(
    '  Local preview: http://alumni.demo.localhost:3000 (hosts file → 127.0.0.1)',
  );
  console.log('  Or path: http://localhost:3000/alumni-portal');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
