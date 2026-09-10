/**
 * Ensure St. Luke's Secondary School tenant, hosts, and website CMS exist.
 * If the public site is already seeded, only tenant domains are refreshed.
 *
 *   npx tsx scripts/ensure-st-lukes-school.ts
 */
import { PrismaClient } from '@prisma/client';
import { seedStLukesSecondarySchool } from '../prisma/seeds/seed-st-lukes-tura';
import { seedStLukesWebsite } from '../prisma/seeds/seed-st-lukes-website';

const prisma = new PrismaClient();

const PRODUCTION_HOSTS = [
  'erp.stlukestura.in',
  'stlukestura.in',
  'www.stlukestura.in',
] as const;

async function main() {
  const existing = await prisma.tenant.findFirst({
    where: { slug: 'st-lukes-tura', deletedAt: null },
  });
  if (!existing) {
    const result = await seedStLukesSecondarySchool(prisma);
    console.log("✓ St. Luke's Secondary School tenant created");
    console.log(`  Admin: ${result.adminEmail} / Admin@123`);
    console.log('  Public website: https://stlukestura.in/');
    console.log('  School ERP: https://erp.stlukestura.in/login');
    for (const host of result.hosts) console.log(`  Domain: ${host}`);
    return;
  }

  for (const host of PRODUCTION_HOSTS) {
    await prisma.tenantDomain.upsert({
      where: { host },
      update: { tenantId: existing.id, verified: true, deletedAt: null },
      create: { tenantId: existing.id, host, verified: true },
    });
  }

  const site = await prisma.schoolWebSite.findUnique({
    where: { tenantId: existing.id },
  });
  if (!site) {
    await seedStLukesWebsite(prisma, existing.id);
    console.log("✓ St. Luke's website CMS seeded");
  } else {
    const extras =
      site.extrasJson &&
      typeof site.extrasJson === 'object' &&
      !Array.isArray(site.extrasJson)
        ? (site.extrasJson as Record<string, unknown>)
        : {};
    await prisma.schoolWebSite.update({
      where: { tenantId: existing.id },
      data: {
        email: 'admin@stlukestura.in',
        extrasJson: {
          ...extras,
          contactNote: 'Phone will be published when the school confirms it.',
        },
      },
    });
    console.log("✓ St. Luke's office email set to admin@stlukestura.in");
  }

  console.log("✓ St. Luke's Secondary School tenant ready");
  console.log('  Public website: https://stlukestura.in/');
  console.log('  School ERP: https://erp.stlukestura.in/login');
  for (const host of PRODUCTION_HOSTS) console.log(`  Domain: ${host}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
