import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { JournalNotificationService } from './journal-notification.service';
import { JournalResolutionService } from './journal-resolution.service';
import { JournalReviewService } from './journal-review.service';

@Injectable()
export class JournalEditorialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolution: JournalResolutionService,
    private readonly reviews: JournalReviewService,
    private readonly notifications: JournalNotificationService,
  ) {}

  async decide(
    user: JwtUser,
    journalId: string,
    submissionId: string,
    dto: {
      decision: string;
      notesHtml?: string;
      roundId?: string;
    },
  ) {
    await this.resolution.requireJournal(user.tid, journalId);
    const submission = await this.prisma.journalSubmission.findFirst({
      where: { id: submissionId, tenantId: user.tid, journalId },
    });
    if (!submission) throw new NotFoundException('Submission not found');

    const allowed = ['ACCEPT', 'REJECT', 'REVISE', 'SEND_TO_REVIEW'];
    if (!allowed.includes(dto.decision)) {
      throw new BadRequestException('Invalid decision');
    }

    const decision = await this.prisma.journalEditorialDecision.create({
      data: {
        tenantId: user.tid,
        submissionId,
        roundId: dto.roundId,
        decision: dto.decision,
        notesHtml: dto.notesHtml,
        decidedByUserId: user.sub,
      },
    });

    if (dto.decision === 'SEND_TO_REVIEW') {
      await this.reviews.openRound(user, journalId, submissionId);
      return decision;
    }

    let status = submission.status;
    if (dto.decision === 'ACCEPT') status = 'ACCEPTED';
    if (dto.decision === 'REJECT') status = 'REJECTED';
    if (dto.decision === 'REVISE') status = 'REVISION_REQUIRED';

    if (dto.roundId) {
      await this.prisma.journalReviewRound.updateMany({
        where: { id: dto.roundId, tenantId: user.tid },
        data: { status: 'CLOSED' },
      });
    }

    await this.prisma.journalSubmission.update({
      where: { id: submissionId },
      data: { status },
    });

    if (['ACCEPT', 'REJECT', 'REVISE'].includes(dto.decision)) {
      void this.notifications.decision(
        user.tid,
        { ...submission, status },
        dto.decision,
      );
    }

    return decision;
  }

  async publishToIssue(
    user: JwtUser,
    journalId: string,
    submissionId: string,
    dto: {
      issueId: string;
      pageRange?: string;
      doi?: string;
      category?: string;
    },
  ) {
    await this.resolution.requireJournal(user.tid, journalId);
    const submission = await this.prisma.journalSubmission.findFirst({
      where: { id: submissionId, tenantId: user.tid, journalId },
      include: {
        coAuthors: { orderBy: { sortOrder: 'asc' } },
        files: {
          where: {
            kind: { in: ['MANUSCRIPT', 'REVISION', 'GALLEY', 'PROOF'] },
          },
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });
    if (!submission) throw new NotFoundException('Submission not found');
    if (submission.status !== 'READY_TO_PUBLISH') {
      throw new BadRequestException(
        'Only READY_TO_PUBLISH submissions can be published to an issue',
      );
    }
    if (submission.publishedArticleId) {
      throw new BadRequestException('Already published to catalog');
    }

    const issue = await this.prisma.journalIssue.findFirst({
      where: { id: dto.issueId, tenantId: user.tid, journalId },
    });
    if (!issue) throw new NotFoundException('Issue not found');

    const pdfKey = submission.files[0]?.storageKey;
    const article = await this.prisma.journalArticle.create({
      data: {
        tenantId: user.tid,
        journalId,
        issueId: dto.issueId,
        title: submission.title,
        abstract: submission.abstract,
        keywords: submission.keywords,
        doi: dto.doi,
        pageRange: dto.pageRange,
        pdfUrl: pdfKey ? `/uploads/${pdfKey}` : null,
        category: dto.category || 'Research Article',
        status: 'PUBLISHED',
        publishedAt: new Date(),
        authors: {
          create: submission.coAuthors.map((a) => ({
            tenantId: user.tid,
            fullName: a.fullName,
            affiliation: a.affiliation,
            email: a.email,
            orcid: a.orcid,
            isCorresponding: a.isCorresponding,
            sortOrder: a.sortOrder,
          })),
        },
      },
      include: { authors: true },
    });

    await this.prisma.journalSubmission.update({
      where: { id: submissionId },
      data: { publishedArticleId: article.id },
    });

    void this.notifications.published(user.tid, submission, article.title);

    return article;
  }
}
