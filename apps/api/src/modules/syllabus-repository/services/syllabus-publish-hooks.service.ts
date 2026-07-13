import { Injectable, Logger, Optional } from '@nestjs/common';
import { readFile } from 'fs/promises';
import { PrismaService } from '../../../database/prisma.service';
import { QueueService } from '../../../shared/queue/queue.service';
import { SyllabusAssetsService } from './syllabus-assets.service';

@Injectable()
export class SyllabusPublishHooksService {
  private readonly logger = new Logger(SyllabusPublishHooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: SyllabusAssetsService,
    @Optional() private readonly queue?: QueueService,
  ) {}

  async ingestToKnowledgeBase(documentId: string) {
    const doc = await this.prisma.syllabusDocument.findFirst({
      where: { id: documentId, deletedAt: null },
    });
    if (!doc?.filePath) return { skipped: true, reason: 'No file attached' };

    const absPath = this.assets.resolveAbsolutePath(doc.tenantId, doc.filePath);
    const buffer = await readFile(absPath);
    const pdfParse = (await import('pdf-parse')).default as (
      buf: Buffer,
    ) => Promise<{ text?: string; numpages?: number }>;
    const parsed = await pdfParse(buffer);
    const text = parsed.text ?? '';
    if (text.length < 80) {
      return { skipped: true, reason: 'No readable PDF text extracted' };
    }

    const title = `${doc.paperCode} - ${doc.paperTitle}`;
    await this.prisma.knowledgeDocument.updateMany({
      where: {
        tenantId: doc.tenantId,
        title,
        sourceType: 'SYLLABUS',
        status: 'ACTIVE',
      },
      data: { status: 'ARCHIVED' },
    });

    const knowledgeDocument = await this.prisma.knowledgeDocument.create({
      data: {
        tenantId: doc.tenantId,
        title,
        sourceType: 'SYLLABUS',
        version:
          doc.versionLabel ??
          doc.curriculumVersion ??
          String(doc.currentVersionNo),
        fileName: doc.fileName ?? 'syllabus.pdf',
        pageCount: parsed.numpages ?? null,
        status: 'ACTIVE',
        publishedAt: new Date(),
      },
    });

    const chunks = this.chunkTextWithPages(text, parsed.numpages ?? 1).slice(
      0,
      160,
    );
    for (const chunk of chunks) {
      await this.prisma.knowledgeChunk.create({
        data: {
          tenantId: doc.tenantId,
          documentId: knowledgeDocument.id,
          pageNo: chunk.pageNo,
          heading: chunk.heading,
          content: chunk.content,
        },
      });
    }

    await this.prisma.syllabusDocument.update({
      where: { id: doc.id },
      data: { knowledgeDocumentId: knowledgeDocument.id },
    });

    return {
      knowledgeDocumentId: knowledgeDocument.id,
      chunks: chunks.length,
    };
  }

  async notifyStudents(documentId: string) {
    try {
      const doc = await this.prisma.syllabusDocument.findFirst({
        where: { id: documentId, deletedAt: null },
      });
      if (!doc) return { skipped: true, reason: 'Document not found' };

      const lines = await this.prisma.semesterRegistrationLine.findMany({
        where: {
          tenantId: doc.tenantId,
          status: { notIn: ['dropped', 'cancelled', 'rejected'] },
          offering: { courseId: doc.courseId, deletedAt: null },
          registration: { archivedAt: null },
        },
        select: {
          registration: {
            select: {
              student: { select: { id: true, userId: true } },
            },
          },
        },
        take: 1000,
      });
      const userIds = [
        ...new Set(
          lines.map((line) => line.registration.student.userId).filter(Boolean),
        ),
      ];
      if (!userIds.length) return { notified: 0 };

      const title = 'New syllabus published';
      const body = `${doc.paperCode} - ${doc.paperTitle} is now available.`;
      const metadata = {
        entityType: 'syllabus_document',
        entityId: doc.id,
        paperCode: doc.paperCode,
      };

      if (this.queue) {
        await this.queue.enqueueNotification({
          channel: 'in_app',
          tenantId: doc.tenantId,
          type: 'SYLLABUS_PUBLISHED',
          title,
          body,
          userIds,
          metadata,
        });
        return { notified: userIds.length, queued: true };
      }

      await this.prisma.userNotification.createMany({
        data: userIds.map((userId) => ({
          tenantId: doc.tenantId,
          userId,
          type: 'SYLLABUS_PUBLISHED',
          title,
          body,
          link: `/student/syllabus/${doc.id}`,
          metadata,
        })),
        skipDuplicates: true,
      });
      return { notified: userIds.length, queued: false };
    } catch (err) {
      this.logger.warn(
        `Syllabus notification hook skipped: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return { skipped: true };
    }
  }

  private chunkTextWithPages(text: string, pageCount: number) {
    const pages = text.split(/\f/g);
    const usePages = pages.length > 1 ? pages : [text];
    const chunks: Array<{
      heading: string | null;
      content: string;
      pageNo: number | null;
    }> = [];

    usePages.forEach((pageText, pageIdx) => {
      const pageNo =
        pages.length > 1 ? pageIdx + 1 : Math.min(pageIdx + 1, pageCount);
      const parts = pageText
        .split(/\n{2,}/)
        .map((part) => part.replace(/\s+/g, ' ').trim())
        .filter((part) => part.length > 30);
      let buffer = '';
      let heading: string | null = null;
      for (const part of parts) {
        if (part.length < 100 && /^[A-Z0-9][A-Z0-9 \-/&:]{4,}$/.test(part)) {
          heading = part;
          continue;
        }
        if (`${buffer} ${part}`.length > 1100) {
          if (buffer) chunks.push({ heading, content: buffer.trim(), pageNo });
          buffer = part;
        } else {
          buffer = `${buffer} ${part}`.trim();
        }
      }
      if (buffer) chunks.push({ heading, content: buffer.trim(), pageNo });
    });

    return chunks;
  }
}
