import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { StorageService } from '../../../shared/storage/storage.service';
import { paginate } from '../constants/governance.constants';
import type {
  DocumentListQueryDto,
  UploadDocumentDto,
} from '../dto/governance.dto';
import { governanceDb } from './governance-prisma.util';

@Injectable()
export class GovernanceDocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private db() {
    return governanceDb(this.prisma);
  }

  async list(tenantId: string, query: DocumentListQueryDto) {
    const { skip, take, page, limit } = paginate(query.page, query.limit);
    const where: Record<string, unknown> = { tenantId };
    if (query.committeeId) where.committeeId = query.committeeId;
    if (query.category) where.category = query.category;
    if (query.folderPath) where.folderPath = query.folderPath;
    if (query.q) {
      where.title = { contains: query.q, mode: 'insensitive' };
    }

    const [items, total] = await Promise.all([
      this.db().governanceDocument.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { committee: { select: { name: true, shortCode: true } } },
      }),
      this.db().governanceDocument.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getById(tenantId: string, id: string) {
    const row = await this.db().governanceDocument.findFirst({
      where: { id, tenantId },
      include: { committee: { select: { name: true, shortCode: true } } },
    });
    if (!row) throw new NotFoundException('Document not found');
    return row;
  }

  async upload(
    user: JwtUser,
    dto: UploadDocumentDto,
    file?: Express.Multer.File,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('File is required');
    }

    const folderPath = dto.folderPath ?? `/${dto.category.toLowerCase()}`;
    const storageKey = `governance/${user.tid}/${dto.committeeId ?? 'general'}/${Date.now()}-${file.originalname}`;

    await this.storage.put(storageKey, file.buffer, {
      contentType: file.mimetype,
    });

    return this.db().governanceDocument.create({
      data: {
        tenantId: user.tid,
        committeeId: dto.committeeId,
        folderPath,
        title: dto.title.trim(),
        category: dto.category,
        storageKey,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        academicYear: dto.academicYear,
        uploadedById: user.sub,
      },
    });
  }

  async download(tenantId: string, id: string) {
    const doc = await this.getById(tenantId, id);
    const buffer = await this.storage.get(doc.storageKey);
    if (!buffer) throw new NotFoundException('File not found in storage');
    return {
      buffer,
      fileName: doc.fileName,
      mimeType: doc.mimeType ?? 'application/octet-stream',
    };
  }

  async remove(user: JwtUser, id: string) {
    await this.getById(user.tid, id);
    return this.db().governanceDocument.delete({ where: { id } });
  }
}
