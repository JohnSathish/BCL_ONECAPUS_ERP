/**
 * Unpublish known demo/seed website content that was auto-imported into the live CMS.
 *
 * Usage (on API host):
 *   npx ts-node -r tsconfig-paths/register scripts/purge-website-demo-content.ts --tenant=demo
 *   npx ts-node -r tsconfig-paths/register scripts/purge-website-demo-content.ts --tenant=demo --apply
 *
 * Default is dry-run. Pass --apply to write DRAFT / hide rows.
 */
import { PrismaClient } from '@prisma/client';
import {
  DEMO_NEWS_SLUGS,
  DEMO_NOTICE_SLUGS,
  DEMO_TESTIMONIAL_SLUGS,
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
  if (!tenant) {
    throw new Error(`Tenant not found: ${tenantSlug}`);
  }

  const site = await prisma.websiteSite.findFirst({
    where: { tenantId: tenant.id },
  });
  if (!site) {
    throw new Error(`Website site missing for tenant ${tenantSlug}`);
  }

  const entrySlugs = [...DEMO_NEWS_SLUGS, ...DEMO_TESTIMONIAL_SLUGS];
  const entries = await prisma.websiteContentEntry.findMany({
    where: {
      tenantId: tenant.id,
      siteId: site.id,
      deletedAt: null,
      slug: { in: entrySlugs },
      status: 'PUBLISHED',
    },
    select: { id: true, slug: true, title: true, status: true },
  });

  const notices = await prisma.websiteNotice.findMany({
    where: {
      tenantId: tenant.id,
      siteId: site.id,
      deletedAt: null,
      slug: { in: [...DEMO_NOTICE_SLUGS] },
      OR: [
        { status: 'PUBLISHED' },
        { isVisible: true },
        { showOnHomepage: true },
      ],
    },
    select: { id: true, slug: true, title: true, status: true },
  });

  console.log(
    JSON.stringify(
      {
        tenant: tenantSlug,
        mode: apply ? 'APPLY' : 'DRY_RUN',
        entriesToUnpublish: entries,
        noticesToHide: notices,
      },
      null,
      2,
    ),
  );

  if (!apply) {
    console.log('\nDry run only. Re-run with --apply to unpublish.');
    return;
  }

  const entryResult = await prisma.websiteContentEntry.updateMany({
    where: { id: { in: entries.map((e) => e.id) } },
    data: { status: 'DRAFT', publishedAt: null },
  });

  const noticeResult = await prisma.websiteNotice.updateMany({
    where: { id: { in: notices.map((n) => n.id) } },
    data: {
      status: 'DRAFT',
      isVisible: false,
      showOnHomepage: false,
    },
  });

  console.log(
    JSON.stringify(
      {
        unpublishedEntries: entryResult.count,
        hiddenNotices: noticeResult.count,
      },
      null,
      2,
    ),
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
