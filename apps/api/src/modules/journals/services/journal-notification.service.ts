import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CommunicationTriggerService } from '../../communication/services/communication-trigger.service';
import type { ResolvedRecipient } from '../../communication/services/communication-audience.service';

type SubmissionLike = {
  id: string;
  title: string;
  status: string;
  correspondingEmail?: string | null;
  submittedByUserId: string;
  journalId: string;
  coAuthors?: Array<{
    fullName: string;
    email?: string | null;
    isCorresponding: boolean;
  }>;
};

@Injectable()
export class JournalNotificationService {
  private readonly logger = new Logger(JournalNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly triggers: CommunicationTriggerService,
  ) {}

  private async resolveContext(tenantId: string, submission: SubmissionLike) {
    const journal = await this.prisma.journal.findFirst({
      where: { id: submission.journalId, tenantId },
      select: {
        name: true,
        slug: true,
        subdomain: true,
        contactEmail: true,
      },
    });
    const submitter = await this.prisma.user.findFirst({
      where: { id: submission.submittedByUserId, tenantId },
      select: { email: true, displayName: true },
    });
    const corresponding =
      submission.coAuthors?.find((a) => a.isCorresponding) ??
      submission.coAuthors?.[0];
    const authorEmail =
      submission.correspondingEmail?.trim() ||
      corresponding?.email?.trim() ||
      submitter?.email ||
      null;
    const authorName =
      corresponding?.fullName ||
      submitter?.displayName ||
      authorEmail ||
      'Author';
    const portalHint = `/journals-portal/author?journal=${journal?.slug || 'transient'}`;
    const institutionName = await this.triggers.getInstitutionName(tenantId);
    return {
      journal,
      authorEmail,
      authorName,
      portalHint,
      institutionName,
    };
  }

  private async fire(
    tenantId: string,
    templateCode: string,
    triggerKey: string,
    entityId: string,
    recipient: ResolvedRecipient,
    variables: Record<string, string>,
    options?: { skipDedupe?: boolean },
  ) {
    if (!recipient.email) return;
    try {
      await this.triggers.trigger({
        tenantId,
        templateCode,
        triggerKey,
        entityType: 'journal_submission',
        entityId,
        recipient,
        variables,
        channels: ['EMAIL'],
        skipDedupe: options?.skipDedupe ?? true,
      });
    } catch (err) {
      this.logger.warn(
        `Journal notify ${templateCode} failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async submissionReceived(tenantId: string, submission: SubmissionLike) {
    const ctx = await this.resolveContext(tenantId, submission);
    if (!ctx.authorEmail) return;
    await this.fire(
      tenantId,
      'JOURNAL_SUBMISSION_RECEIVED',
      `journal-submit:${submission.id}:${submission.status}`,
      submission.id,
      {
        recipientType: 'USER',
        email: ctx.authorEmail,
        displayName: ctx.authorName,
        userId: submission.submittedByUserId,
      },
      {
        authorName: ctx.authorName,
        journalName: ctx.journal?.name ?? 'Journal',
        submissionTitle: submission.title,
        status: submission.status,
        portalHint: ctx.portalHint,
        institution_name: ctx.institutionName,
      },
    );

    if (ctx.journal?.contactEmail) {
      await this.fire(
        tenantId,
        'JOURNAL_SUBMISSION_TO_EDITOR',
        `journal-submit-editor:${submission.id}:${submission.status}`,
        submission.id,
        {
          recipientType: 'USER',
          email: ctx.journal.contactEmail,
          displayName: `${ctx.journal.name} Editorial`,
        },
        {
          authorName: ctx.authorName,
          journalName: ctx.journal.name,
          submissionTitle: submission.title,
          status: submission.status,
          portalHint: `/admin/journals?journal=${ctx.journal.slug}`,
          institution_name: ctx.institutionName,
        },
      );
    }
  }

  async decision(
    tenantId: string,
    submission: SubmissionLike,
    decision: string,
  ) {
    const ctx = await this.resolveContext(tenantId, submission);
    if (!ctx.authorEmail) return;
    await this.fire(
      tenantId,
      'JOURNAL_DECISION',
      `journal-decision:${submission.id}:${decision}`,
      submission.id,
      {
        recipientType: 'USER',
        email: ctx.authorEmail,
        displayName: ctx.authorName,
        userId: submission.submittedByUserId,
      },
      {
        authorName: ctx.authorName,
        journalName: ctx.journal?.name ?? 'Journal',
        submissionTitle: submission.title,
        decision,
        portalHint: ctx.portalHint,
        institution_name: ctx.institutionName,
      },
    );
  }

  async proofReady(tenantId: string, submission: SubmissionLike) {
    const ctx = await this.resolveContext(tenantId, submission);
    if (!ctx.authorEmail) return;
    await this.fire(
      tenantId,
      'JOURNAL_PROOF_READY',
      `journal-proof:${submission.id}`,
      submission.id,
      {
        recipientType: 'USER',
        email: ctx.authorEmail,
        displayName: ctx.authorName,
        userId: submission.submittedByUserId,
      },
      {
        authorName: ctx.authorName,
        journalName: ctx.journal?.name ?? 'Journal',
        submissionTitle: submission.title,
        portalHint: `/journals-portal/author/submissions/${submission.id}`,
        institution_name: ctx.institutionName,
      },
    );
  }

  async published(
    tenantId: string,
    submission: SubmissionLike,
    articleTitle: string,
  ) {
    const ctx = await this.resolveContext(tenantId, submission);
    if (!ctx.authorEmail) return;
    await this.fire(
      tenantId,
      'JOURNAL_PUBLISHED',
      `journal-published:${submission.id}`,
      submission.id,
      {
        recipientType: 'USER',
        email: ctx.authorEmail,
        displayName: ctx.authorName,
        userId: submission.submittedByUserId,
      },
      {
        authorName: ctx.authorName,
        journalName: ctx.journal?.name ?? 'Journal',
        articleTitle,
        submissionTitle: submission.title,
        portalHint: ctx.portalHint,
        institution_name: ctx.institutionName,
      },
    );
  }
}
