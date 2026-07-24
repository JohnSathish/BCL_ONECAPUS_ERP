/**
 * One-time migration: import News & Events from https://donboscocollege.ac.in/news
 * into Website CMS content entries + media library.
 *
 * Usage:
 *   npx tsx scripts/import-donbosco-news.ts
 *   npx tsx scripts/import-donbosco-news.ts --dry-run
 *   npx tsx scripts/import-donbosco-news.ts --tenant=demo --limit=5
 */
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import * as cheerio from 'cheerio';
import { PrismaClient, type Prisma } from '@prisma/client';
import sharp from 'sharp';
import {
  resolveStorageRoot,
  resolveUploadRoot,
} from '../src/common/uploads/upload-paths';
import { sanitizeWebsiteHtml } from '../src/modules/website/utils/website-html-sanitizer';

const SOURCE_ORIGIN = 'https://donboscocollege.ac.in';
const SOURCE_INDEX = `${SOURCE_ORIGIN}/news`;
const USER_AGENT =
  'BCL-OneCampus-NewsImporter/1.0 (+https://erp.donboscocollege.ac.in)';

const NEWS_FIELD_DEFS = [
  { key: 'summary', label: 'Summary', type: 'text', required: true },
  { key: 'body', label: 'Body', type: 'richText', required: true },
  { key: 'image', label: 'Featured image', type: 'image', required: false },
  {
    key: 'imageThumb',
    label: 'Featured thumbnail',
    type: 'image',
    required: false,
  },
  { key: 'gallery', label: 'Gallery images', type: 'json', required: false },
  { key: 'category', label: 'Category', type: 'text', required: false },
  { key: 'author', label: 'Author', type: 'text', required: false },
  { key: 'tags', label: 'Tags', type: 'json', required: false },
  { key: 'seoTitle', label: 'SEO meta title', type: 'text', required: false },
  {
    key: 'seoDescription',
    label: 'SEO description',
    type: 'text',
    required: false,
  },
  { key: 'featured', label: 'Featured news', type: 'boolean', required: false },
  {
    key: 'sourceUrl',
    label: 'Original source URL',
    type: 'text',
    required: false,
  },
] as const;

type CliOptions = {
  tenantSlug: string;
  dryRun: boolean;
  limit: number | null;
  concurrency: number;
};

type ListedArticle = {
  path: string;
  slug: string;
  sourceUrl: string;
  listingTitle: string | null;
  listingSummary: string | null;
  listingDate: string | null;
};

type ParsedArticle = {
  title: string;
  slug: string;
  summary: string;
  bodyHtml: string;
  publishedAt: Date | null;
  featuredImageUrl: string | null;
  gallery: Array<{ src: string; alt: string; caption: string }>;
  author: string | null;
  category: string;
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  sourceUrl: string;
};

type ImportReport = {
  startedAt: string;
  finishedAt: string | null;
  source: string;
  tenantSlug: string;
  dryRun: boolean;
  totals: {
    found: number;
    imported: number;
    skippedDuplicates: number;
    imagesDownloaded: number;
    thumbnailsGenerated: number;
    failed: number;
  };
  items: Array<{
    slug: string;
    status: 'imported' | 'skipped' | 'failed';
    title?: string;
    message?: string;
    sourceUrl?: string;
    images?: number;
  }>;
};

function parseArgs(argv: string[]): CliOptions {
  let tenantSlug = 'demo';
  let dryRun = false;
  let limit: number | null = null;
  let concurrency = 3;
  for (const arg of argv) {
    if (arg === '--dry-run') dryRun = true;
    else if (arg.startsWith('--tenant='))
      tenantSlug = arg.slice('--tenant='.length).trim() || 'demo';
    else if (arg.startsWith('--limit=')) {
      const n = Number.parseInt(arg.slice('--limit='.length), 10);
      limit = Number.isFinite(n) && n > 0 ? n : null;
    } else if (arg.startsWith('--concurrency=')) {
      const n = Number.parseInt(arg.slice('--concurrency='.length), 10);
      if (Number.isFinite(n) && n > 0) concurrency = Math.min(n, 6);
    }
  }
  return { tenantSlug, dryRun, limit, concurrency };
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'user-agent': USER_AGENT,
      accept: 'text/html,application/xhtml+xml',
    },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function encodeImageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.pathname = parsed.pathname
      .split('/')
      .map((segment) => encodeURIComponent(decodeURIComponent(segment)))
      .join('/');
    return parsed.toString();
  } catch {
    return url.replace(/ /g, '%20');
  }
}

async function fetchBinary(
  url: string,
): Promise<{ buffer: Buffer; contentType: string | null } | null> {
  const candidates = [encodeImageUrl(url), url];
  // Next image optimizer sometimes still serves assets when the raw path 404s.
  try {
    const parsed = new URL(url);
    if (parsed.origin === SOURCE_ORIGIN) {
      candidates.push(
        `${SOURCE_ORIGIN}/_next/image?url=${encodeURIComponent(parsed.pathname)}&w=1200&q=75`,
      );
    }
  } catch {
    // ignore
  }

  for (const candidate of candidates) {
    try {
      const res = await fetch(candidate, {
        headers: { 'user-agent': USER_AGENT, accept: 'image/*,*/*' },
        redirect: 'follow',
      });
      if (!res.ok) continue;
      const buffer = Buffer.from(await res.arrayBuffer());
      if (!buffer.length) continue;
      const contentType = res.headers.get('content-type');
      if (contentType && /text\/html/i.test(contentType)) continue;
      return { buffer, contentType };
    } catch {
      // try next candidate
    }
  }
  return null;
}

function absolutize(
  src: string | undefined | null,
  base = SOURCE_ORIGIN,
): string | null {
  if (!src) return null;
  const trimmed = src.trim();
  if (!trimmed || trimmed.startsWith('data:')) return null;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/_next/image')) {
    try {
      const u = new URL(trimmed, base);
      const raw = u.searchParams.get('url');
      if (raw) return absolutize(decodeURIComponent(raw), base);
    } catch {
      return null;
    }
  }
  try {
    return new URL(trimmed, base).toString();
  } catch {
    return null;
  }
}

function slugify(input: string): string {
  return (
    input
      .trim()
      .toLowerCase()
      .replace(/^\/+|\/+$/g, '')
      .replace(/[^a-z0-9/]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'news-item'
  );
}

function monthFolder(date: Date): string {
  return date
    .toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })
    .toLowerCase();
}

function guessExt(fileNameOrUrl: string, contentType: string | null): string {
  const fromName = extname(fileNameOrUrl.split('?')[0] || '').toLowerCase();
  if (fromName && fromName.length <= 5) {
    if (fromName === '.jfif') return '.jpg';
    return fromName;
  }
  const ct = (contentType || '').toLowerCase();
  if (ct.includes('png')) return '.png';
  if (ct.includes('webp')) return '.webp';
  if (ct.includes('gif')) return '.gif';
  if (ct.includes('jpeg') || ct.includes('jpg')) return '.jpg';
  return '.jpg';
}

function stripTags(html: string): string {
  return cheerio.load(html).root().text().replace(/\s+/g, ' ').trim();
}

function parseListingDate(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return null;
  const month = m[1].padStart(2, '0');
  const day = m[2].padStart(2, '0');
  let year = m[3];
  if (year.length === 2) {
    const n = Number.parseInt(year, 10);
    year = String(n >= 70 ? 1900 + n : 2000 + n);
  }
  const yNum = Number.parseInt(year, 10);
  if (!Number.isFinite(yNum) || yNum < 1990 || yNum > 2100) return null;
  return `${year}-${month}-${day}`;
}

async function listArticles(): Promise<ListedArticle[]> {
  const html = await fetchText(SOURCE_INDEX);
  const $ = cheerio.load(html);
  const bySlug = new Map<string, ListedArticle>();

  $('a[href^="/news/"]').each((_, el) => {
    const href = ($(el).attr('href') || '').split('?')[0].replace(/\/$/, '');
    if (!href || href === '/news') return;
    const slug = slugify(href.replace(/^\/news\//, ''));
    if (!slug || slug === 'news') return;
    const card = $(el).closest('article, li, .card, div');
    const listingTitle =
      $(el).find('h2,h3').first().text().trim() ||
      $(el).attr('title')?.trim() ||
      $(el).text().replace(/\s+/g, ' ').trim().slice(0, 180) ||
      null;
    const listingSummary =
      card.find('p').first().text().replace(/\s+/g, ' ').trim() || null;
    const dateText =
      card.find('time').attr('datetime') ||
      card.find('time').text() ||
      card.text().match(/\d{1,2}\/\d{1,2}\/\d{4}/)?.[0] ||
      null;
    if (!bySlug.has(slug)) {
      bySlug.set(slug, {
        path: href.startsWith('/') ? href : `/news/${slug}`,
        slug,
        sourceUrl: `${SOURCE_ORIGIN}${href.startsWith('/') ? href : `/news/${slug}`}`,
        listingTitle,
        listingSummary,
        listingDate: parseListingDate(dateText),
      });
    }
  });

  return [...bySlug.values()];
}

function parseArticleHtml(html: string, listed: ListedArticle): ParsedArticle {
  const $ = cheerio.load(html);
  const title =
    $('article h1').first().text().trim() ||
    $('h1').first().text().trim() ||
    listed.listingTitle ||
    listed.slug;
  const publishedRaw =
    $('article time[datetime]').attr('datetime') ||
    $('time[datetime]').attr('datetime') ||
    listed.listingDate ||
    null;
  const publishedAtRaw = publishedRaw ? new Date(publishedRaw) : null;
  let publishedAt =
    publishedAtRaw && !Number.isNaN(publishedAtRaw.getTime())
      ? publishedAtRaw
      : null;
  if (
    publishedAt &&
    (publishedAt.getUTCFullYear() < 1990 || publishedAt.getUTCFullYear() > 2100)
  ) {
    publishedAt = listed.listingDate
      ? new Date(`${listed.listingDate}T00:00:00.000Z`)
      : null;
  }
  const summary =
    $('meta[name="description"]').attr('content')?.trim() ||
    listed.listingSummary ||
    $('article p').first().text().replace(/\s+/g, ' ').trim() ||
    '';
  const bodyEl = $('article .news-article-body').first();
  let bodyHtml = bodyEl.length ? bodyEl.html()?.trim() || '' : '';
  if (!bodyHtml) {
    const paragraphs = $('article p')
      .toArray()
      .map((p) => $(p).html()?.trim())
      .filter(Boolean);
    bodyHtml = paragraphs.map((p) => `<p>${p}</p>`).join('\n');
  }
  if (!bodyHtml && summary)
    bodyHtml = `<p>${cheerio.load('<div/>').text(summary).html()}</p>`;

  const featuredCandidate =
    $('article .relative img, article img').first().attr('src') ||
    $('article img').first().attr('srcset')?.split(/\s+/)[0] ||
    null;
  const featuredImageUrl = absolutize(featuredCandidate);

  const gallery: ParsedArticle['gallery'] = [];
  const seen = new Set<string>();
  bodyEl.find('img').each((_, img) => {
    const src = absolutize($(img).attr('src'));
    if (!src || seen.has(src)) return;
    seen.add(src);
    gallery.push({
      src,
      alt: ($(img).attr('alt') || '').trim(),
      caption: (
        $(img).closest('figure').find('figcaption').text() ||
        $(img).attr('title') ||
        ''
      ).trim(),
    });
  });

  const author =
    $('[rel="author"], .author, .byline')
      .first()
      .text()
      .replace(/\s+/g, ' ')
      .trim() || 'Don Bosco College, Tura';
  const categoryBadge = $('article .badge, article .category, [data-category]')
    .first()
    .text()
    .replace(/\s+/g, ' ')
    .trim();
  const category = categoryBadge || 'News & Events';
  const tagSet = new Set<string>(['news', 'events']);
  if (category) tagSet.add(category.toLowerCase());
  $('meta[name="keywords"]')
    .attr('content')
    ?.split(',')
    .forEach((t) => {
      const v = t.trim().toLowerCase();
      if (v) tagSet.add(v);
    });

  const seoTitle =
    $('meta[property="og:title"]').attr('content')?.trim() ||
    $('title')
      .first()
      .text()
      .replace(/\s*\|\s*Don Bosco.*$/i, '')
      .trim() ||
    title;
  const seoDescription =
    $('meta[name="description"]').attr('content')?.trim() ||
    summary.slice(0, 320);

  return {
    title,
    slug: listed.slug,
    summary: summary || title,
    bodyHtml,
    publishedAt:
      publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null,
    featuredImageUrl,
    gallery,
    author,
    category,
    tags: [...tagSet],
    seoTitle,
    seoDescription,
    sourceUrl: listed.sourceUrl,
  };
}

async function ensureFolderPath(
  prisma: PrismaClient,
  tenantId: string,
  siteId: string,
  parts: string[],
  cache: Map<string, string>,
): Promise<string | null> {
  let parentId: string | null = null;
  let pathKey = '';
  for (const name of parts) {
    pathKey = pathKey ? `${pathKey}/${name}` : name;
    const cached = cache.get(pathKey);
    if (cached) {
      parentId = cached;
      continue;
    }
    const existing = await prisma.websiteMediaFolder.findFirst({
      where: { siteId, parentId, name },
    });
    if (existing) {
      cache.set(pathKey, existing.id);
      parentId = existing.id;
      continue;
    }
    const created = await prisma.websiteMediaFolder.create({
      data: { tenantId, siteId, parentId, name },
    });
    cache.set(pathKey, created.id);
    parentId = created.id;
  }
  return parentId;
}

async function writeDual(storageKey: string, buffer: Buffer) {
  const storagePath = join(resolveStorageRoot(), storageKey);
  await mkdir(dirname(storagePath), { recursive: true });
  await writeFile(storagePath, buffer);
  const uploadPath = join(resolveUploadRoot(), storageKey);
  await mkdir(dirname(uploadPath), { recursive: true });
  await writeFile(uploadPath, buffer);
}

async function storeImage(opts: {
  prisma: PrismaClient;
  tenantId: string;
  siteId: string;
  actorId: string;
  folderId: string | null;
  sourceUrl: string;
  altText?: string;
  caption?: string;
  tags?: string[];
  year: number;
  month: string;
  dryRun: boolean;
}): Promise<{
  publicUrl: string;
  thumbUrl: string | null;
  bytes: number;
} | null> {
  if (opts.dryRun) {
    return {
      publicUrl: `/uploads/website/dry-run/${opts.year}/${opts.month}/preview.jpg`,
      thumbUrl: `/uploads/website/dry-run/${opts.year}/${opts.month}/preview-thumb.webp`,
      bytes: 0,
    };
  }

  const existing = await opts.prisma.websiteMediaAsset.findFirst({
    where: {
      siteId: opts.siteId,
      deletedAt: null,
      tags: {
        has: `source:${createHash('sha1').update(opts.sourceUrl).digest('hex').slice(0, 12)}`,
      },
    },
  });
  if (existing) {
    const thumb = await opts.prisma.websiteMediaAsset.findFirst({
      where: {
        siteId: opts.siteId,
        deletedAt: null,
        tags: { has: `thumb-of:${existing.id}` },
      },
    });
    return {
      publicUrl: existing.publicUrl,
      thumbUrl: thumb?.publicUrl ?? null,
      bytes: existing.bytes,
    };
  }

  const downloaded = await fetchBinary(opts.sourceUrl);
  if (!downloaded) return null;
  const { buffer, contentType } = downloaded;
  const ext = guessExt(opts.sourceUrl, contentType);
  const hash = createHash('sha1')
    .update(opts.sourceUrl)
    .digest('hex')
    .slice(0, 10);
  const baseName = `news-${hash}${ext === '.jfif' ? '.jpg' : ext}`;
  const id = randomUUID();
  const storageKey = `website/${opts.tenantId}/${opts.siteId}/news/${opts.year}/${opts.month}/${id}-${baseName}`;
  let finalBuffer = buffer;
  let mime = (contentType || 'image/jpeg').split(';')[0].toLowerCase();
  try {
    finalBuffer = await sharp(buffer).rotate().toBuffer();
    const meta = await sharp(finalBuffer).metadata();
    mime =
      meta.format === 'png'
        ? 'image/png'
        : meta.format === 'webp'
          ? 'image/webp'
          : meta.format === 'gif'
            ? 'image/gif'
            : 'image/jpeg';
  } catch {
    // keep original bytes if sharp cannot decode
  }

  await writeDual(storageKey, finalBuffer);
  const publicUrl = `/uploads/${storageKey}`;
  const sourceTag = `source:${createHash('sha1').update(opts.sourceUrl).digest('hex').slice(0, 12)}`;
  const asset = await opts.prisma.websiteMediaAsset.create({
    data: {
      tenantId: opts.tenantId,
      siteId: opts.siteId,
      folderId: opts.folderId,
      kind: 'IMAGE',
      storageKey,
      publicUrl,
      fileName: baseName,
      mimeType: mime,
      bytes: finalBuffer.length,
      altText: opts.altText || null,
      caption: opts.caption || null,
      tags: [...(opts.tags || []), 'news-import', sourceTag],
      createdById: opts.actorId,
    },
  });

  let thumbUrl: string | null = null;
  try {
    const thumbBuffer = await sharp(finalBuffer)
      .rotate()
      .resize({
        width: 480,
        height: 320,
        fit: 'cover',
        withoutEnlargement: true,
      })
      .webp({ quality: 78 })
      .toBuffer();
    const thumbKey = `website/${opts.tenantId}/${opts.siteId}/news/${opts.year}/${opts.month}/${id}-${hash}-thumb.webp`;
    await writeDual(thumbKey, thumbBuffer);
    thumbUrl = `/uploads/${thumbKey}`;
    await opts.prisma.websiteMediaAsset.create({
      data: {
        tenantId: opts.tenantId,
        siteId: opts.siteId,
        folderId: opts.folderId,
        kind: 'IMAGE',
        storageKey: thumbKey,
        publicUrl: thumbUrl,
        fileName: `${hash}-thumb.webp`,
        mimeType: 'image/webp',
        bytes: thumbBuffer.length,
        altText: opts.altText
          ? `${opts.altText} (thumbnail)`
          : 'News thumbnail',
        caption: opts.caption || null,
        tags: ['news-import', 'thumbnail', `thumb-of:${asset.id}`],
        createdById: opts.actorId,
      },
    });
  } catch {
    thumbUrl = null;
  }

  return { publicUrl, thumbUrl, bytes: finalBuffer.length };
}

function rewriteHtmlImages(html: string, map: Map<string, string>): string {
  if (!html) return html;
  const $ = cheerio.load(`<div id="root">${html}</div>`, { xmlMode: false });
  $('#root img').each((_, img) => {
    const src = absolutize($(img).attr('src'));
    if (src && map.has(src)) {
      $(img).attr('src', map.get(src)!);
      $(img).removeAttr('srcset');
    }
  });
  return $('#root').html() || html;
}

function mergeFieldDefs(existing: unknown): Prisma.InputJsonValue {
  const current = Array.isArray(existing) ? existing : [];
  const byKey = new Map<string, Record<string, unknown>>();
  for (const item of current) {
    if (item && typeof item === 'object' && 'key' in item) {
      const row = item as Record<string, unknown>;
      if (typeof row.key === 'string') byKey.set(row.key, row);
    }
  }
  for (const def of NEWS_FIELD_DEFS) {
    if (!byKey.has(def.key)) byKey.set(def.key, { ...def });
  }
  return [...byKey.values()] as unknown as Prisma.InputJsonValue;
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => run()),
  );
  return results;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();
  const report: ImportReport = {
    startedAt: new Date().toISOString(),
    finishedAt: null,
    source: SOURCE_INDEX,
    tenantSlug: opts.tenantSlug,
    dryRun: opts.dryRun,
    totals: {
      found: 0,
      imported: 0,
      skippedDuplicates: 0,
      imagesDownloaded: 0,
      thumbnailsGenerated: 0,
      failed: 0,
    },
    items: [],
  };

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: opts.tenantSlug },
    });
    if (!tenant) throw new Error(`Tenant not found: ${opts.tenantSlug}`);
    const actor = await prisma.user.findFirst({
      where: { tenantId: tenant.id, isActive: true },
      select: { id: true },
    });
    if (!actor) throw new Error(`No active user for tenant ${opts.tenantSlug}`);

    const site = await prisma.websiteSite.upsert({
      where: { tenantId: tenant.id },
      update: { updatedById: actor.id },
      create: {
        tenantId: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        createdById: actor.id,
        updatedById: actor.id,
      },
    });

    const newsType = await prisma.websiteContentType.upsert({
      where: { siteId_slug: { siteId: site.id, slug: 'news' } },
      update: {},
      create: {
        tenantId: tenant.id,
        siteId: site.id,
        name: 'News',
        slug: 'news',
        description: 'College news and announcements',
        fields: NEWS_FIELD_DEFS as unknown as Prisma.InputJsonValue,
      },
    });
    await prisma.websiteContentType.update({
      where: { id: newsType.id },
      data: { fields: mergeFieldDefs(newsType.fields) },
    });

    let listed = await listArticles();
    listed.sort((a, b) =>
      (b.listingDate || '').localeCompare(a.listingDate || ''),
    );
    if (opts.limit) listed = listed.slice(0, opts.limit);
    report.totals.found = listed.length;
    console.log(`Found ${listed.length} articles (dryRun=${opts.dryRun})`);

    const folderCache = new Map<string, string>();
    const existingEntries = await prisma.websiteContentEntry.findMany({
      where: { contentTypeId: newsType.id },
      select: {
        id: true,
        slug: true,
        title: true,
        publishedAt: true,
        data: true,
      },
    });
    const bySlug = new Set(existingEntries.map((e) => e.slug));
    const byTitleDate = new Set(
      existingEntries.map((e) => {
        const day = e.publishedAt
          ? e.publishedAt.toISOString().slice(0, 10)
          : '';
        return `${e.title.trim().toLowerCase()}|${day}`;
      }),
    );
    // Also treat previously imported source URLs as duplicates
    for (const entry of existingEntries) {
      const data =
        entry.data &&
        typeof entry.data === 'object' &&
        !Array.isArray(entry.data)
          ? (entry.data as Record<string, unknown>)
          : {};
      if (typeof data.sourceUrl === 'string' && data.sourceUrl) {
        bySlug.add(
          slugify(data.sourceUrl.replace(/^https?:\/\/[^/]+\/news\//, '')),
        );
      }
    }

    await mapPool(listed, opts.concurrency, async (item, index) => {
      const label = `[${index + 1}/${listed.length}] ${item.slug}`;
      try {
        if (bySlug.has(item.slug)) {
          report.totals.skippedDuplicates += 1;
          report.items.push({
            slug: item.slug,
            status: 'skipped',
            message: 'Duplicate slug',
            sourceUrl: item.sourceUrl,
          });
          console.log(`${label} SKIP duplicate slug`);
          return;
        }

        const html = await fetchText(item.sourceUrl);
        const parsed = parseArticleHtml(html, item);
        const day = parsed.publishedAt
          ? parsed.publishedAt.toISOString().slice(0, 10)
          : item.listingDate || '';
        const titleDateKey = `${parsed.title.trim().toLowerCase()}|${day}`;
        if (byTitleDate.has(titleDateKey)) {
          report.totals.skippedDuplicates += 1;
          report.items.push({
            slug: item.slug,
            status: 'skipped',
            title: parsed.title,
            message: 'Duplicate title+date',
            sourceUrl: item.sourceUrl,
          });
          console.log(`${label} SKIP duplicate title+date`);
          return;
        }

        const publishedAt =
          parsed.publishedAt ||
          (item.listingDate
            ? new Date(`${item.listingDate}T00:00:00.000Z`)
            : new Date());
        const year = publishedAt.getUTCFullYear();
        const month = monthFolder(publishedAt);
        const folderId = opts.dryRun
          ? null
          : await ensureFolderPath(
              prisma,
              tenant.id,
              site.id,
              ['news', String(year), month],
              folderCache,
            );

        const urlMap = new Map<string, string>();
        let imageCount = 0;
        let thumbCount = 0;
        let featuredUrl: string | null = null;
        let featuredThumb: string | null = null;
        const galleryLocal: Array<{
          src: string;
          alt: string;
          caption: string;
        }> = [];

        const imageJobs: Array<{
          url: string;
          alt?: string;
          caption?: string;
          featured?: boolean;
        }> = [];
        if (parsed.featuredImageUrl) {
          imageJobs.push({
            url: parsed.featuredImageUrl,
            alt: parsed.title,
            featured: true,
          });
        }
        for (const g of parsed.gallery) {
          if (g.src !== parsed.featuredImageUrl) {
            imageJobs.push({ url: g.src, alt: g.alt, caption: g.caption });
          }
        }

        const imageWarnings: string[] = [];
        for (const job of imageJobs) {
          try {
            const stored = await storeImage({
              prisma,
              tenantId: tenant.id,
              siteId: site.id,
              actorId: actor.id,
              folderId,
              sourceUrl: job.url,
              altText: job.alt,
              caption: job.caption,
              tags: ['news', parsed.category.toLowerCase()],
              year,
              month,
              dryRun: opts.dryRun,
            });
            if (!stored) {
              imageWarnings.push(`missing image: ${job.url}`);
              continue;
            }
            urlMap.set(job.url, stored.publicUrl);
            imageCount += 1;
            if (stored.thumbUrl) thumbCount += 1;
            if (job.featured) {
              featuredUrl = stored.publicUrl;
              featuredThumb = stored.thumbUrl;
            } else {
              galleryLocal.push({
                src: stored.publicUrl,
                alt: job.alt || '',
                caption: job.caption || '',
              });
            }
          } catch (imageError) {
            imageWarnings.push(
              imageError instanceof Error
                ? imageError.message
                : String(imageError),
            );
          }
        }
        if (!featuredUrl) {
          featuredUrl = null;
        }

        const rewrittenBody = sanitizeWebsiteHtml(
          rewriteHtmlImages(parsed.bodyHtml, urlMap),
        );
        const featured =
          index < 3 ||
          /faculty development|inauguration|college week/i.test(parsed.title);

        if (!opts.dryRun) {
          await prisma.websiteContentEntry.create({
            data: {
              tenantId: tenant.id,
              siteId: site.id,
              contentTypeId: newsType.id,
              title: parsed.title,
              slug: parsed.slug,
              status: 'PUBLISHED',
              publishedAt,
              data: {
                summary: parsed.summary,
                body: rewrittenBody,
                image: featuredUrl,
                imageThumb: featuredThumb,
                gallery: galleryLocal,
                category: parsed.category,
                author: parsed.author,
                tags: parsed.tags,
                seoTitle: parsed.seoTitle,
                seoDescription: parsed.seoDescription,
                featured,
                sourceUrl: parsed.sourceUrl,
              },
              createdById: actor.id,
              updatedById: actor.id,
            },
          });
        }

        bySlug.add(parsed.slug);
        byTitleDate.add(titleDateKey);
        report.totals.imported += 1;
        report.totals.imagesDownloaded += imageCount;
        report.totals.thumbnailsGenerated += thumbCount;
        report.items.push({
          slug: parsed.slug,
          status: 'imported',
          title: parsed.title,
          sourceUrl: parsed.sourceUrl,
          images: imageCount,
          message: imageWarnings.length ? imageWarnings.join('; ') : undefined,
        });
        console.log(
          `${label} OK images=${imageCount}${imageWarnings.length ? ` warnings=${imageWarnings.length}` : ''}`,
        );
      } catch (error) {
        report.totals.failed += 1;
        report.items.push({
          slug: item.slug,
          status: 'failed',
          sourceUrl: item.sourceUrl,
          message: error instanceof Error ? error.message : String(error),
        });
        console.error(`${label} FAIL`, error);
      }
    });

    report.finishedAt = new Date().toISOString();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportKey = `website/import-reports/donbosco-news-${opts.tenantSlug}-${stamp}.json`;
    const reportBody = Buffer.from(JSON.stringify(report, null, 2), 'utf8');
    await writeDual(reportKey, reportBody);
    const localReport = join(process.cwd(), 'storage', reportKey);
    console.log('\nIMPORT REPORT');
    console.log(JSON.stringify(report.totals, null, 2));
    console.log(`Report written: /uploads/${reportKey}`);
    console.log(`Also at: ${localReport}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
