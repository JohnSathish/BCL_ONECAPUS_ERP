import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'crypto';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';
import type {
  AdminWebsitePageDto,
  CreateWebsiteContentTypeDto,
  PublishWebsiteDto,
  UpdateWebsiteHeroSlideDto,
  UpdateWebsiteMediaDto,
  UpdateWebsiteMenuDto,
  WebsiteContentEntryDto,
  WebsiteSectionDto,
  WebsiteSettingsDto,
} from './dto/website-admin.dto';
import { sanitizeWebsiteHtml } from './utils/website-html-sanitizer';
import { DEFAULT_HOMEPAGE_CONTENT } from './website-homepage-content';
import { WebsiteService } from './website.service';

const SETTINGS_DEFAULTS = {
  tagline: null,
  description: null,
  primaryColor: '#2563eb',
  secondaryColor: '#7c3aed',
  fontFamily: 'Inter',
  contactEmail: null,
  contactPhone: null,
  address: null,
  mapUrl: null,
  socialLinks: {},
} as const;

@Injectable()
export class WebsiteAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly website: WebsiteService,
  ) {}

  async dashboard(tenantId: string) {
    const site = await this.website.getOrCreateSite(tenantId);
    const [
      pages,
      publishedPages,
      draftPages,
      mediaAssets,
      pendingReviews,
      recentActivity,
    ] = await this.prisma.$transaction([
      this.prisma.websitePage.count({ where: { tenantId, siteId: site.id } }),
      this.prisma.websitePage.count({
        where: { tenantId, siteId: site.id, status: 'PUBLISHED' },
      }),
      this.prisma.websitePage.count({
        where: { tenantId, siteId: site.id, status: 'DRAFT' },
      }),
      this.prisma.websiteMediaAsset.count({
        where: { tenantId, siteId: site.id },
      }),
      this.prisma.websitePage.count({
        where: { tenantId, siteId: site.id, status: 'IN_REVIEW' },
      }),
      this.prisma.websiteRevision.findMany({
        where: { tenantId, siteId: site.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);
    const latest = await this.prisma.websitePage.aggregate({
      where: { tenantId, siteId: site.id, status: 'PUBLISHED' },
      _max: { publishedAt: true },
    });
    return {
      pages,
      publishedPages,
      draftPages,
      mediaAssets,
      pendingReviews,
      lastPublishedAt: latest._max.publishedAt,
      siteUrl: site.primaryDomain ? `https://${site.primaryDomain}` : null,
      recentActivity: recentActivity.map((revision) =>
        this.mapRevision(revision),
      ),
    };
  }

  async seedDefaults(user: JwtUser) {
    const site = await this.website.getOrCreateSite(user.tid, user.sub);
    await this.ensureMenus(site.id, user.tid);
    for (const definition of [
      {
        name: 'News',
        slug: 'news',
        description: 'College news and announcements',
        fields: [
          { key: 'summary', label: 'Summary', type: 'text', required: true },
          { key: 'body', label: 'Body', type: 'richText', required: true },
          {
            key: 'image',
            label: 'Featured image',
            type: 'image',
            required: false,
          },
          {
            key: 'imageThumb',
            label: 'Featured thumbnail',
            type: 'image',
            required: false,
          },
          {
            key: 'gallery',
            label: 'Gallery images',
            type: 'json',
            required: false,
          },
          { key: 'category', label: 'Category', type: 'text', required: false },
          { key: 'author', label: 'Author', type: 'text', required: false },
          { key: 'tags', label: 'Tags', type: 'json', required: false },
          {
            key: 'seoTitle',
            label: 'SEO meta title',
            type: 'text',
            required: false,
          },
          {
            key: 'seoDescription',
            label: 'SEO description',
            type: 'text',
            required: false,
          },
          {
            key: 'featured',
            label: 'Featured news',
            type: 'boolean',
            required: false,
          },
          {
            key: 'sourceUrl',
            label: 'Original source URL',
            type: 'text',
            required: false,
          },
        ],
      },
      {
        name: 'Events',
        slug: 'events',
        description: 'Upcoming and archived college events',
        fields: [
          { key: 'date', label: 'Event date', type: 'date', required: true },
          { key: 'venue', label: 'Venue', type: 'text', required: false },
          { key: 'body', label: 'Body', type: 'richText', required: true },
        ],
      },
      {
        name: 'Testimonials',
        slug: 'testimonials',
        description: 'Student and alumni voices',
        fields: [
          { key: 'quote', label: 'Quote', type: 'richText', required: true },
          {
            key: 'department',
            label: 'Department',
            type: 'text',
            required: true,
          },
          {
            key: 'graduationYear',
            label: 'Graduation year',
            type: 'text',
            required: true,
          },
          {
            key: 'status',
            label: 'Current status',
            type: 'text',
            required: false,
          },
          {
            key: 'photoSrc',
            label: 'Photo URL',
            type: 'image',
            required: false,
          },
        ],
      },
      {
        name: 'Flash News',
        slug: 'flash-news',
        description: 'Short ticker / flash items',
        fields: [
          { key: 'summary', label: 'Summary', type: 'text', required: true },
          { key: 'href', label: 'Link', type: 'text', required: false },
        ],
      },
      {
        name: 'Announcements',
        slug: 'announcements',
        description: 'Campus announcements',
        fields: [
          { key: 'summary', label: 'Summary', type: 'text', required: true },
          { key: 'body', label: 'Body', type: 'richText', required: false },
          { key: 'href', label: 'Link', type: 'text', required: false },
        ],
      },
    ]) {
      await this.prisma.websiteContentType.upsert({
        where: {
          siteId_slug: { siteId: site.id, slug: definition.slug },
        },
        update: {},
        create: {
          tenantId: user.tid,
          siteId: site.id,
          ...definition,
        },
      });
    }
    const pages = await this.prisma.websitePage.findMany({
      where: { tenantId: user.tid, siteId: site.id },
    });
    for (const page of pages) {
      if (
        !(await this.prisma.websitePageSection.count({
          where: { pageId: page.id },
        }))
      ) {
        await this.prisma.websitePageSection.create({
          data: {
            tenantId: user.tid,
            pageId: page.id,
            type: page.path === '/' ? 'HERO' : 'RICH_TEXT',
            label: page.title,
            heading: page.title,
            position: 0,
          },
        });
      }
    }
    // Seed homepage editable content defaults once.
    const settings =
      site.settingsJson &&
      typeof site.settingsJson === 'object' &&
      !Array.isArray(site.settingsJson)
        ? (site.settingsJson as Record<string, unknown>)
        : {};
    if (!settings.homepage) {
      await this.prisma.websiteSite.update({
        where: { id: site.id },
        data: {
          settingsJson: {
            ...settings,
            homepage: DEFAULT_HOMEPAGE_CONTENT,
            aboutCollege: DEFAULT_HOMEPAGE_CONTENT.aboutCollege,
            footerWidgets: DEFAULT_HOMEPAGE_CONTENT.footer,
            stats: DEFAULT_HOMEPAGE_CONTENT.statistics,
          } as Prisma.InputJsonValue,
        },
      });
    }
    return { menus: 3, contentTypes: 5, pages: pages.length };
  }

  async settings(tenantId: string) {
    const site = await this.website.getOrCreateSite(tenantId);
    return this.mapSettings(site);
  }

  async updateSettings(user: JwtUser, dto: WebsiteSettingsDto) {
    const site = await this.website.getOrCreateSite(user.tid, user.sub);
    const current = this.asRecord(site.settingsJson);
    // Merge branding fields into existing settingsJson — never wipe homepage CMS.
    const settings = {
      ...current,
      tagline: dto.tagline ?? null,
      description: dto.description ?? null,
      primaryColor: dto.primaryColor,
      secondaryColor: dto.secondaryColor,
      fontFamily: dto.fontFamily,
      contactEmail: dto.contactEmail ?? null,
      contactPhone: dto.contactPhone ?? null,
      address: dto.address ?? null,
      mapUrl: dto.mapUrl ?? null,
      socialLinks: this.safeSocialLinks(dto.socialLinks),
    };
    const updated = await this.prisma.websiteSite.update({
      where: { id: site.id },
      data: {
        name: dto.siteName.trim(),
        logoUrl: dto.logoUrl ?? null,
        faviconUrl: dto.faviconUrl ?? null,
        settingsJson: settings as Prisma.InputJsonValue,
        updatedById: user.sub,
      },
    });
    await this.recordRevision(
      user,
      site.id,
      'SETTINGS',
      site.id,
      'UPDATED',
      this.mapSettings(updated),
    );
    return this.mapSettings(updated);
  }

  async pages(tenantId: string) {
    const site = await this.website.getOrCreateSite(tenantId);
    const pages = await this.prisma.websitePage.findMany({
      where: { tenantId, siteId: site.id, deletedAt: null },
      include: {
        currentRevision: true,
        sections: { orderBy: { position: 'asc' } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    const authorIds = [
      ...new Set(
        pages
          .map((page) => page.createdById)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const authors = authorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: authorIds } },
          select: { id: true, displayName: true, email: true },
        })
      : [];
    const authorById = new Map(
      authors.map((user) => [
        user.id,
        user.displayName?.trim() || user.email || 'Unknown',
      ]),
    );
    return pages.map((page) =>
      this.mapPage(page, {
        authorName: page.createdById
          ? (authorById.get(page.createdById) ?? 'System')
          : 'System',
        createdAt: page.createdAt,
        path: page.path,
      }),
    );
  }

  async createPage(user: JwtUser, dto: AdminWebsitePageDto) {
    if (!dto.title?.trim()) throw new BadRequestException('title is required');
    const page = await this.website.createPage(user, {
      title: dto.title,
      path: dto.slug || this.slugify(dto.title),
      excerpt: dto.excerpt ?? undefined,
      seoTitle: dto.seoTitle ?? undefined,
      seoDescription: dto.seoDescription ?? undefined,
    });
    const updated =
      dto.template || dto.status === 'IN_REVIEW'
        ? await this.prisma.websitePage.update({
            where: { id: page.id },
            data: {
              template: dto.template?.trim() || 'DEFAULT',
              status: dto.status === 'IN_REVIEW' ? 'IN_REVIEW' : 'DRAFT',
            },
            include: {
              currentRevision: true,
              sections: { orderBy: { position: 'asc' } },
            },
          })
        : await this.getAdminPage(user.tid, page.id);
    const mapped = this.mapPage(updated);
    await this.recordRevision(
      user,
      page.siteId,
      'PAGE',
      page.id,
      'CREATED',
      mapped,
    );
    return mapped;
  }

  async updatePage(user: JwtUser, pageId: string, dto: AdminWebsitePageDto) {
    if (dto.status === 'SCHEDULED') {
      throw new BadRequestException(
        'Use the publish endpoint to schedule a page',
      );
    }
    const existing = await this.getAdminPage(user.tid, pageId);
    if (dto.status === 'PUBLISHED' && existing.status !== 'PUBLISHED') {
      this.assertCanPublish(user);
    }
    const revisionFieldsChanged = [
      dto.title,
      dto.slug,
      dto.excerpt,
      dto.seoTitle,
      dto.seoDescription,
    ].some((value) => value !== undefined);
    if (revisionFieldsChanged) {
      await this.website.updatePage(user, pageId, {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.slug !== undefined ? { path: dto.slug } : {}),
        ...(dto.excerpt !== undefined ? { excerpt: dto.excerpt } : {}),
        ...(dto.seoTitle !== undefined ? { seoTitle: dto.seoTitle } : {}),
        ...(dto.seoDescription !== undefined
          ? { seoDescription: dto.seoDescription }
          : {}),
        changeNote: 'Updated from website CMS',
      });
    }
    if (dto.status === 'PUBLISHED' && existing.status !== 'PUBLISHED') {
      await this.website.publishPage(user, pageId);
    } else if (dto.status === 'ARCHIVED') {
      await this.website.archivePage(user, pageId);
    } else if (dto.status || dto.template) {
      await this.prisma.websitePage.update({
        where: { id: pageId },
        data: {
          ...(dto.status ? { status: dto.status } : {}),
          ...(dto.template ? { template: dto.template.trim() } : {}),
          updatedById: user.sub,
        },
      });
    }
    const updated = await this.getAdminPage(user.tid, pageId);
    const mapped = this.mapPage(updated);
    await this.recordRevision(
      user,
      existing.siteId,
      'PAGE',
      pageId,
      'UPDATED',
      mapped,
    );
    return mapped;
  }

  async createSection(user: JwtUser, pageId: string, dto: WebsiteSectionDto) {
    const page = await this.getAdminPage(user.tid, pageId);
    if (!dto.type?.trim()) throw new BadRequestException('type is required');
    const max = await this.prisma.websitePageSection.aggregate({
      where: { pageId },
      _max: { position: true },
    });
    const section = await this.prisma.websitePageSection.create({
      data: {
        tenantId: user.tid,
        pageId,
        type: dto.type.trim(),
        label: dto.label?.trim() || dto.type.trim(),
        heading: dto.heading?.trim() || null,
        bodyHtml: sanitizeWebsiteHtml(dto.bodyHtml),
        settings: this.sanitizeSectionSettings(dto.settings ?? {}),
        position: dto.position ?? (max._max.position ?? -1) + 1,
        isVisible: dto.isVisible ?? true,
      },
    });
    await this.recordPageSnapshot(user, page.siteId, pageId, 'SECTION_CREATED');
    return section;
  }

  async updateSection(
    user: JwtUser,
    pageId: string,
    sectionId: string,
    dto: WebsiteSectionDto,
  ) {
    await this.requireSection(user.tid, pageId, sectionId);
    const section = await this.prisma.websitePageSection.update({
      where: { id: sectionId },
      data: {
        ...(dto.type !== undefined ? { type: dto.type.trim() } : {}),
        ...(dto.label !== undefined ? { label: dto.label.trim() } : {}),
        ...(dto.heading !== undefined
          ? { heading: dto.heading?.trim() || null }
          : {}),
        ...(dto.bodyHtml !== undefined
          ? { bodyHtml: sanitizeWebsiteHtml(dto.bodyHtml) || null }
          : {}),
        ...(dto.settings !== undefined
          ? { settings: this.sanitizeSectionSettings(dto.settings) }
          : {}),
        ...(dto.position !== undefined ? { position: dto.position } : {}),
        ...(dto.isVisible !== undefined ? { isVisible: dto.isVisible } : {}),
      },
    });
    const page = await this.getAdminPage(user.tid, pageId);
    await this.recordPageSnapshot(user, page.siteId, pageId, 'SECTION_UPDATED');
    return section;
  }

  async reorderSections(user: JwtUser, pageId: string, sectionIds: string[]) {
    const page = await this.getAdminPage(user.tid, pageId);
    const existing = await this.prisma.websitePageSection.findMany({
      where: { tenantId: user.tid, pageId },
      select: { id: true },
    });
    const expected = new Set(existing.map((section) => section.id));
    if (
      sectionIds.length !== expected.size ||
      sectionIds.some((id) => !expected.has(id))
    ) {
      throw new BadRequestException(
        'sectionIds must contain every page section',
      );
    }
    await this.prisma.$transaction(
      sectionIds.map((id, position) =>
        this.prisma.websitePageSection.update({
          where: { id },
          data: { position },
        }),
      ),
    );
    await this.recordPageSnapshot(
      user,
      page.siteId,
      pageId,
      'SECTIONS_REORDERED',
    );
    return this.prisma.websitePageSection.findMany({
      where: { pageId },
      orderBy: { position: 'asc' },
    });
  }

  async menus(tenantId: string) {
    const site = await this.website.getOrCreateSite(tenantId);
    await this.ensureMenus(site.id, tenantId);
    return this.prisma.websiteMenu.findMany({
      where: { tenantId, siteId: site.id },
      include: { items: { orderBy: { position: 'asc' } } },
      orderBy: { location: 'asc' },
    });
  }

  async updateMenu(user: JwtUser, menuId: string, dto: UpdateWebsiteMenuDto) {
    const menu = await this.prisma.websiteMenu.findFirst({
      where: { id: menuId, tenantId: user.tid },
    });
    if (!menu) throw new NotFoundException('Menu not found');
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.websiteMenu.update({
        where: { id: menuId },
        data: {
          ...(dto.name ? { name: dto.name.trim() } : {}),
          ...(dto.location ? { location: dto.location } : {}),
        },
      });
      if (dto.items) {
        await tx.websiteMenuItem.deleteMany({ where: { menuId } });
        const normalized = dto.items.map((raw, position) => ({
          id: this.isUuid(raw.id) ? this.stringValue(raw.id) : randomUUID(),
          sourceId: this.stringValue(raw.id),
          parentSourceId: this.stringValue(raw.parentId),
          label: this.stringValue(raw.label).trim(),
          url: this.safeMenuUrl(this.stringValue(raw.url)),
          target: raw.target === '_blank' ? '_blank' : '_self',
          position: Number.isInteger(raw.position)
            ? Number(raw.position)
            : position,
          isVisible: raw.isVisible !== false,
        }));
        const idMap = new Map(
          normalized
            .filter((item) => item.sourceId)
            .map((item) => [item.sourceId, item.id]),
        );
        const pending = [...normalized];
        const created = new Set<string>();
        while (pending.length) {
          const index = pending.findIndex(
            (item) =>
              !item.parentSourceId ||
              created.has(idMap.get(item.parentSourceId) ?? ''),
          );
          if (index < 0) {
            throw new BadRequestException('Menu item parent cycle detected');
          }
          const [item] = pending.splice(index, 1);
          if (!item.label)
            throw new BadRequestException('Menu item label is required');
          await tx.websiteMenuItem.create({
            data: {
              id: item.id,
              tenantId: user.tid,
              menuId,
              label: item.label,
              url: item.url,
              target: item.target,
              position: item.position,
              parentId: item.parentSourceId
                ? (idMap.get(item.parentSourceId) ?? null)
                : null,
              isVisible: item.isVisible,
            },
          });
          created.add(item.id);
        }
      }
      return tx.websiteMenu.findUniqueOrThrow({
        where: { id: menuId },
        include: { items: { orderBy: { position: 'asc' } } },
      });
    });
    await this.recordRevision(
      user,
      menu.siteId,
      'MENU',
      menuId,
      'UPDATED',
      result,
    );
    return result;
  }

  async contentTypes(tenantId: string) {
    const site = await this.website.getOrCreateSite(tenantId);
    const rows = await this.prisma.websiteContentType.findMany({
      where: { tenantId, siteId: site.id },
      include: { _count: { select: { entries: true } } },
      orderBy: { name: 'asc' },
    });
    return rows.map(({ _count, ...row }) => ({
      ...row,
      entryCount: _count.entries,
    }));
  }

  async createContentType(user: JwtUser, dto: CreateWebsiteContentTypeDto) {
    const site = await this.website.getOrCreateSite(user.tid, user.sub);
    const slug = this.slugify(dto.slug);
    this.validateContentFields(dto.fields);
    const duplicate = await this.prisma.websiteContentType.findFirst({
      where: { siteId: site.id, slug },
    });
    if (duplicate)
      throw new ConflictException('Content type slug already exists');
    const row = await this.prisma.websiteContentType.create({
      data: {
        tenantId: user.tid,
        siteId: site.id,
        name: dto.name.trim(),
        slug,
        description: dto.description?.trim() || null,
        fields: dto.fields as Prisma.InputJsonValue,
      },
    });
    await this.recordRevision(
      user,
      site.id,
      'CONTENT',
      row.id,
      'TYPE_CREATED',
      row,
    );
    return { ...row, entryCount: 0 };
  }

  async entries(tenantId: string, contentTypeId: string) {
    await this.requireContentType(tenantId, contentTypeId);
    return this.prisma.websiteContentEntry.findMany({
      where: { tenantId, contentTypeId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createEntry(
    user: JwtUser,
    contentTypeId: string,
    dto: WebsiteContentEntryDto,
  ) {
    if (dto.status === 'PUBLISHED' || dto.status === 'SCHEDULED') {
      this.assertCanPublish(user);
    }
    if (dto.status === 'SCHEDULED' && !dto.scheduledAt) {
      throw new BadRequestException('scheduledAt is required');
    }
    const type = await this.requireContentType(user.tid, contentTypeId);
    if (!dto.title?.trim()) throw new BadRequestException('title is required');
    const data = this.sanitizeEntryData(type.fields, dto.data ?? {});
    const row = await this.prisma.websiteContentEntry.create({
      data: {
        tenantId: user.tid,
        siteId: type.siteId,
        contentTypeId,
        title: dto.title.trim(),
        slug: this.slugify(dto.slug || dto.title),
        status: dto.status ?? 'DRAFT',
        data: data as Prisma.InputJsonValue,
        scheduledAt: this.optionalFutureDate(dto.scheduledAt),
        publishedAt: dto.status === 'PUBLISHED' ? new Date() : null,
        createdById: user.sub,
        updatedById: user.sub,
      },
    });
    await this.recordRevision(
      user,
      type.siteId,
      'CONTENT',
      row.id,
      'CREATED',
      row,
    );
    return row;
  }

  async updateEntry(
    user: JwtUser,
    entryId: string,
    dto: WebsiteContentEntryDto,
  ) {
    if (dto.status === 'PUBLISHED' || dto.status === 'SCHEDULED') {
      this.assertCanPublish(user);
    }
    const existing = await this.prisma.websiteContentEntry.findFirst({
      where: { id: entryId, tenantId: user.tid },
      include: { contentType: true },
    });
    if (!existing) throw new NotFoundException('Content entry not found');
    if (
      dto.status === 'SCHEDULED' &&
      !dto.scheduledAt &&
      !existing.scheduledAt
    ) {
      throw new BadRequestException('scheduledAt is required');
    }
    const scheduledAt =
      dto.scheduledAt !== undefined
        ? this.optionalFutureDate(dto.scheduledAt)
        : undefined;
    const row = await this.prisma.websiteContentEntry.update({
      where: { id: entryId },
      data: {
        ...(dto.title ? { title: dto.title.trim() } : {}),
        ...(dto.slug ? { slug: this.slugify(dto.slug) } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.status === 'PUBLISHED' ? { publishedAt: new Date() } : {}),
        ...(dto.data
          ? {
              data: this.sanitizeEntryData(
                existing.contentType.fields,
                dto.data,
              ) as Prisma.InputJsonValue,
            }
          : {}),
        ...(scheduledAt !== undefined ? { scheduledAt } : {}),
        updatedById: user.sub,
      },
    });
    await this.recordRevision(
      user,
      existing.siteId,
      'CONTENT',
      row.id,
      'UPDATED',
      row,
    );
    return row;
  }

  async updateMedia(
    user: JwtUser,
    mediaId: string,
    dto: UpdateWebsiteMediaDto,
  ) {
    const media = await this.prisma.websiteMediaAsset.findFirst({
      where: { id: mediaId, tenantId: user.tid },
    });
    if (!media) throw new NotFoundException('Media asset not found');
    const updated = await this.prisma.websiteMediaAsset.update({
      where: { id: mediaId },
      data: {
        ...(dto.altText !== undefined
          ? { altText: dto.altText?.trim() || null }
          : {}),
        ...(dto.caption !== undefined
          ? { caption: dto.caption?.trim() || null }
          : {}),
        ...(dto.fileName ? { fileName: dto.fileName.trim() } : {}),
      },
    });
    return this.mapMedia(updated);
  }

  async media(tenantId: string) {
    const rows = await this.website.listMedia(tenantId);
    return rows.map((row) => this.mapMedia(row));
  }

  async uploadMedia(
    user: JwtUser,
    file: Express.Multer.File | undefined,
    altText?: string,
    kind: 'IMAGE' | 'DOCUMENT' = 'IMAGE',
  ) {
    const row = await this.website.uploadMedia(user, file, kind, altText);
    return this.mapMedia(row);
  }

  async listHeroSlides(tenantId: string) {
    const site = await this.website.getOrCreateSite(tenantId);
    const rows = await this.prisma.websiteHeroSlide.findMany({
      where: { tenantId, siteId: site.id },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((row) => this.mapHeroSlide(row));
  }

  async createHeroSlide(
    user: JwtUser,
    desktop: Express.Multer.File | undefined,
    altText?: string,
    mobileUrl?: string,
  ) {
    if (!desktop) {
      throw new BadRequestException('Desktop hero image is required');
    }
    const media = await this.website.uploadMedia(
      user,
      desktop,
      'IMAGE',
      altText,
      'website-hero',
    );
    const site = await this.website.getOrCreateSite(user.tid, user.sub);
    const max = await this.prisma.websiteHeroSlide.aggregate({
      where: { tenantId: user.tid, siteId: site.id },
      _max: { position: true },
    });
    const row = await this.prisma.websiteHeroSlide.create({
      data: {
        tenantId: user.tid,
        siteId: site.id,
        altText: (altText ?? '').trim() || desktop.originalname,
        desktopUrl: media.publicUrl,
        mobileUrl: mobileUrl?.trim() || null,
        mediaId: media.id,
        position: (max._max.position ?? -1) + 1,
        isActive: true,
        createdById: user.sub,
      },
    });
    return this.mapHeroSlide(row);
  }

  async uploadHeroSlideMobile(
    user: JwtUser,
    slideId: string,
    mobile: Express.Multer.File | undefined,
  ) {
    const slide = await this.prisma.websiteHeroSlide.findFirst({
      where: { id: slideId, tenantId: user.tid },
    });
    if (!slide) throw new NotFoundException('Hero slide not found');
    if (!mobile) {
      throw new BadRequestException('Mobile hero image is required');
    }
    const media = await this.website.uploadMedia(
      user,
      mobile,
      'IMAGE',
      slide.altText,
      'website-hero',
    );
    const updated = await this.prisma.websiteHeroSlide.update({
      where: { id: slide.id },
      data: {
        mobileUrl: media.publicUrl,
        mobileMediaId: media.id,
      },
    });
    return this.mapHeroSlide(updated);
  }

  async updateHeroSlide(
    user: JwtUser,
    slideId: string,
    dto: UpdateWebsiteHeroSlideDto,
  ) {
    const slide = await this.prisma.websiteHeroSlide.findFirst({
      where: { id: slideId, tenantId: user.tid },
    });
    if (!slide) throw new NotFoundException('Hero slide not found');
    const updated = await this.prisma.websiteHeroSlide.update({
      where: { id: slide.id },
      data: {
        ...(dto.altText !== undefined ? { altText: dto.altText.trim() } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.desktopUrl !== undefined
          ? { desktopUrl: dto.desktopUrl.trim() }
          : {}),
        ...(dto.mobileUrl !== undefined
          ? { mobileUrl: dto.mobileUrl?.trim() || null }
          : {}),
      },
    });
    return this.mapHeroSlide(updated);
  }

  async reorderHeroSlides(user: JwtUser, slideIds: string[]) {
    const site = await this.website.getOrCreateSite(user.tid, user.sub);
    const existing = await this.prisma.websiteHeroSlide.findMany({
      where: { tenantId: user.tid, siteId: site.id },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((row) => row.id));
    if (
      slideIds.length !== existing.length ||
      slideIds.some((id) => !existingIds.has(id))
    ) {
      throw new BadRequestException('Invalid hero slide order payload');
    }
    await this.prisma.$transaction(
      slideIds.map((id, position) =>
        this.prisma.websiteHeroSlide.update({
          where: { id },
          data: { position },
        }),
      ),
    );
    return this.listHeroSlides(user.tid);
  }

  async deleteHeroSlide(user: JwtUser, slideId: string) {
    const slide = await this.prisma.websiteHeroSlide.findFirst({
      where: { id: slideId, tenantId: user.tid },
    });
    if (!slide) throw new NotFoundException('Hero slide not found');
    await this.prisma.websiteHeroSlide.delete({ where: { id: slide.id } });
    return { ok: true };
  }

  async listPublicHeroSlides(tenantId: string) {
    const site = await this.prisma.websiteSite.findFirst({
      where: { tenantId, status: 'ACTIVE' },
    });
    if (!site) return [];
    const rows = await this.prisma.websiteHeroSlide.findMany({
      where: { tenantId, siteId: site.id, isActive: true },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      desktopSrc: row.desktopUrl,
      mobileSrc: row.mobileUrl,
      alt: row.altText || 'Campus highlight',
    }));
  }

  async revisions(tenantId: string) {
    const site = await this.website.getOrCreateSite(tenantId);
    const rows = await this.prisma.websiteRevision.findMany({
      where: { tenantId, siteId: site.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((revision) => this.mapRevision(revision));
  }

  async restoreRevision(user: JwtUser, revisionId: string) {
    const revision = await this.prisma.websiteRevision.findFirst({
      where: { id: revisionId, tenantId: user.tid },
    });
    if (!revision) throw new NotFoundException('Revision not found');
    if (revision.entityType !== 'PAGE') {
      throw new BadRequestException('Only page revisions can be restored');
    }
    const snapshot = revision.snapshot as Record<string, unknown>;
    await this.updatePage(user, revision.entityId, {
      title: this.stringValue(snapshot.title),
      slug: this.stringValue(snapshot.slug),
      excerpt: typeof snapshot.excerpt === 'string' ? snapshot.excerpt : null,
      template:
        typeof snapshot.template === 'string' ? snapshot.template : 'DEFAULT',
      seoTitle:
        typeof snapshot.seoTitle === 'string' ? snapshot.seoTitle : null,
      seoDescription:
        typeof snapshot.seoDescription === 'string'
          ? snapshot.seoDescription
          : null,
      status: 'DRAFT',
    });
    const snapshotSections = snapshot.sections;
    if (Array.isArray(snapshotSections)) {
      await this.prisma.$transaction(async (tx) => {
        await tx.websitePageSection.deleteMany({
          where: { pageId: revision.entityId, tenantId: user.tid },
        });
        for (const [position, raw] of snapshotSections.entries()) {
          if (!raw || typeof raw !== 'object') continue;
          const section = raw as Record<string, unknown>;
          await tx.websitePageSection.create({
            data: {
              tenantId: user.tid,
              pageId: revision.entityId,
              type: this.stringValue(section.type, 'RICH_TEXT'),
              label: this.stringValue(section.label, `Section ${position + 1}`),
              heading:
                typeof section.heading === 'string' ? section.heading : null,
              bodyHtml:
                typeof section.bodyHtml === 'string'
                  ? sanitizeWebsiteHtml(section.bodyHtml)
                  : null,
              settings: this.asRecord(
                section.settings,
              ) as Prisma.InputJsonValue,
              position,
              isVisible: section.isVisible !== false,
            },
          });
        }
      });
    }
    const restored = await this.recordPageSnapshot(
      user,
      revision.siteId,
      revision.entityId,
      'RESTORED',
    );
    return this.mapRevision(restored);
  }

  async createPreview(user: JwtUser, pageId?: string) {
    const site = await this.website.getOrCreateSite(user.tid, user.sub);
    if (pageId) await this.getAdminPage(user.tid, pageId);
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await this.prisma.websitePreviewToken.create({
      data: {
        tenantId: user.tid,
        siteId: site.id,
        pageId,
        tokenHash: this.hashToken(token),
        expiresAt,
      },
    });
    const origin = site.primaryDomain
      ? `https://${site.primaryDomain}`
      : 'http://localhost:3000';
    return {
      token,
      url: `${origin}/api/v1/website/public/preview/${encodeURIComponent(token)}`,
      expiresAt,
    };
  }

  async resolvePreview(token: string) {
    const row = await this.prisma.websitePreviewToken.findUnique({
      where: { tokenHash: this.hashToken(token) },
      include: {
        site: true,
        page: {
          include: {
            currentRevision: true,
            sections: { orderBy: { position: 'asc' } },
          },
        },
      },
    });
    if (!row || row.expiresAt <= new Date()) {
      throw new NotFoundException('Preview expired or not found');
    }
    const page =
      row.page ??
      (await this.prisma.websitePage.findFirst({
        where: { siteId: row.siteId, path: '/' },
        include: {
          currentRevision: true,
          sections: { orderBy: { position: 'asc' } },
        },
      }));
    return {
      site: this.mapSettings(row.site),
      page: page
        ? {
            ...this.mapPage(page),
            bodyHtml: page.currentRevision?.bodyHtml ?? '',
          }
        : null,
      expiresAt: row.expiresAt,
    };
  }

  async renderPreviewHtml(token: string) {
    const preview = await this.resolvePreview(token);
    const page = preview.page;
    const sections = page?.sections ?? [];
    const content = page
      ? [
          page.bodyHtml,
          ...sections
            .filter(
              (section) =>
                section &&
                typeof section === 'object' &&
                (!('isVisible' in section) || section.isVisible !== false),
            )
            .map((raw) => {
              const section = raw as Record<string, unknown>;
              const heading =
                typeof section.heading === 'string'
                  ? `<h2>${this.escapeHtml(section.heading)}</h2>`
                  : '';
              const body =
                typeof section.bodyHtml === 'string'
                  ? sanitizeWebsiteHtml(section.bodyHtml)
                  : '';
              return `<section>${heading}${body}</section>`;
            }),
        ].join('')
      : '<p>No page selected for preview.</p>';
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${this.escapeHtml(page?.title ?? preview.site.siteName)} — Preview</title>
<style>body{margin:0;font:16px/1.6 system-ui,sans-serif;color:#172033;background:#f7f8fb}header{padding:12px 5%;background:#172033;color:#fff}main{max-width:1100px;margin:auto;padding:32px 5%;background:#fff;min-height:80vh}section{margin:0 0 32px}img{max-width:100%;height:auto}table{border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px}.badge{font-size:12px;opacity:.8}</style>
</head><body><header>${this.escapeHtml(preview.site.siteName)} <span class="badge">PREVIEW</span></header><main>${content}</main></body></html>`;
  }

  async publicContent(tenantId: string, typeSlug: string, entrySlug?: string) {
    const site = await this.website.getPublicSite(tenantId);
    const contentType = await this.prisma.websiteContentType.findFirst({
      where: { tenantId, siteId: site.id, slug: this.slugify(typeSlug) },
    });
    if (!contentType) throw new NotFoundException('Content type not found');
    if (entrySlug) {
      const entry = await this.prisma.websiteContentEntry.findFirst({
        where: {
          tenantId,
          contentTypeId: contentType.id,
          slug: this.slugify(entrySlug),
          status: 'PUBLISHED',
          deletedAt: null,
        },
      });
      if (!entry) throw new NotFoundException('Content entry not found');
      return entry;
    }
    const rows = await this.prisma.websiteContentEntry.findMany({
      where: {
        tenantId,
        contentTypeId: contentType.id,
        status: 'PUBLISHED',
        deletedAt: null,
      },
      orderBy: { publishedAt: 'desc' },
    });
    // List payloads omit full HTML bodies so college-web can load all cards
    // without timing out; single-entry requests still return the full body.
    if (contentType.slug === 'news') {
      return rows.map((row) => {
        const data = this.asRecord(row.data);
        const lite: Record<string, unknown> = { ...data };
        delete lite.body;
        delete lite.bodyHtml;
        delete lite.gallery;
        return {
          ...row,
          data: {
            ...lite,
            summary:
              typeof lite.summary === 'string'
                ? lite.summary
                : typeof lite.excerpt === 'string'
                  ? lite.excerpt
                  : '',
          },
        };
      });
    }
    return rows;
  }

  async publish(user: JwtUser, dto: PublishWebsiteDto) {
    const scheduledAt = dto.scheduledAt
      ? this.optionalFutureDate(dto.scheduledAt)
      : null;
    const site = await this.website.getOrCreateSite(user.tid, user.sub);
    const pages = dto.pageId
      ? [await this.getAdminPage(user.tid, dto.pageId)]
      : await this.prisma.websitePage.findMany({
          where: {
            tenantId: user.tid,
            siteId: site.id,
            status: { in: ['DRAFT', 'IN_REVIEW', 'SCHEDULED'] },
          },
          include: {
            currentRevision: true,
            sections: { orderBy: { position: 'asc' } },
          },
        });
    for (const page of pages) {
      if (!page.currentRevisionId) continue;
      if (scheduledAt) {
        await this.prisma.websitePage.update({
          where: { id: page.id },
          data: {
            status: 'SCHEDULED',
            scheduledAt,
            publishedRevisionId: page.currentRevisionId,
            publishedSections: JSON.parse(
              JSON.stringify(page.sections),
            ) as Prisma.InputJsonValue,
            updatedById: user.sub,
          },
        });
      } else {
        await this.website.publishPage(user, page.id);
      }
      await this.recordPageSnapshot(
        user,
        page.siteId,
        page.id,
        scheduledAt ? 'SCHEDULED' : 'PUBLISHED',
      );
    }
    return {
      ok: true,
      pageCount: pages.length,
      status: scheduledAt ? 'SCHEDULED' : 'PUBLISHED',
      scheduledAt,
    };
  }

  @Interval(60_000)
  async publishScheduledContent() {
    const now = new Date();
    await this.prisma.websitePage.updateMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { lte: now },
        publishedRevisionId: { not: null },
      },
      data: { status: 'PUBLISHED', publishedAt: now, scheduledAt: null },
    });
    await this.prisma.websiteContentEntry.updateMany({
      where: { status: 'SCHEDULED', scheduledAt: { lte: now } },
      data: { status: 'PUBLISHED', publishedAt: now, scheduledAt: null },
    });
  }

  private async getAdminPage(tenantId: string, pageId: string) {
    const page = await this.prisma.websitePage.findFirst({
      where: { id: pageId, tenantId },
      include: {
        currentRevision: true,
        sections: { orderBy: { position: 'asc' } },
      },
    });
    if (!page) throw new NotFoundException('Website page not found');
    return page;
  }

  private async requireSection(
    tenantId: string,
    pageId: string,
    sectionId: string,
  ) {
    const section = await this.prisma.websitePageSection.findFirst({
      where: { id: sectionId, pageId, tenantId },
    });
    if (!section) throw new NotFoundException('Website section not found');
    return section;
  }

  private async requireContentType(tenantId: string, contentTypeId: string) {
    const type = await this.prisma.websiteContentType.findFirst({
      where: { id: contentTypeId, tenantId },
    });
    if (!type) throw new NotFoundException('Content type not found');
    return type;
  }

  private async ensureMenus(siteId: string, tenantId: string) {
    for (const [location, name] of [
      ['HEADER', 'Header Navigation'],
      ['FOOTER', 'Footer Navigation'],
      ['UTILITY', 'Utility Navigation'],
    ] as const) {
      await this.prisma.websiteMenu.upsert({
        where: { siteId_location: { siteId, location } },
        update: {},
        create: { tenantId, siteId, location, name },
      });
    }
  }

  private mapSettings(site: {
    name: string;
    logoUrl: string | null;
    faviconUrl: string | null;
    settingsJson: unknown;
  }) {
    const settings = this.asRecord(site.settingsJson);
    return {
      siteName: site.name,
      tagline: this.nullableString(settings.tagline),
      description: this.nullableString(settings.description),
      logoUrl: site.logoUrl,
      faviconUrl: site.faviconUrl,
      primaryColor:
        this.nullableString(settings.primaryColor) ??
        SETTINGS_DEFAULTS.primaryColor,
      secondaryColor:
        this.nullableString(settings.secondaryColor) ??
        SETTINGS_DEFAULTS.secondaryColor,
      fontFamily:
        this.nullableString(settings.fontFamily) ??
        SETTINGS_DEFAULTS.fontFamily,
      contactEmail: this.nullableString(settings.contactEmail),
      contactPhone: this.nullableString(settings.contactPhone),
      address: this.nullableString(settings.address),
      mapUrl: this.nullableString(settings.mapUrl),
      socialLinks: this.safeSocialLinks(
        this.asRecord(settings.socialLinks) as Record<string, string>,
      ),
    };
  }

  private mapPage(
    page: {
      id: string;
      path: string;
      title: string;
      status: string;
      template: string;
      updatedAt: Date;
      publishedAt: Date | null;
      createdAt?: Date;
      createdById?: string | null;
      currentRevision: {
        excerpt: string | null;
        seoTitle: string | null;
        seoDescription: string | null;
      } | null;
      sections: Array<unknown>;
    },
    extras?: {
      authorName?: string;
      createdAt?: Date;
      path?: string;
    },
  ) {
    return {
      id: page.id,
      title: page.title,
      slug: page.path === '/' ? 'home' : page.path.replace(/^\//, ''),
      path: extras?.path ?? page.path,
      excerpt: page.currentRevision?.excerpt ?? null,
      status: page.status,
      template: page.template,
      seoTitle: page.currentRevision?.seoTitle ?? null,
      seoDescription: page.currentRevision?.seoDescription ?? null,
      sections: page.sections,
      authorName: extras?.authorName ?? 'System',
      createdAt: extras?.createdAt ?? page.createdAt ?? page.updatedAt,
      updatedAt: page.updatedAt,
      publishedAt: page.publishedAt,
    };
  }

  private mapHeroSlide(row: {
    id: string;
    altText: string;
    desktopUrl: string;
    mobileUrl: string | null;
    mediaId: string | null;
    mobileMediaId: string | null;
    position: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      altText: row.altText,
      desktopUrl: row.desktopUrl,
      mobileUrl: row.mobileUrl,
      mediaId: row.mediaId,
      mobileMediaId: row.mobileMediaId,
      position: row.position,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapMedia(row: {
    id: string;
    fileName: string;
    mimeType: string;
    publicUrl: string;
    altText: string | null;
    caption: string | null;
    tags?: string[];
    folderId?: string | null;
    bytes: number;
    createdAt: Date;
  }) {
    return {
      id: row.id,
      fileName: row.fileName,
      mimeType: row.mimeType,
      publicUrl: row.publicUrl,
      altText: row.altText,
      caption: row.caption,
      tags: row.tags ?? [],
      folderId: row.folderId ?? null,
      size: row.bytes,
      createdAt: row.createdAt,
    };
  }

  private mapRevision(row: {
    id: string;
    entityId: string;
    entityType: string;
    version: number;
    action: string;
    actorName: string | null;
    createdAt: Date;
  }) {
    return {
      id: row.id,
      entityId: row.entityId,
      entityType: row.entityType,
      version: row.version,
      action: row.action,
      actorName: row.actorName,
      createdAt: row.createdAt,
    };
  }

  private async recordPageSnapshot(
    user: JwtUser,
    siteId: string,
    pageId: string,
    action: string,
  ) {
    const page = await this.getAdminPage(user.tid, pageId);
    return this.recordRevision(
      user,
      siteId,
      'PAGE',
      pageId,
      action,
      this.mapPage(page),
    );
  }

  private async recordRevision(
    user: JwtUser,
    siteId: string,
    entityType: 'PAGE' | 'SETTINGS' | 'MENU' | 'CONTENT',
    entityId: string,
    action: string,
    snapshot: unknown,
  ) {
    const latest = await this.prisma.websiteRevision.aggregate({
      where: { entityType, entityId },
      _max: { version: true },
    });
    return this.prisma.websiteRevision.create({
      data: {
        tenantId: user.tid,
        siteId,
        entityType,
        entityId,
        version: (latest._max.version ?? 0) + 1,
        action,
        snapshot: JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonValue,
        actorId: user.sub,
        actorName: user.email,
      },
    });
  }

  private validateContentFields(fields: Array<Record<string, unknown>>) {
    const allowed = new Set([
      'text',
      'richText',
      'image',
      'date',
      'number',
      'boolean',
      'relation',
    ]);
    const keys = new Set<string>();
    for (const field of fields) {
      const key = this.stringValue(field.key).trim();
      const label = this.stringValue(field.label).trim();
      const type = this.stringValue(field.type);
      if (!key || !label || !/^[a-z][a-zA-Z0-9_]*$/.test(key)) {
        throw new BadRequestException('Invalid content field key or label');
      }
      if (!allowed.has(type)) {
        throw new BadRequestException(
          `Unsupported content field type: ${type}`,
        );
      }
      if (keys.has(key))
        throw new BadRequestException('Duplicate content field key');
      keys.add(key);
    }
  }

  private sanitizeEntryData(
    fieldsValue: unknown,
    data: Record<string, unknown>,
  ) {
    const fields = Array.isArray(fieldsValue)
      ? (fieldsValue as Array<Record<string, unknown>>)
      : [];
    const result: Record<string, unknown> = {};
    for (const field of fields) {
      const key = this.stringValue(field.key);
      const value = data[key];
      if (value === undefined) {
        if (field.required === true) {
          throw new BadRequestException(`${key} is required`);
        }
        continue;
      }
      result[key] =
        field.type === 'richText'
          ? sanitizeWebsiteHtml(this.stringValue(value))
          : value;
    }
    return result;
  }

  private sanitizeSectionSettings(
    settings: Record<string, unknown>,
  ): Prisma.InputJsonObject {
    const result: Record<string, Prisma.InputJsonValue> = {};
    for (const [key, value] of Object.entries(settings)) {
      if (value === undefined || value === null) continue;
      if (typeof value === 'string' && /html$/i.test(key)) {
        result[key] = sanitizeWebsiteHtml(value);
      } else if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        result[key] = value;
      } else if (Array.isArray(value)) {
        result[key] = JSON.parse(
          JSON.stringify(value),
        ) as Prisma.InputJsonValue;
      } else if (typeof value === 'object') {
        result[key] = this.sanitizeSectionSettings(
          value as Record<string, unknown>,
        );
      }
    }
    return result;
  }

  private optionalFutureDate(value?: string | null) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime()) || date <= new Date()) {
      throw new BadRequestException('scheduledAt must be a future ISO date');
    }
    return date;
  }

  private safeMenuUrl(value: string) {
    const url = value.trim();
    if (url.startsWith('/') || /^https:\/\//i.test(url)) return url;
    throw new BadRequestException(
      'Menu URLs must be internal paths or HTTPS URLs',
    );
  }

  private safeSocialLinks(value: Record<string, string>) {
    const result: Record<string, string> = {};
    for (const [key, raw] of Object.entries(value ?? {})) {
      if (/^[a-z0-9_-]{1,30}$/i.test(key) && /^https:\/\//i.test(String(raw))) {
        result[key] = String(raw);
      }
    }
    return result;
  }

  private slugify(value: string) {
    const slug = value
      .trim()
      .toLowerCase()
      .replace(/^\/+|\/+$/g, '')
      .replace(/[^a-z0-9/]+/g, '-')
      .replace(/-+/g, '-');
    if (!slug) return 'home';
    return slug;
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private assertCanPublish(user: JwtUser) {
    if (
      user.permissions.includes('website:publish') ||
      user.roles.some((role) =>
        ['college-admin', 'super-admin', 'university-admin'].includes(role),
      )
    ) {
      return;
    }
    throw new ForbiddenException('website:publish permission is required');
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private nullableString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value : null;
  }

  private stringValue(value: unknown, fallback = '') {
    return typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
      ? `${value}`
      : fallback;
  }

  private escapeHtml(value: string) {
    return value.replace(
      /[&<>"']/g,
      (character) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[character] ?? character,
    );
  }

  private isUuid(value: unknown) {
    return (
      typeof value === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      )
    );
  }
}
