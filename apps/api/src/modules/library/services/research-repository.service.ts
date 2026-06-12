import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import type {
  CreateResearchItemDto,
  ResearchApprovalDto,
  ResearchItemQueryDto,
  UpdateResearchItemDto,
} from '../dto/library.dto';
import {
  DEFAULT_LIBRARY_MIME_TYPES,
  LibraryAssetsService,
} from './library-assets.service';
import { LibrarySettingsService } from './library-settings.service';

@Injectable()
export class ResearchRepositoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: LibraryAssetsService,
    private readonly settings: LibrarySettingsService,
  ) {}

  private buildSearchText(input: {
    title: string;
    abstract?: string;
    itemType?: string;
    keywords?: string[];
  }) {
    return [
      input.title,
      input.abstract,
      input.itemType,
      ...(input.keywords ?? []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  private async uploadLimits(tenantId: string) {
    const s = await this.settings.getSettings(tenantId);
    const allowed = Array.isArray(s.allowedMimeTypes)
      ? (s.allowedMimeTypes as string[])
      : DEFAULT_LIBRARY_MIME_TYPES;
    return { maxUploadMb: s.maxUploadMb, allowedMimeTypes: allowed };
  }

  async list(user: JwtUser, query: ResearchItemQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;
    const search = query.search?.trim();
    const isFacultySubmit =
      user.roles?.includes('faculty') &&
      !user.permissions?.includes('library:research:manage');

    const where = {
      tenantId: user.tid,
      deletedAt: null,
      ...(query.itemType ? { itemType: query.itemType } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(isFacultySubmit && query.status !== 'PENDING_REVIEW'
        ? { OR: [{ submittedById: user.sub }, { status: 'PUBLISHED' }] }
        : query.status
          ? { status: query.status }
          : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' as const } },
              { abstract: { contains: search, mode: 'insensitive' as const } },
              {
                searchText: { contains: search, mode: 'insensitive' as const },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.researchRepositoryItem.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.researchRepositoryItem.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getById(user: JwtUser, id: string) {
    const row = await this.prisma.researchRepositoryItem.findFirst({
      where: { tenantId: user.tid, id, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Research item not found');
    return row;
  }

  async create(
    user: JwtUser,
    dto: CreateResearchItemDto,
    file?: Express.Multer.File,
  ) {
    const limits = await this.uploadLimits(user.tid);
    const id = randomUUID();
    let fileMeta: Record<string, unknown> = {};

    if (file) {
      fileMeta = await this.assets.saveFile(user.tid, file, {
        segment: 'research',
        assetId: id,
        ...limits,
      });
    }

    return this.prisma.researchRepositoryItem.create({
      data: {
        id,
        tenantId: user.tid,
        title: dto.title.trim(),
        abstract: dto.abstract?.trim(),
        itemType: dto.itemType.trim().toUpperCase(),
        departmentId: dto.departmentId,
        publicationYear: dto.publicationYear,
        journalName: dto.journalName?.trim(),
        doi: dto.doi?.trim(),
        staffAuthorId: dto.staffAuthorId,
        studentAuthorId: dto.studentAuthorId,
        supervisorStaffId: dto.supervisorStaffId,
        externalUrl: dto.externalUrl?.trim(),
        submittedById: user.sub,
        status: 'DRAFT',
        searchText: this.buildSearchText({
          title: dto.title,
          abstract: dto.abstract,
          itemType: dto.itemType,
        }),
        ...fileMeta,
      },
    });
  }

  async update(
    user: JwtUser,
    id: string,
    dto: UpdateResearchItemDto,
    file?: Express.Multer.File,
  ) {
    const row = await this.getById(user, id);
    if (!['DRAFT', 'REJECTED'].includes(row.status)) {
      throw new BadRequestException('Only draft/rejected items can be edited');
    }
    const limits = await this.uploadLimits(user.tid);
    let fileMeta: Record<string, unknown> = {};
    if (file) {
      fileMeta = await this.assets.saveFile(user.tid, file, {
        segment: 'research',
        assetId: id,
        ...limits,
      });
    }

    return this.prisma.researchRepositoryItem.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        abstract: dto.abstract?.trim(),
        itemType: dto.itemType?.trim().toUpperCase(),
        departmentId: dto.departmentId,
        publicationYear: dto.publicationYear,
        journalName: dto.journalName?.trim(),
        doi: dto.doi?.trim(),
        externalUrl: dto.externalUrl?.trim(),
        searchText: dto.title
          ? this.buildSearchText({
              title: dto.title,
              abstract: dto.abstract,
              itemType: dto.itemType,
            })
          : undefined,
        ...fileMeta,
      },
    });
  }

  async submit(user: JwtUser, id: string) {
    const row = await this.getById(user, id);
    if (row.status !== 'DRAFT' && row.status !== 'REJECTED') {
      throw new BadRequestException('Item already submitted');
    }
    if (!row.filePath && !row.externalUrl) {
      throw new BadRequestException(
        'Upload a file or provide external URL before submit',
      );
    }
    return this.prisma.researchRepositoryItem.update({
      where: { id },
      data: { status: 'PENDING_REVIEW', submittedById: user.sub },
    });
  }

  async review(user: JwtUser, id: string, dto: ResearchApprovalDto) {
    const row = await this.getById(user, id);
    if (row.status !== 'PENDING_REVIEW') {
      throw new BadRequestException('Item is not pending review');
    }
    if (dto.action === 'APPROVE') {
      return this.prisma.researchRepositoryItem.update({
        where: { id },
        data: {
          status: 'PUBLISHED',
          approvedById: user.sub,
          approvedAt: new Date(),
          publishedAt: new Date(),
        },
      });
    }
    return this.prisma.researchRepositoryItem.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approvedById: user.sub,
        approvedAt: new Date(),
      },
    });
  }

  async logAccess(
    tenantId: string,
    itemId: string,
    userId: string | undefined,
    action: string,
    ip?: string,
  ) {
    await this.prisma.researchRepositoryAccessLog.create({
      data: {
        id: randomUUID(),
        tenantId,
        itemId,
        userId,
        action,
        ipAddress: ip,
      },
    });
    if (action === 'DOWNLOAD') {
      await this.prisma.researchRepositoryItem.update({
        where: { id: itemId },
        data: { downloadCount: { increment: 1 } },
      });
    } else if (action === 'VIEW') {
      await this.prisma.researchRepositoryItem.update({
        where: { id: itemId },
        data: { viewCount: { increment: 1 } },
      });
    }
  }

  async openDownload(user: JwtUser, id: string, ip?: string) {
    const row = await this.getById(user, id);
    if (row.status !== 'PUBLISHED')
      throw new BadRequestException('Item not published');
    if (!row.filePath) throw new NotFoundException('No file attached');
    await this.logAccess(user.tid, id, user.sub, 'DOWNLOAD', ip);
    return this.assets.openDownloadStream(
      user.tid,
      row.filePath,
      'research',
      row.fileName ?? undefined,
    );
  }

  async pendingReview(tenantId: string) {
    return this.prisma.researchRepositoryItem.findMany({
      where: { tenantId, status: 'PENDING_REVIEW', deletedAt: null },
      orderBy: { updatedAt: 'asc' },
    });
  }

  async popular(tenantId: string, limit = 10) {
    return this.prisma.researchRepositoryItem.findMany({
      where: { tenantId, status: 'PUBLISHED', deletedAt: null },
      orderBy: { downloadCount: 'desc' },
      take: limit,
    });
  }
}
