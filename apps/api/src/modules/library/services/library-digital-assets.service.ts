import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import type {
  CreateDigitalAssetDto,
  DigitalAssetQueryDto,
  UpdateDigitalAssetDto,
} from '../dto/library.dto';
import {
  DEFAULT_LIBRARY_MIME_TYPES,
  LibraryAssetsService,
} from './library-assets.service';
import { LibrarySettingsService } from './library-settings.service';

@Injectable()
export class LibraryDigitalAssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: LibraryAssetsService,
    private readonly settings: LibrarySettingsService,
  ) {}

  private buildSearchText(input: {
    title: string;
    author?: string;
    assetType?: string;
    keywords?: string[];
  }) {
    return [
      input.title,
      input.author,
      input.assetType,
      ...(input.keywords ?? []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  private async assertStudentAccess(user: JwtUser) {
    if (!this.isStudentOnly(user)) return;
    const limits = await this.uploadLimits(user.tid);
    if (limits.studentDigitalAccessEnabled === false) {
      throw new ForbiddenException(
        'The digital library is closed to students.',
      );
    }
  }

  private async uploadLimits(tenantId: string) {
    const s = await this.settings.getSettings(tenantId);
    const allowed = Array.isArray(s.allowedMimeTypes)
      ? (s.allowedMimeTypes as string[])
      : DEFAULT_LIBRARY_MIME_TYPES;
    return {
      maxUploadMb: s.maxUploadMb,
      allowedMimeTypes: allowed,
      studentDigitalAccessEnabled: s.studentDigitalAccessEnabled,
    };
  }

  private isStudentOnly(user: JwtUser) {
    return (
      user.roles?.includes('student') &&
      !user.permissions?.includes('library:manage')
    );
  }

  async summary(tenantId: string) {
    const [counts, departments, years] = await Promise.all([
      this.prisma.$queryRaw<
        {
          total: number;
          ebooks: number;
          papers: number;
          research: number;
          other: number;
        }[]
      >`
        SELECT COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE asset_type = 'EBOOK')::int AS ebooks,
          COUNT(*) FILTER (WHERE asset_type = 'QUESTION_PAPER')::int AS papers,
          COUNT(*) FILTER (WHERE asset_type = 'RESEARCH_PAPER')::int AS research,
          COUNT(*) FILTER (
            WHERE asset_type NOT IN ('EBOOK', 'QUESTION_PAPER', 'RESEARCH_PAPER')
          )::int AS other
        FROM library.library_digital_assets
        WHERE tenant_id = CAST(${tenantId} AS uuid) AND deleted_at IS NULL
      `,
      this.prisma.department.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.$queryRaw<{ year: number }[]>`
        SELECT DISTINCT EXTRACT(YEAR FROM created_at)::int AS year
        FROM library.library_digital_assets
        WHERE tenant_id = CAST(${tenantId} AS uuid) AND deleted_at IS NULL
        ORDER BY year DESC
      `,
    ]);
    const row = counts[0] ?? {
      total: 0,
      ebooks: 0,
      papers: 0,
      research: 0,
      other: 0,
    };
    const share = (value: number) =>
      row.total ? Math.round((value / row.total) * 1000) / 10 : 0;
    return {
      ...row,
      shares: {
        ebooks: share(row.ebooks),
        papers: share(row.papers),
        research: share(row.research),
        other: share(row.other),
      },
      departments,
      years: years
        .map((item) => Number(item.year))
        .filter((year) => Number.isFinite(year)),
    };
  }

  async list(user: JwtUser, query: DigitalAssetQueryDto) {
    await this.assertStudentAccess(user);
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;
    const search = query.search?.trim();

    const where = {
      tenantId: user.tid,
      deletedAt: null,
      ...(query.assetType ? { assetType: query.assetType } : {}),
      ...(query.bucket === 'OTHER'
        ? {
            assetType: { notIn: ['EBOOK', 'QUESTION_PAPER', 'RESEARCH_PAPER'] },
          }
        : query.bucket
          ? { assetType: query.bucket }
          : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.year && /^\d{4}$/.test(query.year)
        ? {
            createdAt: {
              gte: new Date(Number(query.year), 0, 1),
              lt: new Date(Number(query.year) + 1, 0, 1),
            },
          }
        : {}),
      ...(this.isStudentOnly(user)
        ? { status: 'PUBLISHED', visibility: { in: ['STUDENT', 'PUBLIC'] } }
        : query.status
          ? { status: query.status }
          : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' as const } },
              { author: { contains: search, mode: 'insensitive' as const } },
              {
                searchText: { contains: search, mode: 'insensitive' as const },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.libraryDigitalAsset.findMany({
        where,
        include: { category: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.libraryDigitalAsset.count({ where }),
    ]);

    const departmentIds = items.map((item) => item.departmentId);
    const names = await this.departmentNames(user.tid, departmentIds);
    return {
      items: items.map((item) => ({
        ...item,
        departmentName: names.get(item.departmentId ?? '') ?? null,
        addedYear: item.createdAt.getFullYear(),
      })),
      total,
      page,
      limit,
      from: total ? skip + 1 : 0,
      to: Math.min(skip + items.length, total),
    };
  }

  private async departmentNames(tenantId: string, ids: Array<string | null>) {
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (!unique.length) return new Map<string, string>();
    const rows = await this.prisma.department.findMany({
      where: { tenantId, id: { in: unique } },
      select: { id: true, name: true },
    });
    return new Map(rows.map((row) => [row.id, row.name]));
  }

  async getById(user: JwtUser, id: string) {
    await this.assertStudentAccess(user);
    const row = await this.prisma.libraryDigitalAsset.findFirst({
      where: { tenantId: user.tid, id, deletedAt: null },
      include: { category: true },
    });
    if (!row) throw new NotFoundException('Digital asset not found');
    if (this.isStudentOnly(user) && row.status !== 'PUBLISHED') {
      throw new ForbiddenException('Asset not published');
    }
    return row;
  }

  async create(
    user: JwtUser,
    dto: CreateDigitalAssetDto,
    file?: Express.Multer.File,
  ) {
    const limits = await this.uploadLimits(user.tid);
    const id = randomUUID();
    let fileMeta: {
      filePath?: string;
      fileName?: string;
      mimeType?: string;
      fileSizeBytes?: number;
    } = {};

    if (file) {
      const saved = await this.assets.saveFile(user.tid, file, {
        segment: 'digital-assets',
        assetId: id,
        ...limits,
      });
      fileMeta = saved;
    } else if (!dto.externalUrl?.trim()) {
      throw new BadRequestException('File or external URL required');
    }

    return this.prisma.libraryDigitalAsset.create({
      data: {
        id,
        tenantId: user.tid,
        title: dto.title.trim(),
        author: dto.author?.trim(),
        description: dto.description?.trim(),
        assetType: dto.assetType.trim().toUpperCase(),
        categoryId: dto.categoryId,
        departmentId: dto.departmentId,
        isbn: dto.isbn?.trim(),
        doi: dto.doi?.trim(),
        externalUrl: dto.externalUrl?.trim(),
        visibility: dto.visibility ?? 'STUDENT',
        status: 'DRAFT',
        uploadedById: user.sub,
        searchText: this.buildSearchText({
          title: dto.title,
          author: dto.author,
          assetType: dto.assetType,
        }),
        ...fileMeta,
      },
      include: { category: true },
    });
  }

  async update(
    user: JwtUser,
    id: string,
    dto: UpdateDigitalAssetDto,
    file?: Express.Multer.File,
  ) {
    await this.getById(user, id);
    const limits = await this.uploadLimits(user.tid);
    let fileMeta: Record<string, unknown> = {};

    if (file) {
      const saved = await this.assets.saveFile(user.tid, file, {
        segment: 'digital-assets',
        assetId: id,
        ...limits,
      });
      fileMeta = saved;
    }

    return this.prisma.libraryDigitalAsset.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        author: dto.author?.trim(),
        description: dto.description?.trim(),
        assetType: dto.assetType?.trim().toUpperCase(),
        categoryId: dto.categoryId,
        departmentId: dto.departmentId,
        status: dto.status,
        visibility: dto.visibility,
        externalUrl: dto.externalUrl?.trim(),
        searchText: dto.title
          ? this.buildSearchText({
              title: dto.title,
              author: dto.author,
              assetType: dto.assetType,
            })
          : undefined,
        ...fileMeta,
      },
      include: { category: true },
    });
  }

  async publish(user: JwtUser, id: string) {
    const row = await this.getById(user, id);
    if (!row.filePath && !row.externalUrl) {
      throw new BadRequestException('Cannot publish without file or URL');
    }
    return this.prisma.libraryDigitalAsset.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        publishedById: user.sub,
      },
    });
  }

  async archive(user: JwtUser, id: string) {
    await this.getById(user, id);
    return this.prisma.libraryDigitalAsset.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'ARCHIVED' },
    });
  }

  async logAccess(
    tenantId: string,
    assetId: string,
    userId: string | undefined,
    action: string,
    ip?: string,
  ) {
    await this.prisma.libraryDigitalAccessLog.create({
      data: {
        id: randomUUID(),
        tenantId,
        assetId,
        userId,
        action,
        ipAddress: ip,
      },
    });
    if (action === 'DOWNLOAD') {
      await this.prisma.libraryDigitalAsset.update({
        where: { id: assetId },
        data: { downloadCount: { increment: 1 } },
      });
    } else if (action === 'VIEW') {
      await this.prisma.libraryDigitalAsset.update({
        where: { id: assetId },
        data: { viewCount: { increment: 1 } },
      });
    }
  }

  async openDownload(user: JwtUser, id: string, ip?: string) {
    const row = await this.getById(user, id);
    if (!row.filePath) {
      if (row.externalUrl)
        throw new BadRequestException(
          'External URL asset — open link in browser',
        );
      throw new NotFoundException('No file attached');
    }
    await this.logAccess(user.tid, id, user.sub, 'DOWNLOAD', ip);
    if (row.sourceType === 'QUESTION_BANK') {
      return this.assets.openStreamByPath(
        user.tid,
        row.filePath,
        row.fileName ?? undefined,
      );
    }
    return this.assets.openDownloadStream(
      user.tid,
      row.filePath,
      'digital-assets',
      row.fileName ?? undefined,
    );
  }

  async openPreview(user: JwtUser, id: string, ip?: string) {
    const row = await this.getById(user, id);
    if (!row.filePath || row.mimeType !== 'application/pdf') {
      throw new BadRequestException('Preview available for PDF files only');
    }
    await this.logAccess(user.tid, id, user.sub, 'VIEW', ip);
    if (row.sourceType === 'QUESTION_BANK') {
      return this.assets.openStreamByPath(
        user.tid,
        row.filePath,
        row.fileName ?? undefined,
      );
    }
    return this.assets.openDownloadStream(
      user.tid,
      row.filePath,
      'digital-assets',
      row.fileName ?? undefined,
    );
  }

  async popular(tenantId: string, limit = 10) {
    return this.prisma.libraryDigitalAsset.findMany({
      where: { tenantId, status: 'PUBLISHED', deletedAt: null },
      orderBy: { downloadCount: 'desc' },
      take: limit,
      include: { category: true },
    });
  }
}
