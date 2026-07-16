import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { JournalAuthService } from './journal-auth.service';
import { JournalNotificationService } from './journal-notification.service';
import { JournalResolutionService } from './journal-resolution.service';

const SUBMISSION_INCLUDE = {
  coAuthors: { orderBy: { sortOrder: 'asc' as const } },
  files: { orderBy: [{ kind: 'asc' as const }, { version: 'desc' as const }] },
  rounds: {
    orderBy: { roundNumber: 'desc' as const },
    include: {
      assignments: {
        include: { report: true },
        orderBy: { createdAt: 'desc' as const },
      },
    },
  },
  decisions: { orderBy: { createdAt: 'desc' as const } },
};

@Injectable()
export class JournalSubmissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: JournalAuthService,
    private readonly resolution: JournalResolutionService,
    private readonly notifications: JournalNotificationService,
  ) {}

  async createDraft(
    user: JwtUser,
    journalId: string,
    dto: {
      title: string;
      abstract?: string;
      keywords?: string[];
      correspondingEmail?: string;
      coverLetter?: string;
      coAuthors?: Array<{
        fullName: string;
        email?: string;
        affiliation?: string;
        orcid?: string;
        isCorresponding?: boolean;
      }>;
    },
  ) {
    await this.resolution.requireJournal(user.tid, journalId);
    await this.auth.ensureAuthorAccess(user.tid, user.sub);

    return this.prisma.journalSubmission.create({
      data: {
        tenantId: user.tid,
        journalId,
        submittedByUserId: user.sub,
        title: dto.title.trim(),
        abstract: dto.abstract,
        keywords: dto.keywords ?? [],
        correspondingEmail: dto.correspondingEmail,
        coverLetter: dto.coverLetter,
        status: 'DRAFT',
        coAuthors: {
          create: (dto.coAuthors ?? []).map((a, i) => ({
            tenantId: user.tid,
            fullName: a.fullName,
            email: a.email,
            affiliation: a.affiliation,
            orcid: a.orcid,
            isCorresponding: a.isCorresponding ?? i === 0,
            sortOrder: i + 1,
          })),
        },
      },
      include: SUBMISSION_INCLUDE,
    });
  }

  async updateDraft(
    user: JwtUser,
    journalId: string,
    submissionId: string,
    dto: {
      title?: string;
      abstract?: string;
      keywords?: string[];
      correspondingEmail?: string;
      coverLetter?: string;
      coAuthors?: Array<{
        fullName: string;
        email?: string;
        affiliation?: string;
        orcid?: string;
        isCorresponding?: boolean;
      }>;
    },
  ) {
    const submission = await this.requireOwned(user, journalId, submissionId);
    if (!['DRAFT', 'REVISION_REQUIRED'].includes(submission.status)) {
      throw new BadRequestException(
        'Only draft/revision submissions can be edited',
      );
    }

    if (dto.coAuthors) {
      await this.prisma.journalSubmissionCoAuthor.deleteMany({
        where: { submissionId },
      });
    }

    return this.prisma.journalSubmission.update({
      where: { id: submissionId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.abstract !== undefined ? { abstract: dto.abstract } : {}),
        ...(dto.keywords !== undefined ? { keywords: dto.keywords } : {}),
        ...(dto.correspondingEmail !== undefined
          ? { correspondingEmail: dto.correspondingEmail }
          : {}),
        ...(dto.coverLetter !== undefined
          ? { coverLetter: dto.coverLetter }
          : {}),
        ...(dto.coAuthors
          ? {
              coAuthors: {
                create: dto.coAuthors.map((a, i) => ({
                  tenantId: user.tid,
                  fullName: a.fullName,
                  email: a.email,
                  affiliation: a.affiliation,
                  orcid: a.orcid,
                  isCorresponding: a.isCorresponding ?? i === 0,
                  sortOrder: i + 1,
                })),
              },
            }
          : {}),
      },
      include: SUBMISSION_INCLUDE,
    });
  }

  async submit(user: JwtUser, journalId: string, submissionId: string) {
    const submission = await this.requireOwned(
      user,
      journalId,
      submissionId,
      true,
    );
    if (!['DRAFT', 'REVISION_REQUIRED'].includes(submission.status)) {
      throw new BadRequestException(
        'Submission cannot be submitted in current status',
      );
    }
    const hasMs = submission.files.some(
      (f) => f.kind === 'MANUSCRIPT' || f.kind === 'REVISION',
    );
    if (!hasMs) {
      throw new BadRequestException(
        'Upload a manuscript PDF before submitting',
      );
    }

    const nextStatus =
      submission.status === 'REVISION_REQUIRED' ? 'RESUBMITTED' : 'SUBMITTED';

    const updated = await this.prisma.journalSubmission.update({
      where: { id: submissionId },
      data: {
        status: nextStatus,
        submittedAt: new Date(),
      },
      include: SUBMISSION_INCLUDE,
    });

    void this.notifications.submissionReceived(user.tid, updated);

    return updated;
  }

  async withdraw(user: JwtUser, journalId: string, submissionId: string) {
    await this.requireOwned(user, journalId, submissionId);
    return this.prisma.journalSubmission.update({
      where: { id: submissionId },
      data: { status: 'WITHDRAWN' },
      include: SUBMISSION_INCLUDE,
    });
  }

  listMine(user: JwtUser, journalId: string) {
    return this.prisma.journalSubmission.findMany({
      where: {
        tenantId: user.tid,
        journalId,
        submittedByUserId: user.sub,
      },
      include: SUBMISSION_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getMine(user: JwtUser, journalId: string, submissionId: string) {
    return this.requireOwned(user, journalId, submissionId, true);
  }

  listAdmin(tenantId: string, journalId: string, status?: string) {
    return this.prisma.journalSubmission.findMany({
      where: {
        tenantId,
        journalId,
        ...(status ? { status } : {}),
      },
      include: SUBMISSION_INCLUDE,
      orderBy: [{ submittedAt: 'desc' }, { updatedAt: 'desc' }],
      take: 200,
    });
  }

  async getAdmin(tenantId: string, journalId: string, submissionId: string) {
    const row = await this.prisma.journalSubmission.findFirst({
      where: { id: submissionId, tenantId, journalId },
      include: SUBMISSION_INCLUDE,
    });
    if (!row) throw new NotFoundException('Submission not found');
    return row;
  }

  private async requireOwned(
    user: JwtUser,
    journalId: string,
    submissionId: string,
    _withInclude = false,
  ) {
    await this.resolution.requireJournal(user.tid, journalId);
    const row = await this.prisma.journalSubmission.findFirst({
      where: { id: submissionId, tenantId: user.tid, journalId },
      include: SUBMISSION_INCLUDE,
    });
    if (!row) throw new NotFoundException('Submission not found');
    const isEditor = (user.permissions ?? []).includes('journals:manage');
    if (row.submittedByUserId !== user.sub && !isEditor) {
      throw new ForbiddenException('Not your submission');
    }
    return row;
  }
}
