/**
 * Persist current live homepage CMS content and prove import is fill-only.
 * Usage: npx tsx scripts/persist-and-verify-website-cms.ts
 */
import { PrismaClient } from '@prisma/client';
import { importWebsiteContent } from '../src/modules/website/website-content-importer';
import { resolveHomepageContent } from '../src/modules/website/website-homepage-content';

const prisma = new PrismaClient();

function fingerprint(settingsJson: unknown) {
  const content = resolveHomepageContent(settingsJson);
  return JSON.stringify({
    footerCta: content.footer.ctaTitle,
    footerEmail: content.footer.contactEmail,
    footerPhone: content.footer.contactPhone,
    brandTagline: content.footer.brandTagline,
    research: content.researchLinks.links.map((l) => `${l.label}:${l.href}`),
    coatBody: content.coatOfArms.body.slice(0, 80),
    sisterTitle: content.sisterInstitutions.title,
    sisterCount: content.sisterInstitutions.items.length,
  });
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('demo tenant not found');
  const site = await prisma.websiteSite.findFirst({
    where: { tenantId: tenant.id },
  });
  if (!site) throw new Error('demo website site not found');

  const before = fingerprint(site.settingsJson);
  console.log('BEFORE', before);

  // Re-write resolved homepage back into settingsJson so missing nested keys
  // are filled once from current live values — without replacing editor data.
  const settings =
    site.settingsJson &&
    typeof site.settingsJson === 'object' &&
    !Array.isArray(site.settingsJson)
      ? { ...(site.settingsJson as Record<string, unknown>) }
      : {};
  const resolved = resolveHomepageContent(settings);
  settings.homepage = resolved;
  settings.footerWidgets = resolved.footer;
  settings.aboutCollege = resolved.aboutCollege;
  settings.stats = resolved.statistics;
  await prisma.websiteSite.update({
    where: { id: site.id },
    data: { settingsJson: settings },
  });
  console.log('PERSISTED resolved homepage into settingsJson.homepage');

  // Actor: any active user on tenant (seed import requires actor id)
  const actor = await prisma.user.findFirst({
    where: { tenantId: tenant.id, isActive: true },
    select: { id: true },
  });
  if (!actor) throw new Error('no active user for demo tenant');

  const importResult = await importWebsiteContent(prisma, tenant.id, actor.id);
  console.log('IMPORT', importResult);

  const afterSite = await prisma.websiteSite.findUniqueOrThrow({
    where: { id: site.id },
  });
  const after = fingerprint(afterSite.settingsJson);
  console.log('AFTER', after);

  if (before !== after) {
    throw new Error('CMS content changed after import — preservation failed');
  }
  console.log('OK: CMS content preserved after import');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
