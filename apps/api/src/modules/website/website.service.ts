import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { resolveUploadRoot } from '../../common/uploads/upload-paths';
import { validateDocumentUpload } from '../../common/uploads/file-upload.validator';
import { validateBrandingImage } from '../../common/uploads/image-upload.validator';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../shared/storage/storage.service';
import type {
  CreateWebsitePageDto,
  ListWebsitePagesQueryDto,
  UpdateWebsitePageDto,
  UpdateWebsiteSiteDto,
  UpsertWebsiteRedirectDto,
} from './dto/website.dto';
import { sanitizeWebsiteHtml } from './utils/website-html-sanitizer';

const PAGE_WITH_REVISIONS = {
  currentRevision: true,
  publishedRevision: true,
} as const;

@Injectable()
export class WebsiteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async getOrCreateSite(tenantId: string, actorId?: string) {
    const existing = await this.prisma.websiteSite.findUnique({
      where: { tenantId },
    });
    if (existing) return existing;

    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId, deletedAt: null },
      include: {
        branding: true,
        institutions: { where: { deletedAt: null }, take: 1 },
      },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return this.prisma.websiteSite.create({
      data: {
        tenantId,
        name:
          tenant.branding?.displayName ??
          tenant.institutions[0]?.name ??
          tenant.name,
        slug: tenant.slug,
        logoUrl: tenant.branding?.logoUrl,
        faviconUrl: tenant.branding?.faviconUrl,
        createdById: actorId,
        updatedById: actorId,
      },
    });
  }

  async updateSite(user: JwtUser, dto: UpdateWebsiteSiteDto) {
    const site = await this.getOrCreateSite(user.tid, user.sub);
    const name = dto.name?.trim();
    const slug = dto.slug ? this.normalizeSlug(dto.slug) : undefined;
    return this.prisma.websiteSite.update({
      where: { id: site.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(slug !== undefined ? { slug } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.primaryDomain !== undefined
          ? {
              primaryDomain: dto.primaryDomain
                ? this.normalizeDomain(dto.primaryDomain)
                : null,
            }
          : {}),
        ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl } : {}),
        ...(dto.faviconUrl !== undefined ? { faviconUrl: dto.faviconUrl } : {}),
        ...(dto.settings !== undefined
          ? { settingsJson: dto.settings as Prisma.InputJsonValue }
          : {}),
        updatedById: user.sub,
      },
    });
  }

  async listPages(tenantId: string, query: ListWebsitePagesQueryDto) {
    const site = await this.getOrCreateSite(tenantId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where: Prisma.WebsitePageWhereInput = {
      tenantId,
      siteId: site.id,
      ...(query.status ? { status: query.status } : {}),
      ...(query.q?.trim()
        ? {
            OR: [
              { title: { contains: query.q.trim(), mode: 'insensitive' } },
              { path: { contains: query.q.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.websitePage.findMany({
        where,
        include: PAGE_WITH_REVISIONS,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.websitePage.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async getPage(tenantId: string, pageId: string) {
    const page = await this.prisma.websitePage.findFirst({
      where: { id: pageId, tenantId },
      include: {
        ...PAGE_WITH_REVISIONS,
        revisions: { orderBy: { revisionNumber: 'desc' } },
        sections: { orderBy: { position: 'asc' } },
      },
    });
    if (!page) throw new NotFoundException('Website page not found');
    return page;
  }

  async createPage(user: JwtUser, dto: CreateWebsitePageDto) {
    const site = await this.getOrCreateSite(user.tid, user.sub);
    const path = this.normalizePath(dto.path);
    const title = this.requiredText(dto.title, 'title');
    const duplicate = await this.prisma.websitePage.findFirst({
      where: { siteId: site.id, path },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('Page path already exists');

    return this.prisma.$transaction(async (tx) => {
      const page = await tx.websitePage.create({
        data: {
          tenantId: user.tid,
          siteId: site.id,
          path,
          title,
          createdById: user.sub,
          updatedById: user.sub,
        },
      });
      const revision = await tx.websitePageRevision.create({
        data: {
          tenantId: user.tid,
          pageId: page.id,
          revisionNumber: 1,
          title,
          excerpt: dto.excerpt?.trim() || null,
          bodyHtml: sanitizeWebsiteHtml(dto.bodyHtml),
          seoTitle: dto.seoTitle?.trim() || null,
          seoDescription: dto.seoDescription?.trim() || null,
          seoKeywords: this.normalizeKeywords(dto.seoKeywords),
          changeNote: dto.changeNote?.trim() || 'Initial revision',
          createdById: user.sub,
        },
      });
      return tx.websitePage.update({
        where: { id: page.id },
        data: { currentRevisionId: revision.id },
        include: PAGE_WITH_REVISIONS,
      });
    });
  }

  async updatePage(user: JwtUser, pageId: string, dto: UpdateWebsitePageDto) {
    const page = await this.getPage(user.tid, pageId);
    const base = page.currentRevision;
    if (!base) throw new BadRequestException('Page has no current revision');
    const path =
      dto.path !== undefined ? this.normalizePath(dto.path) : page.path;
    const title =
      dto.title !== undefined
        ? this.requiredText(dto.title, 'title')
        : base.title;
    if (path !== page.path) {
      const duplicate = await this.prisma.websitePage.findFirst({
        where: { siteId: page.siteId, path, id: { not: page.id } },
      });
      if (duplicate) throw new ConflictException('Page path already exists');
    }

    return this.prisma.$transaction(async (tx) => {
      const latest = await tx.websitePageRevision.aggregate({
        where: { pageId },
        _max: { revisionNumber: true },
      });
      const revision = await tx.websitePageRevision.create({
        data: {
          tenantId: user.tid,
          pageId,
          revisionNumber: (latest._max.revisionNumber ?? 0) + 1,
          title,
          excerpt:
            dto.excerpt !== undefined
              ? dto.excerpt?.trim() || null
              : base.excerpt,
          bodyHtml:
            dto.bodyHtml !== undefined
              ? sanitizeWebsiteHtml(dto.bodyHtml)
              : base.bodyHtml,
          seoTitle:
            dto.seoTitle !== undefined
              ? dto.seoTitle?.trim() || null
              : base.seoTitle,
          seoDescription:
            dto.seoDescription !== undefined
              ? dto.seoDescription?.trim() || null
              : base.seoDescription,
          seoKeywords:
            dto.seoKeywords !== undefined
              ? this.normalizeKeywords(dto.seoKeywords)
              : base.seoKeywords,
          changeNote: dto.changeNote?.trim() || null,
          createdById: user.sub,
        },
      });
      return tx.websitePage.update({
        where: { id: pageId },
        data: {
          path,
          title,
          currentRevisionId: revision.id,
          updatedById: user.sub,
        },
        include: PAGE_WITH_REVISIONS,
      });
    });
  }

  async restoreRevision(user: JwtUser, pageId: string, revisionId: string) {
    const source = await this.prisma.websitePageRevision.findFirst({
      where: { id: revisionId, pageId, tenantId: user.tid },
    });
    if (!source) throw new NotFoundException('Revision not found');
    return this.updatePage(user, pageId, {
      title: source.title,
      excerpt: source.excerpt,
      bodyHtml: source.bodyHtml,
      seoTitle: source.seoTitle,
      seoDescription: source.seoDescription,
      seoKeywords: source.seoKeywords,
      changeNote: `Restored revision ${source.revisionNumber}`,
    });
  }

  async publishPage(user: JwtUser, pageId: string, revisionId?: string) {
    const page = await this.getPage(user.tid, pageId);
    const selectedId = revisionId ?? page.currentRevisionId;
    if (!selectedId) throw new BadRequestException('Page has no revision');
    const revision = await this.prisma.websitePageRevision.findFirst({
      where: { id: selectedId, pageId, tenantId: user.tid },
    });
    if (!revision) throw new NotFoundException('Revision not found');
    return this.prisma.websitePage.update({
      where: { id: pageId },
      data: {
        status: 'PUBLISHED',
        publishedRevisionId: revision.id,
        publishedSections: JSON.parse(
          JSON.stringify(page.sections),
        ) as Prisma.InputJsonValue,
        publishedAt: new Date(),
        updatedById: user.sub,
      },
      include: PAGE_WITH_REVISIONS,
    });
  }

  async unpublishPage(user: JwtUser, pageId: string) {
    await this.getPage(user.tid, pageId);
    return this.prisma.websitePage.update({
      where: { id: pageId },
      data: {
        status: 'DRAFT',
        publishedRevisionId: null,
        publishedAt: null,
        updatedById: user.sub,
      },
      include: PAGE_WITH_REVISIONS,
    });
  }

  async archivePage(user: JwtUser, pageId: string) {
    await this.getPage(user.tid, pageId);
    return this.prisma.websitePage.update({
      where: { id: pageId },
      data: {
        status: 'ARCHIVED',
        publishedRevisionId: null,
        publishedAt: null,
        updatedById: user.sub,
      },
    });
  }

  async listMedia(tenantId: string, kind?: string) {
    const site = await this.getOrCreateSite(tenantId);
    return this.prisma.websiteMediaAsset.findMany({
      where: {
        tenantId,
        siteId: site.id,
        deletedAt: null,
        ...(kind ? { kind } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async uploadMedia(
    user: JwtUser,
    file: Express.Multer.File | undefined,
    kind: 'IMAGE' | 'DOCUMENT' = 'IMAGE',
    altText?: string,
    imageKind:
      | 'profile'
      | 'website-hero'
      | 'logo'
      | 'favicon'
      | 'principal-photo'
      | 'careers-hero' = 'profile',
  ) {
    if (kind === 'IMAGE') {
      if (file?.mimetype?.toLowerCase() === 'image/svg+xml') {
        throw new BadRequestException('SVG uploads are not allowed');
      }
      validateBrandingImage(file, imageKind);
    } else {
      validateDocumentUpload(file, 'document');
    }
    const validFile = file!;
    const site = await this.getOrCreateSite(user.tid, user.sub);
    const safeName = validFile.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageKey = `website/${user.tid}/${site.id}/${randomUUID()}-${safeName}`;
    const stored = await this.storage.put(storageKey, validFile.buffer, {
      contentType: validFile.mimetype,
      cacheControl: 'public, max-age=31536000, immutable',
    });
    const publicUrl = stored.url ?? `/uploads/${storageKey}`;
    if (!stored.url) {
      const uploadPath = join(resolveUploadRoot(), storageKey);
      await mkdir(dirname(uploadPath), { recursive: true });
      await writeFile(uploadPath, validFile.buffer);
    }
    return this.prisma.websiteMediaAsset.create({
      data: {
        tenantId: user.tid,
        siteId: site.id,
        kind,
        storageKey,
        publicUrl,
        fileName: validFile.originalname,
        mimeType: validFile.mimetype.toLowerCase(),
        bytes: validFile.size,
        altText: altText?.trim() || null,
        createdById: user.sub,
      },
    });
  }

  async deleteMedia(user: JwtUser, mediaId: string) {
    const media = await this.prisma.websiteMediaAsset.findFirst({
      where: { id: mediaId, tenantId: user.tid },
    });
    if (!media) throw new NotFoundException('Media asset not found');
    await this.prisma.websiteMediaAsset.delete({ where: { id: mediaId } });
    return { ok: true };
  }

  async listRedirects(tenantId: string) {
    const site = await this.getOrCreateSite(tenantId);
    return this.prisma.websiteRedirect.findMany({
      where: { tenantId, siteId: site.id },
      orderBy: { fromPath: 'asc' },
    });
  }

  async upsertRedirect(user: JwtUser, dto: UpsertWebsiteRedirectDto) {
    const site = await this.getOrCreateSite(user.tid, user.sub);
    const fromPath = this.normalizePath(dto.fromPath);
    const toPath = this.normalizeRedirectTarget(dto.toPath);
    if (fromPath === toPath) {
      throw new BadRequestException('Redirect source and target must differ');
    }
    if (toPath.startsWith('/')) {
      const inverse = await this.prisma.websiteRedirect.findFirst({
        where: {
          siteId: site.id,
          fromPath: toPath,
          toPath: fromPath,
          isActive: true,
        },
      });
      if (inverse) throw new BadRequestException('Redirect cycle detected');
    }
    return this.prisma.websiteRedirect.upsert({
      where: { siteId_fromPath: { siteId: site.id, fromPath } },
      update: {
        toPath,
        statusCode: dto.statusCode ?? 301,
        isActive: dto.isActive ?? true,
      },
      create: {
        tenantId: user.tid,
        siteId: site.id,
        fromPath,
        toPath,
        statusCode: dto.statusCode ?? 301,
        isActive: dto.isActive ?? true,
        createdById: user.sub,
      },
    });
  }

  async deleteRedirect(user: JwtUser, redirectId: string) {
    const redirect = await this.prisma.websiteRedirect.findFirst({
      where: { id: redirectId, tenantId: user.tid },
    });
    if (!redirect) throw new NotFoundException('Redirect not found');
    await this.prisma.websiteRedirect.delete({ where: { id: redirectId } });
    return { ok: true };
  }

  async getPublicSite(tenantId: string) {
    const site = await this.prisma.websiteSite.findFirst({
      where: { tenantId, status: 'ACTIVE' },
    });
    if (!site) throw new NotFoundException('Website not found');
    return site;
  }

  async getPublicPage(tenantId: string, rawPath: string) {
    const site = await this.getPublicSite(tenantId);
    const path = this.normalizePath(rawPath);
    const page = await this.prisma.websitePage.findFirst({
      where: {
        tenantId,
        siteId: site.id,
        path,
        status: 'PUBLISHED',
        publishedRevisionId: { not: null },
      },
      include: { publishedRevision: true },
    });
    if (!page?.publishedRevision) {
      throw new NotFoundException('Page not found');
    }
    return {
      id: page.id,
      path: page.path,
      title: page.publishedRevision.title,
      excerpt: page.publishedRevision.excerpt,
      bodyHtml: page.publishedRevision.bodyHtml,
      seoTitle: page.publishedRevision.seoTitle,
      seoDescription: page.publishedRevision.seoDescription,
      seoKeywords: page.publishedRevision.seoKeywords,
      sections: Array.isArray(page.publishedSections)
        ? page.publishedSections.filter(
            (section) =>
              !section ||
              typeof section !== 'object' ||
              !('isVisible' in section) ||
              section.isVisible !== false,
          )
        : [],
      publishedAt: page.publishedAt,
      updatedAt: page.updatedAt,
    };
  }

  async listPublicPages(tenantId: string) {
    const site = await this.getPublicSite(tenantId);
    const pages = await this.prisma.websitePage.findMany({
      where: {
        tenantId,
        siteId: site.id,
        status: 'PUBLISHED',
        publishedRevisionId: { not: null },
      },
      include: { publishedRevision: true },
      orderBy: { path: 'asc' },
    });
    return pages
      .filter((page) => page.publishedRevision)
      .map((page) => ({
        id: page.id,
        path: page.path,
        title: page.publishedRevision!.title,
        excerpt: page.publishedRevision!.excerpt,
        publishedAt: page.publishedAt,
        updatedAt: page.updatedAt,
      }));
  }

  async findPublicRedirect(tenantId: string, rawPath: string) {
    const site = await this.getPublicSite(tenantId);
    const redirect = await this.prisma.websiteRedirect.findFirst({
      where: {
        tenantId,
        siteId: site.id,
        fromPath: this.normalizePath(rawPath),
        isActive: true,
      },
    });
    if (!redirect) throw new NotFoundException('Redirect not found');
    return redirect;
  }

  async seedDefaults(user: JwtUser) {
    const { importWebsiteContent } = await import('./website-content-importer');
    const result = await importWebsiteContent(this.prisma, user.tid, user.sub);
    return {
      site: await this.getOrCreateSite(user.tid, user.sub),
      created: result.pagesCreated,
      totalDefaults: result.pagesTotal,
      import: result,
    };
  }

  private requiredText(value: string, field: string) {
    const normalized = value.trim();
    if (!normalized) throw new BadRequestException(`${field} is required`);
    return normalized;
  }

  private normalizeSlug(value: string) {
    const slug = value.trim().toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new BadRequestException(
        'slug must contain lowercase letters, numbers and hyphens',
      );
    }
    return slug;
  }

  private normalizeDomain(value: string) {
    const domain = value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .split('/')[0];
    if (!domain || !/^[a-z0-9.-]+(?::\d+)?$/.test(domain)) {
      throw new BadRequestException('Invalid primary domain');
    }
    return domain;
  }

  private normalizePath(value: string) {
    const raw = value.trim();
    if (!raw || raw.includes('?') || raw.includes('#') || raw.includes('\\')) {
      throw new BadRequestException('Invalid website path');
    }
    const path = raw.startsWith('/') ? raw : `/${raw}`;
    if (path.includes('//') || path.split('/').includes('..')) {
      throw new BadRequestException('Invalid website path');
    }
    return path === '/' ? '/' : path.replace(/\/+$/, '').toLowerCase();
  }

  private normalizeRedirectTarget(value: string) {
    const target = value.trim();
    if (/^https:\/\//i.test(target)) return target;
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('//')) {
      throw new BadRequestException(
        'Redirect target must be an internal path or HTTPS URL',
      );
    }
    return this.normalizePath(target);
  }

  private normalizeKeywords(values?: string[]) {
    return [
      ...new Set(
        (values ?? [])
          .map((value) => value.trim())
          .filter(Boolean)
          .slice(0, 25),
      ),
    ];
  }
}
