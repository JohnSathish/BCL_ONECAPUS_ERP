import 'server-only';

import { fetchCms, isRecord } from '@/lib/cms-client';
import { listPublicAnnouncements } from '@/lib/announcements';
import { seedContent } from '@/lib/content';
import { seedInformationHub } from '@/lib/information-hub';
import { getPublicNews } from '@/lib/news';
import { getPublicNotices } from '@/lib/notices';

export type FlashAnnouncement = {
  id: string;
  title: string;
  href?: string;
  isNew?: boolean;
};

function asFields(row: Record<string, unknown>) {
  return {
    ...((isRecord(row.fields) ? row.fields : {}) as Record<string, unknown>),
    ...((isRecord(row.data) ? row.data : {}) as Record<string, unknown>),
  };
}

function isRecent(dateValue: unknown, withinDays = 21) {
  if (typeof dateValue !== 'string' || !dateValue) return false;
  const time = Date.parse(dateValue);
  if (!Number.isFinite(time)) return false;
  return Date.now() - time <= withinDays * 24 * 60 * 60 * 1000;
}

function mapContentEntries(rows: unknown[]): FlashAnnouncement[] {
  if (!Array.isArray(rows)) return [];
  const items: FlashAnnouncement[] = [];
  for (const row of rows) {
    if (!isRecord(row)) continue;
    const fields = asFields(row);
    const title =
      (typeof row.title === 'string' && row.title.trim()) ||
      (typeof fields.summary === 'string' && fields.summary.trim()) ||
      '';
    if (!title) continue;
    const id = typeof row.id === 'string' ? row.id : title;
    const href =
      typeof fields.href === 'string' && fields.href.trim() ? fields.href.trim() : undefined;
    items.push({
      id,
      title,
      href,
      isNew: isRecent(row.publishedAt) || isRecent(row.updatedAt) || isRecent(row.createdAt),
    });
  }
  return items;
}

function pushUnique(
  merged: FlashAnnouncement[],
  seen: Set<string>,
  item: FlashAnnouncement,
  limit: number,
) {
  const key = item.title.trim().toLowerCase();
  if (!key || seen.has(key) || merged.length >= limit) return;
  seen.add(key);
  merged.push(item);
}

/**
 * Prefer dedicated WebsiteAnnouncement records for the ticker.
 * Fall back to legacy CPT flash-news, notices, news, then college seed copy
 * so the homepage bar is never blank while CMS content is being published.
 */
export async function getFlashAnnouncements(limit = 12): Promise<FlashAnnouncement[]> {
  const [announcements, flash, notices, news] = await Promise.all([
    listPublicAnnouncements({ ticker: true }),
    fetchCms('content/flash-news', {}, 60, 8000),
    getPublicNotices(),
    getPublicNews(),
  ]);

  // If nothing is marked for ticker, still show any published announcements.
  const announcementPool =
    announcements.length > 0
      ? announcements
      : await listPublicAnnouncements().catch(
          () => [] as Awaited<ReturnType<typeof listPublicAnnouncements>>,
        );

  const fromAnnouncements: FlashAnnouncement[] = announcementPool.map((item) => ({
    id: `announcement-${item.id}`,
    title: item.title,
    href: item.href,
    isNew: item.isNew || item.isPinned,
  }));

  const fromFlash = mapContentEntries(Array.isArray(flash) ? flash : []);
  const fromNotices: FlashAnnouncement[] = notices.map((notice) => ({
    id: `notice-${notice.id}`,
    title: notice.title,
    href: notice.href,
    isNew: notice.badge === 'NEW' || notice.urgent || isRecent(notice.publishedAt),
  }));
  const fromNews: FlashAnnouncement[] = news.slice(0, 8).map((item) => ({
    id: `news-${item.slug}`,
    title: item.title,
    href: `/news/${item.slug}`,
    isNew: isRecent(item.date),
  }));

  const merged: FlashAnnouncement[] = [];
  const seen = new Set<string>();
  for (const item of [...fromAnnouncements, ...fromFlash, ...fromNotices, ...fromNews]) {
    pushUnique(merged, seen, item, limit);
  }

  if (!merged.length) {
    for (const notice of seedInformationHub.notices) {
      pushUnique(
        merged,
        seen,
        {
          id: `seed-notice-${notice.id}`,
          title: notice.title,
          href: notice.href,
          isNew: notice.badge === 'NEW' || Boolean(notice.urgent),
        },
        limit,
      );
    }
    for (const item of seedContent.news.slice(0, 8)) {
      pushUnique(
        merged,
        seen,
        {
          id: `seed-news-${item.slug}`,
          title: item.title,
          href: `/news/${item.slug}`,
          isNew: isRecent(item.date),
        },
        limit,
      );
    }
  }

  return merged;
}
