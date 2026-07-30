import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import ExcelJS from 'exceljs';
import { mkdir, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { resolveUploadRoot } from '../../common/uploads/upload-paths';
import { validateDocumentUpload } from '../../common/uploads/file-upload.validator';
import {
  validateBrandingImage,
  extensionForMime,
} from '../../common/uploads/image-upload.validator';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../shared/storage/storage.service';
import type {
  CreateWebsiteBloodDonorDto,
  CreateWebsiteFyugInterestDto,
  CreateWebsiteNewsletterDto,
  CreateWebsitePageDto,
  ListWebsiteBloodDonorsQueryDto,
  ListWebsiteFyugInterestsQueryDto,
  ListWebsiteNewsletterQueryDto,
  ListWebsitePagesQueryDto,
  UpdateWebsitePageDto,
  UpdateWebsiteSiteDto,
  UpsertWebsiteRedirectDto,
} from './dto/website.dto';
import { sanitizeWebsiteHtml } from './utils/website-html-sanitizer';
import { importWebsiteContent } from './website-content-importer';

const FYUG_PHOTO_MAX_BYTES = 2 * 1024 * 1024;

const PAGE_WITH_REVISIONS = {
  currentRevision: true,
  publishedRevision: true,
} as const;

@Injectable()
export class WebsiteService {
  private readonly logger = new Logger(WebsiteService.name);

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
        ? page.publishedSections.filter((section: unknown) => {
            if (!section || typeof section !== 'object') return true;
            if (!('isVisible' in section)) return true;
            return (section as { isVisible?: unknown }).isVisible !== false;
          })
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
      .filter(
        (
          page,
        ): page is (typeof pages)[number] & {
          publishedRevision: NonNullable<
            (typeof pages)[number]['publishedRevision']
          >;
        } => Boolean(page.publishedRevision),
      )
      .map((page) => ({
        id: page.id,
        path: page.path,
        title: page.publishedRevision.title,
        excerpt: page.publishedRevision.excerpt,
        publishedAt: page.publishedAt,
        updatedAt: page.updatedAt,
      }));
  }

  /**
   * Public committee roster for college-web (e.g. IQAC Members).
   * Source of truth: GovernanceCommittee / GovernanceCommitteeMember.
   */
  async getPublicCommitteeMembers(tenantId: string, rawCode: string) {
    const code = String(rawCode ?? '')
      .trim()
      .toUpperCase();
    if (!code) throw new BadRequestException('Committee code is required');

    const committee = await this.prisma.governanceCommittee.findFirst({
      where: {
        tenantId,
        shortCode: code,
        status: 'ACTIVE',
      },
      select: { id: true, name: true, shortCode: true },
    });
    if (!committee) {
      return {
        code,
        name: code === 'IQAC' ? 'Internal Quality Assurance Cell' : code,
        members: [] as Array<{
          displayName: string;
          role: string;
          designation: string | null;
          departmentName: string | null;
          memberType: string | null;
          organization: string | null;
          exOfficioPosition: string | null;
        }>,
      };
    }

    const roleOrder = [
      'CHAIRPERSON',
      'COORDINATOR',
      'CONVENER',
      'MEMBER_SECRETARY',
      'SECRETARY',
      'EX_OFFICIO',
      'MEMBER',
    ];

    const rows = await this.prisma.governanceCommitteeMember.findMany({
      where: {
        tenantId,
        committeeId: committee.id,
        status: 'ACTIVE',
      },
      select: {
        displayName: true,
        role: true,
        designation: true,
        departmentName: true,
        memberType: true,
        organization: true,
        exOfficioPosition: true,
      },
      orderBy: [{ role: 'asc' }, { displayName: 'asc' }],
    });

    const members = [...rows].sort((a, b) => {
      const ai = roleOrder.indexOf(a.role);
      const bi = roleOrder.indexOf(b.role);
      const aRank = ai === -1 ? roleOrder.length : ai;
      const bRank = bi === -1 ? roleOrder.length : bi;
      if (aRank !== bRank) return aRank - bRank;
      return a.displayName.localeCompare(b.displayName);
    });

    return {
      code: committee.shortCode,
      name: committee.name,
      members,
    };
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

  async createPublicBloodDonor(
    tenantId: string,
    dto: CreateWebsiteBloodDonorDto,
  ) {
    if (dto.company) {
      throw new BadRequestException('Automated submission rejected');
    }
    if (!dto.eligible) {
      throw new BadRequestException(
        'Please confirm you are eligible to donate blood',
      );
    }

    const site = await this.getOrCreateSite(tenantId);
    const lastDonationDate = dto.lastDonationDate
      ? new Date(`${dto.lastDonationDate}T00:00:00.000Z`)
      : null;

    const row = await this.prisma.websiteBloodDonor.create({
      data: {
        tenantId,
        siteId: site.id,
        fullName: dto.fullName.trim(),
        dateOfBirth: new Date(`${dto.dateOfBirth}T00:00:00.000Z`),
        gender: dto.gender,
        phone: dto.phone.trim(),
        email: dto.email.trim().toLowerCase(),
        preferredContact: dto.preferredContact ?? 'Email',
        bloodGroup: dto.bloodGroup,
        lastDonationDate,
        streetAddress: dto.streetAddress?.trim() ?? '',
        city: dto.city?.trim() ?? '',
        state: dto.state?.trim() ?? '',
        pincode: dto.pincode?.trim() ?? '',
        medicalNotes: dto.medicalNotes?.trim() ?? '',
        eligible: true,
        status: 'NEW',
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
      },
    });

    void this.deliverBloodDonorNotice(row.id, dto).catch((error: unknown) => {
      this.logger.warn(
        `Blood donor notification failed for ${row.id}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    });

    return {
      id: row.id,
      status: 'accepted' as const,
      createdAt: row.createdAt,
    };
  }

  async listBloodDonors(
    tenantId: string,
    query: ListWebsiteBloodDonorsQueryDto = {},
  ) {
    const site = await this.getOrCreateSite(tenantId);
    const skip = query.skip ?? 0;
    const take = query.take ?? 50;
    const [items, total] = await Promise.all([
      this.prisma.websiteBloodDonor.findMany({
        where: { tenantId, siteId: site.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          fullName: true,
          dateOfBirth: true,
          gender: true,
          phone: true,
          email: true,
          preferredContact: true,
          bloodGroup: true,
          lastDonationDate: true,
          streetAddress: true,
          city: true,
          state: true,
          pincode: true,
          medicalNotes: true,
          eligible: true,
          status: true,
          createdAt: true,
        },
      }),
      this.prisma.websiteBloodDonor.count({
        where: { tenantId, siteId: site.id },
      }),
    ]);
    return { items, total, skip, take };
  }

  async createPublicNewsletterSubscriber(
    tenantId: string,
    dto: CreateWebsiteNewsletterDto,
  ) {
    if (dto.company) {
      throw new BadRequestException('Automated submission rejected');
    }
    const email = dto.email.trim().toLowerCase();
    if (!email) throw new BadRequestException('Email is required');
    const site = await this.getOrCreateSite(tenantId);
    const source = (dto.source?.trim() || 'FOOTER').toUpperCase();

    const existing = await this.prisma.websiteNewsletterSubscriber.findUnique({
      where: { siteId_email: { siteId: site.id, email } },
    });

    if (existing) {
      if (existing.status === 'ACTIVE') {
        return {
          id: existing.id,
          email: existing.email,
          status: existing.status,
          alreadySubscribed: true,
        };
      }
      const revived = await this.prisma.websiteNewsletterSubscriber.update({
        where: { id: existing.id },
        data: {
          status: 'ACTIVE',
          source,
          unsubscribedAt: null,
        },
        select: { id: true, email: true, status: true },
      });
      return { ...revived, alreadySubscribed: false };
    }

    const row = await this.prisma.websiteNewsletterSubscriber.create({
      data: {
        tenantId,
        siteId: site.id,
        email,
        status: 'ACTIVE',
        source,
      },
      select: { id: true, email: true, status: true },
    });
    return { ...row, alreadySubscribed: false };
  }

  async listNewsletterSubscribers(
    tenantId: string,
    query: ListWebsiteNewsletterQueryDto = {},
  ) {
    const site = await this.getOrCreateSite(tenantId);
    const skip = query.skip ?? 0;
    const take = query.take ?? 100;
    const status =
      !query.status || query.status === 'ALL' ? undefined : query.status;
    const where = {
      tenantId,
      siteId: site.id,
      ...(status ? { status } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.websiteNewsletterSubscriber.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          email: true,
          status: true,
          source: true,
          unsubscribedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.websiteNewsletterSubscriber.count({ where }),
    ]);
    return { items, total, skip, take };
  }

  async updateNewsletterSubscriberStatus(
    tenantId: string,
    subscriberId: string,
    status: string,
  ) {
    const normalized = status.toUpperCase();
    if (!['ACTIVE', 'UNSUBSCRIBED'].includes(normalized)) {
      throw new BadRequestException('Invalid newsletter status');
    }
    const existing = await this.prisma.websiteNewsletterSubscriber.findFirst({
      where: { id: subscriberId, tenantId },
    });
    if (!existing) throw new NotFoundException('Subscriber not found');
    return this.prisma.websiteNewsletterSubscriber.update({
      where: { id: existing.id },
      data: {
        status: normalized,
        unsubscribedAt: normalized === 'UNSUBSCRIBED' ? new Date() : null,
      },
      select: {
        id: true,
        email: true,
        status: true,
        source: true,
        unsubscribedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async deleteNewsletterSubscriber(tenantId: string, subscriberId: string) {
    const existing = await this.prisma.websiteNewsletterSubscriber.findFirst({
      where: { id: subscriberId, tenantId },
    });
    if (!existing) throw new NotFoundException('Subscriber not found');
    await this.prisma.websiteNewsletterSubscriber.delete({
      where: { id: existing.id },
    });
    return { ok: true };
  }

  async createPublicFyugInterest(
    tenantId: string,
    dto: CreateWebsiteFyugInterestDto,
    photograph?: Express.Multer.File,
  ) {
    if (dto.company) {
      throw new BadRequestException('Automated submission rejected');
    }
    if (!dto.declarationAccepted) {
      throw new BadRequestException(
        'Please accept the declaration to continue',
      );
    }
    if (dto.hasBackPapers) {
      throw new BadRequestException(
        'Applicants having back papers are not eligible for admission into the Fourth-Year Undergraduate Honours Programme',
      );
    }

    const site = await this.getOrCreateSite(tenantId);
    let photographUrl: string | null = null;
    let photographKey: string | null = null;

    if (photograph) {
      if (photograph.mimetype?.toLowerCase() === 'image/svg+xml') {
        throw new BadRequestException('SVG photographs are not allowed');
      }
      if (photograph.size > FYUG_PHOTO_MAX_BYTES) {
        throw new BadRequestException('Photograph must be 2MB or smaller');
      }
      const mime = (photograph.mimetype ?? '').toLowerCase();
      if (
        !['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(mime)
      ) {
        throw new BadRequestException('Photograph must be PNG, JPG, or WEBP');
      }
      const buf = photograph.buffer;
      const isPng =
        buf.length >= 4 &&
        buf[0] === 0x89 &&
        buf[1] === 0x50 &&
        buf[2] === 0x4e &&
        buf[3] === 0x47;
      const isJpeg =
        buf.length >= 3 &&
        buf[0] === 0xff &&
        buf[1] === 0xd8 &&
        buf[2] === 0xff;
      const isWebp =
        buf.length > 12 &&
        buf.toString('ascii', 0, 4) === 'RIFF' &&
        buf.toString('ascii', 8, 12) === 'WEBP';
      if (!isPng && !isJpeg && !isWebp) {
        throw new BadRequestException(
          'Photograph content is not a valid image',
        );
      }
      const ext = extensionForMime(mime);
      photographKey = `website/${tenantId}/${site.id}/fyug/${randomUUID()}.${ext}`;
      const stored = await this.storage.put(photographKey, photograph.buffer, {
        contentType: mime,
        cacheControl: 'private, max-age=31536000',
      });
      photographUrl = stored.url ?? `/uploads/${photographKey}`;
      if (!stored.url) {
        const uploadPath = join(resolveUploadRoot(), photographKey);
        await mkdir(dirname(uploadPath), { recursive: true });
        await writeFile(uploadPath, photograph.buffer);
      }
    } else {
      throw new BadRequestException('Applicant photograph is required');
    }

    const whatsapp = (dto.whatsapp?.trim() || dto.mobile.trim()).slice(0, 30);
    const applicationNumber = await this.nextFyugApplicationNumber(site.id);

    const row = await this.prisma.websiteFyugInterest.create({
      data: {
        tenantId,
        siteId: site.id,
        applicationNumber,
        academicSession: '2026-2027',
        fullName: dto.fullName.trim().toUpperCase(),
        photographUrl,
        photographKey,
        gender: dto.gender,
        dateOfBirth: new Date(`${dto.dateOfBirth}T00:00:00.000Z`),
        mobile: dto.mobile.trim(),
        whatsapp,
        email: dto.email.trim().toLowerCase(),
        state: dto.state.trim(),
        district: dto.district?.trim() ?? '',
        pinCode: dto.pinCode?.trim() ?? '',
        bloodGroup: dto.bloodGroup?.trim() ?? '',
        fatherName: dto.fatherName.trim(),
        fatherMobile: dto.fatherMobile.trim(),
        motherName: dto.motherName.trim(),
        motherMobile: dto.motherMobile.trim(),
        collegeLastAttended: dto.collegeLastAttended.trim(),
        affiliatedUniversity: dto.affiliatedUniversity.trim(),
        majorCourse: dto.majorCourse.trim(),
        minorCourse: dto.minorCourse.trim(),
        applyingHonoursIn: dto.applyingHonoursIn.trim(),
        cuetScore: dto.cuetScore?.trim() ?? '',
        cgpaSemesterV: dto.cgpaSemesterV?.trim() ?? '',
        percentageSemesterV: dto.percentageSemesterV?.trim() ?? '',
        hasBackPapers: false,
        backPaperDetails: '',
        declarationAccepted: true,
        signatureName: dto.signatureName.trim(),
        status: 'SUBMITTED',
      },
      select: {
        id: true,
        applicationNumber: true,
        status: true,
        createdAt: true,
      },
    });

    return {
      id: row.id,
      applicationNumber: row.applicationNumber,
      status: 'accepted' as const,
      createdAt: row.createdAt,
    };
  }

  async listFyugInterests(
    tenantId: string,
    query: ListWebsiteFyugInterestsQueryDto = {},
  ) {
    await this.getOrCreateSite(tenantId);
    const skip = query.skip ?? 0;
    const take = query.take ?? 50;
    // Scope by tenant only — site recreation must not hide imported rows.
    const where = { tenantId };
    const [items, total] = await Promise.all([
      this.prisma.websiteFyugInterest.findMany({
        where,
        orderBy: [{ applicationNumber: 'desc' }, { createdAt: 'desc' }],
        skip,
        take,
      }),
      this.prisma.websiteFyugInterest.count({ where }),
    ]);
    return { items, total, skip, take };
  }

  async getFyugInterestStats(tenantId: string) {
    await this.getOrCreateSite(tenantId);
    const rows = await this.prisma.websiteFyugInterest.findMany({
      where: { tenantId },
      select: {
        applyingHonoursIn: true,
        majorCourse: true,
        collegeLastAttended: true,
        state: true,
        gender: true,
        status: true,
        hasBackPapers: true,
        createdAt: true,
      },
    });

    const startOfToday = this.startOfDayInIndia(new Date());
    let today = 0;
    let eligible = 0;
    let rejected = 0;
    let pending = 0;
    let approved = 0;

    const honours = new Map<string, number>();
    const majors = new Map<string, number>();
    const colleges = new Map<string, number>();
    const states = new Map<string, number>();
    const genders = new Map<string, number>();

    for (const row of rows) {
      if (row.createdAt >= startOfToday) today += 1;
      if (!row.hasBackPapers) eligible += 1;
      const status = (row.status || '').toUpperCase();
      if (status === 'APPROVED') approved += 1;
      else if (status === 'REJECTED') rejected += 1;
      else pending += 1;

      this.bumpCount(
        honours,
        this.cleanLabel(row.applyingHonoursIn, 'Unspecified'),
      );
      this.bumpCount(majors, this.cleanLabel(row.majorCourse, 'Unspecified'));
      this.bumpCount(
        colleges,
        this.normalizeCollegeName(row.collegeLastAttended),
      );
      this.bumpCount(states, this.cleanLabel(row.state, 'Unspecified'));
      this.bumpCount(genders, this.cleanLabel(row.gender, 'Unspecified'));
    }

    const toSeries = (map: Map<string, number>, limit?: number) => {
      const items = [...map.entries()]
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
      return typeof limit === 'number' ? items.slice(0, limit) : items;
    };

    return {
      total: rows.length,
      today,
      eligible,
      rejected,
      pending,
      approved,
      byHonours: toSeries(honours),
      byMajor: toSeries(majors),
      byCollege: toSeries(colleges, 12),
      byState: toSeries(states),
      byGender: toSeries(genders),
    };
  }

  private bumpCount(map: Map<string, number>, key: string) {
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  private cleanLabel(value: string | null | undefined, fallback: string) {
    const cleaned = (value ?? '').replace(/\s+/g, ' ').trim();
    return cleaned || fallback;
  }

  private normalizeCollegeName(value: string | null | undefined) {
    const raw = this.cleanLabel(value, 'Unspecified').toLowerCase();
    if (raw.includes('don bosco') && raw.includes('tura')) {
      return 'Don Bosco College, Tura';
    }
    if (
      raw.includes('loyola') &&
      (raw.includes('williamnagar') || raw.includes('william nagar'))
    ) {
      return 'Loyola College, Williamnagar';
    }
    if (raw.includes('mendipathar')) {
      return 'Mendipathar College';
    }
    if (raw.includes('tia') && raw.includes('college')) {
      return "Tura's International Academy (TIA)";
    }
    // Title-case remaining names while preserving common punctuation.
    return raw
      .split(' ')
      .map((part) => {
        if (!part) return part;
        if (part === 'nehu' || part === 'tia') return part.toUpperCase();
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join(' ')
      .replace(/\s+,/g, ',')
      .replace(/,\s*/g, ', ');
  }

  private startOfDayInIndia(now: Date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
    const month = parts.find((p) => p.type === 'month')?.value ?? '01';
    const day = parts.find((p) => p.type === 'day')?.value ?? '01';
    // Midnight IST = previous day 18:30 UTC.
    return new Date(`${year}-${month}-${day}T00:00:00+05:30`);
  }

  async exportFyugInterestsExcel(tenantId: string): Promise<Buffer> {
    await this.getOrCreateSite(tenantId);
    const rows = await this.prisma.websiteFyugInterest.findMany({
      where: { tenantId },
      orderBy: [{ applicationNumber: 'asc' }, { createdAt: 'asc' }],
    });
    const stats = await this.getFyugInterestStats(tenantId);
    const generatedAt = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'BCL OneCampus ERP';
    workbook.created = new Date();
    workbook.lastModifiedBy = 'Website CMS';

    const navy: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0B2E59' },
    };
    const zebra: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' },
    };
    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };

    const styleHeaderCells = (
      row: ExcelJS.Row,
      fromCol: number,
      toCol: number,
    ) => {
      row.height = 22;
      for (let i = fromCol; i <= toCol; i += 1) {
        const cell = row.getCell(i);
        cell.fill = navy;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center',
          wrapText: true,
        };
        cell.border = thinBorder;
      }
    };

    const styleDataCells = (
      row: ExcelJS.Row,
      fromCol: number,
      toCol: number,
      odd: boolean,
    ) => {
      for (let i = fromCol; i <= toCol; i += 1) {
        const cell = row.getCell(i);
        cell.border = thinBorder;
        cell.alignment = { vertical: 'middle' };
        if (odd) cell.fill = zebra;
      }
    };

    const writeCountBlock = (
      sheet: ExcelJS.Worksheet,
      startRow: number,
      startCol: number,
      title: string,
      items: { label: string; value: number }[],
    ) => {
      const titleCell = sheet.getCell(startRow, startCol);
      titleCell.value = title;
      titleCell.font = { bold: true, size: 12, color: { argb: 'FF0B2E59' } };
      sheet.getCell(startRow + 1, startCol).value = 'Category';
      sheet.getCell(startRow + 1, startCol + 1).value = 'Count';
      styleHeaderCells(sheet.getRow(startRow + 1), startCol, startCol + 1);
      items.forEach((item, index) => {
        const r = startRow + 2 + index;
        sheet.getCell(r, startCol).value = item.label;
        sheet.getCell(r, startCol + 1).value = item.value;
        styleDataCells(
          sheet.getRow(r),
          startCol,
          startCol + 1,
          index % 2 === 1,
        );
      });
      return startRow + 2 + Math.max(items.length, 1) + 1;
    };

    // --- Summary sheet ---
    const summary = workbook.addWorksheet('Summary', {
      views: [{ state: 'frozen', ySplit: 4 }],
    });
    summary.getColumn(1).width = 34;
    summary.getColumn(2).width = 12;
    summary.getColumn(3).width = 3;
    summary.getColumn(4).width = 34;
    summary.getColumn(5).width = 12;

    summary.mergeCells('A1:E1');
    summary.getCell('A1').value = 'Don Bosco College, Tura';
    summary.getCell('A1').font = {
      bold: true,
      size: 14,
      color: { argb: 'FF0B2E59' },
    };
    summary.mergeCells('A2:E2');
    summary.getCell('A2').value =
      'FYUG 4th-year Interest Registrations — Summary';
    summary.getCell('A2').font = { bold: true, size: 12 };
    summary.mergeCells('A3:E3');
    summary.getCell('A3').value =
      `Fourth-Year Honours 2026 · ${stats.total} registrations · Generated ${generatedAt}`;
    summary.getCell('A3').font = { size: 10, color: { argb: 'FF64748B' } };

    const kpiLabels: [string, number][] = [
      ['Total applied', stats.total],
      ['Today', stats.today],
      ['Eligible (no back papers)', stats.eligible],
      ['Pending', stats.pending],
      ['Approved', stats.approved],
      ['Rejected', stats.rejected],
    ];
    summary.getCell('A5').value = 'Overview';
    summary.getCell('A5').font = {
      bold: true,
      size: 12,
      color: { argb: 'FF0B2E59' },
    };
    summary.getCell('A6').value = 'Metric';
    summary.getCell('B6').value = 'Count';
    styleHeaderCells(summary.getRow(6), 1, 2);
    kpiLabels.forEach(([label, value], index) => {
      const r = 7 + index;
      summary.getCell(r, 1).value = label;
      summary.getCell(r, 2).value = value;
      styleDataCells(summary.getRow(r), 1, 2, index % 2 === 1);
    });

    let leftRow = 7 + kpiLabels.length + 2;
    leftRow = writeCountBlock(
      summary,
      leftRow,
      1,
      'Honours-wise',
      stats.byHonours,
    );
    leftRow = writeCountBlock(
      summary,
      leftRow,
      1,
      'Major subject',
      stats.byMajor,
    );
    leftRow = writeCountBlock(summary, leftRow, 1, 'State-wise', stats.byState);
    writeCountBlock(summary, leftRow, 1, 'Gender-wise', stats.byGender);
    writeCountBlock(
      summary,
      5,
      4,
      'College-wise (normalised)',
      stats.byCollege,
    );

    // --- Registrations sheet ---
    const sheet = workbook.addWorksheet('Registrations', {
      views: [{ state: 'frozen', xSplit: 3, ySplit: 4 }],
    });
    const columns: Array<{ header: string; key: string; width: number }> = [
      { header: '#', key: 'serial', width: 6 },
      { header: 'Application No', key: 'applicationNumber', width: 16 },
      { header: 'Name', key: 'fullName', width: 28 },
      { header: 'Gender', key: 'gender', width: 10 },
      { header: 'Date of Birth', key: 'dateOfBirth', width: 14 },
      { header: 'Mobile', key: 'mobile', width: 14 },
      { header: 'WhatsApp', key: 'whatsapp', width: 14 },
      { header: 'Email', key: 'email', width: 32 },
      { header: 'State', key: 'state', width: 14 },
      { header: 'District', key: 'district', width: 16 },
      { header: 'PIN Code', key: 'pinCode', width: 10 },
      { header: 'Blood Group', key: 'bloodGroup', width: 12 },
      { header: 'College (as entered)', key: 'collegeRaw', width: 28 },
      { header: 'College (normalised)', key: 'collegeNorm', width: 28 },
      {
        header: 'Affiliated University',
        key: 'affiliatedUniversity',
        width: 18,
      },
      { header: 'Major', key: 'majorCourse', width: 18 },
      { header: 'Minor', key: 'minorCourse', width: 18 },
      { header: 'Honours Applied', key: 'applyingHonoursIn', width: 18 },
      { header: 'CUET Score', key: 'cuetScore', width: 12 },
      { header: 'CGPA (Sem V)', key: 'cgpaSemesterV', width: 12 },
      { header: 'Percentage (Sem V)', key: 'percentageSemesterV', width: 14 },
      { header: 'Back Papers', key: 'hasBackPapers', width: 12 },
      { header: 'Back Paper Details', key: 'backPaperDetails', width: 24 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Remarks', key: 'remarks', width: 20 },
      { header: 'Father Name', key: 'fatherName', width: 22 },
      { header: 'Father Mobile', key: 'fatherMobile', width: 14 },
      { header: 'Mother Name', key: 'motherName', width: 22 },
      { header: 'Mother Mobile', key: 'motherMobile', width: 14 },
      { header: 'Typed Signature', key: 'signatureName', width: 22 },
      { header: 'Academic Session', key: 'academicSession', width: 16 },
      { header: 'Submitted At (IST)', key: 'createdAt', width: 20 },
      { header: 'Photo URL', key: 'photographUrl', width: 40 },
    ];
    sheet.columns = columns.map((col) => ({ key: col.key, width: col.width }));

    sheet.mergeCells(1, 1, 1, columns.length);
    sheet.getCell(1, 1).value =
      'Don Bosco College, Tura — FYUG 4th-year Interest Registrations';
    sheet.getCell(1, 1).font = {
      bold: true,
      size: 14,
      color: { argb: 'FF0B2E59' },
    };
    sheet.mergeCells(2, 1, 2, columns.length);
    sheet.getCell(2, 1).value =
      `${rows.length} registration${rows.length === 1 ? '' : 's'} · Generated ${generatedAt}`;
    sheet.getCell(2, 1).font = { size: 10, color: { argb: 'FF64748B' } };
    sheet.getRow(3).height = 8;

    const headerRow = sheet.getRow(4);
    columns.forEach((col, index) => {
      headerRow.getCell(index + 1).value = col.header;
    });
    styleHeaderCells(headerRow, 1, columns.length);

    rows.forEach((row, index) => {
      const excelRow = sheet.addRow({
        serial: index + 1,
        applicationNumber: row.applicationNumber ?? '',
        fullName: row.fullName,
        gender: row.gender,
        dateOfBirth: row.dateOfBirth.toISOString().slice(0, 10),
        mobile: row.mobile,
        whatsapp: row.whatsapp,
        email: row.email,
        state: row.state,
        district: row.district,
        pinCode: row.pinCode,
        bloodGroup: row.bloodGroup,
        collegeRaw: row.collegeLastAttended,
        collegeNorm: this.normalizeCollegeName(row.collegeLastAttended),
        affiliatedUniversity: row.affiliatedUniversity,
        majorCourse: row.majorCourse,
        minorCourse: row.minorCourse,
        applyingHonoursIn: row.applyingHonoursIn,
        cuetScore: row.cuetScore,
        cgpaSemesterV: row.cgpaSemesterV,
        percentageSemesterV: row.percentageSemesterV,
        hasBackPapers: row.hasBackPapers ? 'Yes' : 'No',
        backPaperDetails: row.backPaperDetails,
        status: row.status,
        remarks: row.remarks,
        fatherName: row.fatherName,
        fatherMobile: row.fatherMobile,
        motherName: row.motherName,
        motherMobile: row.motherMobile,
        signatureName: row.signatureName,
        academicSession: row.academicSession,
        createdAt: row.createdAt.toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
        }),
        photographUrl: row.photographUrl ?? '',
      });
      styleDataCells(excelRow, 1, columns.length, index % 2 === 1);
      excelRow.getCell(1).alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
    });

    sheet.autoFilter = {
      from: { row: 4, column: 1 },
      to: { row: Math.max(4, 4 + rows.length), column: columns.length },
    };

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async nextFyugApplicationNumber(siteId: string): Promise<string> {
    const year = new Date().getFullYear().toString().slice(-2);
    const prefix = `FYUG${year}-`;
    const latest = await this.prisma.websiteFyugInterest.findFirst({
      where: {
        siteId,
        applicationNumber: { startsWith: prefix },
      },
      orderBy: { applicationNumber: 'desc' },
      select: { applicationNumber: true },
    });
    let next = 1;
    if (latest?.applicationNumber) {
      const match = latest.applicationNumber.match(/(\d+)$/);
      if (match) next = Number.parseInt(match[1], 10) + 1;
    }
    return `${prefix}${String(next).padStart(6, '0')}`;
  }

  private async deliverBloodDonorNotice(
    id: string,
    payload: CreateWebsiteBloodDonorDto,
  ) {
    const endpoint = process.env.COLLEGE_FORMS_URL?.replace(/\/+$/, '');
    if (!endpoint) return;
    const recipient = process.env.COLLEGE_CONTACT_RECIPIENT?.trim();
    const response = await fetch(`${endpoint}/blood-donor`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(process.env.COLLEGE_FORMS_TOKEN
          ? { authorization: `Bearer ${process.env.COLLEGE_FORMS_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({
        id,
        ...payload,
        company: undefined,
        ...(recipient ? { recipient } : {}),
      }),
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) {
      throw new Error(`Form delivery responded ${response.status}`);
    }
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
