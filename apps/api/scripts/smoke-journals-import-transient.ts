/**
 * Smoke: Transient Google Sites → Journal CMS import.
 *
 * Prerequisites:
 *   npx prisma migrate deploy
 *   npx tsx scripts/ensure-journals-portal.ts --tenant=demo
 *   npx tsx scripts/import-journal-content.ts --tenant=demo --journal=transient --snapshot=./data/journals/transient/snapshot.json
 *
 *   npx tsx scripts/smoke-journals-import-transient.ts
 */
import { PrismaClient } from '@prisma/client';

const TENANT_SLUG = process.env.TENANT_SLUG ?? 'demo';
const JOURNAL_SLUG = 'transient';

async function main() {
  const prisma = new PrismaClient();
  const failures: string[] = [];

  try {
    const tenant = await prisma.tenant.findFirst({
      where: { slug: TENANT_SLUG },
    });
    if (!tenant) throw new Error(`Tenant ${TENANT_SLUG} not found`);

    const journal = await prisma.journal.findFirst({
      where: { tenantId: tenant.id, slug: JOURNAL_SLUG },
    });
    if (!journal) throw new Error('Transient journal not found');

    if (journal.issn !== '2250-0650') {
      failures.push(`Expected ISSN 2250-0650, got ${journal.issn}`);
    }
    if (journal.contactEmail !== 'transient@donboscocollege.ac.in') {
      failures.push(
        `Expected contact transient@donboscocollege.ac.in, got ${journal.contactEmail}`,
      );
    }

    const advisory = await prisma.journalEditorialMember.count({
      where: { journalId: journal.id, boardType: 'ADVISORY', isActive: true },
    });
    if (advisory < 1) failures.push('Expected ≥1 ADVISORY board member');

    const volumes = await prisma.journalVolume.count({
      where: { journalId: journal.id },
    });
    const downloads = await prisma.journalDownload.count({
      where: { journalId: journal.id, category: 'VOLUME_PDF' },
    });
    if (volumes < 1 && downloads < 1) {
      failures.push('Expected ≥1 volume row or VOLUME_PDF download');
    }

    const about = await prisma.journalPage.findFirst({
      where: { journalId: journal.id, key: 'about' },
    });
    if (!about?.bodyHtml?.includes('2250-0650')) {
      failures.push('About page body should mention ISSN 2250-0650');
    }

    if (journal.logoUrl && /sites\.google\.com/i.test(journal.logoUrl)) {
      failures.push(`Logo still hotlinks Google Sites: ${journal.logoUrl}`);
    }

    const mediaHotlink = await prisma.journalMediaAsset.findFirst({
      where: {
        journalId: journal.id,
        publicUrl: { contains: 'sites.google' },
      },
    });
    if (mediaHotlink) {
      failures.push(
        `Media publicUrl still Google Sites: ${mediaHotlink.publicUrl}`,
      );
    }

    const redirects = await prisma.journalRedirect.count({
      where: { journalId: journal.id },
    });
    if (redirects < 1) failures.push('Expected ≥1 JournalRedirect');

    console.log('—— Transient import smoke ——');
    console.log({
      issn: journal.issn,
      contactEmail: journal.contactEmail,
      advisory,
      volumes,
      volumePdfs: downloads,
      redirects,
      aboutHasIssn: Boolean(about?.bodyHtml?.includes('2250-0650')),
      logoUrl: journal.logoUrl,
    });

    if (failures.length) {
      console.error('FAILED:');
      for (const f of failures) console.error(`  - ${f}`);
      process.exitCode = 1;
    } else {
      console.log('PASSED');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
