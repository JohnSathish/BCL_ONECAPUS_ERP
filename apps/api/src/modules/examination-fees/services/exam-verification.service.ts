import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { EXAM_APPLICATION_STATUSES } from '../constants/exam-fee.constants';
import type { VerifyExamApplicationDto } from '../dto/examination-fees.dto';
import { ExamApplicationService } from './exam-application.service';

@Injectable()
export class ExamVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly applications: ExamApplicationService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  listPending(tenantId: string, sessionId?: string) {
    return this.db().examApplication.findMany({
      where: {
        tenantId,
        status: {
          in: [
            EXAM_APPLICATION_STATUSES.UNDER_VERIFICATION,
            EXAM_APPLICATION_STATUSES.PAID,
            EXAM_APPLICATION_STATUSES.MANUAL_PAID,
          ],
        },
        ...(sessionId ? { sessionId } : {}),
      },
      include: {
        currentSubjects: true,
        backPapers: true,
        receipts: { take: 1, orderBy: { issuedAt: 'desc' } },
      },
      orderBy: { paidAt: 'asc' },
    });
  }

  async verify(
    user: JwtUser,
    applicationId: string,
    dto: VerifyExamApplicationDto,
  ) {
    const app = await this.applications.get(user.tid, applicationId);
    const paidStatuses = [
      EXAM_APPLICATION_STATUSES.UNDER_VERIFICATION,
      EXAM_APPLICATION_STATUSES.PAID,
      EXAM_APPLICATION_STATUSES.MANUAL_PAID,
      EXAM_APPLICATION_STATUSES.CORRECTION_REQUESTED,
    ];
    if (!paidStatuses.includes(app.status) && dto.action === 'APPROVE') {
      throw new BadRequestException('Only paid applications can be approved.');
    }

    const toStatus =
      dto.action === 'APPROVE'
        ? EXAM_APPLICATION_STATUSES.APPROVED
        : dto.action === 'REJECT'
          ? EXAM_APPLICATION_STATUSES.REJECTED
          : EXAM_APPLICATION_STATUSES.CORRECTION_REQUESTED;

    await this.db().examApplication.update({
      where: { id: applicationId },
      data: {
        status: toStatus,
        remarks: dto.remarks ?? app.remarks,
        ...(dto.action === 'APPROVE'
          ? { verifiedAt: new Date(), verifiedById: user.sub }
          : {}),
      },
    });

    await this.db().examApplicationStatusHistory.create({
      data: {
        tenantId: user.tid,
        applicationId,
        fromStatus: app.status,
        toStatus,
        action: dto.action,
        remarks: dto.remarks ?? null,
        actorUserId: user.sub,
      },
    });

    return this.applications.get(user.tid, applicationId);
  }
}
