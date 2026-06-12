import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class LibraryQuestionBankBridgeService {
  constructor(private readonly prisma: PrismaService) {}

  async syncPublishedPaper(user: JwtUser, paperId: string) {
    const paper = await this.prisma.questionPaper.findFirst({
      where: {
        tenantId: user.tid,
        id: paperId,
        status: 'PUBLISHED',
        deletedAt: null,
      },
    });
    if (!paper)
      throw new NotFoundException('Published question paper not found');
    if (!paper.filePath) throw new NotFoundException('Paper has no file');

    const existing = await this.prisma.libraryDigitalAsset.findFirst({
      where: {
        tenantId: user.tid,
        sourceType: 'QUESTION_BANK',
        sourceId: paperId,
        deletedAt: null,
      },
    });

    const data = {
      title: paper.paperName,
      author: paper.paperCode,
      description: `${paper.paperType} · ${paper.examYear ?? ''}`.trim(),
      assetType: 'QUESTION_PAPER',
      departmentId: paper.departmentId,
      filePath: paper.filePath,
      fileName: paper.fileName,
      mimeType: paper.mimeType,
      fileSizeBytes: paper.fileSizeBytes,
      sourceType: 'QUESTION_BANK',
      sourceId: paperId,
      visibility: 'STUDENT',
      status: 'PUBLISHED',
      publishedAt: paper.publishedAt ?? new Date(),
      publishedById: user.sub,
      searchText: [
        paper.paperCode,
        paper.paperName,
        paper.paperType,
        paper.examYear,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    };

    if (existing) {
      return this.prisma.libraryDigitalAsset.update({
        where: { id: existing.id },
        data,
      });
    }

    return this.prisma.libraryDigitalAsset.create({
      data: {
        id: randomUUID(),
        tenantId: user.tid,
        uploadedById: user.sub,
        ...data,
      },
    });
  }

  async listLinked(tenantId: string) {
    return this.prisma.libraryDigitalAsset.findMany({
      where: { tenantId, sourceType: 'QUESTION_BANK', deletedAt: null },
      orderBy: { publishedAt: 'desc' },
    });
  }

  async syncAllPublished(user: JwtUser) {
    const papers = await this.prisma.questionPaper.findMany({
      where: {
        tenantId: user.tid,
        status: 'PUBLISHED',
        deletedAt: null,
        filePath: { not: null },
      },
      select: { id: true },
    });
    const results = [];
    for (const p of papers) {
      results.push(await this.syncPublishedPaper(user, p.id));
    }
    return { synced: results.length, items: results };
  }
}
