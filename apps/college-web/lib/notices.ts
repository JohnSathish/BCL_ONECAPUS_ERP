import 'server-only';

import { fetchCms, isRecord } from '@/lib/cms-client';
import { isDemoWebsiteContentSlug } from '@/lib/demo-content-slugs';
import type { HubNotice, HubNoticeBadge } from '@/lib/information-hub';
import { absolutizeMediaUrl } from '@/lib/media-url';

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

export async function getPublicNotices(): Promise<HubNotice[]> {
  const rows = await fetchCms('notices', {}, 120);
  if (!Array.isArray(rows) || !rows.length) return [];
  const notices: HubNotice[] = [];
  for (const row of rows) {
    if (!isRecord(row) || typeof row.title !== 'string' || typeof row.id !== 'string') continue;
    const slug = typeof row.slug === 'string' ? row.slug : '';
    if (isDemoWebsiteContentSlug(slug)) continue;
    const attachments = extractAttachments(row);
    const attachmentUrl = attachments[0]?.url;
    const priority = typeof row.priority === 'string' ? row.priority : 'NORMAL';
    const category = typeof row.category === 'string' ? row.category : 'GENERAL';
    const publishedAt =
      typeof row.publishAt === 'string'
        ? row.publishAt
        : typeof row.createdAt === 'string'
          ? row.createdAt
          : new Date().toISOString();
    notices.push({
      id: row.id,
      title: row.title,
      badge: badgeFromNotice(priority, category, attachments.length > 0),
      publishedAt: publishedAt.slice(0, 10),
      href: `/notices/${typeof row.slug === 'string' ? row.slug : row.id}`,
      attachmentHref: attachmentUrl,
      attachments,
      urgent: priority === 'URGENT',
    });
  }
  return notices;
}
