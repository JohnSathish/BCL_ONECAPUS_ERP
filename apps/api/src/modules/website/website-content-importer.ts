import type { Prisma, PrismaClient } from '@prisma/client';
import { HOMEPAGE_SECTION_CATALOG } from './website-cms.registry';
import {
  CONTENT_TYPE_CATALOG,
  FOOTER_MENU_CATALOG,
  GALLERY_SEED,
  HEADER_MENU_CATALOG,
  HERO_FALLBACK_SLIDES,
  NEWS_SEED_CATALOG,
  NOTICE_SEED_CATALOG,
  UTILITY_MENU_CATALOG,
  WEBSITE_PAGE_CATALOG,
  type CatalogMenuNode,
} from './website-content-catalog';
import { DEFAULT_HOMEPAGE_CONTENT } from './website-homepage-content';

export type WebsiteImportResult = {
  siteId: string;
  pagesCreated: number;
  pagesTotal: number;
  menuItemsCreated: number;
  homepageSections: number;
  heroSlidesCreated: number;
  newsCreated: number;
  noticesCreated: number;
  contentTypes: number;
};

async function upsertMenuTree(
  prisma: PrismaClient,
  tenantId: string,
  menuId: string,
  nodes: CatalogMenuNode[],
  parentId: string | null,
  startPosition = 0,
): Promise<number> {
  let created = 0;
  let position = startPosition;
  for (const node of nodes) {
    const existing = await prisma.websiteMenuItem.findFirst({
      where: {
        menuId,
        parentId,
        label: node.label,
        url: node.url,
      },
    });
    let itemId = existing?.id;
    if (!existing) {
      const row = await prisma.websiteMenuItem.create({
        data: {
          tenantId,
          menuId,
          label: node.label,
          url: node.url,
          position,
          parentId,
          isVisible: true,
        },
      });
      itemId = row.id;
      created += 1;
    }
    position += 1;
    if (node.children?.length && itemId) {
      created += await upsertMenuTree(
        prisma,
        tenantId,
        menuId,
        node.children,
        itemId,
        0,
      );
    }
  }
  return created;
}

/**
 * Idempotent import of the public website catalogue into Website CMS tables.
 * Safe to run after migrations / deploys: creates missing rows only and never
 * overwrites saved homepage content, menus items, pages, or section toggles.
 */
export async function importWebsiteContent(
  prisma: PrismaClient,
  tenantId: string,
  actorId: string,
): Promise<WebsiteImportResult> {
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    include: {
      branding: true,
      institutions: { where: { deletedAt: null }, take: 1 },
    },
  });
  const name =
    tenant.branding?.displayName ?? tenant.institutions[0]?.name ?? tenant.name;

  const site = await prisma.websiteSite.upsert({
    where: { tenantId },
    update: { updatedById: actorId },
    create: {
      tenantId,
      name,
      slug: tenant.slug,
      logoUrl: tenant.branding?.logoUrl,
      faviconUrl: tenant.branding?.faviconUrl,
      createdById: actorId,
      updatedById: actorId,
    },
  });

  let pagesCreated = 0;
  for (const item of WEBSITE_PAGE_CATALOG) {
    const existing = await prisma.websitePage.findUnique({
      where: { siteId_path: { siteId: site.id, path: item.path } },
    });
    if (existing) {
      if (!existing.deletedAt) continue;
      await prisma.websitePage.update({
        where: { id: existing.id },
        data: { deletedAt: null, deletedById: null, status: 'PUBLISHED' },
      });
      continue;
    }
    await prisma.$transaction(async (tx) => {
      const page = await tx.websitePage.create({
        data: {
          tenantId,
          siteId: site.id,
          path: item.path,
          title: item.title,
          status: 'PUBLISHED',
          publishedAt: new Date(),
          createdById: actorId,
          updatedById: actorId,
        },
      });
      const revision = await tx.websitePageRevision.create({
        data: {
          tenantId,
          pageId: page.id,
          revisionNumber: 1,
          title: item.title,
          excerpt: item.excerpt ?? null,
          bodyHtml: item.bodyHtml,
          changeNote: 'Imported from website content catalogue',
          createdById: actorId,
        },
      });
      const section = await tx.websitePageSection.create({
        data: {
          tenantId,
          pageId: page.id,
          type: item.path === '/' ? 'HERO' : 'RICH_TEXT',
          label: item.title,
          heading: item.title,
          bodyHtml: item.bodyHtml,
          position: 0,
          isVisible: true,
        },
      });
      await tx.websitePage.update({
        where: { id: page.id },
        data: {
          currentRevisionId: revision.id,
          publishedRevisionId: revision.id,
          publishedSections: [section],
        },
      });
    });
    pagesCreated += 1;
  }

  const menuSpecs = [
    {
      location: 'HEADER',
      name: 'Header Navigation',
      tree: HEADER_MENU_CATALOG,
    },
    {
      location: 'FOOTER',
      name: 'Footer Navigation',
      tree: FOOTER_MENU_CATALOG,
    },
    {
      location: 'UTILITY',
      name: 'Utility Navigation',
      tree: UTILITY_MENU_CATALOG,
    },
  ] as const;

  let menuItemsCreated = 0;
  for (const spec of menuSpecs) {
    const menu = await prisma.websiteMenu.upsert({
      where: {
        siteId_location: { siteId: site.id, location: spec.location },
      },
      update: { name: spec.name },
      create: {
        tenantId,
        siteId: site.id,
        location: spec.location,
        name: spec.name,
      },
    });
    // Replace flat stub menus (Home/About/Contact only) when empty of nested items
    const itemCount = await prisma.websiteMenuItem.count({
      where: { menuId: menu.id },
    });
    if (itemCount === 0) {
      menuItemsCreated += await upsertMenuTree(
        prisma,
        tenantId,
        menu.id,
        [...spec.tree],
        null,
      );
    } else if (spec.location === 'HEADER' && itemCount <= 3) {
      // Upgrade stub flat header to nested college nav
      const hasChildren = await prisma.websiteMenuItem.count({
        where: { menuId: menu.id, parentId: { not: null } },
      });
      if (!hasChildren) {
        await prisma.websiteMenuItem.deleteMany({ where: { menuId: menu.id } });
        menuItemsCreated += await upsertMenuTree(
          prisma,
          tenantId,
          menu.id,
          [...spec.tree],
          null,
        );
      }
    } else if (
      (spec.location === 'UTILITY' || spec.location === 'FOOTER') &&
      itemCount < spec.tree.length
    ) {
      menuItemsCreated += await upsertMenuTree(
        prisma,
        tenantId,
        menu.id,
        [...spec.tree],
        null,
      );
    }
  }

  // Homepage layout — create missing sections only; never reset toggles/order.
  for (const [position, item] of HOMEPAGE_SECTION_CATALOG.entries()) {
    const existing = await prisma.websiteHomepageSection.findUnique({
      where: {
        siteId_sectionKey: { siteId: site.id, sectionKey: item.key },
      },
    });
    if (existing) {
      if (existing.label !== item.label) {
        await prisma.websiteHomepageSection.update({
          where: { id: existing.id },
          data: { label: item.label },
        });
      }
      continue;
    }
    await prisma.websiteHomepageSection.create({
      data: {
        tenantId,
        siteId: site.id,
        sectionKey: item.key,
        label: item.label,
        enabled: item.defaultEnabled,
        position,
        settingsJson: {},
      },
    });
  }

  // Settings: fill missing keys only — never restore defaults over saved CMS content.
  const settings =
    site.settingsJson &&
    typeof site.settingsJson === 'object' &&
    !Array.isArray(site.settingsJson)
      ? (site.settingsJson as Record<string, unknown>)
      : {};
  const existingHub =
    settings.informationHub &&
    typeof settings.informationHub === 'object' &&
    !Array.isArray(settings.informationHub)
      ? (settings.informationHub as Record<string, unknown>)
      : {};
  const existingLeadership =
    existingHub.leadership &&
    typeof existingHub.leadership === 'object' &&
    !Array.isArray(existingHub.leadership)
      ? (existingHub.leadership as Record<string, unknown>)
      : null;

  const nextSettings: Record<string, unknown> = {
    ...settings,
    homepage: settings.homepage ?? DEFAULT_HOMEPAGE_CONTENT,
    aboutCollege:
      settings.aboutCollege ?? DEFAULT_HOMEPAGE_CONTENT.aboutCollege,
    footerWidgets: settings.footerWidgets ?? DEFAULT_HOMEPAGE_CONTENT.footer,
    stats: settings.stats ?? DEFAULT_HOMEPAGE_CONTENT.statistics,
    gallery:
      Array.isArray(settings.gallery) && settings.gallery.length
        ? settings.gallery
        : settings.gallery === undefined
          ? GALLERY_SEED
          : settings.gallery,
    informationHub: {
      ...existingHub,
      leadership: existingLeadership ?? {
        message: DEFAULT_HOMEPAGE_CONTENT.principal.message,
        name: DEFAULT_HOMEPAGE_CONTENT.principal.name,
        role: DEFAULT_HOMEPAGE_CONTENT.principal.role,
        tenure: DEFAULT_HOMEPAGE_CONTENT.principal.tenure,
        portraitSrc: DEFAULT_HOMEPAGE_CONTENT.principal.portraitSrc,
        portraitAlt: DEFAULT_HOMEPAGE_CONTENT.principal.portraitAlt,
        messageHref: DEFAULT_HOMEPAGE_CONTENT.principal.messageHref,
        leadershipHref: DEFAULT_HOMEPAGE_CONTENT.principal.leadershipHref,
      },
    },
  };
  await prisma.websiteSite.update({
    where: { id: site.id },
    data: { settingsJson: nextSettings as Prisma.InputJsonValue },
  });

  let heroSlidesCreated = 0;
  const heroCount = await prisma.websiteHeroSlide.count({
    where: { siteId: site.id },
  });
  if (!heroCount) {
    for (const [position, slide] of HERO_FALLBACK_SLIDES.entries()) {
      await prisma.websiteHeroSlide.create({
        data: {
          tenantId,
          siteId: site.id,
          altText: slide.altText,
          desktopUrl: slide.desktopUrl,
          mobileUrl: slide.mobileUrl,
          position,
          isActive: true,
          createdById: actorId,
        },
      });
      heroSlidesCreated += 1;
    }
  }

  for (const contentType of CONTENT_TYPE_CATALOG) {
    await prisma.websiteContentType.upsert({
      where: {
        siteId_slug: { siteId: site.id, slug: contentType.slug },
      },
      // Do not overwrite editor-customized CPT schemas on re-import.
      update: {},
      create: {
        tenantId,
        siteId: site.id,
        name: contentType.name,
        slug: contentType.slug,
        description: contentType.description,
        fields: contentType.fields as unknown as Prisma.InputJsonValue,
      },
    });
  }

  let newsCreated = 0;
  const newsType = await prisma.websiteContentType.findUnique({
    where: { siteId_slug: { siteId: site.id, slug: 'news' } },
  });
  if (newsType) {
    for (const entry of NEWS_SEED_CATALOG) {
      const exists = await prisma.websiteContentEntry.findFirst({
        where: { contentTypeId: newsType.id, slug: entry.slug },
      });
      if (exists) continue;
      await prisma.websiteContentEntry.create({
        data: {
          tenantId,
          siteId: site.id,
          contentTypeId: newsType.id,
          title: entry.title,
          slug: entry.slug,
          status: 'PUBLISHED',
          publishedAt: new Date(),
          data: {
            summary: entry.summary,
            body: entry.body,
            category: entry.category,
          },
          createdById: actorId,
          updatedById: actorId,
        },
      });
      newsCreated += 1;
    }
  }

  // Testimonials CPT entries from homepage principal-quality seed quotes
  const testimonialsType = await prisma.websiteContentType.findUnique({
    where: { siteId_slug: { siteId: site.id, slug: 'testimonials' } },
  });
  if (testimonialsType) {
    const testimonialCount = await prisma.websiteContentEntry.count({
      where: { contentTypeId: testimonialsType.id },
    });
    if (!testimonialCount) {
      const seeds = [
        {
          title: 'Jemina M. Sangma',
          slug: 'jemina-sangma',
          quote:
            'Don Bosco College shaped the way I see science and service. Field visits around the Garo Hills taught me that ecology is not only a textbook chapter.',
          department: 'B.Sc. Botany',
          graduationYear: '2021',
          status: 'Pursuing M.Sc. in Plant Ecology, NEHU, Shillong',
        },
        {
          title: 'Anita Ch. Marak',
          slug: 'anita-marak',
          quote:
            'Don Bosco taught me to combine ambition with empathy. The mentors here continue to shape every decision I make.',
          department: 'B.A. Education',
          graduationYear: '2018',
          status: 'Alumna · Secondary school educator, Tura',
        },
        {
          title: 'Ricky R. Sangma',
          slug: 'ricky-sangma',
          quote:
            'The campus gave me room to question, create and lead. I found a community that believed in my potential before I fully believed in myself.',
          department: 'B.Com.',
          graduationYear: '2023',
          status: 'Student leader · Department of Commerce',
        },
      ];
      for (const row of seeds) {
        await prisma.websiteContentEntry.create({
          data: {
            tenantId,
            siteId: site.id,
            contentTypeId: testimonialsType.id,
            title: row.title,
            slug: row.slug,
            status: 'PUBLISHED',
            publishedAt: new Date(),
            data: {
              quote: row.quote,
              department: row.department,
              graduationYear: row.graduationYear,
              status: row.status,
            },
            createdById: actorId,
            updatedById: actorId,
          },
        });
      }
    }
  }

  let noticesCreated = 0;
  for (const notice of NOTICE_SEED_CATALOG) {
    const exists = await prisma.websiteNotice.findFirst({
      where: { siteId: site.id, slug: notice.slug },
    });
    if (exists) continue;
    await prisma.websiteNotice.create({
      data: {
        tenantId,
        siteId: site.id,
        title: notice.title,
        slug: notice.slug,
        bodyHtml: notice.bodyHtml,
        category: notice.category,
        priority: notice.priority,
        status: 'PUBLISHED',
        publishAt: new Date(),
        showOnHomepage: true,
        isVisible: true,
        createdById: actorId,
        updatedById: actorId,
      },
    });
    noticesCreated += 1;
  }

  const pagesTotal = await prisma.websitePage.count({
    where: { siteId: site.id, deletedAt: null },
  });
  const homepageSections = await prisma.websiteHomepageSection.count({
    where: { siteId: site.id },
  });

  return {
    siteId: site.id,
    pagesCreated,
    pagesTotal,
    menuItemsCreated,
    homepageSections,
    heroSlidesCreated,
    newsCreated,
    noticesCreated,
    contentTypes: CONTENT_TYPE_CATALOG.length,
  };
}
