/**
 * Ensure journal portal tenant domains + Transient/Source seed content.
 *
 *   npx tsx scripts/ensure-journals-portal.ts
 *   npx tsx scripts/ensure-journals-portal.ts --tenant=demo
 */
import { PrismaClient } from '@prisma/client';
import {
  JOURNAL_COMMUNICATION_TEMPLATE_CODES,
  findDefaultTemplateByCode,
} from '../src/modules/communication/data/default-communication-templates';

const prisma = new PrismaClient();

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

const tenantSlug = readArg('tenant') ?? 'demo';
const JOURNAL_HOSTS = [
  'transient.demo.localhost',
  'source.demo.localhost',
  'transient.donboscocollege.ac.in',
  'source.donboscocollege.ac.in',
];

const DEFAULT_PAGES: Array<{ key: string; title: string; bodyHtml: string }> = [
  {
    key: 'about',
    title: 'About the Journal',
    bodyHtml:
      '<p>TRANSIENT is a peer-reviewed journal published by Don Bosco College, Tura, covering natural sciences and allied subjects. Manuscripts receive preliminary editorial screening followed by expert peer review.</p><p><strong>About the College.</strong> Don Bosco College, Tura (founded 1987), affiliated to North-Eastern Hill University (NEHU), lives by the motto <em>In Pursuit of Excellence</em>.</p>',
  },
  {
    key: 'aim-scope',
    title: 'Aim & Scope',
    bodyHtml:
      '<p>The journal publishes high-quality research across multidisciplinary academic areas.</p>',
  },
  {
    key: 'peer-review',
    title: 'Peer Review Policy',
    bodyHtml: '<p>All submissions undergo rigorous peer review.</p>',
  },
  {
    key: 'ethics',
    title: 'Publication Ethics',
    bodyHtml:
      '<p>The journal follows established publication ethics guidelines.</p>',
  },
  {
    key: 'author-guidelines',
    title: 'Author Guidelines',
    bodyHtml:
      '<p>Authors should follow the submission guidelines published by the journal.</p>',
  },
  {
    key: 'indexing',
    title: 'Indexing',
    bodyHtml:
      '<p>Indexing information will be updated by the editorial office.</p>',
  },
  {
    key: 'contact',
    title: 'Contact',
    bodyHtml:
      '<p>Contact the editorial office using the details on this page.</p>',
  },
];

async function ensurePages(tenantId: string, journalId: string) {
  for (const [index, page] of DEFAULT_PAGES.entries()) {
    const exists = await prisma.journalPage.findFirst({
      where: { journalId, key: page.key },
    });
    if (exists) {
      if (page.key === 'about') {
        await prisma.journalPage.update({
          where: { id: exists.id },
          data: { title: page.title, bodyHtml: page.bodyHtml },
        });
      }
      continue;
    }
    await prisma.journalPage.create({
      data: {
        tenantId,
        journalId,
        key: page.key,
        title: page.title,
        bodyHtml: page.bodyHtml,
        sortOrder: index + 1,
        isPublished: true,
      },
    });
  }
}

async function ensureJournal(
  tenantId: string,
  data: {
    name: string;
    shortName: string;
    slug: string;
    issn: string;
    tagline: string;
    description: string;
    contactEmail: string;
  },
) {
  let journal = await prisma.journal.findFirst({
    where: { tenantId, slug: data.slug },
  });
  if (!journal) {
    journal = await prisma.journal.create({
      data: {
        tenantId,
        name: data.name,
        shortName: data.shortName,
        slug: data.slug,
        subdomain: data.slug,
        issn: data.issn,
        tagline: data.tagline,
        description: data.description,
        contactEmail: data.contactEmail,
        publisher: 'Don Bosco College, Tura',
        institution: 'Don Bosco College, Tura',
        frequency: 'ANNUAL',
        logoUrl: '/branding/college-logo.png',
        bannerUrl: '/branding/alumni-campus-hero.png',
        status: 'ACTIVE',
      },
    });
    console.log(`✓ Created journal: ${data.slug}`);
  } else {
    journal = await prisma.journal.update({
      where: { id: journal.id },
      data: {
        tagline: data.tagline,
        description: data.description,
        contactEmail: data.contactEmail,
        issn: data.issn,
      },
    });
    console.log(`✓ Journal exists: ${data.slug}`);
  }
  await ensurePages(tenantId, journal.id);

  // Phase 3: demo DOI prefix for dry-run minting (Transient uses 10.xxxxx)
  if (data.slug === 'transient' && !journal.doiPrefix) {
    journal = await prisma.journal.update({
      where: { id: journal.id },
      data: {
        doiPrefix: '10.xxxxx',
        crossrefEnabled: false,
        crossrefDepositorName: 'Don Bosco College Tura',
        crossrefDepositorEmail: data.contactEmail,
        crossrefRegistrant: 'Don Bosco College, Tura',
      },
    });
    console.log(`✓ Transient DOI prefix set to 10.xxxxx (dry-run)`);
  } else if (data.slug === 'transient' && journal.doiPrefix) {
    console.log(`✓ Transient DOI prefix: ${journal.doiPrefix}`);
  }

  return journal;
}

async function ensureTransientContent(tenantId: string, journalId: string) {
  const boardCount = await prisma.journalEditorialMember.count({
    where: { journalId },
  });
  if (boardCount === 0) {
    await prisma.journalEditorialMember.create({
      data: {
        tenantId,
        journalId,
        fullName: 'Chief Editor',
        roleTitle: 'Chief Editor',
        boardType: 'CHIEF_EDITOR',
        institution: 'Don Bosco College, Tura',
        sortOrder: 1,
      },
    });
    await prisma.journalEditorialMember.create({
      data: {
        tenantId,
        journalId,
        fullName: 'Managing Editor',
        roleTitle: 'Managing Editor',
        boardType: 'MANAGING',
        institution: 'Don Bosco College, Tura',
        sortOrder: 2,
      },
    });
  }

  let volume = await prisma.journalVolume.findFirst({
    where: { journalId, volumeNumber: 12, year: 2024 },
  });
  if (!volume) {
    volume = await prisma.journalVolume.create({
      data: {
        tenantId,
        journalId,
        volumeNumber: 12,
        year: 2024,
        label: 'Volume 12',
      },
    });
  }

  const issue = await prisma.journalIssue.findFirst({
    where: { volumeId: volume.id, issueNumber: 1 },
  });
  if (!issue) {
    await prisma.journalIssue.create({
      data: {
        tenantId,
        journalId,
        volumeId: volume.id,
        issueNumber: 1,
        title: 'Transient – 2024',
        publicationDate: new Date('2024-12-01'),
        coverUrl: '/branding/alumni-campus-hero.png',
        summary:
          'The 2024 annual issue of TRANSIENT featuring peer-reviewed research contributions.',
        isCurrent: true,
        isPublished: true,
        articles: {
          create: [
            {
              tenantId,
              journalId,
              title: 'Education, Culture and Development in the Garo Hills',
              abstract:
                'An exploratory study on the intersections of education and cultural development.',
              keywords: ['Education', 'Culture', 'Meghalaya'],
              pageRange: '1-12',
              category: 'Research Article',
              status: 'PUBLISHED',
              publishedAt: new Date('2024-12-01'),
              htmlContent:
                '<p>Full article content will be available in the published PDF.</p>',
              authors: {
                create: [
                  {
                    tenantId,
                    fullName: 'Sample Author',
                    affiliation: 'Don Bosco College, Tura',
                    isCorresponding: true,
                    sortOrder: 1,
                  },
                ],
              },
            },
          ],
        },
      },
    });
    console.log('✓ Transient sample issue + article');
  }

  const announcements = await prisma.journalAnnouncement.count({
    where: { journalId },
  });
  if (announcements === 0) {
    await prisma.journalAnnouncement.create({
      data: {
        tenantId,
        journalId,
        title: 'Call for Papers — Next Annual Issue',
        bodyHtml:
          '<p>Authors are invited to submit original research for the forthcoming issue of TRANSIENT.</p>',
        publishedAt: new Date(),
        isPinned: true,
        isPublished: true,
      },
    });
  }
}

async function ensureSourceContent(tenantId: string, journalId: string) {
  const volume = await prisma.journalVolume.findFirst({ where: { journalId } });
  if (!volume) {
    const created = await prisma.journalVolume.create({
      data: {
        tenantId,
        journalId,
        volumeNumber: 1,
        year: new Date().getFullYear(),
        label: 'Volume 1',
      },
    });
    await prisma.journalIssue.create({
      data: {
        tenantId,
        journalId,
        volumeId: created.id,
        issueNumber: 1,
        title: 'Source — Inaugural Issue',
        publicationDate: new Date(),
        summary: 'Inaugural issue of SOURCE.',
        isCurrent: true,
        isPublished: true,
      },
    });
    console.log('✓ Source sample volume/issue');
  }
}

async function ensureJournalCommunicationTemplates(tenantId: string) {
  for (const code of JOURNAL_COMMUNICATION_TEMPLATE_CODES) {
    const tpl = findDefaultTemplateByCode(code);
    if (!tpl) continue;
    await prisma.communicationTemplate.upsert({
      where: { tenantId_code: { tenantId, code: tpl.code } },
      create: {
        tenantId,
        code: tpl.code,
        name: tpl.name,
        category: tpl.category ?? 'JOURNALS',
        subject: tpl.subject,
        bodyHtml: tpl.bodyHtml,
        bodyText: tpl.bodyText,
        variables: tpl.variables ?? [],
        channels: tpl.channels ?? ['EMAIL'],
        isActive: true,
      },
      update: {
        name: tpl.name,
        subject: tpl.subject,
        bodyHtml: tpl.bodyHtml,
        bodyText: tpl.bodyText,
        variables: tpl.variables ?? [],
        channels: tpl.channels ?? ['EMAIL'],
        isActive: true,
        deletedAt: null,
      },
    });
  }
  console.log(
    `✓ Journal communication templates (${JOURNAL_COMMUNICATION_TEMPLATE_CODES.length})`,
  );
}

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: tenantSlug, deletedAt: null },
  });
  if (!tenant) throw new Error(`Tenant not found: ${tenantSlug}`);

  for (const host of JOURNAL_HOSTS) {
    await prisma.tenantDomain.upsert({
      where: { host },
      update: { tenantId: tenant.id, verified: true, deletedAt: null },
      create: { tenantId: tenant.id, host, verified: true },
    });
    console.log(`✓ Domain registered: ${host}`);
  }

  await ensureJournalCommunicationTemplates(tenant.id);

  const transient = await ensureJournal(tenant.id, {
    name: 'TRANSIENT',
    shortName: 'Transient',
    slug: 'transient',
    issn: '2250-0650',
    tagline: 'A Journal of Natural Sciences and Allied Subjects',
    description:
      'Transient – A Journal of Natural Science and Allied Subjects, is an annual peer reviewed multi-discipline research science journal (ISSN NO. 2250-0650) in English published by Don Bosco College, Tura, Meghalaya, India from the year 2011.',
    contactEmail: 'transient@donboscocollege.ac.in',
  });
  await ensureTransientContent(tenant.id, transient.id);

  const source = await ensureJournal(tenant.id, {
    name: 'SOURCE',
    shortName: 'Source',
    slug: 'source',
    issn: 'XXXX-XXXX',
    tagline: 'A Peer Reviewed Research Journal',
    description:
      'SOURCE is a peer-reviewed journal of Don Bosco College, Tura, fostering scholarly inquiry and knowledge sharing.',
    contactEmail: 'source.journal@donboscocollege.ac.in',
  });
  await ensureSourceContent(tenant.id, source.id);

  console.log(`✓ Journals portal ready for tenant "${tenantSlug}"`);
  console.log(
    '  Local: http://transient.demo.localhost:3000 (hosts file → 127.0.0.1)',
  );
  console.log(
    '  Or path: http://localhost:3000/journals-portal?journal=transient',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
