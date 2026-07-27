/**
 * Import news entries from export-website-news JSON into Website CMS.
 * Upserts by slug; sets PUBLISHED. Does not download images (URLs kept as-is).
 *
 *   npx tsx scripts/import-website-news-export.ts --tenant=demo --file=storage/website/news-export-demo.json --apply
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaClient, type Prisma } from '@prisma/client';

const prisma = new PrismaClient();

function arg(name: string) {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : undefined;
}

type ExportFile = {
  tenantSlug?: string;
  entries: Array<{
    title: string;
    slug: string;
    status?: string;
    publishedAt?: string | null;
    data?: unknown;
  }>;
};

async function main() {
  const tenantSlug = arg('--tenant') || 'demo';
  const file = arg('--file');
  const apply = process.argv.includes('--apply');
  if (!file) throw new Error('Missing --file=...');

  const raw = JSON.parse(
    await readFile(resolve(process.cwd(), file), 'utf8'),
  ) as ExportFile;
  const entries = Array.isArray(raw.entries) ? raw.entries : [];
  if (!entries.length) throw new Error('Export file has no entries');

  const tenant = await prisma.tenant.findFirst({
    where: { slug: tenantSlug, deletedAt: null },
  });
  if (!tenant) throw new Error(`Tenant not found: ${tenantSlug}`);

  const site = await prisma.websiteSite.findFirst({
    where: { tenantId: tenant.id },
  });
  if (!site) throw new Error('Website site missing');

  const newsType = await prisma.websiteContentType.findFirst({
    where: { tenantId: tenant.id, siteId: site.id, slug: 'news' },
  });
  if (!newsType) throw new Error('News content type missing');

  const actor =
    (await prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        email: { contains: 'admin' },
      },
      select: { id: true },
    })) ??
    (await prisma.user.findFirst({
      where: { tenantId: tenant.id, deletedAt: null },
      select: { id: true },
    }));
  if (!actor) throw new Error('No actor user');

  // Prefer real college articles over the 3 placeholder seed cards.
  const SEED_SLUGS = new Set([
    'college-week-2026',
    'admissions-open-2026',
    'internal-assessment',
  ]);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  console.log(
    JSON.stringify(
      {
        mode: apply ? 'APPLY' : 'DRY_RUN',
        tenant: tenantSlug,
        file,
        incoming: entries.length,
      },
      null,
      2,
    ),
  );

  for (const entry of entries) {
    if (!entry.slug?.trim() || !entry.title?.trim()) {
      skipped += 1;
      continue;
    }
    const slug = entry.slug.trim();
    const existing = await prisma.websiteContentEntry.findFirst({
      where: {
        tenantId: tenant.id,
        siteId: site.id,
        contentTypeId: newsType.id,
        slug,
      },
    });

    const publishedAt = entry.publishedAt
      ? new Date(entry.publishedAt)
      : new Date();
    const data = (entry.data ?? {}) as Prisma.InputJsonValue;

    if (!apply) continue;

    if (existing) {
      await prisma.websiteContentEntry.update({
        where: { id: existing.id },
        data: {
          title: entry.title.trim(),
          status: 'PUBLISHED',
          publishedAt,
          deletedAt: null,
          data,
          updatedById: actor.id,
        },
      });
      updated += 1;
    } else {
      await prisma.websiteContentEntry.create({
        data: {
          tenantId: tenant.id,
          siteId: site.id,
          contentTypeId: newsType.id,
          title: entry.title.trim(),
          slug,
          status: 'PUBLISHED',
          publishedAt,
          data,
          createdById: actor.id,
          updatedById: actor.id,
        },
      });
      created += 1;
    }
  }

  if (apply) {
    // Hide placeholder seed cards when real archive is present
    const realCount = entries.filter(
      (e) => e.slug && !SEED_SLUGS.has(e.slug),
    ).length;
    if (realCount > 0) {
      await prisma.websiteContentEntry.updateMany({
        where: {
          tenantId: tenant.id,
          siteId: site.id,
          contentTypeId: newsType.id,
          slug: { in: [...SEED_SLUGS] },
        },
        data: { status: 'DRAFT', publishedAt: null },
      });
    }
  }

  const live = await prisma.websiteContentEntry.count({
    where: {
      tenantId: tenant.id,
      siteId: site.id,
      contentTypeId: newsType.id,
      status: 'PUBLISHED',
      deletedAt: null,
    },
  });

  console.log(
    JSON.stringify(
      { created, updated, skipped, publishedNewsTotal: live },
      null,
      2,
    ),
  );
  if (!apply) console.log('\nDry run only. Re-run with --apply to write.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
