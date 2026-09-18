import { prisma } from '@/lib/prisma';

export const LEGAL_REVIEW_NOTE =
  'This page is published as BaseCode Labs company policy information. It should be reviewed by a qualified legal professional before being treated as final legal terms. Signed quotations, licenses and service agreements prevail if they differ.';

export async function listLegalDocuments() {
  return prisma.legalDocument.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { displayOrder: 'asc' },
    include: { versions: { orderBy: { publishedAt: 'desc' } } },
  });
}

export async function getLegalDocument(slug: string) {
  return prisma.legalDocument.findFirst({
    where: { slug, status: 'PUBLISHED' },
    include: { versions: { orderBy: { publishedAt: 'desc' } } },
  });
}
