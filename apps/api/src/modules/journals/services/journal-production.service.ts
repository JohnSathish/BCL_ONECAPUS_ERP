import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { isSuperAdmin } from '../../../common/permissions/permission-registry';
import { PrismaService } from '../../../database/prisma.service';
import { JournalNotificationService } from './journal-notification.service';
import { JournalResolutionService } from './journal-resolution.service';

const NEXT: Record<string, string> = {
  ACCEPTED: 'COPYEDITING',
  COPYEDITING: 'PROOFING',
  PROOFING: 'READY_TO_PUBLISH',
};

const ALLOWED_JUMP = new Set([
  'ACCEPTED',
  'COPYEDITING',
  'PROOFING',
  'READY_TO_PUBLISH',
]);

@Injectable()
export class JournalProductionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolution: JournalResolutionService,
    private readonly notifications: JournalNotificationService,
  ) {}

  listProductionQueue(tenantId: string, journalId: string) {
    return this.prisma.journalSubmission.findMany({
      where: {
        tenantId,
        journalId,
        status: {
          in: ['ACCEPTED', 'COPYEDITING', 'PROOFING', 'READY_TO_PUBLISH'],
        },
      },
      include: {
        files: {
          where: {
            kind: { in: ['GALLEY', 'PROOF', 'MANUSCRIPT', 'REVISION'] },
          },
          orderBy: [{ kind: 'asc' }, { version: 'desc' }],
        },
        coAuthors: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
  }

  async advance(
    user: JwtUser,
    journalId: string,
    submissionId: string,
    dto?: { targetStatus?: string; notes?: string; skipToReady?: boolean },
  ) {
    await this.resolution.requireJournal(user.tid, journalId);
    const submission = await this.prisma.journalSubmission.findFirst({
      where: { id: submissionId, tenantId: user.tid, journalId },
    });
    if (!submission) throw new NotFoundException('Submission not found');

    let next: string;
    if (dto?.skipToReady && submission.status === 'ACCEPTED') {
      next = 'READY_TO_PUBLISH';
    } else if (dto?.targetStatus) {
      if (!ALLOWED_JUMP.has(dto.targetStatus)) {
        throw new BadRequestException('Invalid target status');
      }
      next = dto.targetStatus;
    } else {
      next = NEXT[submission.status];
      if (!next) {
        throw new BadRequestException(
          `Cannot advance from status ${submission.status}`,
        );
      }
    }

    const updated = await this.prisma.journalSubmission.update({
      where: { id: submissionId },
      data: {
        status: next,
        productionNotes: dto?.notes ?? submission.productionNotes,
        ...(next === 'PROOFING'
          ? { proofApprovedAt: null, proofApprovedByUserId: null }
          : {}),
      },
      include: {
        files: true,
        coAuthors: true,
      },
    });

    if (next === 'PROOFING') {
      void this.notifications.proofReady(user.tid, updated);
    }

    return updated;
  }

  async sendToProduction(
    user: JwtUser,
    journalId: string,
    submissionId: string,
  ) {
    await this.resolution.requireJournal(user.tid, journalId);
    const submission = await this.prisma.journalSubmission.findFirst({
      where: { id: submissionId, tenantId: user.tid, journalId },
    });
    if (!submission) throw new NotFoundException('Submission not found');
    if (submission.status !== 'ACCEPTED') {
      throw new BadRequestException(
        'Only ACCEPTED submissions enter production',
      );
    }
    return this.advance(user, journalId, submissionId, {
      targetStatus: 'COPYEDITING',
    });
  }

  async approveProof(user: JwtUser, journalId: string, submissionId: string) {
    await this.resolution.requireJournal(user.tid, journalId);
    const submission = await this.prisma.journalSubmission.findFirst({
      where: { id: submissionId, tenantId: user.tid, journalId },
    });
    if (!submission) throw new NotFoundException('Submission not found');
    if (submission.submittedByUserId !== user.sub) {
      const isEditor =
        isSuperAdmin(user.roles ?? []) ||
        (user.permissions ?? []).includes('journals:manage');
      if (!isEditor) throw new ForbiddenException('Not your submission');
    }
    if (submission.status !== 'PROOFING') {
      throw new BadRequestException('Proof approval only in PROOFING status');
    }

    return this.prisma.journalSubmission.update({
      where: { id: submissionId },
      data: {
        proofApprovedAt: new Date(),
        proofApprovedByUserId: user.sub,
        status: 'READY_TO_PUBLISH',
      },
    });
  }
}
