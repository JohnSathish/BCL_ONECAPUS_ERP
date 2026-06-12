/**
 * One-time (or repeat-safe) bulk provision of Day · Section A for shared pool offerings.
 *
 * Run:
 *   npx ts-node --transpile-only scripts/provision-pool-sections.ts
 *   npx ts-node --transpile-only scripts/provision-pool-sections.ts --semester=1
 *   npx ts-node --transpile-only scripts/provision-pool-sections.ts --tenant=demo --shift=DAY
 */
import { PrismaClient } from '@prisma/client';
import { PoolSectionProvisioningService } from '../src/modules/academic-engine/services/pool-section-provisioning.service';

const prisma = new PrismaClient();
const service = new PoolSectionProvisioningService(prisma as never);

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

async function main() {
  const tenantSlug = readArg('tenant') ?? 'demo';
  const semesterNo = readArg('semester') ? Number(readArg('semester')) : 1;
  const shiftCode = readArg('shift') ?? 'DAY';
  const categories = (readArg('categories') ?? 'MDC,AEC,SEC,VAC,VTC')
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);

  const tenant = await prisma.tenant.findFirst({ where: { slug: tenantSlug } });
  if (!tenant) {
    console.error(`Tenant "${tenantSlug}" not found.`);
    process.exit(1);
  }

  console.log('\n=== Provision pool delivery sections ===\n');
  console.log(`Tenant: ${tenantSlug}`);
  console.log(`Semester: ${semesterNo}`);
  console.log(`Shift: ${shiftCode} · Section A`);
  console.log(`Categories: ${categories.join(', ')}\n`);

  const result = await service.provisionPoolOfferings(tenant.id, {
    semesterNo,
    categories,
    shiftCode,
  });

  console.log(`Processed ${result.total} pool offering(s)`);
  console.log(`Created: ${result.created}`);
  console.log(`Skipped (already existed): ${result.skipped}`);

  if (result.details.length) {
    console.log('\nDetails:');
    for (const row of result.details) {
      console.log(`  ${row.created ? '+' : '='} ${row.courseCode}`);
    }
  }

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
