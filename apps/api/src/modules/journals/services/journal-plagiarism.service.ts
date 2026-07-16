import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { JournalFilesService } from './journal-files.service';
import { JournalResolutionService } from './journal-resolution.service';

/** Stub interface for a future external plagiarism provider. */
export interface PlagiarismProvider {
  submit?(buffer: Buffer, fileName: string): Promise<{ externalId: string }>;
}

@Injectable()
export class JournalPlagiarismService {
  private readonly provider: PlagiarismProvider | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly resolution: JournalResolutionService,
    private readonly files: JournalFilesService,
  ) {}

  async setScoreAndReport(
    user: JwtUser,
    journalId: string,
    submissionId: string,
    score: number,
    file?: Express.Multer.File,
  ) {
    await this.resolution.requireJournal(user.tid, journalId);
    if (score < 0 || score > 100) {
      throw new BadRequestException('Similarity score must be 0–100');
    }
    const submission = await this.prisma.journalSubmission.findFirst({
      where: { id: submissionId, tenantId: user.tid, journalId },
    });
    if (!submission) throw new NotFoundException('Submission not found');

    let reportFileId = submission.similarityReportFileId;
    if (file) {
      const uploaded = await this.files.uploadSubmissionFile(
        user,
        journalId,
        submissionId,
        file,
        'SIMILARITY_REPORT',
      );
      reportFileId = uploaded.id;
      // Optional future hook
      void this.provider?.submit?.(file.buffer, file.originalname);
    }

    return this.prisma.journalSubmission.update({
      where: { id: submissionId },
      data: {
        similarityScore: score,
        similarityReportFileId: reportFileId,
      },
      include: { files: true },
    });
  }

  async getIntegrity(
    tenantId: string,
    journalId: string,
    submissionId: string,
  ) {
    const submission = await this.prisma.journalSubmission.findFirst({
      where: { id: submissionId, tenantId, journalId },
      select: {
        id: true,
        similarityScore: true,
        similarityReportFileId: true,
        files: {
          where: { kind: 'SIMILARITY_REPORT' },
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });
    if (!submission) throw new NotFoundException('Submission not found');
    return submission;
  }
}
