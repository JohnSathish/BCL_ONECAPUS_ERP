/**
 * Normalize BA-EDU curriculum versions:
 * - Remove mistaken v1 and v2 (purge if unused, archive if referenced)
 * - Relabel configured v3 → v1 (same internal ID)
 *
 * Run:
 *   npx ts-node --transpile-only scripts/cleanup-ba-edu-versions.ts --dry-run
 *   npx ts-node --transpile-only scripts/cleanup-ba-edu-versions.ts --tenant=demo
 */
import { PrismaClient } from '@prisma/client';
import { ProgramVersionLifecycleService } from '../src/modules/programs-courses/program-version-lifecycle.service';

const prisma = new PrismaClient();
const lifecycle = new ProgramVersionLifecycleService(prisma as never);

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

async function main() {
  const tenantSlug = readArg('tenant');
  const dryRun = process.argv.includes('--dry-run');
  const programCode = readArg('program') ?? 'BA-EDU';

  const tenant = tenantSlug
    ? await prisma.tenant.findFirst({ where: { slug: tenantSlug } })
    : await prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } });

  if (!tenant) {
    throw new Error(
      tenantSlug ? `Tenant not found: ${tenantSlug}` : 'No tenant found',
    );
  }

  const admin = await prisma.user.findFirst({
    where: { tenantId: tenant.id, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });
  if (!admin) throw new Error('No admin user found for tenant');

  const program = await prisma.program.findFirst({
    where: { tenantId: tenant.id, code: programCode, deletedAt: null },
  });
  if (!program) throw new Error(`Program ${programCode} not found`);

  const versions = await prisma.programVersion.findMany({
    where: { tenantId: tenant.id, programId: program.id, deletedAt: null },
    orderBy: { version: 'asc' },
  });

  console.log(`Tenant: ${tenant.slug} (${tenant.id})`);
  console.log(`Program: ${program.code} (${program.id})`);
  console.log('Versions:');
  for (const v of versions) {
    const usage = await lifecycle.getVersion(tenant.id, v.id);
    console.log(
      `  v${v.version} id=${v.id} status=${v.status} usage=${JSON.stringify(usage.usage)}`,
    );
  }

  const keepVersionNumber = Number(readArg('keep') ?? '3');
  const removeRaw = readArg('remove') ?? '1,2';
  const removeVersionNumbers = removeRaw
    .split(',')
    .map((n) => Number(n.trim()));

  console.log('\nPlan:');
  console.log(`  Remove: v${removeVersionNumbers.join(', v')}`);
  console.log(`  Keep & relabel: v${keepVersionNumber} → v1`);

  if (dryRun) {
    console.log('\nDry run — no changes applied.');
    return;
  }

  const result = await lifecycle.normalizeMistakenProgramVersions(
    tenant.id,
    admin.id,
    programCode,
    { keepVersionNumber, removeVersionNumbers },
  );

  console.log('\nResult:', JSON.stringify(result, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
