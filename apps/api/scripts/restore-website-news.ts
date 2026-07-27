/**
 * Ensure homepage News & Events has published articles.
 * Creates missing catalog news rows and re-publishes drafts.
 *
 * Usage (inside API container):
 *   npx tsx scripts/restore-website-news.ts --tenant=demo --apply
 */
import { PrismaClient } from '@prisma/client';
import {
  DEMO_NEWS_SLUGS,
  NEWS_SEED_CATALOG,
} from '../src/modules/website/website-content-catalog';

const prisma = new PrismaClient();

function arg(name: string) {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : undefined;
}

async function main() {
  const tenantSlug = arg('--tenant') || 'demo';
  const apply = process.argv.includes('--apply');

  const tenant = await prisma.tenant.findFirst({
    where: { slug: tenantSlug, deletedAt: null },
  });
  if (!tenant) throw new Error(`Tenant not found: ${tenantSlug}`);

  const site = await prisma.websiteSite.findFirst({
    where: { tenantId: tenant.id },
  });
  if (!site) throw new Error(`Website site missing for tenant ${tenantSlug}`);

  const newsType = await prisma.websiteContentType.findFirst({
    where: { tenantId: tenant.id, siteId: site.id, slug: 'news' },
  });
  if (!newsType)
    throw new Error(
      'News content type missing — run website seed-defaults first',
    );

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
  if (!actor) throw new Error('No user found to attribute news entries');

  const existing = await prisma.websiteContentEntry.findMany({
    where: {
      tenantId: tenant.id,
      siteId: site.id,
      contentTypeId: newsType.id,
      slug: { in: [...DEMO_NEWS_SLUGS] },
    },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      deletedAt: true,
    },
  });
  const bySlug = new Map(existing.map((r) => [r.slug, r]));

  const plan = NEWS_SEED_CATALOG.map((entry) => {
    const row = bySlug.get(entry.slug);
    if (!row) return { action: 'CREATE', ...entry };
    if (row.deletedAt || row.status !== 'PUBLISHED') {
      return {
        action: 'PUBLISH',
        id: row.id,
        slug: entry.slug,
        title: entry.title,
      };
    }
    return { action: 'KEEP', id: row.id, slug: entry.slug, title: entry.title };
  });

  console.log(
    JSON.stringify(
      { tenant: tenantSlug, mode: apply ? 'APPLY' : 'DRY_RUN', plan },
      null,
      2,
    ),
  );

  if (!apply) {
    console.log('\nDry run only. Re-run with --apply to write.');
    return;
  }

  let created = 0;
  let published = 0;
  for (const item of plan) {
    if (item.action === 'CREATE') {
      await prisma.websiteContentEntry.create({
        data: {
          tenantId: tenant.id,
          siteId: site.id,
          contentTypeId: newsType.id,
          title: item.title,
          slug: item.slug,
          status: 'PUBLISHED',
          publishedAt: new Date(),
          data: {
            summary: item.summary,
            body: item.body,
            category: item.category,
          },
          createdById: actor.id,
          updatedById: actor.id,
        },
      });
      created += 1;
      continue;
    }
    if (item.action === 'PUBLISH' && item.id) {
      await prisma.websiteContentEntry.update({
        where: { id: item.id },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
          deletedAt: null,
          updatedById: actor.id,
        },
      });
      published += 1;
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
    JSON.stringify({ created, published, publishedNewsTotal: live }, null, 2),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
