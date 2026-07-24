/**
 * Migrate About Us pages from https://donboscocollege.ac.in/ into Website CMS.
 *
 * Usage:
 *   npx tsx scripts/import-donbosco-about.ts
 *   npx tsx scripts/import-donbosco-about.ts --dry-run
 *   npx tsx scripts/import-donbosco-about.ts --tenant=demo --force
 *   npx tsx scripts/import-donbosco-about.ts --only=/about/administration/governing-body --force --no-cache
 */
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import * as cheerio from 'cheerio';
import { PrismaClient, type Prisma } from '@prisma/client';
import {
  resolveStorageRoot,
  resolveUploadRoot,
} from '../src/common/uploads/upload-paths';
import { sanitizeWebsiteHtml } from '../src/modules/website/utils/website-html-sanitizer';

const SOURCE_ORIGIN = 'https://donboscocollege.ac.in';
const USER_AGENT =
  'BCL-OneCampus-AboutImporter/1.0 (+https://erp.donboscocollege.ac.in)';
const CACHE_DIR = join(
  process.cwd(),
  'storage',
  'website',
  'import-source',
  'about',
);

type AboutPageSpec = {
  path: string;
  title: string;
  sourcePath: string;
  menuLabel: string;
  /** When false, import the page but do not add it under HEADER → About Us. */
  includeInAboutMenu?: boolean;
};

/** Canonical About Us subtree (SEO-friendly paths). */
export const ABOUT_PAGE_SPECS: AboutPageSpec[] = [
  {
    path: '/about',
    title: 'About Us',
    sourcePath: '/about',
    menuLabel: 'About Us',
  },
  {
    path: '/about/history',
    title: 'History',
    sourcePath: '/about/history',
    menuLabel: 'History',
  },
  {
    path: '/about/vision-mission',
    title: 'Vision & Mission',
    sourcePath: '/about/vision-mission',
    menuLabel: 'Vision & Mission',
  },
  {
    path: '/about/objectives',
    title: 'Objectives',
    sourcePath: '/about/objectives',
    menuLabel: 'Objectives',
  },
  {
    path: '/about/philosophy',
    title: 'Philosophy',
    sourcePath: '/about/philosophy',
    menuLabel: 'Philosophy',
  },
  {
    path: '/about/management',
    title: 'Management',
    sourcePath: '/about/management',
    menuLabel: 'Management',
  },
  {
    path: '/about/affiliation',
    title: 'Affiliation',
    sourcePath: '/about/affiliation',
    menuLabel: 'Affiliation',
  },
  {
    path: '/about/founder',
    title: 'Founder: St. John Bosco',
    sourcePath: '/about/founder',
    menuLabel: 'Founder',
  },
  {
    path: '/about/rector-major',
    title: 'Our Rector Major',
    sourcePath: '/about/rector-major',
    menuLabel: 'Our Rector Major',
  },
  {
    path: '/about/db-higher-education',
    title: 'DB Higher Education in India',
    sourcePath: '/about/db-higher-education',
    menuLabel: 'DB Higher Education',
  },
  {
    path: '/about/former-principals',
    title: 'Former Principals',
    sourcePath: '/about/former-principals',
    menuLabel: 'Former Principals',
  },
  {
    path: '/about/former-vice-principals',
    title: 'Former Vice Principals',
    sourcePath: '/about/former-vice-principals',
    menuLabel: 'Former Vice Principals',
  },
  {
    path: '/about/principal',
    title: "Principal's Desk",
    sourcePath: '/about/principal',
    menuLabel: "Principal's Desk",
  },
  {
    path: '/about/administration',
    title: 'Administration',
    sourcePath: '/about/administration',
    menuLabel: 'Administration',
  },
  {
    path: '/about/administration/governing-body',
    title: 'Governing Body',
    sourcePath: '/administration/governing-body',
    menuLabel: 'Governing Body',
    includeInAboutMenu: false,
  },
];

type CliOptions = {
  tenantSlug: string;
  dryRun: boolean;
  force: boolean;
  useCache: boolean;
  onlyPath: string | null;
};

type ParsedPage = {
  title: string;
  excerpt: string;
  bodyHtml: string;
  seoTitle: string;
  seoDescription: string;
  assetUrls: string[];
};

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    tenantSlug: 'demo',
    dryRun: false,
    force: false,
    useCache: true,
    onlyPath: null,
  };
  for (const arg of argv) {
    if (arg === '--dry-run') opts.dryRun = true;
    if (arg === '--force') opts.force = true;
    if (arg === '--no-cache') opts.useCache = false;
    if (arg.startsWith('--tenant='))
      opts.tenantSlug = arg.slice('--tenant='.length);
    if (arg.startsWith('--only=')) opts.onlyPath = arg.slice('--only='.length);
  }
  return opts;
}

function cacheFileFor(sourcePath: string) {
  const name =
    sourcePath === '/about'
      ? 'about'
      : sourcePath.replace(/^\/+/, '').replaceAll('/', '-');
  return join(CACHE_DIR, `${name}.html`);
}

async function fetchHtml(
  sourcePath: string,
  useCache: boolean,
): Promise<string | null> {
  const cacheFile = cacheFileFor(sourcePath);
  if (useCache) {
    try {
      return await readFile(cacheFile, 'utf8');
    } catch {
      /* fetch fresh */
    }
  }
  const url = `${SOURCE_ORIGIN}${sourcePath}`;
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    redirect: 'follow',
  });
  if (!response.ok) return null;
  const html = await response.text();
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(cacheFile, html, 'utf8');
  return html;
}

function absolutizeSourceUrl(src: string): string | null {
  if (!src || src.startsWith('data:')) return null;
  if (src.startsWith('//')) return `https:${src}`;
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith('/_next/image')) {
    try {
      const u = new URL(src, SOURCE_ORIGIN);
      const nested = u.searchParams.get('url');
      if (nested) return absolutizeSourceUrl(decodeURIComponent(nested));
    } catch {
      return null;
    }
  }
  if (src.startsWith('/')) return `${SOURCE_ORIGIN}${src}`;
  return `${SOURCE_ORIGIN}/${src}`;
}

function isPlaceholderBody(html: string | null | undefined): boolean {
  if (!html?.trim()) return true;
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length < 80) return true;
  return /edit this page in the Website CMS|imported from the public website catalogue|Content for this page is being prepared|Replace this starter copy/i.test(
    text,
  );
}

function decodeNextImageSrc(src: string): string {
  if (!src.includes('/_next/image')) return src;
  try {
    const u = new URL(src, SOURCE_ORIGIN);
    const nested = u.searchParams.get('url');
    return nested ? decodeURIComponent(nested) : src;
  } catch {
    return src;
  }
}

function extractPage(html: string, fallbackTitle: string): ParsedPage {
  const $ = cheerio.load(html);
  $('script, style, noscript, nav, header, footer, .skip-link').remove();

  const h1 =
    $('h1').first().text().replace(/\s+/g, ' ').trim() ||
    $('main .text-3xl, main [class*="text-3xl"]')
      .first()
      .text()
      .replace(/\s+/g, ' ')
      .trim() ||
    fallbackTitle;

  // Administration pages on the live site use card layouts without `.prose`.
  let root = $('.prose').first();
  if (!root.length) {
    const container = $('main .max-w-5xl, main [class*="max-w-5xl"]').first();
    if (container.length) root = container;
  }
  if (!root.length) {
    const cards = $(
      'main .bg-card, main [class*="bg-card"], main [class*="border-brand"], main [class*="rounded-xl"][class*="border"]',
    );
    if (cards.length) {
      const cloneRoot = $('<div></div>');
      const seen = new Set<string>();
      cards.each((_, el) => {
        // Avoid nested card fragments.
        if ($(el).parents('[class*="rounded-xl"]').closest('main').length)
          return;
        const key = $(el).text().slice(0, 80);
        if (seen.has(key)) return;
        seen.add(key);
        cloneRoot.append($(el).clone());
      });
      if (cloneRoot.children().length) root = cloneRoot;
    }
  }
  if (!root.length) {
    root = $('main').first();
  }
  if (!root.length) {
    root = $('article').first();
  }

  // Prefer inner content card when present
  const card = root.find('.prose').first();
  if (card.length) root = card;

  root.find('a').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    if (href.startsWith('/')) $(el).attr('href', `${SOURCE_ORIGIN}${href}`);
  });
  root.find('img').each((_, el) => {
    const src = $(el).attr('src');
    if (!src) return;
    const decoded = decodeNextImageSrc(src);
    const abs = absolutizeSourceUrl(decoded);
    if (abs) $(el).attr('src', abs);
    $(el).removeAttr('srcset');
  });

  // Convert heading-like divs to semantic headings for CMS editing.
  root.find('.text-3xl, [class*="text-3xl"]').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (!text) return;
    $(el).replaceWith(`<h2>${text}</h2>`);
  });
  root.find('.font-semibold.text-2xl, [class*="text-2xl"]').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (!text || /^governing body$/i.test(text)) return;
    $(el).replaceWith(`<h2>${text}</h2>`);
  });

  // Keep tables readable in CMS/public site.
  root.find('table').each((_, el) => {
    const table = $(el);
    table.find('[class]').addBack().removeAttr('class');
    if (!table.parent().is('div.table-wrap')) {
      table.wrap('<div class="table-wrap"></div>');
    }
  });

  // Prefer semantic CMS HTML for administration pages with member tables.
  if (root.find('table').length) {
    const parts: string[] = [];
    root.find('p').each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (!text) return;
      parts.push(`<p>${text}</p>`);
    });
    root.find('h2').each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (!text || new RegExp(`^${fallbackTitle}$`, 'i').test(text)) return;
      parts.push(`<h2>${text}</h2>`);
    });
    root.find('div.table-wrap').each((_, el) => {
      parts.push($.html(el) || '');
    });
    if (parts.length) {
      return finalizeParsedPage($, fallbackTitle, h1, parts.join('\n'));
    }
  }

  let bodyInner = root.html()?.trim() || '';
  // Strip outer chrome wrappers if we grabbed full main
  if (!bodyInner.includes('<') && root.text().trim()) {
    bodyInner = `<p>${root.text().trim()}</p>`;
  }

  // Landing page with no prose — build a useful About index
  if (
    !bodyInner ||
    /Content for this page is being prepared/i.test(bodyInner)
  ) {
    bodyInner = '';
  }

  // Drop duplicate page title heading when the shell already shows it.
  bodyInner = bodyInner.replace(
    new RegExp(
      `<h2>\\s*${fallbackTitle.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\s*<\\/h2>`,
      'i',
    ),
    '',
  );

  return finalizeParsedPage($, fallbackTitle, h1, bodyInner);
}

function finalizeParsedPage(
  $: ReturnType<typeof cheerio.load>,
  fallbackTitle: string,
  h1: string,
  bodyInner: string,
): ParsedPage {
  const text = cheerio
    .load(`<div>${bodyInner}</div>`)('div')
    .text()
    .replace(/\s+/g, ' ')
    .trim();
  const excerpt = text.slice(0, 220);
  const assetUrls = new Set<string>();

  const $body = cheerio.load(`<div id="root">${bodyInner}</div>`);
  $body('#root img[src]').each((_, el) => {
    const src = $body(el).attr('src');
    const abs = absolutizeSourceUrl(src || '');
    if (abs) assetUrls.add(abs);
  });
  $body('#root a[href]').each((_, el) => {
    const href = $body(el).attr('href') || '';
    if (/\.(pdf|docx?|xlsx?|pptx?)(\?|$)/i.test(href)) {
      const abs = absolutizeSourceUrl(href);
      if (abs) assetUrls.add(abs);
    }
  });

  const seoTitle =
    $('meta[property="og:title"]').attr('content')?.trim() ||
    $('title')
      .first()
      .text()
      .replace(/\s*\|\s*Don Bosco.*$/i, '')
      .trim() ||
    h1;
  const seoDescription =
    $('meta[name="description"]').attr('content')?.trim() ||
    excerpt.slice(0, 320);

  return {
    title: h1 || fallbackTitle,
    excerpt,
    bodyHtml: bodyInner,
    seoTitle,
    seoDescription,
    assetUrls: [...assetUrls],
  };
}

function buildAboutLandingHtml(children: AboutPageSpec[]): string {
  const items = children
    .filter((p) => p.path !== '/about')
    .map(
      (p) => `<li><a href="${p.path}"><strong>${p.menuLabel}</strong></a></li>`,
    )
    .join('\n');
  return [
    '<h2>About Don Bosco College, Tura</h2>',
    '<p>Don Bosco College, Tura was established by the Salesians of Don Bosco in 1987 to bring higher education to the people of Garo Hills and North-East India. Explore our heritage, vision, leadership and affiliation below.</p>',
    '<h3>Explore</h3>',
    `<ul>${items}</ul>`,
  ].join('\n');
}

async function writeDual(storageKey: string, buffer: Buffer) {
  const storagePath = join(resolveStorageRoot(), storageKey);
  await mkdir(dirname(storagePath), { recursive: true });
  await writeFile(storagePath, buffer);
  const uploadPath = join(resolveUploadRoot(), storageKey);
  await mkdir(dirname(uploadPath), { recursive: true });
  await writeFile(uploadPath, buffer);
}

async function ensureFolder(
  prisma: PrismaClient,
  tenantId: string,
  siteId: string,
  name: string,
): Promise<string> {
  const existing = await prisma.websiteMediaFolder.findFirst({
    where: { siteId, parentId: null, name },
  });
  if (existing) return existing.id;
  const created = await prisma.websiteMediaFolder.create({
    data: { tenantId, siteId, parentId: null, name },
  });
  return created.id;
}

async function storeAsset(opts: {
  prisma: PrismaClient;
  tenantId: string;
  siteId: string;
  actorId: string;
  folderId: string;
  sourceUrl: string;
  dryRun: boolean;
}): Promise<string | null> {
  const sourceTag = `source:${createHash('sha1').update(opts.sourceUrl).digest('hex').slice(0, 12)}`;
  const existing = await opts.prisma.websiteMediaAsset.findFirst({
    where: { siteId: opts.siteId, deletedAt: null, tags: { has: sourceTag } },
  });
  if (existing) return existing.publicUrl;

  if (opts.dryRun) {
    return `/uploads/website/dry-run/about/${randomUUID().slice(0, 8)}${extname(new URL(opts.sourceUrl).pathname) || '.bin'}`;
  }

  let response: Response;
  try {
    response = await fetch(opts.sourceUrl, {
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) return null;

  const pathname = new URL(opts.sourceUrl).pathname;
  let ext = extname(pathname).toLowerCase() || '.bin';
  const mime =
    response.headers.get('content-type') || 'application/octet-stream';
  if (ext === '.bin') {
    if (mime.includes('jpeg')) ext = '.jpg';
    else if (mime.includes('png')) ext = '.png';
    else if (mime.includes('webp')) ext = '.webp';
    else if (mime.includes('pdf')) ext = '.pdf';
  }
  const storageKey = `website/${opts.tenantId}/${opts.siteId}/${randomUUID()}${ext}`;
  await writeDual(storageKey, buffer);
  const publicUrl = `/uploads/${storageKey.replace(/\\/g, '/')}`;
  const kind = mime.startsWith('image/')
    ? 'IMAGE'
    : mime.includes('pdf') || /\.pdf$/i.test(ext)
      ? 'DOCUMENT'
      : 'FILE';
  await opts.prisma.websiteMediaAsset.create({
    data: {
      tenantId: opts.tenantId,
      siteId: opts.siteId,
      folderId: opts.folderId,
      kind,
      fileName: pathname.split('/').pop() || `asset${ext}`,
      mimeType: mime,
      bytes: buffer.length,
      storageKey,
      publicUrl,
      altText: null,
      tags: ['about-import', sourceTag],
      createdById: opts.actorId,
    },
  });
  return publicUrl;
}

async function rewriteAssets(
  bodyHtml: string,
  urlMap: Map<string, string>,
): Promise<string> {
  let html = bodyHtml;
  for (const [from, to] of urlMap) {
    html = html.split(from).join(to);
    // Also rewrite origin-stripped variants
    try {
      const pathOnly = new URL(from).pathname;
      if (pathOnly && pathOnly !== '/') {
        html = html.split(pathOnly).join(to);
      }
    } catch {
      /* ignore */
    }
  }
  return html;
}

async function upsertPublishedPage(opts: {
  prisma: PrismaClient;
  tenantId: string;
  siteId: string;
  actorId: string;
  path: string;
  title: string;
  excerpt: string;
  bodyHtml: string;
  seoTitle: string;
  seoDescription: string;
  force: boolean;
  dryRun: boolean;
}): Promise<'created' | 'updated' | 'skipped'> {
  const existing = await opts.prisma.websitePage.findUnique({
    where: { siteId_path: { siteId: opts.siteId, path: opts.path } },
    include: {
      publishedRevision: true,
      currentRevision: true,
      sections: { orderBy: { position: 'asc' }, take: 1 },
    },
  });

  const currentBody =
    existing?.publishedRevision?.bodyHtml ??
    existing?.currentRevision?.bodyHtml ??
    '';
  if (existing && !opts.force && !isPlaceholderBody(currentBody)) {
    return 'skipped';
  }

  const safeHtml = sanitizeWebsiteHtml(opts.bodyHtml);
  if (opts.dryRun) return existing ? 'updated' : 'created';

  if (!existing) {
    await opts.prisma.$transaction(async (tx) => {
      const page = await tx.websitePage.create({
        data: {
          tenantId: opts.tenantId,
          siteId: opts.siteId,
          path: opts.path,
          title: opts.title,
          status: 'PUBLISHED',
          publishedAt: new Date(),
          createdById: opts.actorId,
          updatedById: opts.actorId,
        },
      });
      const revision = await tx.websitePageRevision.create({
        data: {
          tenantId: opts.tenantId,
          pageId: page.id,
          revisionNumber: 1,
          title: opts.title,
          excerpt: opts.excerpt || null,
          bodyHtml: safeHtml,
          seoTitle: opts.seoTitle || null,
          seoDescription: opts.seoDescription || null,
          changeNote: 'Imported from donboscocollege.ac.in About Us',
          createdById: opts.actorId,
        },
      });
      const section = await tx.websitePageSection.create({
        data: {
          tenantId: opts.tenantId,
          pageId: page.id,
          type: 'RICH_TEXT',
          label: opts.title,
          heading: opts.title,
          bodyHtml: safeHtml,
          position: 0,
          isVisible: true,
        },
      });
      await tx.websitePage.update({
        where: { id: page.id },
        data: {
          currentRevisionId: revision.id,
          publishedRevisionId: revision.id,
          publishedSections: [section] as unknown as Prisma.InputJsonValue,
        },
      });
    });
    return 'created';
  }

  await opts.prisma.$transaction(async (tx) => {
    const latest = await tx.websitePageRevision.aggregate({
      where: { pageId: existing.id },
      _max: { revisionNumber: true },
    });
    const revision = await tx.websitePageRevision.create({
      data: {
        tenantId: opts.tenantId,
        pageId: existing.id,
        revisionNumber: (latest._max.revisionNumber ?? 0) + 1,
        title: opts.title,
        excerpt: opts.excerpt || null,
        bodyHtml: safeHtml,
        seoTitle: opts.seoTitle || null,
        seoDescription: opts.seoDescription || null,
        changeNote: 'Re-imported from donboscocollege.ac.in About Us',
        createdById: opts.actorId,
      },
    });
    let section = existing.sections[0];
    if (section) {
      section = await tx.websitePageSection.update({
        where: { id: section.id },
        data: {
          heading: opts.title,
          label: opts.title,
          bodyHtml: safeHtml,
          isVisible: true,
        },
      });
    } else {
      section = await tx.websitePageSection.create({
        data: {
          tenantId: opts.tenantId,
          pageId: existing.id,
          type: 'RICH_TEXT',
          label: opts.title,
          heading: opts.title,
          bodyHtml: safeHtml,
          position: 0,
          isVisible: true,
        },
      });
    }
    await tx.websitePage.update({
      where: { id: existing.id },
      data: {
        title: opts.title,
        status: 'PUBLISHED',
        deletedAt: null,
        deletedById: null,
        publishedAt: new Date(),
        currentRevisionId: revision.id,
        publishedRevisionId: revision.id,
        publishedSections: [section] as unknown as Prisma.InputJsonValue,
        updatedById: opts.actorId,
      },
    });
  });
  return 'updated';
}

async function ensureAboutMenu(
  prisma: PrismaClient,
  tenantId: string,
  siteId: string,
  specs: AboutPageSpec[],
  dryRun: boolean,
) {
  const menu = await prisma.websiteMenu.findUnique({
    where: { siteId_location: { siteId, location: 'HEADER' } },
  });
  if (!menu) {
    console.warn('HEADER menu missing — run website seed-defaults first');
    return;
  }

  let about = await prisma.websiteMenuItem.findFirst({
    where: { menuId: menu.id, parentId: null, url: '/about' },
  });
  if (!about) {
    about = await prisma.websiteMenuItem.findFirst({
      where: {
        menuId: menu.id,
        parentId: null,
        label: { contains: 'About', mode: 'insensitive' },
      },
    });
  }
  if (!about && !dryRun) {
    const maxPos = await prisma.websiteMenuItem.aggregate({
      where: { menuId: menu.id, parentId: null },
      _max: { position: true },
    });
    about = await prisma.websiteMenuItem.create({
      data: {
        tenantId,
        menuId: menu.id,
        label: 'About Us',
        url: '/about',
        position: (maxPos._max.position ?? 0) + 1,
        isVisible: true,
      },
    });
  }
  if (!about) return;

  if (!dryRun && (about.label !== 'About Us' || about.url !== '/about')) {
    about = await prisma.websiteMenuItem.update({
      where: { id: about.id },
      data: { label: 'About Us', url: '/about', isVisible: true },
    });
  }

  let position = 0;
  for (const spec of specs) {
    if (spec.path === '/about') continue;
    if (spec.includeInAboutMenu === false) continue;
    position += 1;
    const existing = await prisma.websiteMenuItem.findFirst({
      where: {
        menuId: menu.id,
        parentId: about.id,
        OR: [{ url: spec.path }, { label: spec.menuLabel }],
      },
    });
    if (dryRun) {
      console.log(
        `  menu ${existing ? 'keep' : 'add'}: ${spec.menuLabel} -> ${spec.path}`,
      );
      continue;
    }
    if (existing) {
      await prisma.websiteMenuItem.update({
        where: { id: existing.id },
        data: {
          label: spec.menuLabel,
          url: spec.path,
          position,
          isVisible: true,
          parentId: about.id,
        },
      });
    } else {
      await prisma.websiteMenuItem.create({
        data: {
          tenantId,
          menuId: menu.id,
          parentId: about.id,
          label: spec.menuLabel,
          url: spec.path,
          position,
          isVisible: true,
        },
      });
    }
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();
  const startedAt = new Date().toISOString();
  const report = {
    startedAt,
    finishedAt: null as string | null,
    tenantSlug: opts.tenantSlug,
    dryRun: opts.dryRun,
    force: opts.force,
    pages: [] as Array<Record<string, unknown>>,
    totals: { created: 0, updated: 0, skipped: 0, assets: 0, failed: 0 },
  };

  try {
    const tenant = await prisma.tenant.findFirst({
      where: { slug: opts.tenantSlug },
      include: { branding: true },
    });
    if (!tenant) throw new Error(`Tenant not found: ${opts.tenantSlug}`);

    const site = await prisma.websiteSite.findFirst({
      where: { tenantId: tenant.id },
    });
    if (!site) throw new Error('WebsiteSite missing — seed website CMS first');

    const actorId =
      (
        await prisma.user.findFirst({
          where: { tenantId: tenant.id, deletedAt: null },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        })
      )?.id ?? null;
    if (!actorId) throw new Error('No actor user found for tenant');

    const folderId = opts.dryRun
      ? 'dry-run'
      : await ensureFolder(prisma, tenant.id, site.id, 'About Us');

    console.log(
      `Importing About Us → tenant=${opts.tenantSlug} dryRun=${opts.dryRun} force=${opts.force}${
        opts.onlyPath ? ` only=${opts.onlyPath}` : ''
      }`,
    );

    const specs = opts.onlyPath
      ? ABOUT_PAGE_SPECS.filter((spec) => spec.path === opts.onlyPath)
      : ABOUT_PAGE_SPECS;
    if (!specs.length) {
      throw new Error(`No About page spec matches --only=${opts.onlyPath}`);
    }

    const parsedByPath = new Map<string, ParsedPage>();

    for (const spec of specs) {
      const html = await fetchHtml(spec.sourcePath, opts.useCache);
      if (!html) {
        if (
          spec.path === '/about/principal' ||
          spec.path === '/about/administration'
        ) {
          // Keep existing CMS/dedicated routes; seed minimal body only if missing
          parsedByPath.set(spec.path, {
            title: spec.title,
            excerpt: `${spec.title} at Don Bosco College, Tura.`,
            bodyHtml: `<h2>${spec.title}</h2><p>Edit this page in the Website CMS.</p>`,
            seoTitle: spec.title,
            seoDescription: `${spec.title} — Don Bosco College, Tura`,
            assetUrls: [],
          });
          continue;
        }
        console.warn(`SKIP fetch failed: ${spec.sourcePath}`);
        report.totals.failed += 1;
        report.pages.push({ path: spec.path, status: 'fetch-failed' });
        continue;
      }
      const parsed = extractPage(html, spec.title);
      parsedByPath.set(spec.path, parsed);
    }

    // Build /about landing if empty
    const aboutParsed = parsedByPath.get('/about');
    if (aboutParsed && isPlaceholderBody(aboutParsed.bodyHtml)) {
      aboutParsed.bodyHtml = buildAboutLandingHtml(
        ABOUT_PAGE_SPECS.filter((spec) => spec.includeInAboutMenu !== false),
      );
      aboutParsed.excerpt =
        'Don Bosco College, Tura — heritage, vision, leadership and affiliation.';
      aboutParsed.title = 'About Us';
    }

    for (const spec of specs) {
      const parsed = parsedByPath.get(spec.path);
      if (!parsed) continue;

      const urlMap = new Map<string, string>();
      for (const assetUrl of parsed.assetUrls) {
        // Prefer known storage/media mirrors for common PDFs
        const candidates = [assetUrl];
        if (assetUrl.includes('/downloads/affiliation/')) {
          const file = assetUrl.split('/').pop();
          if (file) candidates.push(`${SOURCE_ORIGIN}/storage/media/${file}`);
        }
        let stored: string | null = null;
        for (const candidate of candidates) {
          stored = await storeAsset({
            prisma,
            tenantId: tenant.id,
            siteId: site.id,
            actorId,
            folderId,
            sourceUrl: candidate,
            dryRun: opts.dryRun,
          });
          if (stored) {
            urlMap.set(assetUrl, stored);
            if (candidate !== assetUrl) urlMap.set(candidate, stored);
            report.totals.assets += 1;
            break;
          }
        }
      }

      let bodyHtml = await rewriteAssets(parsed.bodyHtml, urlMap);
      if (!bodyHtml.trim()) {
        bodyHtml = `<h2>${parsed.title}</h2><p>Content will be updated in the Website CMS.</p>`;
      }

      const status = await upsertPublishedPage({
        prisma,
        tenantId: tenant.id,
        siteId: site.id,
        actorId,
        path: spec.path,
        title: parsed.title || spec.title,
        excerpt: parsed.excerpt,
        bodyHtml,
        seoTitle: parsed.seoTitle || spec.title,
        seoDescription: parsed.seoDescription || parsed.excerpt,
        force: opts.force,
        dryRun: opts.dryRun,
      });
      report.totals[status] += 1;
      report.pages.push({
        path: spec.path,
        title: parsed.title || spec.title,
        status,
        chars: bodyHtml.replace(/<[^>]+>/g, ' ').trim().length,
        assets: parsed.assetUrls.length,
      });
      console.log(`${status.toUpperCase()} ${spec.path} (${parsed.title})`);
    }

    if (!opts.onlyPath) {
      console.log('Updating HEADER → About Us children…');
      await ensureAboutMenu(
        prisma,
        tenant.id,
        site.id,
        ABOUT_PAGE_SPECS,
        opts.dryRun,
      );
    }

    report.finishedAt = new Date().toISOString();
    const reportPath = join(
      process.cwd(),
      'storage',
      'website',
      'import-reports',
      `donbosco-about-${opts.tenantSlug}-${report.finishedAt.replace(/[:.]/g, '-')}.json`,
    );
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log('Report:', reportPath);
    console.log('Totals:', report.totals);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
