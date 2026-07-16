import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { CommunicationTriggerService } from '../../communication/services/communication-trigger.service';
import { JournalAuthService } from './journal-auth.service';
import { JournalResolutionService } from './journal-resolution.service';

@Injectable()
export class JournalReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: JournalAuthService,
    private readonly resolution: JournalResolutionService,
    private readonly communication: CommunicationTriggerService,
  ) {}

  async openRound(user: JwtUser, journalId: string, submissionId: string) {
    await this.resolution.requireJournal(user.tid, journalId);
    const submission = await this.prisma.journalSubmission.findFirst({
      where: { id: submissionId, tenantId: user.tid, journalId },
    });
    if (!submission) throw new NotFoundException('Submission not found');
    if (
      !['SUBMITTED', 'RESUBMITTED', 'IN_REVIEW'].includes(submission.status)
    ) {
      throw new BadRequestException('Cannot open review for this status');
    }

    const nextRound = submission.currentRound + 1;
    const round = await this.prisma.journalReviewRound.create({
      data: {
        tenantId: user.tid,
        submissionId,
        roundNumber: nextRound,
        status: 'OPEN',
      },
    });

    await this.prisma.journalSubmission.update({
      where: { id: submissionId },
      data: { status: 'IN_REVIEW', currentRound: nextRound },
    });

    return round;
  }

  async inviteReviewer(
    user: JwtUser,
    journalId: string,
    submissionId: string,
    dto: {
      email: string;
      displayName?: string;
      dueAt?: string;
      roundId?: string;
    },
  ) {
    await this.resolution.requireJournal(user.tid, journalId);
    const submission = await this.prisma.journalSubmission.findFirst({
      where: { id: submissionId, tenantId: user.tid, journalId },
      include: { journal: true, rounds: { orderBy: { roundNumber: 'desc' } } },
    });
    if (!submission) throw new NotFoundException('Submission not found');

    let round = dto.roundId
      ? submission.rounds.find((r) => r.id === dto.roundId)
      : submission.rounds[0];
    if (!round || round.status !== 'OPEN') {
      round = await this.openRound(user, journalId, submissionId);
    }

    const { user: reviewer } = await this.auth.provisionReviewer(
      user.tid,
      dto.email,
      dto.displayName,
    );

    const inviteToken = randomBytes(24).toString('hex');
    const assignment = await this.prisma.journalReviewAssignment.create({
      data: {
        tenantId: user.tid,
        roundId: round.id,
        reviewerUserId: reviewer.id,
        invitedByUserId: user.sub,
        status: 'INVITED',
        inviteToken,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
      },
    });

    if (submission.status !== 'IN_REVIEW') {
      await this.prisma.journalSubmission.update({
        where: { id: submissionId },
        data: { status: 'IN_REVIEW' },
      });
    }

    const hostHint =
      submission.journal.subdomain || submission.journal.slug || 'transient';
    const publicBase = (
      process.env.JOURNALS_PUBLIC_URL ||
      process.env.NEXT_PUBLIC_JOURNALS_URL ||
      `https://${hostHint}.donboscocollege.ac.in`
    ).replace(/\/$/, '');
    const invitePath = `${publicBase}/reviewer/assignments/${assignment.id}?token=${inviteToken}`;

    try {
      await this.communication.trigger({
        tenantId: user.tid,
        templateCode: 'JOURNAL_REVIEWER_INVITE',
        triggerKey: `journal-review-invite:${assignment.id}`,
        entityType: 'journal_review_assignment',
        entityId: assignment.id,
        recipient: {
          recipientType: 'USER',
          email: dto.email.trim().toLowerCase(),
          displayName: dto.displayName || reviewer.displayName || dto.email,
          userId: reviewer.id,
        },
        variables: {
          authorName: dto.displayName || reviewer.displayName || dto.email,
          journalName: submission.journal.name,
          submissionTitle: submission.title,
          invitePath,
          portalHint: hostHint,
          hostHint,
        },
        channels: ['EMAIL'],
        skipDedupe: true,
      });
    } catch {
      console.warn(
        `[journal-reviewer-invite] to=${dto.email} path=${invitePath} token=${inviteToken}`,
      );
    }

    return assignment;
  }

  listMyAssignments(user: JwtUser, journalId: string) {
    return this.prisma.journalReviewAssignment.findMany({
      where: {
        tenantId: user.tid,
        reviewerUserId: user.sub,
        round: { submission: { journalId } },
      },
      include: {
        report: true,
        round: {
          include: {
            submission: {
              include: {
                files: {
                  where: { kind: { in: ['MANUSCRIPT', 'REVISION'] } },
                  orderBy: { version: 'desc' },
                  take: 3,
                },
                journal: {
                  select: { name: true, shortName: true, slug: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAssignment(user: JwtUser, journalId: string, assignmentId: string) {
    const row = await this.prisma.journalReviewAssignment.findFirst({
      where: {
        id: assignmentId,
        tenantId: user.tid,
        round: { submission: { journalId } },
      },
      include: {
        report: true,
        round: {
          include: {
            submission: {
              include: {
                coAuthors: true,
                files: { orderBy: [{ kind: 'asc' }, { version: 'desc' }] },
                journal: true,
              },
            },
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Assignment not found');
    const isEditor = (user.permissions ?? []).includes('journals:manage');
    if (row.reviewerUserId !== user.sub && !isEditor) {
      throw new ForbiddenException('Not your assignment');
    }
    return row;
  }

  async respondInvite(
    user: JwtUser,
    journalId: string,
    assignmentId: string,
    accept: boolean,
    token?: string,
    coi?: { conflictOfInterest?: boolean; conflictOfInterestNotes?: string },
  ) {
    const row = await this.getAssignment(user, journalId, assignmentId);
    if (token && row.inviteToken !== token) {
      throw new BadRequestException('Invalid invite token');
    }
    if (row.status !== 'INVITED') {
      throw new BadRequestException('Invite already responded');
    }
    if (accept) {
      if (typeof coi?.conflictOfInterest !== 'boolean') {
        throw new BadRequestException(
          'Conflict of interest declaration is required to accept',
        );
      }
      if (
        coi.conflictOfInterest &&
        !(coi.conflictOfInterestNotes || '').trim()
      ) {
        throw new BadRequestException(
          'Please describe the conflict of interest',
        );
      }
    }
    return this.prisma.journalReviewAssignment.update({
      where: { id: assignmentId },
      data: {
        status: accept ? 'ACCEPTED' : 'DECLINED',
        respondedAt: new Date(),
        ...(accept
          ? {
              conflictOfInterest: coi!.conflictOfInterest,
              conflictOfInterestNotes: coi!.conflictOfInterest
                ? (coi!.conflictOfInterestNotes || '').trim()
                : null,
            }
          : {}),
      },
    });
  }

  async submitReport(
    user: JwtUser,
    journalId: string,
    assignmentId: string,
    dto: {
      recommendation: string;
      commentsToEditor?: string;
      commentsToAuthor?: string;
      confidentialNotes?: string;
    },
  ) {
    const row = await this.getAssignment(user, journalId, assignmentId);
    if (row.reviewerUserId !== user.sub) {
      throw new ForbiddenException('Not your assignment');
    }
    if (!['ACCEPTED', 'INVITED'].includes(row.status)) {
      throw new BadRequestException('Cannot submit report in current status');
    }
    if (row.report) throw new BadRequestException('Report already submitted');

    const allowed = ['ACCEPT', 'MINOR_REVISION', 'MAJOR_REVISION', 'REJECT'];
    if (!allowed.includes(dto.recommendation)) {
      throw new BadRequestException('Invalid recommendation');
    }

    const report = await this.prisma.journalReviewReport.create({
      data: {
        tenantId: user.tid,
        assignmentId,
        recommendation: dto.recommendation,
        commentsToEditor: dto.commentsToEditor,
        commentsToAuthor: dto.commentsToAuthor,
        confidentialNotes: dto.confidentialNotes,
      },
    });

    await this.prisma.journalReviewAssignment.update({
      where: { id: assignmentId },
      data: { status: 'COMPLETED', respondedAt: new Date() },
    });

    return report;
  }
}
