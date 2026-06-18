import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';

const APPROVAL_CHAIN = [
  'PENDING_HOD',
  'PENDING_PRINCIPAL',
  'APPROVED',
] as const;

@Injectable()
export class CommunicationApprovalService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, status?: string) {
    return this.prisma.communicationApproval.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async submit(user: JwtUser, campaignId: string) {
    const campaign = await this.prisma.communicationCampaign.findFirst({
      where: { id: campaignId, tenantId: user.tid },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    await this.prisma.communicationCampaign.update({
      where: { id: campaignId },
      data: { requiresApproval: true, approvalStatus: 'PENDING_HOD' },
    });

    return this.prisma.communicationApproval.create({
      data: {
        tenantId: user.tid,
        campaignId,
        status: 'PENDING_HOD',
        submittedById: user.sub,
        currentApproverRole: 'HOD',
        history: [
          {
            action: 'SUBMITTED',
            by: user.sub,
            at: new Date().toISOString(),
          },
        ],
      },
    });
  }

  async approve(user: JwtUser, approvalId: string, note?: string) {
    const approval = await this.prisma.communicationApproval.findFirst({
      where: { id: approvalId, tenantId: user.tid },
    });
    if (!approval) throw new NotFoundException('Approval not found');

    const idx = APPROVAL_CHAIN.indexOf(
      approval.status as (typeof APPROVAL_CHAIN)[number],
    );
    if (idx < 0 || idx >= APPROVAL_CHAIN.length - 1) {
      throw new BadRequestException('Approval cannot be advanced');
    }

    const nextStatus = APPROVAL_CHAIN[idx + 1];
    const history = [
      ...((approval.history as object[]) ?? []),
      {
        action: 'APPROVED',
        by: user.sub,
        at: new Date().toISOString(),
        note,
        from: approval.status,
        to: nextStatus,
      },
    ];

    await this.prisma.communicationApproval.update({
      where: { id: approvalId },
      data: {
        status: nextStatus,
        currentApproverRole:
          nextStatus === 'PENDING_PRINCIPAL' ? 'PRINCIPAL' : null,
        history,
      },
    });

    await this.prisma.communicationCampaign.update({
      where: { id: approval.campaignId },
      data: { approvalStatus: nextStatus },
    });

    return { approvalId, status: nextStatus };
  }

  async reject(user: JwtUser, approvalId: string, note?: string) {
    const approval = await this.prisma.communicationApproval.findFirst({
      where: { id: approvalId, tenantId: user.tid },
    });
    if (!approval) throw new NotFoundException('Approval not found');

    const history = [
      ...((approval.history as object[]) ?? []),
      {
        action: 'REJECTED',
        by: user.sub,
        at: new Date().toISOString(),
        note,
      },
    ];

    await this.prisma.communicationApproval.update({
      where: { id: approvalId },
      data: { status: 'REJECTED', history },
    });

    await this.prisma.communicationCampaign.update({
      where: { id: approval.campaignId },
      data: { approvalStatus: 'REJECTED' },
    });

    return { approvalId, status: 'REJECTED' };
  }
}
