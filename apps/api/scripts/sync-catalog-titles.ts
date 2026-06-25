/**
 * Export / import course titles between environments (local → live).
 *
 * Export from local (correct titles):
 *   npx tsx scripts/sync-catalog-titles.ts export --tenant=demo --out=catalog-titles.json
 *
 * Copy catalog-titles.json to VPS, then import on live:
 *   npx tsx scripts/sync-catalog-titles.ts import --file=catalog-titles.json --tenant=demo
 *   npx tsx scripts/sync-catalog-titles.ts import --file=catalog-titles.json --tenant=demo --apply
 *
 * Uses a two-phase rename to avoid unique constraint failures on
 * (tenant_id, department_id, title) when swapping or colliding titles.
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';
import { mergeCatalogSeedExclusions } from '../src/common/services/catalog-seed-exclusions.util';

const prisma = new PrismaClient();

type TitleEntry = { code: string; title: string };

type CourseRow = {
  id: string;
  code: string;
  title: string;
  departmentId: string | null;
};

type PendingUpdate = {
  id: string;
  code: string;
  departmentId: string | null;
  oldTitle: string;
  newTitle: string;
};

type TitleBlocker = CourseRow & {
  blockedCode: string;
  blockedNewTitle: string;
};

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function tempTitle(courseId: string) {
  return `__sync_${courseId.replace(/-/g, '')}__`;
}

function disambiguatedTitle(originalTitle: string, code: string) {
  const suffix = ` [${code}]`;
  const maxLen = 255;
  const base = originalTitle.trim();
  if (base.length + suffix.length <= maxLen) {
    return `${base}${suffix}`;
  }
  return `${base.slice(0, maxLen - suffix.length)}${suffix}`;
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

async function findTitleBlockers(
  tenantId: string,
  pending: PendingUpdate[],
): Promise<TitleBlocker[]> {
  const blockers: TitleBlocker[] = [];
  const seen = new Set<string>();

  for (const update of pending) {
    const occupying = await prisma.course.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        id: { not: update.id },
        title: { equals: update.newTitle, mode: 'insensitive' },
        ...(update.departmentId
          ? { departmentId: update.departmentId }
          : { departmentId: null }),
      },
      select: { id: true, code: true, title: true, departmentId: true },
    });
    if (!occupying) continue;

    const key = `${occupying.id}::${update.code}`;
    if (seen.has(key)) continue;
    seen.add(key);

    blockers.push({
      ...occupying,
      blockedCode: update.code,
      blockedNewTitle: update.newTitle,
    });
  }

  return blockers;
}

async function applyTitleUpdates(
  pending: PendingUpdate[],
  blockers: TitleBlocker[],
) {
  const pendingIds = new Set(pending.map((row) => row.id));
  const tempIds = [
    ...new Set([
      ...pending.map((row) => row.id),
      ...blockers.map((row) => row.id),
    ]),
  ];

  await prisma.$transaction(async (tx) => {
    for (const id of tempIds) {
      await tx.course.update({
        where: { id },
        data: { title: tempTitle(id) },
      });
    }

    for (const update of pending) {
      await tx.course.update({
        where: { id: update.id },
        data: { title: update.newTitle },
      });
    }

    for (const blocker of blockers) {
      if (pendingIds.has(blocker.id)) continue;
      await tx.course.update({
        where: { id: blocker.id },
        data: {
          title: disambiguatedTitle(blocker.title, blocker.code),
        },
      });
    }
  });
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
  let missing = 0;
  let unchanged = 0;
  const pending: PendingUpdate[] = [];
  const changes: string[] = [];

  for (const entry of entries) {
    const course = await prisma.course.findFirst({
      where: { tenantId: tenant.id, code: entry.code, deletedAt: null },
      select: { id: true, code: true, title: true, departmentId: true },
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
    pending.push({
      id: course.id,
      code: course.code,
      departmentId: course.departmentId,
      oldTitle: course.title.trim(),
      newTitle: nextTitle,
    });
    changes.push(`  ${entry.code}: "${course.title.trim()}" → "${nextTitle}"`);
  }

  const blockers = pending.length
    ? await findTitleBlockers(tenant.id, pending)
    : [];

  console.log(
    `${apply ? 'APPLY' : 'DRY RUN'} | tenant=${tenantSlug} | file=${inFile}`,
  );
  console.log(`Entries in file: ${entries.length}`);
  console.log(`Would update / updated: ${pending.length}`);
  console.log(`Unchanged: ${unchanged}`);
  console.log(`Missing codes in DB: ${missing}`);

  if (changes.length) {
    console.log('\nTitle changes:');
    for (const line of changes.slice(0, 50)) console.log(line);
    if (changes.length > 50) {
      console.log(`  ... and ${changes.length - 50} more`);
    }
  }

  if (blockers.length) {
    console.log(
      `\nTitle collisions resolved via temporary rename (${blockers.length} blocker(s)):`,
    );
    for (const blocker of blockers.slice(0, 20)) {
      console.log(
        `  ${blocker.code} currently holds "${blocker.title.trim()}" needed by ${blocker.blockedCode} → will become "${disambiguatedTitle(blocker.title, blocker.code)}"`,
      );
    }
    if (blockers.length > 20) {
      console.log(`  ... and ${blockers.length - 20} more`);
    }
  }

  if (apply && pending.length > 0) {
    await applyTitleUpdates(pending, blockers);
    const codes = entries.map((e) => e.code);
    await mergeCatalogSeedExclusions(prisma, tenant.id, {
      catalogCustomizedCourseCodes: codes,
    });
    console.log(
      `\nApplied ${pending.length} title update(s) and locked ${codes.length} course codes against seed overwrite.`,
    );
  } else if (!apply && pending.length > 0) {
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
