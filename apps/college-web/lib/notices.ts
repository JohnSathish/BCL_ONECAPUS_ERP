import 'server-only';

import { fetchCms, isRecord } from '@/lib/cms-client';
import { isDemoWebsiteContentSlug } from '@/lib/demo-content-slugs';
import type { HubNotice, HubNoticeBadge } from '@/lib/information-hub';
import { absolutizeMediaUrl } from '@/lib/media-url';

export type PublicNotice = {
  id: string;
  title: string;
  slug: string;
  bodyHtml: string;
  category: string;
  priority: string;
  publishAt: string;
  attachmentUrl: string;
  attachmentName: string;
  attachments: Array<{ url: string; name: string }>;
  href: string;
  urgent: boolean;
};

function badgeFromNotice(
  priority: string,
  category: string,
  hasAttachment: boolean,
): HubNoticeBadge | 'URGENT' {
  if (priority === 'URGENT') return 'URGENT';
  if (priority === 'IMPORTANT') return 'IMPORTANT';
  if (hasAttachment) return 'PDF';
  const map: Record<string, HubNoticeBadge> = {
    HOLIDAY: 'HOLIDAY',
    CIRCULAR: 'CIRCULAR',
    SCHOLARSHIP: 'SCHOLARSHIP',
    TENDER: 'TENDER',
    EXAMINATION: 'EXAM',
  };
  return map[category] ?? 'NEW';
}

function extractAttachments(row: Record<string, unknown>): Array<{ url: string; name: string }> {
  const out: Array<{ url: string; name: string }> = [];
  const seen = new Set<string>();
  const push = (urlRaw: unknown, nameRaw?: unknown) => {
    const raw = typeof urlRaw === 'string' ? urlRaw.trim() : '';
    if (!raw || seen.has(raw)) return;
    seen.add(raw);
    const absolute = absolutizeMediaUrl(raw) || raw;
    const name = typeof nameRaw === 'string' && nameRaw.trim() ? nameRaw.trim() : 'PDF';
    out.push({ url: absolute, name });
  };

  if (Array.isArray(row.attachments)) {
    for (const item of row.attachments) {
      if (!isRecord(item)) continue;
      push(item.url, item.name);
    }
  }
  if (!out.length) {
    push(row.attachmentUrl, row.attachmentName);
  }
  return out;
}

function mapPublicNotice(row: unknown): PublicNotice | null {
  if (!isRecord(row) || typeof row.title !== 'string' || typeof row.id !== 'string') return null;
  const slug = typeof row.slug === 'string' && row.slug.trim() ? row.slug : row.id;
  if (isDemoWebsiteContentSlug(slug)) return null;
  const attachments = extractAttachments(row);
  const priority = typeof row.priority === 'string' ? row.priority : 'NORMAL';
  const category = typeof row.category === 'string' ? row.category : 'GENERAL';
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
    bodyHtml: typeof row.bodyHtml === 'string' ? row.bodyHtml : '',
    category,
    priority,
    publishAt,
    attachmentUrl: attachments[0]?.url ?? '',
    attachmentName: attachments[0]?.name ?? 'PDF',
    attachments,
    href: `/notices/${slug}`,
    urgent: priority === 'URGENT',
  };
}

export async function getPublicNotices(): Promise<HubNotice[]> {
  const rows = await fetchCms('notices', {}, 120);
  if (!Array.isArray(rows) || !rows.length) return [];
  const notices: HubNotice[] = [];
  for (const row of rows) {
    const mapped = mapPublicNotice(row);
    if (!mapped) continue;
    notices.push({
      id: mapped.id,
      title: mapped.title,
      badge: badgeFromNotice(mapped.priority, mapped.category, mapped.attachments.length > 0),
      publishedAt: mapped.publishAt.slice(0, 10),
      href: mapped.href,
      attachmentHref: mapped.attachmentUrl || undefined,
      attachments: mapped.attachments,
      urgent: mapped.urgent,
    });
  }
  return notices;
}

export async function listPublicNoticesDetailed(): Promise<PublicNotice[]> {
  const rows = await fetchCms('notices', {}, 120);
  if (!Array.isArray(rows)) return [];
  return rows.map(mapPublicNotice).filter((row): row is PublicNotice => Boolean(row));
}

export async function getPublicNotice(slug: string): Promise<PublicNotice | null> {
  const row = await fetchCms(`notices/${encodeURIComponent(slug)}`, {}, 60, 8000);
  return mapPublicNotice(row);
}
