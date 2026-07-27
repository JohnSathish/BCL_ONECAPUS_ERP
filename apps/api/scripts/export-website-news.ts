/**
 * Export published Website CMS news entries to JSON (for syncing local → VPS).
 *
 *   npx tsx scripts/export-website-news.ts --tenant=demo --out=storage/website/news-export-demo.json
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function arg(name: string) {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : undefined;
}

async function main() {
  const tenantSlug = arg('--tenant') || 'demo';
  const out =
    arg('--out') ||
    `storage/website/news-export-${tenantSlug}-${new Date().toISOString().slice(0, 10)}.json`;

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

  const rows = await prisma.websiteContentEntry.findMany({
    where: {
      tenantId: tenant.id,
      siteId: site.id,
      contentTypeId: newsType.id,
      deletedAt: null,
      status: 'PUBLISHED',
    },
    orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
  });

  const payload = {
    exportedAt: new Date().toISOString(),
    tenantSlug,
    count: rows.length,
    entries: rows.map((row) => ({
      title: row.title,
      slug: row.slug,
      status: row.status,
      publishedAt: row.publishedAt,
      data: row.data,
    })),
  };

  const abs = resolve(process.cwd(), out);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, JSON.stringify(payload, null, 2), 'utf8');
  console.log(JSON.stringify({ written: abs, count: rows.length }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
