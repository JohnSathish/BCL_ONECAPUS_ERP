/**
 * Verify Sem 7 / Sem 8 curriculum readiness for published FYUGP programmes.
 *
 * Expects per programme:
 *   Sem 7: MAJOR >= 3, MINOR >= 2
 *   Sem 8: MAJOR >= 5, DISSERTATION >= 1
 *   Sem 8 structure rule has pathwayVariants (HONOURS / HONOURS_WITH_RESEARCH)
 *
 * Usage (from apps/api):
 *   npx tsx scripts/verify-sem7-sem8-curriculum.ts
 *   npx tsx scripts/verify-sem7-sem8-curriculum.ts --tenant=demo
 */
import { PrismaClient } from '@prisma/client';
import { listSem7Sem8PlaceholderDepartments } from '../src/modules/academic-engine/domain/fyugp-sem7-sem8-placeholder-catalog';

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

const tenantSlug = readArg('tenant') ?? 'demo';
const prisma = new PrismaClient();

type CatCounts = Record<string, number>;

function countByCategory(rows: Array<{ category: string | null }>): CatCounts {
  const out: CatCounts = {};
  for (const row of rows) {
    const cat = (row.category ?? 'UNKNOWN').toUpperCase();
    out[cat] = (out[cat] ?? 0) + 1;
  }
  return out;
}

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: tenantSlug, deletedAt: null },
    select: { id: true, slug: true },
  });
  if (!tenant) throw new Error(`Tenant not found: ${tenantSlug}`);

  const targetCodes = listSem7Sem8PlaceholderDepartments().map(
    (d) => d.programCode,
  );

  const versions = await prisma.programVersion.findMany({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      status: 'PUBLISHED',
      program: { deletedAt: null, code: { in: targetCodes } },
    },
    include: {
      program: { select: { code: true, name: true } },
    },
    orderBy: { program: { code: 'asc' } },
  });

  console.log(
    `Sem 7/8 curriculum verify — tenant=${tenant.slug}, programmes=${versions.length}`,
  );

  const failures: string[] = [];
  const ok: string[] = [];

  for (const version of versions) {
    const code = version.program.code;
    const offerings = await prisma.courseOffering.findMany({
      where: {
        tenantId: tenant.id,
        programVersionId: version.id,
        deletedAt: null,
        semesterSequence: { in: [7, 8] },
        mappingSource: 'DIRECT',
      },
      select: { category: true, semesterSequence: true },
    });

    const sem7 = countByCategory(
      offerings.filter((o) => o.semesterSequence === 7),
    );
    const sem8 = countByCategory(
      offerings.filter((o) => o.semesterSequence === 8),
    );

    const rule8 = await prisma.semesterStructureRule.findFirst({
      where: {
        tenantId: tenant.id,
        programVersionId: version.id,
        semesterSequence: 8,
      },
      select: { pathwayVariants: true, categoryCounts: true },
    });

    const variants =
      rule8?.pathwayVariants &&
      typeof rule8.pathwayVariants === 'object' &&
      !Array.isArray(rule8.pathwayVariants)
        ? (rule8.pathwayVariants as Record<string, unknown>)
        : null;

    const hasHonours = Boolean(variants?.HONOURS);
    const hasResearch = Boolean(variants?.HONOURS_WITH_RESEARCH);

    const issues: string[] = [];
    if ((sem7.MAJOR ?? 0) < 3) {
      issues.push(`Sem7 MAJOR=${sem7.MAJOR ?? 0} (need >=3)`);
    }
    if ((sem7.MINOR ?? 0) < 2) {
      issues.push(`Sem7 MINOR=${sem7.MINOR ?? 0} (need >=2)`);
    }
    if ((sem8.MAJOR ?? 0) < 5) {
      issues.push(`Sem8 MAJOR=${sem8.MAJOR ?? 0} (need >=5)`);
    }
    if ((sem8.DISSERTATION ?? 0) < 1) {
      issues.push(`Sem8 DISSERTATION=${sem8.DISSERTATION ?? 0} (need >=1)`);
    }
    if (!rule8) {
      issues.push('missing Sem8 structure rule');
    } else if (!hasHonours || !hasResearch) {
      issues.push(
        `Sem8 pathwayVariants incomplete (HONOURS=${hasHonours}, RESEARCH=${hasResearch})`,
      );
    }

    const summary = `${code}: S7 M${sem7.MAJOR ?? 0}/m${sem7.MINOR ?? 0} | S8 M${sem8.MAJOR ?? 0}/D${sem8.DISSERTATION ?? 0}/P${sem8.PROJECT ?? 0}`;

    if (issues.length) {
      failures.push(`${summary} — FAIL: ${issues.join('; ')}`);
      console.log(`  ✗ ${summary}`);
      for (const issue of issues) console.log(`      - ${issue}`);
    } else {
      ok.push(summary);
      console.log(`  ✓ ${summary}`);
    }
  }

  const missingPrograms = targetCodes.filter(
    (code) => !versions.some((v) => v.program.code === code),
  );
  if (missingPrograms.length) {
    console.log(
      `\nNote: no published version for: ${missingPrograms.join(', ')}`,
    );
  }

  console.log(`\nOK: ${ok.length}  FAIL: ${failures.length}`);
  if (failures.length) {
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
