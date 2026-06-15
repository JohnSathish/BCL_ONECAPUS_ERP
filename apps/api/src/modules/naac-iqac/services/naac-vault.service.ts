import {
  BadRequestException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { StorageService } from '../../../shared/storage/storage.service';
import type { VaultUploadDto } from '../dto/naac-iqac.dto';
import { paginate } from '../constants/naac.constants';
import { naacDb } from './naac-prisma.util';
import { NaacEvidenceService } from './naac-evidence.service';

@Injectable()
export class NaacVaultService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly evidence: NaacEvidenceService,
  ) {}

  private db() {
    return naacDb(this.prisma);
  }

  async list(tenantId: string, page?: number, limit?: number) {
    const { skip, take, page: p, limit: l } = paginate(page, limit);
    const [items, total] = await Promise.all([
      this.db().naacVaultDocument.findMany({
        where: { tenantId },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { evidenceTags: true },
      }),
      this.db().naacVaultDocument.count({ where: { tenantId } }),
    ]);
    return { items, total, page: p, limit: l };
  }

  async upload(user: JwtUser, dto: VaultUploadDto, file?: Express.Multer.File) {
    if (!file?.buffer?.length)
      throw new BadRequestException('File is required');

    const storageKey = `naac/${user.tid}/vault/${Date.now()}-${file.originalname}`;
    await this.storage.put(storageKey, file.buffer, {
      contentType: file.mimetype,
    });

    const doc = await this.db().naacVaultDocument.create({
      data: {
        tenantId: user.tid,
        storageKey,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        uploadedById: user.sub,
      },
    });

    await this.evidence.create(user, {
      sourceType: 'naac_vault',
      sourceId: doc.id,
      criterion: dto.criterion,
      academicYear: dto.academicYear,
      metricCode: dto.metricCode,
      departmentId: dto.departmentId,
      committeeId: dto.committeeId,
      programmeId: dto.programmeId,
      activityTitle: dto.activityTitle,
      eventTitle: dto.eventTitle,
      evidenceNotes: dto.evidenceNotes,
      fileName: file.originalname,
      storageKey,
      vaultDocumentId: doc.id,
    });

    return doc;
  }

  async download(tenantId: string, id: string) {
    const doc = await this.db().naacVaultDocument.findFirst({
      where: { id, tenantId },
    });
    if (!doc) throw new NotFoundException('Vault document not found');

    const buffer = await this.storage.get(doc.storageKey);
    if (!buffer) throw new NotFoundException('File not found in storage');
    return new StreamableFile(buffer, {
      type: doc.mimeType ?? 'application/octet-stream',
      disposition: `attachment; filename="${doc.fileName}"`,
    });
  }
}
