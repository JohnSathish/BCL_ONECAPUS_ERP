import 'server-only';

import { fetchCms, isRecord } from '@/lib/cms-client';
import type { NewsItem } from '@/lib/content';
import { isDemoWebsiteContentSlug } from '@/lib/demo-content-slugs';

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function stringField(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function htmlToParagraphs(html: string): string[] {
  const cleaned = html
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
  const parts = cleaned
    .split('\n')
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return parts.length ? parts : cleaned ? [cleaned] : [];
}

function resolveBody(
  fields: Record<string, unknown>,
  excerpt: string,
): { body: string[]; bodyHtml?: string } {
  if (typeof fields.body === 'string' && fields.body.includes('<')) {
    return { body: htmlToParagraphs(fields.body), bodyHtml: fields.body };
  }
  if (typeof fields.bodyHtml === 'string' && fields.bodyHtml.trim()) {
    return { body: htmlToParagraphs(fields.bodyHtml), bodyHtml: fields.bodyHtml };
  }
  if (Array.isArray(fields.body) && fields.body.every((item) => typeof item === 'string')) {
    return { body: fields.body as string[] };
  }
  if (typeof fields.body === 'string' && fields.body.trim()) {
    return { body: [fields.body.trim()] };
  }
  return { body: excerpt ? [excerpt] : [] };
}

function mapGallery(value: unknown): NewsItem['gallery'] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!isRecord(item)) return null;
      const src = stringField(item.src);
      if (!src) return null;
      return {
        src,
        alt: stringField(item.alt),
        caption: stringField(item.caption),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

function mapAttachments(value: unknown): NewsItem['attachments'] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!isRecord(item)) return null;
      const url = stringField(item.url);
      if (!url) return null;
      return {
        url,
        name: stringField(item.name, 'Download'),
        mime: stringField(item.mime),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

function mapTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()));
}

function mapRelated(value: unknown): string[] {
  return mapTags(value);
}

function mapNewsRow(row: unknown): NewsItem | null {
  if (!isRecord(row)) return null;
  const slug = typeof row.slug === 'string' ? row.slug : null;
  const title = typeof row.title === 'string' ? row.title : null;
  if (!slug || !title) return null;
  const fields = {
    ...asRecord(row.fields),
    ...asRecord(row.data),
  };
  const excerpt = stringField(fields.summary, fields.excerpt, row.excerpt);
  const rawImage = stringField(fields.image, fields.coverImage, fields.imageThumb);
  const image = rawImage && !rawImage.includes('campus-hero') ? rawImage : '';
  const category = stringField(fields.category, row.category, 'News');
  const date =
    (typeof row.publishedAt === 'string' && row.publishedAt.slice(0, 10)) ||
    (typeof row.updatedAt === 'string' && row.updatedAt.slice(0, 10)) ||
    new Date().toISOString().slice(0, 10);
  const { body, bodyHtml } = resolveBody(fields, excerpt);
  return {
    slug,
    title,
    date,
    category,
    excerpt,
    image,
    body,
    bodyHtml,
    author: stringField(fields.author) || undefined,
    seoTitle: stringField(fields.seoTitle) || undefined,
    seoDescription: stringField(fields.seoDescription) || undefined,
    seoKeywords: stringField(fields.seoKeywords) || undefined,
    ogImage: stringField(fields.ogImage, fields.image) || undefined,
    featured: fields.featured === true,
    sticky: fields.sticky === true,
    tags: mapTags(fields.tags),
    gallery: mapGallery(fields.gallery),
    attachments: mapAttachments(fields.attachments),
    relatedSlugs: mapRelated(fields.relatedSlugs),
    viewCount: typeof fields.viewCount === 'number' ? fields.viewCount : undefined,
  };
}

function sortNews(items: NewsItem[]): NewsItem[] {
  return [...items].sort((a, b) => {
    const stickyDiff = Number(Boolean(b.sticky)) - Number(Boolean(a.sticky));
    if (stickyDiff) return stickyDiff;
    const featuredDiff = Number(Boolean(b.featured)) - Number(Boolean(a.featured));
    if (featuredDiff) return featuredDiff;
    return b.date.localeCompare(a.date);
  });
}

/** List cards — API omits full HTML bodies for speed. */
export async function getPublicNews(): Promise<NewsItem[]> {
  try {
    const rows = await fetchCms('content/news', {}, 120, 12000);
    if (!Array.isArray(rows) || !rows.length) return [];
    return sortNews(
      rows
        .map(mapNewsRow)
        .filter((item): item is NewsItem => Boolean(item))
        .filter((item) => !isDemoWebsiteContentSlug(item.slug)),
    );
  } catch {
    return [];
  }
}

/** Full article including body HTML. */
export async function getPublicNewsBySlug(slug: string): Promise<NewsItem | null> {
  if (isDemoWebsiteContentSlug(slug)) return null;
  try {
    const row = await fetchCms('content/news', { entry: slug }, 120, 12000);
    return mapNewsRow(row);
  } catch {
    return null;
  }
}
