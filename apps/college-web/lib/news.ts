import 'server-only';

import { fetchCms, isRecord } from '@/lib/cms-client';
import type { NewsItem } from '@/lib/content';

export async function getPublicNews(): Promise<NewsItem[]> {
  try {
    const rows = await fetchCms('content/news', {}, 120);
    if (!Array.isArray(rows) || !rows.length) return [];
    return rows
      .map((row) => {
        if (!isRecord(row)) return null;
        const slug = typeof row.slug === 'string' ? row.slug : null;
        const title = typeof row.title === 'string' ? row.title : null;
        if (!slug || !title) return null;
        const fields = isRecord(row.fields) ? row.fields : {};
        const excerpt =
          (typeof fields.excerpt === 'string' && fields.excerpt) ||
          (typeof row.excerpt === 'string' && row.excerpt) ||
          '';
        const image =
          (typeof fields.image === 'string' && fields.image) ||
          (typeof fields.coverImage === 'string' && fields.coverImage) ||
          '/images/campus-hero.webp';
        const category =
          (typeof fields.category === 'string' && fields.category) ||
          (typeof row.category === 'string' && row.category) ||
          'News';
        const date =
          (typeof row.publishedAt === 'string' && row.publishedAt.slice(0, 10)) ||
          (typeof row.updatedAt === 'string' && row.updatedAt.slice(0, 10)) ||
          new Date().toISOString().slice(0, 10);
        const body =
          Array.isArray(fields.body) && fields.body.every((item) => typeof item === 'string')
            ? (fields.body as string[])
            : typeof fields.bodyHtml === 'string'
              ? [fields.bodyHtml]
              : [excerpt];
        return { slug, title, date, category, excerpt, image, body } satisfies NewsItem;
      })
      .filter((item): item is NewsItem => Boolean(item));
  } catch {
    return [];
  }
}
