/**
 * Ensure pay.* fee collection portal tenant domains exist.
 *
 *   npx tsx scripts/ensure-pay-portal.ts
 *   npx tsx scripts/ensure-pay-portal.ts --tenant=demo
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

const tenantSlug = readArg('tenant') ?? 'demo';
const PAY_HOSTS = ['pay.demo.localhost', 'pay.donboscocollege.ac.in'];

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: tenantSlug, deletedAt: null },
  });
  if (!tenant) throw new Error(`Tenant not found: ${tenantSlug}`);

  for (const host of PAY_HOSTS) {
    await prisma.tenantDomain.upsert({
      where: { host },
      update: { tenantId: tenant.id, verified: true, deletedAt: null },
      create: { tenantId: tenant.id, host, verified: true },
    });
    console.log(`✓ Domain registered: ${host}`);
  }

  console.log(`✓ Pay portal hosts configured for tenant "${tenantSlug}"`);
  console.log(
    '  Local preview: http://pay.demo.localhost:3000 (hosts file → 127.0.0.1)',
  );
  console.log('  Or path: http://localhost:3000/fee-collection-portal');
  console.log(
    '  Production DNS/SSL: pay.donboscocollege.ac.in → same ERP web upstream (nginx updated).',
  );
  console.log(
    '  Set PAY_PORTAL_ORIGIN=https://pay.donboscocollege.ac.in for gateway return URLs.',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
