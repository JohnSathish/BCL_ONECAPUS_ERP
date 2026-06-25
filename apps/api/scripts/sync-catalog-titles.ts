/**
 * Export / import course titles between environments (local → live).
 *
 * Export from local (correct titles):
 *   npx tsx scripts/sync-catalog-titles.ts export --tenant=demo --out=catalog-titles.json
 *
 * Copy catalog-titles.json to VPS, then import on live:
 *   npx tsx scripts/sync-catalog-titles.ts import --file=catalog-titles.json --tenant=demo
 *   npx tsx scripts/sync-catalog-titles.ts import --file=catalog-titles.json --tenant=demo --apply
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';
import { mergeCatalogSeedExclusions } from '../src/common/services/catalog-seed-exclusions.util';

const prisma = new PrismaClient();

type TitleEntry = { code: string; title: string };

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

const mode = process.argv[2];
const apply = process.argv.includes('--apply');
const tenantSlug = readArg('tenant') ?? 'demo';
const outFile = readArg('out') ?? 'catalog-titles.json';
const inFile = readArg('file') ?? 'catalog-titles.json';

async function exportTitles() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: tenantSlug } });
  if (!tenant) throw new Error(`Tenant "${tenantSlug}" not found`);

  const courses = await prisma.course.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
    select: { code: true, title: true },
    orderBy: { code: 'asc' },
  });

  const payload = {
    exportedAt: new Date().toISOString(),
    tenantSlug,
    courses: courses.map((c) => ({ code: c.code, title: c.title.trim() })),
  };

  const path = resolve(process.cwd(), outFile);
  writeFileSync(path, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`Exported ${payload.courses.length} course titles → ${path}`);
}

async function importTitles() {
  const path = resolve(process.cwd(), inFile);
  const raw = readFileSync(path, 'utf8');
  const payload = JSON.parse(raw) as {
    tenantSlug?: string;
    courses: TitleEntry[];
  };

  const tenant = await prisma.tenant.findFirst({ where: { slug: tenantSlug } });
  if (!tenant) throw new Error(`Tenant "${tenantSlug}" not found`);

  const entries = payload.courses ?? [];
  let updated = 0;
  let missing = 0;
  let unchanged = 0;
  const changes: string[] = [];

  for (const entry of entries) {
    const course = await prisma.course.findFirst({
      where: { tenantId: tenant.id, code: entry.code, deletedAt: null },
      select: { id: true, title: true },
    });
    if (!course) {
      missing += 1;
      continue;
    }
    const nextTitle = entry.title.trim();
    if (course.title.trim() === nextTitle) {
      unchanged += 1;
      continue;
    }
    changes.push(`  ${entry.code}: "${course.title}" → "${nextTitle}"`);
    if (apply) {
      await prisma.course.update({
        where: { id: course.id },
        data: { title: nextTitle },
      });
    }
    updated += 1;
  }

  console.log(
    `${apply ? 'APPLY' : 'DRY RUN'} | tenant=${tenantSlug} | file=${inFile}`,
  );
  console.log(`Entries in file: ${entries.length}`);
  console.log(`Would update / updated: ${updated}`);
  console.log(`Unchanged: ${unchanged}`);
  console.log(`Missing codes in DB: ${missing}`);

  if (changes.length) {
    console.log('\nTitle changes:');
    for (const line of changes.slice(0, 50)) console.log(line);
    if (changes.length > 50) {
      console.log(`  ... and ${changes.length - 50} more`);
    }
  }

  if (apply && updated > 0) {
    const codes = entries.map((e) => e.code);
    await mergeCatalogSeedExclusions(prisma, tenant.id, {
      catalogCustomizedCourseCodes: codes,
    });
    console.log(
      `\nLocked ${codes.length} course codes against seed title overwrite.`,
    );
  } else if (!apply && updated > 0) {
    console.log('\nRe-run with --apply to write changes and lock titles.');
  }
}

async function main() {
  if (mode === 'export') {
    await exportTitles();
    return;
  }
  if (mode === 'import') {
    await importTitles();
    return;
  }
  console.error(
    'Usage: sync-catalog-titles.ts export|import [--apply] [--tenant=demo] [--out=file] [--file=file]',
  );
  process.exit(1);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
