/**
 * Re-publish college news entries that were drafted by purge-website-demo-content.
 * Does NOT restore seed notices/testimonials.
 *
 * Usage:
 *   npx tsx scripts/restore-website-news.ts --tenant=demo
 *   npx tsx scripts/restore-website-news.ts --tenant=demo --apply
 */
import { PrismaClient } from '@prisma/client';
import { DEMO_NEWS_SLUGS } from '../src/modules/website/website-content-catalog';

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
  if (!newsType) throw new Error('News content type missing');

  const rows = await prisma.websiteContentEntry.findMany({
    where: {
      tenantId: tenant.id,
      siteId: site.id,
      contentTypeId: newsType.id,
      deletedAt: null,
      slug: { in: [...DEMO_NEWS_SLUGS] },
    },
    select: { id: true, slug: true, title: true, status: true },
  });

  console.log(
    JSON.stringify(
      {
        tenant: tenantSlug,
        mode: apply ? 'APPLY' : 'DRY_RUN',
        newsFound: rows,
      },
      null,
      2,
    ),
  );

  if (!apply) {
    console.log('\nDry run only. Re-run with --apply to publish.');
    return;
  }

  const result = await prisma.websiteContentEntry.updateMany({
    where: { id: { in: rows.map((r) => r.id) } },
    data: { status: 'PUBLISHED', publishedAt: new Date() },
  });

  console.log(JSON.stringify({ published: result.count }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
