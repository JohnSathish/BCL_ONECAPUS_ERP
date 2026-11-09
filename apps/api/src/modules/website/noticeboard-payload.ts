/**
 * Shapes the public digital notice board from Website CMS notices,
 * image notices, ticker announcements, and academic-calendar events.
 * The left carousel uses Image Notices only. PDF notices stay in the text list.
 */

const IMAGE_EXT = /\.(?:jpe?g|png|webp)$/i;

const PRIORITY_RANK: Record<string, number> = {
  URGENT: 0,
  IMPORTANT: 1,
  NORMAL: 2,
};

const DURATION_MS: Record<string, number> = {
  URGENT: 20_000,
  IMPORTANT: 15_000,
  NORMAL: 10_000,
};

const NEW_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export type NoticeboardSourceNotice = {
  id: string;
  title: string;
  slug: string;
  bodyHtml?: string | null;
  category?: string | null;
  priority?: string | null;
  publishAt?: Date | string | null;
  attachments?: Array<{ url?: string | null; name?: string | null }> | null;
  attachmentUrl?: string | null;
};

export type NoticeboardSourceImage = {
  id: string;
  title: string;
  caption?: string | null;
  imageUrl: string;
  createdAt?: Date | string | null;
};

export type NoticeboardSourceAnnouncement = {
  id: string;
  title: string;
};

export type NoticeboardSourceEvent = {
  id: string;
  title: string;
  date: string;
  endDate?: string | null;
  category?: string | null;
  type?: string | null;
  description?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  venue?: string | null;
  isAllDay?: boolean | null;
};

export type NoticeboardBanner = {
  id: string;
  noticeId: string;
  title: string;
  category: string;
  priority: string;
  imageUrl: string;
  excerpt: string;
  publishAt: string | null;
  durationMs: number;
};

export type NoticeboardNoticeCard = {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  priority: string;
  publishAt: string | null;
  isNew: boolean;
  hasImage: boolean;
};

export type NoticeboardPayload = {
  banners: NoticeboardBanner[];
  notices: NoticeboardNoticeCard[];
  ticker: Array<{ id: string; text: string }>;
  events: Array<{
    id: string;
    title: string;
    date: string;
    endDate: string | null;
    category: string;
    description: string | null;
    startTime: string | null;
    endTime: string | null;
    venue: string | null;
    isAllDay: boolean;
  }>;
};

function priorityRank(priority?: string | null) {
  return PRIORITY_RANK[(priority ?? 'NORMAL').toUpperCase()] ?? 3;
}

function publishTime(value?: Date | string | null) {
  if (!value) return 0;
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function isoDate(value?: Date | string | null) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

export function isNoticeboardImageUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed || /^data:/i.test(trimmed) || /^javascript:/i.test(trimmed)) {
    return false;
  }
  const path = trimmed.split(/[?#]/, 1)[0] ?? trimmed;
  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    decoded = path;
  }
  return IMAGE_EXT.test(decoded);
}

export function noticeImageUrls(notice: NoticeboardSourceNotice) {
  const urls: string[] = [];
  const seen = new Set<string>();
  const push = (raw?: string | null) => {
    const url = raw?.trim() ?? '';
    if (!url || seen.has(url) || !isNoticeboardImageUrl(url)) return;
    seen.add(url);
    urls.push(url);
  };

  const html = notice.bodyHtml ?? '';
  const imgSrc = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
  for (const match of html.matchAll(imgSrc)) {
    push(match[1]?.replace(/&amp;/g, '&'));
  }
  for (const file of notice.attachments ?? []) {
    push(file?.url);
  }
  push(notice.attachmentUrl);
  return urls;
}

export function noticeExcerpt(html: string | null | undefined, max = 180) {
  const text = (html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function compareNotices(
  a: NoticeboardSourceNotice,
  b: NoticeboardSourceNotice,
) {
  const rank = priorityRank(a.priority) - priorityRank(b.priority);
  if (rank !== 0) return rank;
  return publishTime(b.publishAt) - publishTime(a.publishAt);
}

export function buildNoticeboardPayload(input: {
  notices: NoticeboardSourceNotice[];
  imageNotices?: NoticeboardSourceImage[];
  announcements: NoticeboardSourceAnnouncement[];
  events: NoticeboardSourceEvent[];
  now?: Date;
}): NoticeboardPayload {
  const now = input.now ?? new Date();
  const notices = [...input.notices].sort(compareNotices);
  const cards: NoticeboardNoticeCard[] = notices.map((notice) => {
    const priority = (notice.priority ?? 'NORMAL').toUpperCase();
    const publishedMs = publishTime(notice.publishAt);
    return {
      id: notice.id,
      title: notice.title,
      excerpt: noticeExcerpt(notice.bodyHtml),
      category: notice.category || 'GENERAL',
      priority,
      publishAt: isoDate(notice.publishAt),
      isNew: publishedMs > 0 && now.getTime() - publishedMs <= NEW_WINDOW_MS,
      hasImage: false,
    };
  });
  const banners: NoticeboardBanner[] = (input.imageNotices ?? []).flatMap(
    (image) => {
      const imageUrl = image.imageUrl?.trim() ?? '';
      if (!isNoticeboardImageUrl(imageUrl)) return [];
      return [
        {
          id: image.id,
          noticeId: image.id,
          title: image.title.trim() || 'Notice',
          category: 'IMAGE',
          priority: 'NORMAL',
          imageUrl,
          excerpt: (image.caption ?? '').trim(),
          publishAt: isoDate(image.createdAt),
          durationMs: 8_000,
        },
      ];
    },
  );

  const tickerSource = input.announcements.filter((row) => row.title?.trim());
  const ticker =
    tickerSource.length > 0
      ? tickerSource.map((row) => ({ id: row.id, text: row.title.trim() }))
      : cards
          .filter(
            (row) => row.priority === 'URGENT' || row.priority === 'IMPORTANT',
          )
          .map((row) => ({ id: row.id, text: row.title }));

  return {
    banners,
    notices: cards,
    ticker,
    events: input.events.slice(0, 6).map((event) => ({
      id: event.id,
      title: event.title,
      date: event.date,
      endDate: event.endDate ?? null,
      category: event.category || event.type || 'Academic',
      description: event.description ?? null,
      startTime: event.startTime ?? null,
      endTime: event.endTime ?? null,
      venue: event.venue ?? null,
      isAllDay: event.isAllDay !== false,
    })),
  };
}
