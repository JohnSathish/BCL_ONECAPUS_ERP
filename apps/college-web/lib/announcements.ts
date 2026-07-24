import 'server-only';

import { fetchCms, isRecord } from '@/lib/cms-client';
import { absolutizeMediaUrl } from '@/lib/media-url';

export type PublicAnnouncement = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  bodyHtml: string;
  featuredImageUrl: string;
  featuredImageAlt: string;
  attachmentUrl: string;
  attachmentName: string;
  isPinned: boolean;
  publishAt: string;
  expireAt: string | null;
  href: string;
  isNew: boolean;
};

function mapRow(row: unknown): PublicAnnouncement | null {
  if (!isRecord(row) || typeof row.id !== 'string' || typeof row.title !== 'string') return null;
  const slug = typeof row.slug === 'string' ? row.slug : row.id;
  const featuredRaw = typeof row.featuredImageUrl === 'string' ? row.featuredImageUrl : '';
  const attachmentRaw = typeof row.attachmentUrl === 'string' ? row.attachmentUrl : '';
  const publishAt =
    typeof row.publishAt === 'string'
      ? row.publishAt
      : typeof row.createdAt === 'string'
        ? row.createdAt
        : new Date().toISOString();
  return {
    id: row.id,
    title: row.title,
    slug,
    summary: typeof row.summary === 'string' ? row.summary : '',
    bodyHtml: typeof row.bodyHtml === 'string' ? row.bodyHtml : '',
    featuredImageUrl: absolutizeMediaUrl(featuredRaw) || featuredRaw,
    featuredImageAlt:
      typeof row.featuredImageAlt === 'string' && row.featuredImageAlt.trim()
        ? row.featuredImageAlt
        : row.title,
    attachmentUrl: absolutizeMediaUrl(attachmentRaw) || attachmentRaw,
    attachmentName:
      typeof row.attachmentName === 'string' && row.attachmentName.trim()
        ? row.attachmentName
        : 'Download PDF',
    isPinned: row.isPinned === true,
    publishAt,
    expireAt: typeof row.expireAt === 'string' ? row.expireAt : null,
    href: typeof row.href === 'string' ? row.href : `/announcements/${slug}`,
    isNew: row.isNew === true,
  };
}

export async function listPublicAnnouncements(opts?: {
  ticker?: boolean;
}): Promise<PublicAnnouncement[]> {
  const query = opts?.ticker ? { ticker: '1' } : undefined;
  const rows = await fetchCms('announcements', query, 60, 8000);
  if (!Array.isArray(rows)) return [];
  return rows.map(mapRow).filter((row): row is PublicAnnouncement => Boolean(row));
}

export async function getPublicAnnouncement(slug: string): Promise<PublicAnnouncement | null> {
  const row = await fetchCms(`announcements/${encodeURIComponent(slug)}`, {}, 60, 8000);
  return mapRow(row);
}
