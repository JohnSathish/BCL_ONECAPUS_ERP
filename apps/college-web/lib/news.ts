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
    featured: fields.featured === true,
  };
}

/** List cards — API omits full HTML bodies for speed. */
export async function getPublicNews(): Promise<NewsItem[]> {
  try {
    const rows = await fetchCms('content/news', {}, 120, 12000);
    if (!Array.isArray(rows) || !rows.length) return [];
    return rows
      .map(mapNewsRow)
      .filter((item): item is NewsItem => Boolean(item))
      .filter((item) => !isDemoWebsiteContentSlug(item.slug));
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
