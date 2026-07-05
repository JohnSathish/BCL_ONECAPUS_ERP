/**
 * Soft-delete incomplete student stub rows (no programme, department, or major choice).
 *
 *   npx ts-node -r tsconfig-paths/register scripts/remove-incomplete-student-stubs.ts --dry-run
 *   npx ts-node -r tsconfig-paths/register scripts/remove-incomplete-student-stubs.ts --tenant=demo
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

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: tenantSlug, deletedAt: null },
    select: { id: true, slug: true },
  });
  if (!tenant) throw new Error(`Tenant not found: ${tenantSlug}`);

  const candidates = await prisma.student.findMany({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      programVersionId: null,
      departmentId: null,
      programChoices: {
        none: { choiceType: 'MAJOR', status: 'active', deletedAt: null },
      },
    },
    select: {
      id: true,
      rollNumber: true,
      enrollmentNumber: true,
      masterProfile: { select: { fullName: true } },
    },
    orderBy: { rollNumber: 'asc' },
  });

  console.log(
    `Incomplete student stubs — tenant=${tenant.slug}${dryRun ? ' (DRY RUN)' : ''}`,
  );
  console.log(`Found ${candidates.length} candidate(s)`);
  for (const s of candidates) {
    console.log(
      `  ${s.rollNumber ?? s.enrollmentNumber} — ${s.masterProfile?.fullName ?? '(no name)'}`,
    );
  }

  if (!candidates.length) return;

  if (dryRun) {
    console.log('\nDry run — no changes written.');
    return;
  }

  const now = new Date();
  for (const s of candidates) {
    await prisma.student.update({
      where: { id: s.id },
      data: { deletedAt: now },
    });
  }
  console.log(`\nSoft-deleted ${candidates.length} stub student(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
