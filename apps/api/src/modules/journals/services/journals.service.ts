import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { JournalResolutionService } from './journal-resolution.service';
import {
  TRANSIENT_AUTHOR_GUIDELINES_HTML,
  TRANSIENT_PEER_REVIEW_HTML,
} from '../content/transient-author-guidelines';

const DEFAULT_PAGE_KEYS: Array<{
  key: string;
  title: string;
  bodyHtml: string;
}> = [
  {
    key: 'about',
    title: 'About the Journal',
    bodyHtml:
      '<p>A peer-reviewed annual journal published by Don Bosco College, Tura.</p>',
  },
  {
    key: 'aim-scope',
    title: 'Aim & Scope',
    bodyHtml:
      '<p>The journal publishes high-quality research across multidisciplinary academic areas.</p>',
  },
  {
    key: 'peer-review',
    title: 'Peer Review Policy',
    bodyHtml: TRANSIENT_PEER_REVIEW_HTML,
  },
  {
    key: 'ethics',
    title: 'Publication Ethics',
    bodyHtml:
      '<p>The journal follows established publication ethics guidelines. Copyright in published papers is reserved by the publisher as stated in journal policy.</p>',
  },
  {
    key: 'author-guidelines',
    title: 'Author Guidelines',
    bodyHtml: TRANSIENT_AUTHOR_GUIDELINES_HTML,
  },
  {
    key: 'indexing',
    title: 'Indexing',
    bodyHtml:
      '<p>Indexing information will be updated by the editorial office.</p>',
  },
  {
    key: 'contact',
    title: 'Contact',
    bodyHtml:
      '<p>Contact the editorial office using the details on this page.</p>',
  },
];

@Injectable()
export class JournalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolution: JournalResolutionService,
  ) {}

  async seedDefaults(tenantId: string) {
    const transient = await this.ensureJournal(tenantId, {
      name: 'TRANSIENT',
      shortName: 'Transient',
      slug: 'transient',
      subdomain: 'transient',
      issn: '2583-9987',
      tagline: 'A Peer Reviewed Annual Journal',
      description:
        'TRANSIENT is a peer-reviewed annual journal of Don Bosco College, Tura, dedicated to high-quality multidisciplinary research with open access for readers worldwide.',
      contactEmail: 'transient.journal@donboscocollege.ac.in',
      publisher: 'Don Bosco College, Tura',
      institution: 'Don Bosco College, Tura',
      frequency: 'ANNUAL',
    });

    const source = await this.ensureJournal(tenantId, {
      name: 'SOURCE',
      shortName: 'Source',
      slug: 'source',
      subdomain: 'source',
      issn: 'XXXX-XXXX',
      tagline: 'A Peer Reviewed Research Journal',
      description:
        'SOURCE is a peer-reviewed journal of Don Bosco College, Tura, fostering scholarly inquiry and knowledge sharing.',
      contactEmail: 'source.journal@donboscocollege.ac.in',
      publisher: 'Don Bosco College, Tura',
      institution: 'Don Bosco College, Tura',
      frequency: 'ANNUAL',
    });

    await this.ensureTransientSampleContent(tenantId, transient.id);
    await this.ensureSourceSampleContent(tenantId, source.id);

    return { transient, source };
  }

  private async ensureJournal(
    tenantId: string,
    data: {
      name: string;
      shortName: string;
      slug: string;
      subdomain: string;
      issn: string;
      tagline: string;
      description: string;
      contactEmail: string;
      publisher: string;
      institution: string;
      frequency: string;
    },
  ) {
    const existing = await this.prisma.journal.findFirst({
      where: { tenantId, slug: data.slug },
    });
    if (existing) {
      await this.ensureDefaultPages(tenantId, existing.id);
      return existing;
    }

    const journal = await this.prisma.journal.create({
      data: {
        tenantId,
        name: data.name,
        shortName: data.shortName,
        slug: data.slug,
        subdomain: data.subdomain,
        issn: data.issn,
        tagline: data.tagline,
        description: data.description,
        contactEmail: data.contactEmail,
        publisher: data.publisher,
        institution: data.institution,
        frequency: data.frequency,
        logoUrl: '/branding/college-logo.png',
        bannerUrl: '/branding/transient-science-hero.png',
        status: 'ACTIVE',
      },
    });
    await this.ensureDefaultPages(tenantId, journal.id);
    return journal;
  }

  private async ensureDefaultPages(tenantId: string, journalId: string) {
    for (const [index, page] of DEFAULT_PAGE_KEYS.entries()) {
      const exists = await this.prisma.journalPage.findFirst({
        where: { journalId, key: page.key },
      });
      if (exists) continue;
      await this.prisma.journalPage.create({
        data: {
          tenantId,
          journalId,
          key: page.key,
          title: page.title,
          bodyHtml: page.bodyHtml,
          sortOrder: index + 1,
          isPublished: true,
        },
      });
    }
  }

  private async ensureTransientSampleContent(
    tenantId: string,
    journalId: string,
  ) {
    const boardCount = await this.prisma.journalEditorialMember.count({
      where: { journalId },
    });
    if (boardCount === 0) {
      await this.prisma.journalEditorialMember.create({
        data: {
          tenantId,
          journalId,
          fullName: 'Chief Editor',
          roleTitle: 'Chief Editor',
          boardType: 'CHIEF_EDITOR',
          institution: 'Don Bosco College, Tura',
          sortOrder: 1,
        },
      });
      await this.prisma.journalEditorialMember.create({
        data: {
          tenantId,
          journalId,
          fullName: 'Managing Editor',
          roleTitle: 'Managing Editor',
          boardType: 'MANAGING',
          institution: 'Don Bosco College, Tura',
          sortOrder: 2,
        },
      });
    }

    let volume = await this.prisma.journalVolume.findFirst({
      where: { journalId, volumeNumber: 12, year: 2024 },
    });
    if (!volume) {
      volume = await this.prisma.journalVolume.create({
        data: {
          tenantId,
          journalId,
          volumeNumber: 12,
          year: 2024,
          label: 'Volume 12',
        },
      });
    }

    let issue = await this.prisma.journalIssue.findFirst({
      where: { volumeId: volume.id, issueNumber: 1 },
      include: { articles: true },
    });
    if (!issue) {
      issue = await this.prisma.journalIssue.create({
        data: {
          tenantId,
          journalId,
          volumeId: volume.id,
          issueNumber: 1,
          title: 'Transient – 2024',
          publicationDate: new Date('2024-12-01'),
          coverUrl: '/branding/transient-science-hero.png',
          summary:
            'The 2024 annual issue of TRANSIENT featuring peer-reviewed research contributions.',
          isCurrent: true,
          isPublished: true,
          articles: {
            create: [
              {
                tenantId,
                journalId,
                title: 'Education, Culture and Development in the Garo Hills',
                abstract:
                  'An exploratory study on the intersections of education and cultural development.',
                keywords: ['Education', 'Culture', 'Meghalaya'],
                pageRange: '1-12',
                category: 'Research Article',
                status: 'PUBLISHED',
                publishedAt: new Date('2024-12-01'),
                htmlContent:
                  '<p>Full article content will be available in the published PDF.</p>',
                authors: {
                  create: [
                    {
                      tenantId,
                      fullName: 'Sample Author',
                      affiliation: 'Don Bosco College, Tura',
                      isCorresponding: true,
                      sortOrder: 1,
                    },
                  ],
                },
              },
            ],
          },
        },
        include: { articles: true },
      });
    } else if (!issue.isCurrent) {
      await this.prisma.journalIssue.update({
        where: { id: issue.id },
        data: { isCurrent: true },
      });
    }

    const announcements = await this.prisma.journalAnnouncement.count({
      where: { journalId },
    });
    if (announcements === 0) {
      await this.prisma.journalAnnouncement.create({
        data: {
          tenantId,
          journalId,
          title: 'Call for Papers — Next Annual Issue',
          bodyHtml:
            '<p>Authors are invited to submit original research for the forthcoming issue of TRANSIENT.</p>',
          publishedAt: new Date(),
          isPinned: true,
          isPublished: true,
        },
      });
    }
  }

  private async ensureSourceSampleContent(tenantId: string, journalId: string) {
    await this.ensureDefaultPages(tenantId, journalId);
    const volume = await this.prisma.journalVolume.findFirst({
      where: { journalId },
    });
    if (!volume) {
      const created = await this.prisma.journalVolume.create({
        data: {
          tenantId,
          journalId,
          volumeNumber: 1,
          year: new Date().getFullYear(),
          label: 'Volume 1',
        },
      });
      await this.prisma.journalIssue.create({
        data: {
          tenantId,
          journalId,
          volumeId: created.id,
          issueNumber: 1,
          title: 'Source — Inaugural Issue',
          publicationDate: new Date(),
          summary: 'Inaugural issue of SOURCE.',
          isCurrent: true,
          isPublished: true,
        },
      });
    }
  }

  async getPortalInfo(tenantId: string, journalId: string) {
    const journal = await this.resolution.requireJournal(tenantId, journalId);
    const [
      pages,
      announcements,
      board,
      currentIssue,
      topViewed,
      topDownloaded,
    ] = await Promise.all([
      this.prisma.journalPage.findMany({
        where: { journalId, isPublished: true },
        orderBy: { sortOrder: 'asc' },
        select: { key: true, title: true },
      }),
      this.prisma.journalAnnouncement.findMany({
        where: { journalId, isPublished: true },
        orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
        take: 5,
      }),
      this.prisma.journalEditorialMember.findMany({
        where: { journalId, isActive: true },
        orderBy: { sortOrder: 'asc' },
        take: 8,
      }),
      this.prisma.journalIssue.findFirst({
        where: { journalId, isPublished: true, isCurrent: true },
        include: {
          volume: true,
          articles: {
            where: { status: 'PUBLISHED' },
            orderBy: { sortOrder: 'asc' },
            take: 6,
            include: { authors: { orderBy: { sortOrder: 'asc' } } },
          },
        },
      }),
      this.listTopArticles(tenantId, journalId, 'views', 5),
      this.listTopArticles(tenantId, journalId, 'downloads', 5),
    ]);

    const volumeCount = await this.prisma.journalVolume.count({
      where: { journalId },
    });
    const articleCount = await this.prisma.journalArticle.count({
      where: { journalId, status: 'PUBLISHED' },
    });
    const authorCount = await this.prisma.journalArticleAuthor
      .groupBy({
        by: ['fullName'],
        where: {
          article: { journalId, status: 'PUBLISHED' },
        },
      })
      .then((rows) => rows.length)
      .catch(() => articleCount);

    return {
      journal: this.withHomeThemeFields(journal),
      pages,
      announcements,
      boardPreview: board,
      currentIssue,
      topViewed,
      topDownloaded,
      metrics: {
        issn: journal.issn,
        volumeCount,
        articleCount,
        authorCount,
        boardCount: board.length,
        peerReviewed: true,
        openAccess: true,
      },
      highlights: [
        'High Quality Research',
        'Global Reach',
        'Peer Reviewed',
        'Open Access',
        'Multi-disciplinary',
      ],
    };
  }

  listTopArticles(
    tenantId: string,
    journalId: string,
    by: 'views' | 'downloads' = 'views',
    limit = 5,
  ) {
    return this.prisma.journalArticle.findMany({
      where: { tenantId, journalId, status: 'PUBLISHED' },
      orderBy:
        by === 'downloads' ? { downloadCount: 'desc' } : { viewCount: 'desc' },
      take: limit,
      include: {
        authors: { orderBy: { sortOrder: 'asc' }, take: 3 },
        issue: { include: { volume: true } },
      },
    });
  }

  getPage(tenantId: string, journalId: string, key: string) {
    return this.prisma.journalPage.findFirst({
      where: { tenantId, journalId, key, isPublished: true },
    });
  }

  listBoard(
    tenantId: string,
    journalId: string,
    opts: { boardType?: string; excludeTypes?: string[] } = {},
  ) {
    return this.prisma.journalEditorialMember.findMany({
      where: {
        tenantId,
        journalId,
        isActive: true,
        ...(opts.boardType ? { boardType: opts.boardType } : {}),
        ...(opts.excludeTypes?.length
          ? { boardType: { notIn: opts.excludeTypes } }
          : {}),
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  listIssues(tenantId: string, journalId: string) {
    return this.prisma.journalIssue.findMany({
      where: { tenantId, journalId, isPublished: true },
      include: { volume: true, _count: { select: { articles: true } } },
      orderBy: [{ publicationDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  getIssue(tenantId: string, journalId: string, issueId: string) {
    return this.prisma.journalIssue.findFirst({
      where: { id: issueId, tenantId, journalId, isPublished: true },
      include: {
        volume: true,
        articles: {
          where: { status: 'PUBLISHED' },
          orderBy: { sortOrder: 'asc' },
          include: { authors: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    });
  }

  async listArticles(
    tenantId: string,
    journalId: string,
    query: {
      q?: string;
      year?: number;
      keyword?: string;
      author?: string;
    } = {},
  ) {
    const q = query.q?.trim();
    return this.prisma.journalArticle.findMany({
      where: {
        tenantId,
        journalId,
        status: 'PUBLISHED',
        ...(query.year ? { issue: { volume: { year: query.year } } } : {}),
        ...(query.keyword ? { keywords: { has: query.keyword } } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: 'insensitive' } },
                { abstract: { contains: q, mode: 'insensitive' } },
                { doi: { contains: q, mode: 'insensitive' } },
                {
                  authors: {
                    some: { fullName: { contains: q, mode: 'insensitive' } },
                  },
                },
              ],
            }
          : {}),
        ...(query.author
          ? {
              authors: {
                some: {
                  fullName: { contains: query.author, mode: 'insensitive' },
                },
              },
            }
          : {}),
      },
      include: {
        authors: { orderBy: { sortOrder: 'asc' } },
        issue: { include: { volume: true } },
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });
  }

  getArticle(tenantId: string, journalId: string, articleId: string) {
    return this.prisma.journalArticle.findFirst({
      where: { id: articleId, tenantId, journalId, status: 'PUBLISHED' },
      include: {
        authors: { orderBy: { sortOrder: 'asc' } },
        issue: { include: { volume: true } },
      },
    });
  }

  async incrementView(tenantId: string, journalId: string, articleId: string) {
    const row = await this.getArticle(tenantId, journalId, articleId);
    if (!row) throw new NotFoundException('Article not found');
    return this.prisma.journalArticle.update({
      where: { id: articleId },
      data: { viewCount: { increment: 1 } },
    });
  }

  async incrementDownload(
    tenantId: string,
    journalId: string,
    articleId: string,
  ) {
    const row = await this.getArticle(tenantId, journalId, articleId);
    if (!row) throw new NotFoundException('Article not found');
    return this.prisma.journalArticle.update({
      where: { id: articleId },
      data: { downloadCount: { increment: 1 } },
    });
  }

  // —— Admin ——
  async listJournals(tenantId: string) {
    const rows = await this.prisma.journal.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
    return rows.map((journal) => this.withHomeThemeFields(journal));
  }

  private withHomeThemeFields<T extends { themeJson: unknown }>(journal: T) {
    const theme = (journal.themeJson ?? {}) as Record<string, unknown>;
    return {
      ...journal,
      homeAnnouncementsImageUrl:
        typeof theme.homeAnnouncementsImageUrl === 'string'
          ? theme.homeAnnouncementsImageUrl
          : null,
      homeAnnouncementsHeadline:
        typeof theme.homeAnnouncementsHeadline === 'string'
          ? theme.homeAnnouncementsHeadline
          : null,
      homeAnnouncementsSubtext:
        typeof theme.homeAnnouncementsSubtext === 'string'
          ? theme.homeAnnouncementsSubtext
          : null,
    };
  }

  async createJournal(
    user: JwtUser,
    dto: {
      name: string;
      shortName: string;
      slug: string;
      issn?: string;
      tagline?: string;
      description?: string;
      contactEmail?: string;
      contactPhone?: string;
      frequency?: string;
    },
  ) {
    const slug = dto.slug.trim().toLowerCase();
    if (!slug) throw new BadRequestException('Slug is required');
    const created = await this.prisma.journal.create({
      data: {
        tenantId: user.tid,
        name: dto.name.trim(),
        shortName: dto.shortName.trim(),
        slug,
        subdomain: slug,
        issn: dto.issn,
        tagline: dto.tagline,
        description: dto.description,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        frequency: dto.frequency || 'ANNUAL',
        logoUrl: '/branding/college-logo.png',
        publisher: 'Don Bosco College, Tura',
        institution: 'Don Bosco College, Tura',
      },
    });
    await this.ensureDefaultPages(user.tid, created.id);
    return created;
  }

  async updateJournal(
    user: JwtUser,
    journalId: string,
    dto: Partial<{
      name: string;
      shortName: string;
      issn: string;
      tagline: string;
      description: string;
      contactEmail: string;
      contactPhone: string;
      logoUrl: string;
      bannerUrl: string;
      frequency: string;
      status: string;
      publisher: string;
      institution: string;
      homeAnnouncementsImageUrl: string | null;
      homeAnnouncementsHeadline: string | null;
      homeAnnouncementsSubtext: string | null;
    }>,
  ) {
    const existing = await this.resolution.requireJournal(user.tid, journalId);
    const theme = {
      ...((existing.themeJson ?? {}) as Record<string, unknown>),
    };
    if (dto.homeAnnouncementsImageUrl !== undefined) {
      theme.homeAnnouncementsImageUrl = dto.homeAnnouncementsImageUrl;
    }
    if (dto.homeAnnouncementsHeadline !== undefined) {
      theme.homeAnnouncementsHeadline = dto.homeAnnouncementsHeadline;
    }
    if (dto.homeAnnouncementsSubtext !== undefined) {
      theme.homeAnnouncementsSubtext = dto.homeAnnouncementsSubtext;
    }
    const themeTouched =
      dto.homeAnnouncementsImageUrl !== undefined ||
      dto.homeAnnouncementsHeadline !== undefined ||
      dto.homeAnnouncementsSubtext !== undefined;

    return this.withHomeThemeFields(
      await this.prisma.journal.update({
        where: { id: journalId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.shortName !== undefined
            ? { shortName: dto.shortName.trim() }
            : {}),
          ...(dto.issn !== undefined ? { issn: dto.issn } : {}),
          ...(dto.tagline !== undefined ? { tagline: dto.tagline } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description }
            : {}),
          ...(dto.contactEmail !== undefined
            ? { contactEmail: dto.contactEmail }
            : {}),
          ...(dto.contactPhone !== undefined
            ? { contactPhone: dto.contactPhone }
            : {}),
          ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl } : {}),
          ...(dto.bannerUrl !== undefined ? { bannerUrl: dto.bannerUrl } : {}),
          ...(dto.frequency !== undefined ? { frequency: dto.frequency } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.publisher !== undefined ? { publisher: dto.publisher } : {}),
          ...(dto.institution !== undefined
            ? { institution: dto.institution }
            : {}),
          ...(themeTouched ? { themeJson: theme } : {}),
        },
      }),
    );
  }

  listAdminPages(tenantId: string, journalId: string) {
    return this.prisma.journalPage.findMany({
      where: { tenantId, journalId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async upsertPage(
    user: JwtUser,
    journalId: string,
    dto: {
      key: string;
      title: string;
      bodyHtml?: string;
      isPublished?: boolean;
      seoTitle?: string | null;
      seoDescription?: string | null;
      seoKeywords?: string[];
    },
  ) {
    await this.resolution.requireJournal(user.tid, journalId);
    const existing = await this.prisma.journalPage.findFirst({
      where: { journalId, key: dto.key },
    });
    const seoData = {
      ...(dto.seoTitle !== undefined ? { seoTitle: dto.seoTitle } : {}),
      ...(dto.seoDescription !== undefined
        ? { seoDescription: dto.seoDescription }
        : {}),
      ...(dto.seoKeywords !== undefined
        ? { seoKeywords: dto.seoKeywords }
        : {}),
    };
    if (existing) {
      return this.prisma.journalPage.update({
        where: { id: existing.id },
        data: {
          title: dto.title,
          bodyHtml: dto.bodyHtml,
          isPublished: dto.isPublished ?? existing.isPublished,
          ...seoData,
        },
      });
    }
    return this.prisma.journalPage.create({
      data: {
        tenantId: user.tid,
        journalId,
        key: dto.key,
        title: dto.title,
        bodyHtml: dto.bodyHtml,
        isPublished: dto.isPublished ?? true,
        seoTitle: dto.seoTitle ?? null,
        seoDescription: dto.seoDescription ?? null,
        seoKeywords: dto.seoKeywords ?? [],
      },
    });
  }

  listAdminAnnouncements(tenantId: string, journalId: string) {
    return this.prisma.journalAnnouncement.findMany({
      where: { tenantId, journalId },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createAnnouncement(
    user: JwtUser,
    journalId: string,
    dto: {
      title: string;
      bodyHtml?: string;
      isPinned?: boolean;
      isPublished?: boolean;
    },
  ) {
    await this.resolution.requireJournal(user.tid, journalId);
    return this.prisma.journalAnnouncement.create({
      data: {
        tenantId: user.tid,
        journalId,
        title: dto.title.trim(),
        bodyHtml: dto.bodyHtml,
        isPinned: dto.isPinned ?? false,
        isPublished: dto.isPublished ?? true,
        publishedAt: new Date(),
      },
    });
  }

  listAdminBoard(tenantId: string, journalId: string, boardType?: string) {
    return this.prisma.journalEditorialMember.findMany({
      where: {
        tenantId,
        journalId,
        ...(boardType ? { boardType } : {}),
      },
      orderBy: [{ boardType: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async createBoardMember(
    user: JwtUser,
    journalId: string,
    dto: {
      fullName: string;
      roleTitle: string;
      boardType?: string;
      institution?: string;
      department?: string;
      country?: string;
      email?: string;
      orcid?: string;
      bio?: string;
      researchAreas?: string;
      photoUrl?: string | null;
      sortOrder?: number;
    },
  ) {
    await this.resolution.requireJournal(user.tid, journalId);
    return this.prisma.journalEditorialMember.create({
      data: {
        tenantId: user.tid,
        journalId,
        fullName: dto.fullName.trim(),
        roleTitle: dto.roleTitle.trim(),
        boardType: dto.boardType || 'BOARD',
        institution: dto.institution,
        department: dto.department,
        country: dto.country,
        email: dto.email,
        orcid: dto.orcid,
        bio: dto.bio,
        researchAreas: dto.researchAreas,
        photoUrl: dto.photoUrl ?? null,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateBoardMember(
    user: JwtUser,
    journalId: string,
    memberId: string,
    dto: Partial<{
      fullName: string;
      roleTitle: string;
      boardType: string;
      institution: string | null;
      department: string | null;
      country: string | null;
      email: string | null;
      orcid: string | null;
      bio: string | null;
      researchAreas: string | null;
      sortOrder: number;
      isActive: boolean;
      photoUrl: string | null;
    }>,
  ) {
    await this.resolution.requireJournal(user.tid, journalId);
    const row = await this.prisma.journalEditorialMember.findFirst({
      where: { id: memberId, tenantId: user.tid, journalId },
    });
    if (!row) throw new NotFoundException('Board member not found');
    return this.prisma.journalEditorialMember.update({
      where: { id: memberId },
      data: {
        ...(dto.fullName !== undefined
          ? { fullName: dto.fullName.trim() }
          : {}),
        ...(dto.roleTitle !== undefined
          ? { roleTitle: dto.roleTitle.trim() }
          : {}),
        ...(dto.boardType !== undefined ? { boardType: dto.boardType } : {}),
        ...(dto.institution !== undefined
          ? { institution: dto.institution }
          : {}),
        ...(dto.department !== undefined ? { department: dto.department } : {}),
        ...(dto.country !== undefined ? { country: dto.country } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.orcid !== undefined ? { orcid: dto.orcid } : {}),
        ...(dto.bio !== undefined ? { bio: dto.bio } : {}),
        ...(dto.researchAreas !== undefined
          ? { researchAreas: dto.researchAreas }
          : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.photoUrl !== undefined ? { photoUrl: dto.photoUrl } : {}),
      },
    });
  }

  async deleteBoardMember(user: JwtUser, journalId: string, memberId: string) {
    await this.resolution.requireJournal(user.tid, journalId);
    const row = await this.prisma.journalEditorialMember.findFirst({
      where: { id: memberId, tenantId: user.tid, journalId },
    });
    if (!row) throw new NotFoundException('Board member not found');
    await this.prisma.journalEditorialMember.delete({
      where: { id: memberId },
    });
    return { ok: true };
  }

  listAdminVolumes(tenantId: string, journalId: string) {
    return this.prisma.journalVolume.findMany({
      where: { tenantId, journalId },
      include: {
        issues: {
          orderBy: { issueNumber: 'asc' },
          include: { _count: { select: { articles: true } } },
        },
      },
      orderBy: [{ year: 'desc' }, { volumeNumber: 'desc' }],
    });
  }

  async createVolume(
    user: JwtUser,
    journalId: string,
    dto: { volumeNumber: number; year: number; label?: string },
  ) {
    await this.resolution.requireJournal(user.tid, journalId);
    return this.prisma.journalVolume.create({
      data: {
        tenantId: user.tid,
        journalId,
        volumeNumber: dto.volumeNumber,
        year: dto.year,
        label: dto.label,
      },
    });
  }

  async createIssue(
    user: JwtUser,
    journalId: string,
    dto: {
      volumeId: string;
      issueNumber: number;
      title?: string;
      summary?: string;
      publicationDate?: string;
      isCurrent?: boolean;
      coverUrl?: string;
    },
  ) {
    await this.resolution.requireJournal(user.tid, journalId);
    const volume = await this.prisma.journalVolume.findFirst({
      where: { id: dto.volumeId, tenantId: user.tid, journalId },
    });
    if (!volume) throw new NotFoundException('Volume not found');

    if (dto.isCurrent) {
      await this.prisma.journalIssue.updateMany({
        where: { journalId, tenantId: user.tid },
        data: { isCurrent: false },
      });
    }

    return this.prisma.journalIssue.create({
      data: {
        tenantId: user.tid,
        journalId,
        volumeId: dto.volumeId,
        issueNumber: dto.issueNumber,
        title: dto.title,
        summary: dto.summary,
        coverUrl: dto.coverUrl,
        publicationDate: dto.publicationDate
          ? new Date(dto.publicationDate)
          : null,
        isCurrent: dto.isCurrent ?? false,
        isPublished: true,
      },
    });
  }

  async updateIssue(
    user: JwtUser,
    journalId: string,
    issueId: string,
    dto: Partial<{
      title: string | null;
      summary: string | null;
      coverUrl: string | null;
      publicationDate: string | null;
      isCurrent: boolean;
      isPublished: boolean;
    }>,
  ) {
    await this.resolution.requireJournal(user.tid, journalId);
    const issue = await this.prisma.journalIssue.findFirst({
      where: { id: issueId, tenantId: user.tid, journalId },
    });
    if (!issue) throw new NotFoundException('Issue not found');

    if (dto.isCurrent === true) {
      await this.prisma.journalIssue.updateMany({
        where: { journalId, tenantId: user.tid, id: { not: issueId } },
        data: { isCurrent: false },
      });
    }

    return this.prisma.journalIssue.update({
      where: { id: issueId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.summary !== undefined ? { summary: dto.summary } : {}),
        ...(dto.coverUrl !== undefined ? { coverUrl: dto.coverUrl } : {}),
        ...(dto.publicationDate !== undefined
          ? {
              publicationDate: dto.publicationDate
                ? new Date(dto.publicationDate)
                : null,
            }
          : {}),
        ...(dto.isCurrent !== undefined ? { isCurrent: dto.isCurrent } : {}),
        ...(dto.isPublished !== undefined
          ? { isPublished: dto.isPublished }
          : {}),
      },
    });
  }

  listAdminArticles(tenantId: string, journalId: string) {
    return this.prisma.journalArticle.findMany({
      where: { tenantId, journalId },
      include: {
        authors: { orderBy: { sortOrder: 'asc' } },
        issue: { include: { volume: true } },
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });
  }

  async createArticle(
    user: JwtUser,
    journalId: string,
    dto: {
      issueId: string;
      title: string;
      abstract?: string;
      keywords?: string[];
      doi?: string;
      pageRange?: string;
      pdfUrl?: string;
      htmlContent?: string;
      category?: string;
      authors?: Array<{
        fullName: string;
        affiliation?: string;
        email?: string;
        isCorresponding?: boolean;
      }>;
    },
  ) {
    await this.resolution.requireJournal(user.tid, journalId);
    const issue = await this.prisma.journalIssue.findFirst({
      where: { id: dto.issueId, tenantId: user.tid, journalId },
    });
    if (!issue) throw new NotFoundException('Issue not found');

    return this.prisma.journalArticle.create({
      data: {
        tenantId: user.tid,
        journalId,
        issueId: dto.issueId,
        title: dto.title.trim(),
        abstract: dto.abstract,
        keywords: dto.keywords ?? [],
        doi: dto.doi,
        pageRange: dto.pageRange,
        pdfUrl: dto.pdfUrl,
        htmlContent: dto.htmlContent,
        category: dto.category,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        authors: {
          create: (dto.authors ?? []).map((a, index) => ({
            tenantId: user.tid,
            fullName: a.fullName,
            affiliation: a.affiliation,
            email: a.email,
            isCorresponding: a.isCorresponding ?? index === 0,
            sortOrder: index + 1,
          })),
        },
      },
      include: { authors: true },
    });
  }
}
