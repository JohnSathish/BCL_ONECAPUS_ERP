import { prisma } from '@/lib/prisma';
import { LEGAL_SEEDS } from '../../prisma/legal-content';

export const LEGAL_REVIEW_NOTE =
  'This page is published as BaseCode Labs company policy information. It should be reviewed by a qualified legal professional before being treated as final legal terms. Signed quotations, licenses and service agreements prevail if they differ.';

const EFFECTIVE = new Date('2026-09-18T00:00:00.000Z');

const SLUG_ALIASES: Record<string, string> = {
  privacy: 'privacy-policy',
  'privacy-policy.html': 'privacy-policy',
  terms: 'terms',
  'terms-and-conditions': 'terms',
  'terms-and-conditions.html': 'terms',
  cookies: 'cookie-policy',
  'cookie-policy.html': 'cookie-policy',
  refund: 'refund-policy',
  'refund-policy.html': 'refund-policy',
};

function canonicalSlug(slug: string) {
  const trimmed = slug.replace(/^\//, '').toLowerCase();
  return SLUG_ALIASES[trimmed] ?? trimmed;
}

function fromSeed(slug: string) {
  const seed = LEGAL_SEEDS.find((d) => d.slug === slug);
  if (!seed) return null;
  return {
    id: seed.slug,
    slug: seed.slug,
    title: seed.title,
    shortDescription: seed.shortDescription,
    category: 'Legal',
    icon: seed.icon,
    version: '1.0',
    status: 'PUBLISHED',
    effectiveDate: EFFECTIVE,
    lastUpdated: EFFECTIVE,
    contentHtml: seed.contentHtml,
    publishedBy: 'BaseCode Labs Pvt. Ltd.',
    displayOrder: seed.displayOrder,
    createdAt: EFFECTIVE,
    updatedAt: EFFECTIVE,
    versions: [] as Array<{
      id: string;
      version: string;
      contentHtml: string;
      changeSummary: string;
      publishedBy: string;
      publishedAt: Date;
    }>,
  };
}

export async function listLegalDocuments() {
  try {
    const rows = await prisma.legalDocument.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { displayOrder: 'asc' },
      include: { versions: { orderBy: { publishedAt: 'desc' } } },
    });
    if (rows.length) return rows;
  } catch {
    /* SQLite not seeded yet */
  }
  return LEGAL_SEEDS.map((s) => fromSeed(s.slug)!);
}

export async function getLegalDocument(slug: string) {
  const key = canonicalSlug(slug);
  try {
    const row = await prisma.legalDocument.findFirst({
      where: { slug: key, status: 'PUBLISHED' },
      include: { versions: { orderBy: { publishedAt: 'desc' } } },
    });
    if (row) return row;
  } catch {
    /* SQLite not seeded yet */
  }
  return fromSeed(key);
}
