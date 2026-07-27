import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';
import {
  DEFAULT_CONTENT_SOURCES,
  HOMEPAGE_SECTION_CATALOG,
  NOTICE_CATEGORIES,
  NOTICE_PRIORITIES,
  type HomepageSectionKey,
} from './website-cms.registry';
import {
  DEFAULT_HOMEPAGE_CONTENT,
  applyHomepageContentPatch,
  normalizePrincipalHref,
  resolveHomepageContent,
  type WebsiteHomepageContent,
} from './website-homepage-content';
import { WebsiteService } from './website.service';
import { sanitizeWebsiteHtml } from './utils/website-html-sanitizer';
import { isDemoWebsiteContentSlug } from './website-content-catalog';

export type WebsiteMenuTreeNode = {
  id: string;
  label: string;
  url: string;
  target: string;
  linkType: string;
  linkRef: string | null;
  position: number;
  children: WebsiteMenuTreeNode[];
};

@Injectable()
export class WebsiteCmsEnterpriseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly website: WebsiteService,
  ) {}

  async enhancedDashboard(tenantId: string) {
    const site = await this.website.getOrCreateSite(tenantId);
    const now = new Date();
    const [
      pages,
      publishedPages,
      draftPages,
      trashPages,
      mediaAssets,
      notices,
      publishedNotices,
      newsType,
      departments,
      faculty,
      heroSlides,
      pendingReviews,
    ] = await Promise.all([
      this.prisma.websitePage.count({
        where: { tenantId, siteId: site.id, deletedAt: null },
      }),
      this.prisma.websitePage.count({
        where: {
          tenantId,
          siteId: site.id,
          status: 'PUBLISHED',
          deletedAt: null,
        },
      }),
      this.prisma.websitePage.count({
        where: { tenantId, siteId: site.id, status: 'DRAFT', deletedAt: null },
      }),
      this.prisma.websitePage.count({
        where: { tenantId, siteId: site.id, deletedAt: { not: null } },
      }),
      this.prisma.websiteMediaAsset.count({
        where: { tenantId, siteId: site.id, deletedAt: null },
      }),
      this.prisma.websiteNotice.count({
        where: { tenantId, siteId: site.id, deletedAt: null },
      }),
      this.prisma.websiteNotice.count({
        where: {
          tenantId,
          siteId: site.id,
          deletedAt: null,
          status: 'PUBLISHED',
        },
      }),
      this.prisma.websiteContentType.findFirst({
        where: { tenantId, siteId: site.id, slug: 'news' },
      }),
      this.prisma.websiteDepartmentProfile.count({
        where: { tenantId, showOnWebsite: true },
      }),
      this.prisma.staffProfile.count({
        where: { tenantId, showOnWebsite: true, status: 'ACTIVE' },
      }),
      this.prisma.websiteHeroSlide.count({
        where: { tenantId, siteId: site.id, isActive: true },
      }),
      this.prisma.websitePage.count({
        where: {
          tenantId,
          siteId: site.id,
          status: 'IN_REVIEW',
          deletedAt: null,
        },
      }),
    ]);

    const news = newsType
      ? await this.prisma.websiteContentEntry.count({
          where: {
            tenantId,
            siteId: site.id,
            contentTypeId: newsType.id,
            deletedAt: null,
          },
        })
      : 0;

    const settings = this.asRecord(site.settingsJson);
    const sources = {
      ...DEFAULT_CONTENT_SOURCES,
      ...(this.asRecord(settings.sources) as object),
    };

    return {
      status: site.status === 'ACTIVE' ? 'LIVE' : site.status,
      siteUrl: site.primaryDomain ? `https://${site.primaryDomain}` : null,
      pages,
      publishedPages,
      draftPages,
      trashPages,
      news,
      notices,
      publishedNotices,
      upcomingEvents: 0,
      departments,
      facultyProfiles: faculty,
      galleryPhotos: mediaAssets,
      mediaFiles: mediaAssets,
      heroSlides,
      pendingReviews,
      visitorsToday: null as number | null,
      seoScore: null as number | null,
      sources,
      generatedAt: now.toISOString(),
    };
  }

  async ensureHomepageLayout(tenantId: string, actorId?: string) {
    const site = await this.website.getOrCreateSite(tenantId, actorId);
    const existing = await this.prisma.websiteHomepageSection.findMany({
      where: { tenantId, siteId: site.id },
    });
    const byKey = new Map(existing.map((row) => [row.sectionKey, row]));

    // Create missing catalog rows only — never reset editor toggles or order.
    for (const [position, item] of HOMEPAGE_SECTION_CATALOG.entries()) {
      const current = byKey.get(item.key);
      if (!current) {
        const created = await this.prisma.websiteHomepageSection.create({
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
        byKey.set(item.key, created);
        continue;
      }

      const patch: { label?: string; enabled?: boolean } = {};
      if (current.label !== item.label) patch.label = item.label;
      // Keep Upcoming Events folded into Principal hub (one-time policy).
      if (item.key === 'upcomingEvents' && current.enabled) {
        patch.enabled = false;
      }
      // Departments showcase must stay on once catalog exists.
      if (item.key === 'departments' && !current.enabled) {
        patch.enabled = true;
      }
      if (Object.keys(patch).length) {
        await this.prisma.websiteHomepageSection.update({
          where: { id: current.id },
          data: patch,
        });
      }
    }

    const rows = await this.prisma.websiteHomepageSection.findMany({
      where: { tenantId, siteId: site.id },
      orderBy: { position: 'asc' },
    });

    // Seed homepage editable content once — never overwrite saved CMS content.
    const fresh = await this.prisma.websiteSite.findUniqueOrThrow({
      where: { id: site.id },
    });
    const settings = this.asRecord(fresh.settingsJson);
    if (!this.asRecord(settings.homepage)) {
      const hub = this.asRecord(settings.informationHub) ?? {};
      await this.prisma.websiteSite.update({
        where: { id: site.id },
        data: {
          settingsJson: {
            ...settings,
            homepage: DEFAULT_HOMEPAGE_CONTENT,
            informationHub: {
              ...hub,
              leadership: this.asRecord(hub.leadership) ?? {
                message: DEFAULT_HOMEPAGE_CONTENT.principal.message,
                name: DEFAULT_HOMEPAGE_CONTENT.principal.name,
                role: DEFAULT_HOMEPAGE_CONTENT.principal.role,
                tenure: DEFAULT_HOMEPAGE_CONTENT.principal.tenure,
                portraitSrc: DEFAULT_HOMEPAGE_CONTENT.principal.portraitSrc,
                portraitAlt: DEFAULT_HOMEPAGE_CONTENT.principal.portraitAlt,
                messageHref: DEFAULT_HOMEPAGE_CONTENT.principal.messageHref,
                leadershipHref:
                  DEFAULT_HOMEPAGE_CONTENT.principal.leadershipHref,
              },
            },
            aboutCollege:
              settings.aboutCollege ?? DEFAULT_HOMEPAGE_CONTENT.aboutCollege,
            footerWidgets:
              settings.footerWidgets ?? DEFAULT_HOMEPAGE_CONTENT.footer,
            stats: settings.stats ?? DEFAULT_HOMEPAGE_CONTENT.statistics,
          } as Prisma.InputJsonValue,
        },
      });
    }

    return rows.map((row) => this.mapHomepageSection(row));
  }

  async updateHomepageLayout(
    user: JwtUser,
    sections: Array<{
      sectionKey: string;
      enabled?: boolean;
      position?: number;
      settings?: Record<string, unknown>;
      label?: string;
    }>,
  ) {
    const site = await this.website.getOrCreateSite(user.tid, user.sub);
    await this.ensureHomepageLayout(user.tid, user.sub);
    await this.prisma.$transaction(
      sections.map((section, index) =>
        this.prisma.websiteHomepageSection.update({
          where: {
            siteId_sectionKey: {
              siteId: site.id,
              sectionKey: section.sectionKey,
            },
          },
          data: {
            ...(section.enabled !== undefined
              ? { enabled: section.enabled }
              : {}),
            position: section.position ?? index,
            ...(section.label !== undefined ? { label: section.label } : {}),
            ...(section.settings !== undefined
              ? { settingsJson: section.settings as Prisma.InputJsonValue }
              : {}),
          },
        }),
      ),
    );
    return this.ensureHomepageLayout(user.tid);
  }

  async listNotices(tenantId: string, opts?: { trash?: boolean }) {
    const site = await this.website.getOrCreateSite(tenantId);
    const rows = await this.prisma.websiteNotice.findMany({
      where: {
        tenantId,
        siteId: site.id,
        deletedAt: opts?.trash ? { not: null } : null,
      },
      orderBy: [{ publishAt: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map((row) => this.mapNotice(row));
  }

  async createNotice(
    user: JwtUser,
    dto: {
      title: string;
      slug?: string;
      bodyHtml?: string;
      category?: string;
      departmentId?: string | null;
      priority?: string;
      publishAt?: string | null;
      expireAt?: string | null;
      attachmentUrl?: string | null;
      attachmentName?: string | null;
      showOnHomepage?: boolean;
      isVisible?: boolean;
      status?: string;
    },
  ) {
    const site = await this.website.getOrCreateSite(user.tid, user.sub);
    const title = dto.title.trim();
    if (!title) throw new BadRequestException('Title is required');
    const slug = (dto.slug?.trim() || this.slugify(title)).toLowerCase();
    const category = (dto.category ?? 'GENERAL').toUpperCase();
    if (
      !NOTICE_CATEGORIES.includes(
        category as (typeof NOTICE_CATEGORIES)[number],
      )
    ) {
      throw new BadRequestException('Invalid notice category');
    }
    const priority = (dto.priority ?? 'NORMAL').toUpperCase();
    if (
      !NOTICE_PRIORITIES.includes(
        priority as (typeof NOTICE_PRIORITIES)[number],
      )
    ) {
      throw new BadRequestException('Invalid notice priority');
    }
    const row = await this.prisma.websiteNotice.create({
      data: {
        tenantId: user.tid,
        siteId: site.id,
        title,
        slug,
        bodyHtml: sanitizeWebsiteHtml(dto.bodyHtml ?? ''),
        category,
        departmentId: dto.departmentId ?? null,
        priority,
        publishAt: dto.publishAt ? new Date(dto.publishAt) : new Date(),
        expireAt: dto.expireAt ? new Date(dto.expireAt) : null,
        attachmentUrl: dto.attachmentUrl ?? null,
        attachmentName: dto.attachmentName ?? null,
        showOnHomepage: dto.showOnHomepage ?? true,
        isVisible: dto.isVisible ?? true,
        status: dto.status ?? 'DRAFT',
        createdById: user.sub,
        updatedById: user.sub,
      },
    });
    return this.mapNotice(row);
  }

  async updateNotice(
    user: JwtUser,
    noticeId: string,
    dto: Partial<{
      title: string;
      slug: string;
      bodyHtml: string;
      category: string;
      departmentId: string | null;
      priority: string;
      publishAt: string | null;
      expireAt: string | null;
      attachmentUrl: string | null;
      attachmentName: string | null;
      showOnHomepage: boolean;
      isVisible: boolean;
      status: string;
    }>,
  ) {
    const existing = await this.prisma.websiteNotice.findFirst({
      where: { id: noticeId, tenantId: user.tid, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Notice not found');
    const updated = await this.prisma.websiteNotice.update({
      where: { id: existing.id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.slug !== undefined
          ? { slug: dto.slug.trim().toLowerCase() }
          : {}),
        ...(dto.bodyHtml !== undefined
          ? { bodyHtml: sanitizeWebsiteHtml(dto.bodyHtml) }
          : {}),
        ...(dto.category !== undefined
          ? { category: dto.category.toUpperCase() }
          : {}),
        ...(dto.departmentId !== undefined
          ? { departmentId: dto.departmentId }
          : {}),
        ...(dto.priority !== undefined
          ? { priority: dto.priority.toUpperCase() }
          : {}),
        ...(dto.publishAt !== undefined
          ? { publishAt: dto.publishAt ? new Date(dto.publishAt) : null }
          : {}),
        ...(dto.expireAt !== undefined
          ? { expireAt: dto.expireAt ? new Date(dto.expireAt) : null }
          : {}),
        ...(dto.attachmentUrl !== undefined
          ? { attachmentUrl: dto.attachmentUrl }
          : {}),
        ...(dto.attachmentName !== undefined
          ? { attachmentName: dto.attachmentName }
          : {}),
        ...(dto.showOnHomepage !== undefined
          ? { showOnHomepage: dto.showOnHomepage }
          : {}),
        ...(dto.isVisible !== undefined ? { isVisible: dto.isVisible } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        updatedById: user.sub,
      },
    });
    return this.mapNotice(updated);
  }

  async trashNotice(user: JwtUser, noticeId: string) {
    const existing = await this.prisma.websiteNotice.findFirst({
      where: { id: noticeId, tenantId: user.tid, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Notice not found');
    await this.prisma.websiteNotice.update({
      where: { id: existing.id },
      data: { deletedAt: new Date(), deletedById: user.sub },
    });
    return { ok: true };
  }

  async restoreNotice(user: JwtUser, noticeId: string) {
    const existing = await this.prisma.websiteNotice.findFirst({
      where: { id: noticeId, tenantId: user.tid, deletedAt: { not: null } },
    });
    if (!existing) throw new NotFoundException('Notice not found in trash');
    const updated = await this.prisma.websiteNotice.update({
      where: { id: existing.id },
      data: { deletedAt: null, deletedById: null, updatedById: user.sub },
    });
    return this.mapNotice(updated);
  }

  async listAnnouncements(tenantId: string, opts?: { trash?: boolean }) {
    const site = await this.website.getOrCreateSite(tenantId);
    const rows = await this.prisma.websiteAnnouncement.findMany({
      where: {
        tenantId,
        siteId: site.id,
        deletedAt: opts?.trash ? { not: null } : null,
      },
      orderBy: [
        { isPinned: 'desc' },
        { publishAt: 'desc' },
        { createdAt: 'desc' },
      ],
    });
    return rows.map((row) => this.mapAnnouncement(row));
  }

  async createAnnouncement(
    user: JwtUser,
    dto: {
      title: string;
      slug?: string;
      summary?: string;
      bodyHtml?: string;
      featuredImageUrl?: string | null;
      featuredImageAlt?: string | null;
      attachmentUrl?: string | null;
      attachmentName?: string | null;
      linkUrl?: string | null;
      isPinned?: boolean;
      showOnTicker?: boolean;
      showOnHomepage?: boolean;
      isVisible?: boolean;
      publishAt?: string | null;
      expireAt?: string | null;
      status?: string;
    },
  ) {
    const site = await this.website.getOrCreateSite(user.tid, user.sub);
    const title = dto.title.trim();
    if (!title) throw new BadRequestException('Title is required');
    const baseSlug = (dto.slug?.trim() || this.slugify(title)).toLowerCase();
    if (!baseSlug)
      throw new BadRequestException(
        'Could not build a URL slug from the title',
      );
    const status = (dto.status ?? 'DRAFT').toUpperCase();
    if (!['DRAFT', 'PUBLISHED'].includes(status)) {
      throw new BadRequestException('Invalid announcement status');
    }
    const linkUrl = this.normalizeAnnouncementLinkUrl(dto.linkUrl);
    const bodyHtml = sanitizeWebsiteHtml(dto.bodyHtml ?? '');
    if (bodyHtml.length > 400_000) {
      throw new BadRequestException(
        'Announcement body is too large. Insert images with the toolbar (upload), not by pasting huge pictures.',
      );
    }
    const slug = await this.uniqueAnnouncementSlug(site.id, baseSlug);
    try {
      const row = await this.prisma.websiteAnnouncement.create({
        data: {
          tenantId: user.tid,
          siteId: site.id,
          title,
          slug,
          summary: (dto.summary ?? '').trim(),
          bodyHtml,
          featuredImageUrl: dto.featuredImageUrl ?? null,
          featuredImageAlt: dto.featuredImageAlt?.trim() || null,
          attachmentUrl: dto.attachmentUrl ?? null,
          attachmentName: dto.attachmentName ?? null,
          linkUrl,
          isPinned: dto.isPinned ?? false,
          showOnTicker: dto.showOnTicker ?? true,
          showOnHomepage: dto.showOnHomepage ?? true,
          isVisible: dto.isVisible ?? true,
          publishAt: dto.publishAt ? new Date(dto.publishAt) : new Date(),
          expireAt: dto.expireAt ? new Date(dto.expireAt) : null,
          status,
          createdById: user.sub,
          updatedById: user.sub,
        },
      });
      return this.mapAnnouncement(row);
    } catch (error) {
      this.rethrowAnnouncementWriteError(error);
    }
  }

  async updateAnnouncement(
    user: JwtUser,
    announcementId: string,
    dto: Partial<{
      title: string;
      slug: string;
      summary: string;
      bodyHtml: string;
      featuredImageUrl: string | null;
      featuredImageAlt: string | null;
      attachmentUrl: string | null;
      attachmentName: string | null;
      linkUrl: string | null;
      isPinned: boolean;
      showOnTicker: boolean;
      showOnHomepage: boolean;
      isVisible: boolean;
      publishAt: string | null;
      expireAt: string | null;
      status: string;
    }>,
  ) {
    const existing = await this.prisma.websiteAnnouncement.findFirst({
      where: { id: announcementId, tenantId: user.tid, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Announcement not found');
    if (dto.status !== undefined) {
      const status = dto.status.toUpperCase();
      if (!['DRAFT', 'PUBLISHED'].includes(status)) {
        throw new BadRequestException('Invalid announcement status');
      }
    }
    if (dto.bodyHtml !== undefined && dto.bodyHtml.length > 400_000) {
      throw new BadRequestException(
        'Announcement body is too large. Insert images with the toolbar (upload), not by pasting huge pictures.',
      );
    }
    try {
      const updated = await this.prisma.websiteAnnouncement.update({
        where: { id: existing.id },
        data: {
          ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
          ...(dto.slug !== undefined
            ? { slug: dto.slug.trim().toLowerCase() }
            : {}),
          ...(dto.summary !== undefined ? { summary: dto.summary.trim() } : {}),
          ...(dto.bodyHtml !== undefined
            ? { bodyHtml: sanitizeWebsiteHtml(dto.bodyHtml) }
            : {}),
          ...(dto.featuredImageUrl !== undefined
            ? { featuredImageUrl: dto.featuredImageUrl }
            : {}),
          ...(dto.featuredImageAlt !== undefined
            ? { featuredImageAlt: dto.featuredImageAlt?.trim() || null }
            : {}),
          ...(dto.attachmentUrl !== undefined
            ? { attachmentUrl: dto.attachmentUrl }
            : {}),
          ...(dto.attachmentName !== undefined
            ? { attachmentName: dto.attachmentName }
            : {}),
          ...(dto.linkUrl !== undefined
            ? { linkUrl: this.normalizeAnnouncementLinkUrl(dto.linkUrl) }
            : {}),
          ...(dto.isPinned !== undefined ? { isPinned: dto.isPinned } : {}),
          ...(dto.showOnTicker !== undefined
            ? { showOnTicker: dto.showOnTicker }
            : {}),
          ...(dto.showOnHomepage !== undefined
            ? { showOnHomepage: dto.showOnHomepage }
            : {}),
          ...(dto.isVisible !== undefined ? { isVisible: dto.isVisible } : {}),
          ...(dto.publishAt !== undefined
            ? { publishAt: dto.publishAt ? new Date(dto.publishAt) : null }
            : {}),
          ...(dto.expireAt !== undefined
            ? { expireAt: dto.expireAt ? new Date(dto.expireAt) : null }
            : {}),
          ...(dto.status !== undefined
            ? { status: dto.status.toUpperCase() }
            : {}),
          updatedById: user.sub,
        },
      });
      return this.mapAnnouncement(updated);
    } catch (error) {
      this.rethrowAnnouncementWriteError(error);
    }
  }

  async trashAnnouncement(user: JwtUser, announcementId: string) {
    const existing = await this.prisma.websiteAnnouncement.findFirst({
      where: { id: announcementId, tenantId: user.tid, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Announcement not found');
    await this.prisma.websiteAnnouncement.update({
      where: { id: existing.id },
      data: { deletedAt: new Date(), deletedById: user.sub },
    });
    return { ok: true };
  }

  async restoreAnnouncement(user: JwtUser, announcementId: string) {
    const existing = await this.prisma.websiteAnnouncement.findFirst({
      where: {
        id: announcementId,
        tenantId: user.tid,
        deletedAt: { not: null },
      },
    });
    if (!existing)
      throw new NotFoundException('Announcement not found in trash');
    const updated = await this.prisma.websiteAnnouncement.update({
      where: { id: existing.id },
      data: { deletedAt: null, deletedById: null, updatedById: user.sub },
    });
    return this.mapAnnouncement(updated);
  }

  async listPublicAnnouncements(
    tenantId: string,
    opts?: { ticker?: boolean; homepage?: boolean; slug?: string },
  ) {
    const site = await this.prisma.websiteSite.findFirst({
      where: { tenantId, status: 'ACTIVE' },
    });
    if (!site) return opts?.slug ? null : [];
    const now = new Date();
    const where = {
      tenantId,
      siteId: site.id,
      deletedAt: null,
      status: 'PUBLISHED',
      isVisible: true,
      ...(opts?.ticker ? { showOnTicker: true } : {}),
      ...(opts?.homepage ? { showOnHomepage: true } : {}),
      ...(opts?.slug ? { slug: opts.slug } : {}),
      OR: [{ publishAt: null }, { publishAt: { lte: now } }],
      AND: [{ OR: [{ expireAt: null }, { expireAt: { gt: now } }] }],
    };
    if (opts?.slug) {
      const row = await this.prisma.websiteAnnouncement.findFirst({ where });
      return row ? this.mapAnnouncement(row) : null;
    }
    const rows = await this.prisma.websiteAnnouncement.findMany({
      where,
      orderBy: [
        { isPinned: 'desc' },
        { publishAt: 'desc' },
        { createdAt: 'desc' },
      ],
      take: opts?.ticker ? 20 : 50,
    });
    return rows.map((row) => this.mapAnnouncement(row));
  }

  async listPublicNotices(tenantId: string, opts?: { homepage?: boolean }) {
    const site = await this.prisma.websiteSite.findFirst({
      where: { tenantId, status: 'ACTIVE' },
    });
    if (!site) return [];
    const now = new Date();
    const rows = await this.prisma.websiteNotice.findMany({
      where: {
        tenantId,
        siteId: site.id,
        deletedAt: null,
        status: 'PUBLISHED',
        isVisible: true,
        ...(opts?.homepage ? { showOnHomepage: true } : {}),
        OR: [{ publishAt: null }, { publishAt: { lte: now } }],
        AND: [
          {
            OR: [{ expireAt: null }, { expireAt: { gt: now } }],
          },
        ],
      },
      orderBy: [{ priority: 'asc' }, { publishAt: 'desc' }],
      take: opts?.homepage ? 12 : 50,
    });
    return rows
      .filter((row) => !isDemoWebsiteContentSlug(row.slug))
      .map((row) => this.mapNotice(row));
  }

  async getPublicHomepage(tenantId: string) {
    const site = await this.prisma.websiteSite.findFirst({
      where: { tenantId, status: 'ACTIVE' },
    });
    if (!site) throw new NotFoundException('Website not found');

    // Repair order/flags (About above Principal, no standalone events, Why Choose Us on).
    await this.ensureHomepageLayout(tenantId);

    const sections = await this.prisma.websiteHomepageSection.findMany({
      where: {
        tenantId,
        siteId: site.id,
        enabled: true,
        NOT: { sectionKey: 'upcomingEvents' },
      },
      orderBy: { position: 'asc' },
    });

    const notices = sections.some((s) => s.sectionKey === 'noticeBoard')
      ? await this.listPublicNotices(tenantId, { homepage: true })
      : [];
    const heroSlides = sections.some((s) => s.sectionKey === 'hero')
      ? await this.prisma.websiteHeroSlide.findMany({
          where: { tenantId, siteId: site.id, isActive: true },
          orderBy: { position: 'asc' },
        })
      : [];
    // Upcoming Events live inside the Principal hub; the standalone
    // `upcomingEvents` section is kept disabled by policy, so load events
    // whenever Principal (or the legacy events slot) is enabled.
    const events =
      sections.some((s) => s.sectionKey === 'principalMessage') ||
      sections.some((s) => s.sectionKey === 'upcomingEvents')
        ? await this.listUpcomingEvents(tenantId)
        : [];
    const news = sections.some((s) => s.sectionKey === 'news')
      ? await this.listPublicNews(tenantId)
      : [];

    return {
      site: {
        id: site.id,
        name: site.name,
        slug: site.slug,
        logoUrl: site.logoUrl,
        settingsJson: site.settingsJson,
      },
      content: this.getHomepageContentPayload(site.settingsJson),
      sections: sections.map((row) => ({
        ...this.mapHomepageSection(row),
        payload:
          row.sectionKey === 'noticeBoard'
            ? { notices }
            : row.sectionKey === 'hero'
              ? {
                  slides: heroSlides.map((slide) => ({
                    id: slide.id,
                    desktopSrc: slide.desktopUrl,
                    mobileSrc: slide.mobileUrl,
                    alt: slide.altText,
                  })),
                }
              : row.sectionKey === 'upcomingEvents'
                ? {
                    events,
                    source: 'academicCalendar',
                  }
                : row.sectionKey === 'news'
                  ? { entries: news }
                  : {},
      })),
    };
  }

  getHomepageContentPayload(settingsJson: unknown): WebsiteHomepageContent {
    const content = resolveHomepageContent(settingsJson);
    content.principal.messageHref = normalizePrincipalHref(
      content.principal.messageHref,
    );
    if (!content.principal.messageHref) {
      content.principal.messageHref =
        DEFAULT_HOMEPAGE_CONTENT.principal.messageHref;
    }
    return content;
  }

  async getHomepageContent(tenantId: string) {
    const site = await this.website.getOrCreateSite(tenantId);
    return this.getHomepageContentPayload(site.settingsJson);
  }

  async updateHomepageContent(
    user: JwtUser,
    patch: Partial<WebsiteHomepageContent>,
  ) {
    const site = await this.website.getOrCreateSite(user.tid, user.sub);
    const settings = this.asRecord(site.settingsJson);
    const storedHomepage = this.asRecord(settings.homepage) ?? {};
    const nextHomepageStored = applyHomepageContentPatch(storedHomepage, patch);
    const nextHomepage = resolveHomepageContent({
      ...settings,
      homepage: nextHomepageStored,
    });

    const nextSettings: Record<string, unknown> = {
      ...settings,
      homepage: nextHomepageStored,
    };

    // Only rewrite mirrored blobs for sections that were actually patched.
    // Previously every save materialised defaults into principal + informationHub,
    // which made Principal's Message flip back to the short stub.
    if (patch.principal) {
      const hub = this.asRecord(settings.informationHub) ?? {};
      nextSettings.informationHub = {
        ...hub,
        leadership: {
          message: nextHomepage.principal.message,
          name: nextHomepage.principal.name,
          role: nextHomepage.principal.role,
          tenure: nextHomepage.principal.tenure,
          portraitSrc: nextHomepage.principal.portraitSrc,
          portraitAlt: nextHomepage.principal.portraitAlt,
          messageHref: nextHomepage.principal.messageHref,
          leadershipHref: nextHomepage.principal.leadershipHref,
        },
      };
    }
    if (patch.aboutCollege) {
      nextSettings.aboutCollege = nextHomepage.aboutCollege;
    }
    if (patch.visionMission) {
      nextSettings.visionMission = nextHomepage.visionMission;
    }
    if (patch.statistics) {
      nextSettings.stats = nextHomepage.statistics;
    }
    if (patch.footer) {
      nextSettings.footerWidgets = nextHomepage.footer;
    }
    if (patch.whyChooseUs) {
      nextSettings.whyChooseUs = nextHomepage.whyChooseUs;
    }
    if (patch.hero) {
      nextSettings.heroChrome = nextHomepage.hero;
    }
    if (patch.lifeAtCampus) {
      // Keep legacy settings.gallery in sync for older public readers.
      nextSettings.gallery = nextHomepage.lifeAtCampus.items.map((item) => ({
        src: item.src,
        alt: item.alt,
        label: item.label,
        ...(item.href ? { href: item.href } : {}),
      }));
    }

    await this.prisma.websiteSite.update({
      where: { id: site.id },
      data: { settingsJson: nextSettings as Prisma.InputJsonValue },
    });
    void this.requestRevalidation(user, ['/']).catch(() => undefined);
    return this.getHomepageContentPayload(nextSettings);
  }

  async listUpcomingEvents(tenantId: string) {
    // Prefer published ERP Academic Calendar public events.
    const erpEvents = await this.prisma.academicCalendarEvent.findMany({
      where: {
        tenantId,
        deletedAt: null,
        active: true,
        visibility: 'PUBLIC',
        publishedToWebsite: true,
        endDate: { gte: new Date(new Date().toISOString().slice(0, 10)) },
        calendar: { deletedAt: null, status: 'PUBLISHED' },
      },
      orderBy: [{ startDate: 'asc' }, { title: 'asc' }],
      take: 12,
    });
    if (erpEvents.length) {
      return erpEvents.map((row) => ({
        id: row.id,
        title: row.title,
        date: row.startDate.toISOString().slice(0, 10),
        category: row.type,
        href: '/academics/calendar',
        registrationUrl: null,
        featured: false,
        showCountdown: false,
        source: 'ERP',
      }));
    }

    const site = await this.prisma.websiteSite.findFirst({
      where: { tenantId, status: 'ACTIVE' },
    });
    if (!site) return [];
    const settings = this.asRecord(site.settingsJson);
    const items = Array.isArray(settings.calendarItems)
      ? settings.calendarItems
      : [];
    const now = Date.now();
    return items
      .map((row, index) => {
        if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
        const item = row as Record<string, unknown>;
        if (item.showOnWebsite === false) return null;
        const date =
          typeof item.date === 'string'
            ? item.date
            : typeof item.startsAt === 'string'
              ? item.startsAt.slice(0, 10)
              : null;
        if (!date || new Date(date).getTime() < now - 86400000) return null;
        return {
          id: typeof item.id === 'string' ? item.id : `cal-${index}`,
          title: typeof item.title === 'string' ? item.title : 'Event',
          date,
          category:
            typeof item.category === 'string' ? item.category : 'Academic',
          href:
            typeof item.href === 'string' ? item.href : '/academics/calendar',
          registrationUrl:
            typeof item.registrationUrl === 'string'
              ? item.registrationUrl
              : null,
          featured: Boolean(item.featured),
          showCountdown: Boolean(item.showCountdown),
          source: typeof item.source === 'string' ? item.source : 'ERP',
        };
      })
      .filter(Boolean)
      .slice(0, 12);
  }

  async listPublicNews(tenantId: string) {
    const site = await this.prisma.websiteSite.findFirst({
      where: { tenantId, status: 'ACTIVE' },
    });
    if (!site) return [];
    const newsType = await this.prisma.websiteContentType.findFirst({
      where: { tenantId, siteId: site.id, slug: 'news' },
    });
    if (!newsType) return [];
    const rows = await this.prisma.websiteContentEntry.findMany({
      where: {
        tenantId,
        siteId: site.id,
        contentTypeId: newsType.id,
        status: 'PUBLISHED',
        deletedAt: null,
      },
      orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
      take: 12,
    });
    return rows
      .filter((row) => !isDemoWebsiteContentSlug(row.slug))
      .map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        status: row.status,
        fields: this.asRecord(row.data),
        publishedAt: row.publishedAt,
        updatedAt: row.updatedAt,
      }));
  }

  async getCalendarItems(tenantId: string) {
    const site = await this.website.getOrCreateSite(tenantId);
    const settings = this.asRecord(site.settingsJson);
    return Array.isArray(settings.calendarItems) ? settings.calendarItems : [];
  }

  async updateCalendarItems(
    user: JwtUser,
    items: Array<Record<string, unknown>>,
  ) {
    const site = await this.website.getOrCreateSite(user.tid, user.sub);
    const settings = this.asRecord(site.settingsJson);
    const next = {
      ...settings,
      calendarItems: items,
      sources: {
        ...DEFAULT_CONTENT_SOURCES,
        ...(this.asRecord(settings.sources) as object),
        upcomingEvents: { mode: 'ERP', adapter: 'academicCalendar' },
      },
    };
    await this.prisma.websiteSite.update({
      where: { id: site.id },
      data: { settingsJson: next as Prisma.InputJsonValue },
    });
    return items;
  }

  async getContentSources(tenantId: string) {
    const site = await this.website.getOrCreateSite(tenantId);
    const settings = this.asRecord(site.settingsJson);
    return {
      ...DEFAULT_CONTENT_SOURCES,
      ...(this.asRecord(settings.sources) as object),
    };
  }

  async updateContentSources(user: JwtUser, sources: Record<string, unknown>) {
    const site = await this.website.getOrCreateSite(user.tid, user.sub);
    const settings = this.asRecord(site.settingsJson);
    const next = {
      ...settings,
      sources: {
        ...DEFAULT_CONTENT_SOURCES,
        ...sources,
      },
    };
    await this.prisma.websiteSite.update({
      where: { id: site.id },
      data: { settingsJson: next as Prisma.InputJsonValue },
    });
    return next.sources;
  }

  async listMediaFolders(tenantId: string) {
    const site = await this.website.getOrCreateSite(tenantId);
    return this.prisma.websiteMediaFolder.findMany({
      where: { tenantId, siteId: site.id },
      orderBy: { name: 'asc' },
    });
  }

  async createMediaFolder(
    user: JwtUser,
    dto: { name: string; parentId?: string | null },
  ) {
    const site = await this.website.getOrCreateSite(user.tid, user.sub);
    const name = dto.name?.trim();
    if (!name) throw new BadRequestException('Folder name is required');
    return this.prisma.websiteMediaFolder.create({
      data: {
        tenantId: user.tid,
        siteId: site.id,
        name,
        parentId: dto.parentId ?? null,
      },
    });
  }

  async updateMediaMeta(
    user: JwtUser,
    mediaId: string,
    dto: {
      altText?: string | null;
      caption?: string | null;
      tags?: string[];
      folderId?: string | null;
    },
  ) {
    const media = await this.prisma.websiteMediaAsset.findFirst({
      where: { id: mediaId, tenantId: user.tid, deletedAt: null },
    });
    if (!media) throw new NotFoundException('Media not found');
    return this.prisma.websiteMediaAsset.update({
      where: { id: media.id },
      data: {
        ...(dto.altText !== undefined ? { altText: dto.altText } : {}),
        ...(dto.caption !== undefined ? { caption: dto.caption } : {}),
        ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
        ...(dto.folderId !== undefined ? { folderId: dto.folderId } : {}),
      },
    });
  }

  async listSitemapEntries(tenantId: string) {
    const site = await this.prisma.websiteSite.findFirst({
      where: { tenantId, status: 'ACTIVE' },
    });
    if (!site) return [];
    const pages = await this.prisma.websitePage.findMany({
      where: {
        tenantId,
        siteId: site.id,
        status: 'PUBLISHED',
        deletedAt: null,
      },
      select: { path: true, updatedAt: true, publishedAt: true },
    });
    const news = await this.listPublicNews(tenantId);
    return [
      { loc: '/', lastmod: site.updatedAt, changefreq: 'daily', priority: 1 },
      ...pages.map((page) => ({
        loc: page.path.startsWith('/') ? page.path : `/${page.path}`,
        lastmod: page.publishedAt ?? page.updatedAt,
        changefreq: 'weekly',
        priority: 0.7,
      })),
      ...news.map((entry) => ({
        loc: `/news/${entry.slug}`,
        lastmod: entry.publishedAt ?? entry.updatedAt,
        changefreq: 'weekly',
        priority: 0.6,
      })),
    ];
  }

  async getThemePresets(tenantId: string) {
    const site = await this.website.getOrCreateSite(tenantId);
    const settings = this.asRecord(site.settingsJson);
    const presets = Array.isArray(settings.themePresets)
      ? settings.themePresets
      : [
          {
            id: 'classic-navy',
            name: 'Classic Navy',
            primaryColor: '#0B2E59',
            secondaryColor: '#C5A46B',
            fontFamily: 'Libre Baskerville, Georgia, serif',
          },
          {
            id: 'modern-teal',
            name: 'Modern Teal',
            primaryColor: '#0F766E',
            secondaryColor: '#F59E0B',
            fontFamily: 'Source Sans 3, system-ui, sans-serif',
          },
        ];
    return {
      activePresetId:
        typeof settings.activeThemePresetId === 'string'
          ? settings.activeThemePresetId
          : 'classic-navy',
      presets,
      footerWidgets: this.asRecord(settings.footerWidgets),
      seoDefaults: this.asRecord(settings.seoDefaults),
    };
  }

  async updateAppearance(
    user: JwtUser,
    patch: {
      activeThemePresetId?: string;
      themePresets?: unknown[];
      footerWidgets?: Record<string, unknown>;
      seoDefaults?: Record<string, unknown>;
    },
  ) {
    const site = await this.website.getOrCreateSite(user.tid, user.sub);
    const settings = this.asRecord(site.settingsJson);
    const next = {
      ...settings,
      ...(patch.activeThemePresetId !== undefined
        ? { activeThemePresetId: patch.activeThemePresetId }
        : {}),
      ...(patch.themePresets !== undefined
        ? { themePresets: patch.themePresets }
        : {}),
      ...(patch.footerWidgets !== undefined
        ? { footerWidgets: patch.footerWidgets }
        : {}),
      ...(patch.seoDefaults !== undefined
        ? { seoDefaults: patch.seoDefaults }
        : {}),
    };
    await this.prisma.websiteSite.update({
      where: { id: site.id },
      data: { settingsJson: next as Prisma.InputJsonValue },
    });
    return this.getThemePresets(user.tid);
  }

  async requestRevalidation(user: JwtUser, paths?: string[]) {
    const site = await this.website.getOrCreateSite(user.tid, user.sub);
    const settings = this.asRecord(site.settingsJson);
    const hook =
      typeof settings.revalidateWebhookUrl === 'string'
        ? settings.revalidateWebhookUrl
        : process.env.WEBSITE_REVALIDATE_WEBHOOK_URL;
    const payload = {
      tenantId: user.tid,
      siteId: site.id,
      paths: paths?.length ? paths : ['/', '/news', '/sitemap.xml'],
      tags: ['website-cms'],
      requestedAt: new Date().toISOString(),
      requestedBy: user.sub,
    };
    if (hook) {
      try {
        const secret =
          process.env.WEBSITE_REVALIDATE_SECRET?.trim() ||
          process.env.REVALIDATE_SECRET?.trim();
        await fetch(hook, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(secret ? { 'x-revalidate-secret': secret } : {}),
          },
          body: JSON.stringify(payload),
        });
      } catch {
        // Non-blocking: publish still succeeds if webhook is down
      }
    }
    return { ok: true, ...payload, webhookConfigured: Boolean(hook) };
  }

  async trashPage(user: JwtUser, pageId: string) {
    const page = await this.prisma.websitePage.findFirst({
      where: { id: pageId, tenantId: user.tid, deletedAt: null },
    });
    if (!page) throw new NotFoundException('Page not found');
    await this.prisma.websitePage.update({
      where: { id: page.id },
      data: {
        deletedAt: new Date(),
        deletedById: user.sub,
        status: 'ARCHIVED',
      },
    });
    return { ok: true };
  }

  async restorePage(user: JwtUser, pageId: string) {
    const page = await this.prisma.websitePage.findFirst({
      where: { id: pageId, tenantId: user.tid, deletedAt: { not: null } },
    });
    if (!page) throw new NotFoundException('Page not found in trash');
    await this.prisma.websitePage.update({
      where: { id: page.id },
      data: {
        deletedAt: null,
        deletedById: null,
        status: 'DRAFT',
        updatedById: user.sub,
      },
    });
    return { ok: true };
  }

  async duplicatePage(user: JwtUser, pageId: string) {
    const page = await this.prisma.websitePage.findFirst({
      where: { id: pageId, tenantId: user.tid, deletedAt: null },
      include: {
        sections: { orderBy: { position: 'asc' } },
        currentRevision: true,
      },
    });
    if (!page) throw new NotFoundException('Page not found');
    const path = `${page.path.replace(/\/$/, '')}-copy-${Date.now().toString(36)}`;
    const created = await this.prisma.$transaction(async (tx) => {
      const next = await tx.websitePage.create({
        data: {
          tenantId: user.tid,
          siteId: page.siteId,
          path,
          title: `${page.title} (Copy)`,
          status: 'DRAFT',
          template: page.template,
          createdById: user.sub,
          updatedById: user.sub,
        },
      });
      const revision = await tx.websitePageRevision.create({
        data: {
          tenantId: user.tid,
          pageId: next.id,
          revisionNumber: 1,
          title: `${page.title} (Copy)`,
          excerpt: page.currentRevision?.excerpt ?? null,
          bodyHtml: page.currentRevision?.bodyHtml ?? '',
          seoTitle: page.currentRevision?.seoTitle ?? null,
          seoDescription: page.currentRevision?.seoDescription ?? null,
          seoKeywords: page.currentRevision?.seoKeywords ?? [],
          changeNote: `Duplicated from ${page.path}`,
          createdById: user.sub,
        },
      });
      await tx.websitePage.update({
        where: { id: next.id },
        data: { currentRevisionId: revision.id },
      });
      for (const section of page.sections) {
        await tx.websitePageSection.create({
          data: {
            tenantId: user.tid,
            pageId: next.id,
            type: section.type,
            label: section.label,
            heading: section.heading,
            bodyHtml: section.bodyHtml,
            settings: section.settings as Prisma.InputJsonValue,
            position: section.position,
            isVisible: section.isVisible,
          },
        });
      }
      return next;
    });
    return created;
  }

  async listPublicMenus(
    tenantId: string,
    location?: string,
  ): Promise<
    Array<{
      id: string;
      name: string;
      location: string;
      items: WebsiteMenuTreeNode[];
    }>
  > {
    const site = await this.prisma.websiteSite.findFirst({
      where: { tenantId, status: 'ACTIVE' },
    });
    if (!site) return [];
    const menus = await this.prisma.websiteMenu.findMany({
      where: {
        tenantId,
        siteId: site.id,
        ...(location ? { location } : {}),
      },
      include: {
        items: {
          where: { isVisible: true },
          orderBy: { position: 'asc' },
        },
      },
    });
    return menus.map((menu) => ({
      id: menu.id,
      name: menu.name,
      location: menu.location,
      items: this.buildMenuTree(menu.items),
    }));
  }

  private buildMenuTree(
    items: Array<{
      id: string;
      label: string;
      url: string;
      target: string;
      linkType: string;
      linkRef: string | null;
      position: number;
      parentId: string | null;
      isVisible: boolean;
    }>,
  ): WebsiteMenuTreeNode[] {
    const byId = new Map<string, WebsiteMenuTreeNode>();
    items.forEach((item) => {
      byId.set(item.id, {
        id: item.id,
        label: item.label,
        url: item.url,
        target: item.target,
        linkType: item.linkType,
        linkRef: item.linkRef,
        position: item.position,
        children: [],
      });
    });
    const roots: WebsiteMenuTreeNode[] = [];
    items.forEach((item) => {
      const node = byId.get(item.id)!;
      if (item.parentId && byId.has(item.parentId)) {
        byId.get(item.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });
    return roots;
  }

  private mapHomepageSection(row: {
    id: string;
    sectionKey: string;
    label: string;
    enabled: boolean;
    position: number;
    settingsJson: unknown;
  }) {
    return {
      id: row.id,
      sectionKey: row.sectionKey as HomepageSectionKey,
      label: row.label,
      enabled: row.enabled,
      position: row.position,
      settings: this.asRecord(row.settingsJson),
    };
  }

  private mapNotice(row: {
    id: string;
    title: string;
    slug: string;
    bodyHtml: string;
    category: string;
    departmentId: string | null;
    priority: string;
    publishAt: Date | null;
    expireAt: Date | null;
    attachmentUrl: string | null;
    attachmentName: string | null;
    showOnHomepage: boolean;
    isVisible: boolean;
    status: string;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      bodyHtml: row.bodyHtml,
      category: row.category,
      departmentId: row.departmentId,
      priority: row.priority,
      publishAt: row.publishAt,
      expireAt: row.expireAt,
      attachmentUrl: row.attachmentUrl,
      attachmentName: row.attachmentName,
      showOnHomepage: row.showOnHomepage,
      isVisible: row.isVisible,
      status: row.status,
      deletedAt: row.deletedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapAnnouncement(row: {
    id: string;
    title: string;
    slug: string;
    summary: string;
    bodyHtml: string;
    featuredImageUrl: string | null;
    featuredImageAlt: string | null;
    attachmentUrl: string | null;
    attachmentName: string | null;
    linkUrl: string | null;
    isPinned: boolean;
    showOnTicker: boolean;
    showOnHomepage: boolean;
    isVisible: boolean;
    publishAt: Date | null;
    expireAt: Date | null;
    status: string;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const linkUrl = row.linkUrl?.trim() || null;
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      summary: row.summary,
      bodyHtml: row.bodyHtml,
      featuredImageUrl: row.featuredImageUrl,
      featuredImageAlt: row.featuredImageAlt,
      attachmentUrl: row.attachmentUrl,
      attachmentName: row.attachmentName,
      linkUrl,
      isPinned: row.isPinned,
      showOnTicker: row.showOnTicker,
      showOnHomepage: row.showOnHomepage,
      isVisible: row.isVisible,
      publishAt: row.publishAt,
      expireAt: row.expireAt,
      status: row.status,
      deletedAt: row.deletedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      href: linkUrl || `/announcements/${row.slug}`,
      isNew:
        Boolean(row.publishAt) &&
        Date.now() - new Date(row.publishAt!).getTime() <=
          21 * 24 * 60 * 60 * 1000,
    };
  }

  /** Allow same-site paths or http(s) URLs for announcement click-through. */
  private normalizeAnnouncementLinkUrl(value?: string | null): string | null {
    const raw = (value ?? '').trim();
    if (!raw) return null;
    if (raw.startsWith('/') && !raw.startsWith('//')) {
      if (raw.length > 2000) {
        throw new BadRequestException('Link URL is too long');
      }
      return raw;
    }
    let candidate = raw;
    if (!/^https?:\/\//i.test(candidate)) {
      candidate = `https://${candidate}`;
    }
    let parsed: URL;
    try {
      parsed = new URL(candidate);
    } catch {
      throw new BadRequestException(
        'Link URL must be a valid http(s) address or site path (e.g. /news)',
      );
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new BadRequestException('Link URL must use http or https');
    }
    return parsed.toString();
  }

  private async uniqueAnnouncementSlug(siteId: string, baseSlug: string) {
    let slug = baseSlug.slice(0, 80);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const existing = await this.prisma.websiteAnnouncement.findFirst({
        where: { siteId, slug, deletedAt: null },
        select: { id: true },
      });
      if (!existing) return slug;
      const suffix = `-${attempt + 2}`;
      slug = `${baseSlug.slice(0, Math.max(1, 80 - suffix.length))}${suffix}`;
    }
    return `${baseSlug.slice(0, 70)}-${Date.now().toString(36)}`;
  }

  private rethrowAnnouncementWriteError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new BadRequestException(
        'An announcement with a similar title already exists. Change the title slightly and try again.',
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2022'
    ) {
      throw new BadRequestException(
        'Database is missing the announcement link_url column. Run migrations on the server, then retry.',
      );
    }
    if (error instanceof Prisma.PrismaClientValidationError) {
      throw new BadRequestException(
        'Announcement could not be saved (invalid data). If you just deployed, rebuild the API and run migrations.',
      );
    }
    throw error;
  }

  private slugify(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80);
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}
