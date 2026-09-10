import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import sharp from 'sharp';
import { PrismaService } from '../../database/prisma.service';
import { resolveUploadRoot } from '../../common/uploads/upload-paths';
import { TenantResolutionService } from '../tenants/tenant-resolution.service';
import { SCHOOL_SIS_PRODUCT } from '../school-sis/school-sis.constants';
import {
  SCHOOL_WEB_FLASH_NEWS_MAX,
  SCHOOL_WEB_HERO_SLIDE_MAX,
  SCHOOL_WEB_PUBLIC_HOST_SLUGS,
} from './school-web.constants';
import {
  galleryFileLooksSafe,
  HERO_SLIDE_MAX,
  HERO_UPLOAD_MAX_BYTES,
  publicAssetUrl,
} from './school-web-gallery.util';
import { SchoolWebMailService } from './school-web-mail.service';
import type {
  PatchEnquiryStatusDto,
  PatchHomepageSectionDto,
  PatchSchoolWebSiteDto,
  ReplaceSchoolWebMenuDto,
  SubmitSchoolWebEnquiryDto,
  UpsertSchoolWebEventDto,
  UpsertSchoolWebNoticeDto,
  UpsertSchoolWebPageDto,
} from './dto/school-web.dto';

type BrandingExtras = { schoolProduct?: string };

@Injectable()
export class SchoolWebService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenants: TenantResolutionService,
    private readonly mail: SchoolWebMailService,
  ) {}

  async resolvePublicTenantId(rawHost?: string) {
    const host = this.tenants.normalizeHost(rawHost ?? '');
    const loopback =
      !host || host === 'localhost' || host === '127.0.0.1' || host === '::1';
    // Next.js SSR fetches the API as 127.0.0.1, which otherwise resolves to the college demo tenant.
    const mappedSlug =
      SCHOOL_WEB_PUBLIC_HOST_SLUGS[host] ??
      (loopback ? 'st-lukes-tura' : undefined);
    if (mappedSlug) {
      const tenant = await this.prisma.tenant.findFirst({
        where: { slug: mappedSlug, deletedAt: null },
      });
      if (!tenant)
        throw new NotFoundException('School website tenant not found');
      await this.assertSchoolWebTenant(tenant.id);
      return tenant.id;
    }
    const resolved = await this.tenants.resolveHost(host);
    if (!resolved) throw new BadRequestException('Unknown school website host');
    await this.assertSchoolWebTenant(resolved.id);
    return resolved.id;
  }

  async assertSchoolWebTenant(tenantId: string) {
    const branding = await this.prisma.tenantBranding.findUnique({
      where: { tenantId },
      select: { portalExtrasJson: true },
    });
    const extras = (branding?.portalExtrasJson ?? {}) as BrandingExtras;
    if (extras.schoolProduct !== SCHOOL_SIS_PRODUCT) {
      throw new BadRequestException(
        'School website CMS is not enabled for this tenant',
      );
    }
  }

  async getPublicBundle(tenantId: string) {
    await this.assertSchoolWebTenant(tenantId);
    const now = new Date();
    const [
      site,
      menus,
      sections,
      notices,
      pages,
      events,
      albums,
      staff,
      downloads,
    ] = await Promise.all([
      this.prisma.schoolWebSite.findUnique({ where: { tenantId } }),
      this.prisma.schoolWebMenu.findMany({
        where: { tenantId },
        include: {
          items: { where: { visible: true }, orderBy: { sortOrder: 'asc' } },
        },
      }),
      this.prisma.schoolWebHomepageSection.findMany({
        where: { tenantId, enabled: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.schoolWebNotice.findMany({
        where: {
          tenantId,
          status: 'PUBLISHED',
          publishedAt: { lte: now },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        orderBy: { publishedAt: 'desc' },
        take: 20,
      }),
      this.prisma.schoolWebPage.findMany({
        where: { tenantId, status: 'PUBLISHED' },
        select: {
          slug: true,
          title: true,
          seoTitle: true,
          seoDescription: true,
          updatedAt: true,
        },
        orderBy: { title: 'asc' },
      }),
      this.prisma.schoolWebEvent.findMany({
        where: { tenantId, status: 'PUBLISHED' },
        orderBy: { startsAt: 'asc' },
        take: 20,
      }),
      this.prisma.schoolWebGalleryAlbum.findMany({
        where: {
          tenantId,
          published: true,
          deletedAt: null,
          status: 'PUBLISHED',
          visibility: 'PUBLIC',
          OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }],
        },
        include: {
          coverAsset: true,
          category: true,
          _count: { select: { items: true } },
        },
        orderBy: { sortOrder: 'asc' },
        take: 12,
      }),
      this.prisma.schoolWebStaffProfile.findMany({
        where: { tenantId, published: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.schoolWebDownload.findMany({
        where: { tenantId, status: 'PUBLISHED' },
        orderBy: { publishedAt: 'desc' },
        take: 30,
      }),
    ]);
    if (!site) throw new NotFoundException('School website is not seeded');
    return {
      site,
      menus,
      homepage: sections,
      notices,
      pages,
      events,
      albums: albums.map((album) => ({
        id: album.id,
        slug: album.slug,
        title: album.title,
        description: album.description,
        eventDate: album.eventDate,
        category: album.category,
        photoCount: album._count.items,
        cover: album.coverAsset
          ? publicAssetUrl(
              album.coverAsset.storageKey,
              album.coverAsset.variants,
            )
          : null,
        items: [],
      })),
      staff,
      downloads,
    };
  }

  async getPublishedPage(tenantId: string, slug: string) {
    await this.assertSchoolWebTenant(tenantId);
    const page = await this.prisma.schoolWebPage.findFirst({
      where: { tenantId, slug, status: 'PUBLISHED' },
    });
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  async listPublishedNotices(tenantId: string) {
    const bundle = await this.getPublicBundle(tenantId);
    return bundle.notices;
  }

  async getPublishedNotice(tenantId: string, slug: string) {
    await this.assertSchoolWebTenant(tenantId);
    const notice = await this.prisma.schoolWebNotice.findFirst({
      where: { tenantId, slug, status: 'PUBLISHED' },
    });
    if (!notice) throw new NotFoundException('Notice not found');
    return notice;
  }

  async listPublishedEvents(tenantId: string) {
    await this.assertSchoolWebTenant(tenantId);
    return this.prisma.schoolWebEvent.findMany({
      where: { tenantId, status: 'PUBLISHED' },
      orderBy: { startsAt: 'asc' },
    });
  }

  async getPublishedEvent(tenantId: string, slug: string) {
    await this.assertSchoolWebTenant(tenantId);
    const event = await this.prisma.schoolWebEvent.findFirst({
      where: { tenantId, slug, status: 'PUBLISHED' },
    });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async submitEnquiry(tenantId: string, dto: SubmitSchoolWebEnquiryDto) {
    await this.assertSchoolWebTenant(tenantId);
    const row = await this.prisma.schoolWebEnquiry.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        email: dto.email?.trim() || null,
        phone: dto.phone?.trim() || null,
        subject: dto.subject?.trim() || null,
        message: dto.message.trim(),
      },
    });
    const site = await this.prisma.schoolWebSite.findUnique({
      where: { tenantId },
      select: { displayName: true },
    });
    void this.mail.notifyEnquiry({
      schoolName: site?.displayName || "St. Luke's Secondary School, Tura",
      name: row.name,
      email: row.email,
      phone: row.phone,
      subject: row.subject,
      message: row.message,
    });
    return row;
  }

  async getSite(tenantId: string) {
    await this.assertSchoolWebTenant(tenantId);
    const site = await this.prisma.schoolWebSite.findUnique({
      where: { tenantId },
    });
    if (!site) throw new NotFoundException('School website is not seeded');
    return site;
  }

  async patchSite(
    tenantId: string,
    actorUserId: string,
    dto: PatchSchoolWebSiteDto,
  ) {
    const existing = await this.getSite(tenantId);
    const updated = await this.prisma.schoolWebSite.update({
      where: { tenantId },
      data: {
        displayName: dto.displayName?.trim() ?? existing.displayName,
        shortName: dto.shortName?.trim() ?? existing.shortName,
        motto: dto.motto?.trim() ?? existing.motto,
        addressLine: dto.addressLine?.trim() ?? existing.addressLine,
        city: dto.city?.trim() ?? existing.city,
        district: dto.district?.trim() ?? existing.district,
        state: dto.state?.trim() ?? existing.state,
        pin: dto.pin?.trim() ?? existing.pin,
        email: dto.email !== undefined ? dto.email.trim() : existing.email,
        phone: dto.phone !== undefined ? dto.phone.trim() : existing.phone,
        primaryColor: dto.primaryColor ?? existing.primaryColor,
        accentColor: dto.accentColor ?? existing.accentColor,
        seoTitle:
          dto.seoTitle !== undefined ? dto.seoTitle.trim() : existing.seoTitle,
        seoDescription:
          dto.seoDescription !== undefined
            ? dto.seoDescription.trim()
            : existing.seoDescription,
        applyCtaUrl:
          dto.applyCtaUrl !== undefined
            ? dto.applyCtaUrl.trim()
            : existing.applyCtaUrl,
        studentPortalUrl:
          dto.studentPortalUrl !== undefined
            ? dto.studentPortalUrl.trim()
            : existing.studentPortalUrl,
        extrasJson:
          dto.extrasJson !== undefined
            ? (dto.extrasJson as Prisma.InputJsonValue)
            : (existing.extrasJson as Prisma.InputJsonValue),
      },
    });
    await this.audit(
      tenantId,
      actorUserId,
      'SITE_UPDATED',
      'SchoolWebSite',
      updated.id,
      existing,
      updated,
    );
    return updated;
  }

  async listMenus(tenantId: string) {
    await this.assertSchoolWebTenant(tenantId);
    return this.prisma.schoolWebMenu.findMany({
      where: { tenantId },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async replaceMenu(
    tenantId: string,
    actorUserId: string,
    dto: ReplaceSchoolWebMenuDto,
  ) {
    await this.assertSchoolWebTenant(tenantId);
    const menu = await this.prisma.schoolWebMenu.findUnique({
      where: { tenantId_location: { tenantId, location: dto.location } },
    });
    if (!menu) throw new NotFoundException('Menu not found');
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.schoolWebMenuItem.deleteMany({ where: { menuId: menu.id } });
      if (dto.items.length) {
        await tx.schoolWebMenuItem.createMany({
          data: dto.items.map((item, i) => ({
            id: randomUUID(),
            menuId: menu.id,
            label: item.label.trim(),
            href: item.href.trim(),
            sortOrder: item.sortOrder ?? i,
            visible: item.visible ?? true,
            parentId: item.parentId || null,
          })),
        });
      }
      return tx.schoolWebMenu.findUniqueOrThrow({
        where: { id: menu.id },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      });
    });
    await this.audit(
      tenantId,
      actorUserId,
      'MENU_REPLACED',
      'SchoolWebMenu',
      menu.id,
      null,
      dto,
    );
    return updated;
  }

  async listHomepage(tenantId: string) {
    await this.assertSchoolWebTenant(tenantId);
    return this.prisma.schoolWebHomepageSection.findMany({
      where: { tenantId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async patchHomepageSection(
    tenantId: string,
    key: string,
    actorUserId: string,
    dto: PatchHomepageSectionDto,
  ) {
    await this.assertSchoolWebTenant(tenantId);
    const row = await this.prisma.schoolWebHomepageSection.findUnique({
      where: { tenantId_key: { tenantId, key } },
    });
    if (!row && key !== 'flashNews' && key !== 'launchPopup')
      throw new NotFoundException('Homepage section not found');
    if (key === 'launchPopup' && dto.enabled === true && dto.payload) {
      const title = String(
        (dto.payload as Record<string, unknown>).title || '',
      ).trim();
      if (title.length < 2) {
        throw new BadRequestException('The launch popup needs a title');
      }
    }
    if (
      key === 'flashNews' &&
      dto.payload &&
      typeof dto.payload === 'object' &&
      !Array.isArray(dto.payload)
    ) {
      const items = (dto.payload as Record<string, unknown>).items;
      if (Array.isArray(items)) {
        if (items.length > SCHOOL_WEB_FLASH_NEWS_MAX) {
          throw new BadRequestException(
            `Flash news can hold at most ${SCHOOL_WEB_FLASH_NEWS_MAX} items`,
          );
        }
        const missingTitle = items.find((entry) => {
          const item =
            entry && typeof entry === 'object' && !Array.isArray(entry)
              ? (entry as Record<string, unknown>)
              : {};
          return (
            item.enabled !== false && String(item.title || '').trim().length < 2
          );
        });
        if (missingTitle) {
          throw new BadRequestException('Each flash news item needs a title');
        }
      }
    }
    if (
      key === 'hero' &&
      dto.payload &&
      typeof dto.payload === 'object' &&
      !Array.isArray(dto.payload)
    ) {
      const slides = (dto.payload as Record<string, unknown>).slides;
      if (Array.isArray(slides)) {
        if (slides.length > SCHOOL_WEB_HERO_SLIDE_MAX) {
          throw new BadRequestException(
            `The homepage slider can hold at most ${SCHOOL_WEB_HERO_SLIDE_MAX} images`,
          );
        }
        const missingTitle = slides.find((row) => {
          const slide =
            row && typeof row === 'object' && !Array.isArray(row)
              ? (row as Record<string, unknown>)
              : {};
          const image = String(slide.image || '').trim();
          const title = String(slide.title || '').trim();
          return slide.enabled !== false && image && title.length < 2;
        });
        if (missingTitle) {
          throw new BadRequestException('Each slider image needs a title');
        }
      }
    }
    const payload = (dto.payload ??
      row?.payload ?? { items: [] }) as Prisma.InputJsonValue;
    const updated = row
      ? await this.prisma.schoolWebHomepageSection.update({
          where: { id: row.id },
          data: {
            enabled: dto.enabled ?? row.enabled,
            sortOrder: dto.sortOrder ?? row.sortOrder,
            payload,
          },
        })
      : await this.prisma.schoolWebHomepageSection.create({
          data: {
            tenantId,
            key,
            enabled: dto.enabled ?? true,
            sortOrder: dto.sortOrder ?? (key === 'launchPopup' ? 5 : 15),
            payload,
          },
        });
    await this.audit(
      tenantId,
      actorUserId,
      'HOMEPAGE_SECTION_UPDATED',
      'SchoolWebHomepageSection',
      key,
      row,
      updated,
    );
    return updated;
  }

  async uploadHeroImages(
    tenantId: string,
    actorUserId: string,
    files: Express.Multer.File[],
  ) {
    await this.assertSchoolWebTenant(tenantId);
    if (!files?.length)
      throw new BadRequestException('Select one or more images');
    if (files.length > HERO_SLIDE_MAX) {
      throw new BadRequestException(
        `Upload at most ${HERO_SLIDE_MAX} images at a time`,
      );
    }
    const urls: string[] = [];
    for (const file of files) {
      if (!galleryFileLooksSafe(file, HERO_UPLOAD_MAX_BYTES)) {
        throw new BadRequestException(
          `Unsupported or oversized image: ${file.originalname}`,
        );
      }
      const jpeg = await sharp(file.buffer, { failOn: 'error' })
        .rotate()
        .resize({ width: 1920, withoutEnlargement: true })
        .jpeg({ quality: 84, mozjpeg: true })
        .toBuffer();
      const id = randomUUID();
      const storageKey = `school-web/${tenantId}/hero/${id}.jpg`;
      const uploadPath = join(resolveUploadRoot(), storageKey);
      await mkdir(dirname(uploadPath), { recursive: true });
      await writeFile(uploadPath, jpeg);
      await this.prisma.schoolWebMediaAsset.create({
        data: {
          tenantId,
          fileName: file.originalname,
          storageKey,
          mimeType: 'image/jpeg',
          bytes: jpeg.length,
          alt: file.originalname.replace(/\.[^.]+$/, ''),
          variants: { original: storageKey, width: 1920 },
        },
      });
      urls.push(publicAssetUrl(storageKey).original);
    }
    await this.audit(
      tenantId,
      actorUserId,
      'HERO_IMAGES_UPLOADED',
      'SchoolWebHomepageSection',
      'hero',
      null,
      {
        count: urls.length,
      },
    );
    return { urls, maxSlides: HERO_SLIDE_MAX };
  }

  async listPages(tenantId: string) {
    await this.assertSchoolWebTenant(tenantId);
    return this.prisma.schoolWebPage.findMany({
      where: { tenantId },
      orderBy: { slug: 'asc' },
    });
  }

  async upsertPage(
    tenantId: string,
    actorUserId: string,
    dto: UpsertSchoolWebPageDto,
  ) {
    await this.assertSchoolWebTenant(tenantId);
    const slug = dto.slug.trim().toLowerCase();
    const page = await this.prisma.schoolWebPage.upsert({
      where: { tenantId_slug: { tenantId, slug } },
      create: {
        tenantId,
        slug,
        title: dto.title.trim(),
        status: dto.status ?? 'DRAFT',
        seoTitle: dto.seoTitle?.trim() || null,
        seoDescription: dto.seoDescription?.trim() || null,
        seoJson: (dto.seoJson ?? {}) as Prisma.InputJsonValue,
        blockDocument: (dto.blockDocument ?? {
          version: 1,
          blocks: [],
        }) as Prisma.InputJsonValue,
        publishedAt: dto.status === 'PUBLISHED' ? new Date() : null,
      },
      update: {
        title: dto.title.trim(),
        status: dto.status ?? undefined,
        seoTitle: dto.seoTitle?.trim() || null,
        seoDescription: dto.seoDescription?.trim() || null,
        seoJson: dto.seoJson
          ? (dto.seoJson as Prisma.InputJsonValue)
          : undefined,
        blockDocument: dto.blockDocument
          ? (dto.blockDocument as Prisma.InputJsonValue)
          : undefined,
        publishedAt: dto.status === 'PUBLISHED' ? new Date() : undefined,
      },
    });
    await this.prisma.schoolWebPageRevision.create({
      data: {
        pageId: page.id,
        actorUserId,
        snapshot: {
          title: page.title,
          status: page.status,
          blockDocument: page.blockDocument,
        },
      },
    });
    await this.audit(
      tenantId,
      actorUserId,
      'PAGE_UPSERTED',
      'SchoolWebPage',
      page.slug,
      null,
      page,
    );
    return page;
  }

  async listNoticesOffice(tenantId: string) {
    await this.assertSchoolWebTenant(tenantId);
    return this.prisma.schoolWebNotice.findMany({
      where: { tenantId },
      orderBy: { publishedAt: 'desc' },
    });
  }

  async upsertNotice(
    tenantId: string,
    actorUserId: string,
    dto: UpsertSchoolWebNoticeDto,
  ) {
    await this.assertSchoolWebTenant(tenantId);
    const slug = dto.slug.trim().toLowerCase();
    const notice = await this.prisma.schoolWebNotice.upsert({
      where: { tenantId_slug: { tenantId, slug } },
      create: {
        tenantId,
        slug,
        title: dto.title.trim(),
        category: dto.category?.trim() || 'GENERAL',
        body: dto.body.trim(),
        featured: dto.featured ?? false,
        status: dto.status ?? 'DRAFT',
        seoJson: (dto.seoJson ?? {}) as Prisma.InputJsonValue,
        publishedAt: dto.status === 'PUBLISHED' ? new Date() : null,
      },
      update: {
        title: dto.title.trim(),
        category: dto.category?.trim() || undefined,
        body: dto.body.trim(),
        featured: dto.featured,
        status: dto.status,
        seoJson: dto.seoJson
          ? (dto.seoJson as Prisma.InputJsonValue)
          : undefined,
        publishedAt: dto.status === 'PUBLISHED' ? new Date() : undefined,
      },
    });
    await this.audit(
      tenantId,
      actorUserId,
      'NOTICE_UPSERTED',
      'SchoolWebNotice',
      notice.slug,
      null,
      notice,
    );
    return notice;
  }

  async listEventsOffice(tenantId: string) {
    await this.assertSchoolWebTenant(tenantId);
    return this.prisma.schoolWebEvent.findMany({
      where: { tenantId },
      orderBy: { startsAt: 'desc' },
    });
  }

  async upsertEvent(
    tenantId: string,
    actorUserId: string,
    dto: UpsertSchoolWebEventDto,
  ) {
    await this.assertSchoolWebTenant(tenantId);
    const slug = dto.slug.trim().toLowerCase();
    const event = await this.prisma.schoolWebEvent.upsert({
      where: { tenantId_slug: { tenantId, slug } },
      create: {
        tenantId,
        slug,
        title: dto.title.trim(),
        summary: dto.summary?.trim() || null,
        venue: dto.venue?.trim() || null,
        startsAt: new Date(dto.startsAt),
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        status: dto.status ?? 'DRAFT',
        seoJson: (dto.seoJson ?? {}) as Prisma.InputJsonValue,
      },
      update: {
        title: dto.title.trim(),
        summary: dto.summary?.trim() || null,
        venue: dto.venue?.trim() || null,
        startsAt: new Date(dto.startsAt),
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        status: dto.status,
        seoJson: dto.seoJson
          ? (dto.seoJson as Prisma.InputJsonValue)
          : undefined,
      },
    });
    await this.audit(
      tenantId,
      actorUserId,
      'EVENT_UPSERTED',
      'SchoolWebEvent',
      event.slug,
      null,
      event,
    );
    return event;
  }

  async listEnquiries(tenantId: string) {
    await this.assertSchoolWebTenant(tenantId);
    return this.prisma.schoolWebEnquiry.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async patchEnquiry(
    tenantId: string,
    id: string,
    actorUserId: string,
    dto: PatchEnquiryStatusDto,
  ) {
    await this.assertSchoolWebTenant(tenantId);
    const existing = await this.prisma.schoolWebEnquiry.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Enquiry not found');
    const updated = await this.prisma.schoolWebEnquiry.update({
      where: { id },
      data: { status: dto.status },
    });
    await this.audit(
      tenantId,
      actorUserId,
      'ENQUIRY_STATUS',
      'SchoolWebEnquiry',
      id,
      existing,
      updated,
    );
    return updated;
  }

  async listAudit(tenantId: string) {
    await this.assertSchoolWebTenant(tenantId);
    return this.prisma.schoolWebAuditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getSeoAudit(tenantId: string) {
    await this.assertSchoolWebTenant(tenantId);
    const [site, pages, notices, events, albums, recent] = await Promise.all([
      this.prisma.schoolWebSite.findUnique({ where: { tenantId } }),
      this.prisma.schoolWebPage.findMany({ where: { tenantId } }),
      this.prisma.schoolWebNotice.findMany({ where: { tenantId } }),
      this.prisma.schoolWebEvent.findMany({ where: { tenantId } }),
      this.prisma.schoolWebGalleryAlbum.findMany({
        where: { tenantId, deletedAt: null },
      }),
      this.prisma.schoolWebAuditLog.findMany({
        where: {
          tenantId,
          action: {
            in: [
              'PAGE_UPSERTED',
              'NOTICE_UPSERTED',
              'EVENT_UPSERTED',
              'SITE_UPDATED',
            ],
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
    ]);
    const extras = (site?.extrasJson ?? {}) as Record<string, unknown>;
    const seo =
      extras.seo && typeof extras.seo === 'object'
        ? (extras.seo as Record<string, unknown>)
        : {};
    const publicBaseUrl = String(seo.publicBaseUrl || 'https://stlukestura.in');
    const pageRows = pages.map((p) =>
      this.seoRecord(
        'page',
        `/${p.slug}`,
        p.title,
        p.status,
        p.seoTitle,
        p.seoDescription,
        (p as { seoJson?: unknown }).seoJson,
      ),
    );
    const noticeRows = notices.map((n) =>
      this.seoRecord(
        'notice',
        `/notices/${n.slug}`,
        n.title,
        n.status,
        null,
        null,
        (n as { seoJson?: unknown }).seoJson,
      ),
    );
    const eventRows = events.map((e) =>
      this.seoRecord(
        'event',
        `/events/${e.slug}`,
        e.title,
        e.status,
        null,
        null,
        (e as { seoJson?: unknown }).seoJson,
      ),
    );
    const albumRows = albums.map((a) =>
      this.seoRecord(
        'album',
        `/gallery/${a.slug}`,
        a.title,
        a.status,
        null,
        a.description,
        a.seoJson,
      ),
    );
    const all = [...pageRows, ...noticeRows, ...eventRows, ...albumRows];
    const published = all.filter((r) => r.status === 'PUBLISHED');
    const httpsOk = publicBaseUrl.startsWith('https://');
    return {
      indexed: published.filter((r) => r.indexable).length,
      published: published.length,
      noindex: published.filter((r) => !r.indexable).length,
      missingTitles: published.filter((r) => !r.hasTitle).length,
      missingDescriptions: published.filter((r) => !r.hasDescription).length,
      homeTitle: Boolean(site?.seoTitle),
      homeDescription: Boolean(site?.seoDescription),
      publicBaseUrl,
      googleVerification: Boolean(
        String(seo.googleSiteVerification || '').trim(),
      ),
      sitemapPath: '/sitemap.xml',
      robotsPath: '/robots.txt',
      items: all,
      recent,
      audit: [
        {
          id: 'https',
          status: httpsOk ? 'pass' : 'error',
          label: 'HTTPS public URL',
          hint: httpsOk
            ? undefined
            : 'Set the public website URL to https://stlukestura.in',
        },
        {
          id: 'sitemap',
          status: 'pass',
          label: 'Sitemap generated at /sitemap.xml on the public host',
        },
        {
          id: 'robots',
          status: 'pass',
          label: 'robots.txt generated on the public host',
        },
        {
          id: 'canonical',
          status: 'pass',
          label: 'Self-referencing canonical URLs on public pages',
        },
        {
          id: 'og',
          status: String(seo.defaultOgImage || extras.logoUrl || '').trim()
            ? 'pass'
            : 'warning',
          label: 'Default Open Graph image',
        },
        {
          id: 'gsc',
          status: String(seo.googleSiteVerification || '').trim()
            ? 'pass'
            : 'warning',
          label: 'Search Console verification',
          hint: 'Add the meta verification token after domain ownership is confirmed. This is not a ranking score.',
        },
        {
          id: 'nap',
          status: site?.addressLine && site?.phone ? 'pass' : 'warning',
          label: 'Name, address, phone',
          hint: site?.phone
            ? undefined
            : 'Phone is unpublished until the school confirms it.',
        },
        {
          id: 'descriptions',
          status: published.some((r) => !r.hasDescription) ? 'warning' : 'pass',
          label: 'Meta descriptions on published pages',
        },
      ],
    };
  }

  private seoRecord(
    kind: string,
    path: string,
    title: string,
    status: string,
    seoTitle: string | null,
    seoDescription: string | null,
    seoJson: unknown,
  ) {
    const seo =
      seoJson && typeof seoJson === 'object' && !Array.isArray(seoJson)
        ? (seoJson as Record<string, unknown>)
        : {};
    const indexable = status === 'PUBLISHED' && seo.robotsIndex !== false;
    const resolvedTitle = String(seo.title || seoTitle || title || '').trim();
    const resolvedDescription = String(
      seo.description || seoDescription || '',
    ).trim();
    return {
      kind,
      path,
      title,
      status,
      indexable,
      hasTitle: resolvedTitle.length > 0,
      hasDescription: resolvedDescription.length > 0,
      titleLength: resolvedTitle.length,
      descriptionLength: resolvedDescription.length,
      hasOgImage: Boolean(String(seo.ogImage || seo.twitterImage || '').trim()),
      warnings: [
        resolvedTitle.length > 60
          ? 'Title may be truncated in Google results'
          : null,
        resolvedTitle.length > 0 && resolvedTitle.length < 15
          ? 'Title is very short'
          : null,
        !resolvedDescription ? 'Missing meta description' : null,
        resolvedDescription.length > 160
          ? 'Description may be truncated in Google results'
          : null,
      ].filter(Boolean),
    };
  }

  private audit(
    tenantId: string,
    actorUserId: string | null,
    action: string,
    entity: string,
    entityId: string | null,
    before: unknown,
    after: unknown,
  ) {
    return this.prisma.schoolWebAuditLog.create({
      data: {
        tenantId,
        actorUserId,
        action,
        entity,
        entityId,
        beforeJson:
          before === null ? undefined : (before as Prisma.InputJsonValue),
        afterJson:
          after === null ? undefined : (after as Prisma.InputJsonValue),
      },
    });
  }
}
