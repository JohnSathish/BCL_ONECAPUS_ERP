import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import type { QuestionPaperApprovalDto } from '../dto/question-bank.dto';

@Injectable()
export class QuestionPaperWorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  private hasPermission(user: JwtUser, slug: string) {
    return user.permissions?.includes(slug) ?? false;
  }

  private defaultApprovalSteps(tenantId: string) {
    return [
      {
        tenantId,
        stepCode: 'DEPARTMENT_REVIEW',
        stepName: 'Department Review',
        roleSlug: 'hod',
        sequence: 1,
      },
      {
        tenantId,
        stepCode: 'EXAM_CELL_VERIFY',
        stepName: 'Exam Cell Verification',
        roleSlug: 'academic-admin',
        sequence: 2,
      },
    ];
  }

  async submit(user: JwtUser, paperId: string) {
    const paper = await this.prisma.questionPaper.findFirst({
      where: { id: paperId, tenantId: user.tid, deletedAt: null },
    });
    if (!paper) throw new NotFoundException('Paper not found');
    if (!['DRAFT', 'REJECTED'].includes(paper.status)) {
      throw new BadRequestException(
        'Only draft or rejected papers can be submitted',
      );
    }
    const isOwner = paper.uploadedById === user.sub;
    if (!isOwner && !this.hasPermission(user, 'question-bank:manage')) {
      throw new ForbiddenException('You can only submit your own papers');
    }
    if (!paper.filePath)
      throw new BadRequestException('Upload a file before submitting');

    await this.prisma.questionPaperApproval.deleteMany({
      where: { tenantId: user.tid, paperId },
    });

    const updated = await this.prisma.questionPaper.update({
      where: { id: paperId },
      data: {
        status: 'PENDING_REVIEW',
        approvals: { create: this.defaultApprovalSteps(user.tid) },
      },
      include: { approvals: { orderBy: { sequence: 'asc' } } },
    });

    await this.audit(user, 'paper.submitted', paperId, { after: updated });
    return updated;
  }

  async actOnApproval(
    user: JwtUser,
    approvalId: string,
    dto: QuestionPaperApprovalDto,
  ) {
    const approval = await this.prisma.questionPaperApproval.findFirst({
      where: { tenantId: user.tid, id: approvalId },
      include: { paper: true },
    });
    if (!approval) throw new NotFoundException('Approval step not found');
    if (approval.status !== 'PENDING')
      throw new BadRequestException('This approval step is already completed');
    if (!approval.paper || approval.paper.deletedAt)
      throw new NotFoundException('Paper not found');

    const steps = await this.prisma.questionPaperApproval.findMany({
      where: { tenantId: user.tid, paperId: approval.paperId },
      orderBy: { sequence: 'asc' },
    });
    const currentStep = steps.find((step) => step.status === 'PENDING');
    if (!currentStep || currentStep.id !== approvalId) {
      throw new BadRequestException(
        'Previous workflow steps must be completed first',
      );
    }

    const roleMatch = user.roles?.includes(approval.roleSlug ?? '') ?? false;
    const canApprove =
      this.hasPermission(user, 'question-bank:manage') ||
      (this.hasPermission(user, 'question-bank:approve') && roleMatch) ||
      (this.hasPermission(user, 'question-bank:publish') &&
        approval.roleSlug === 'academic-admin' &&
        roleMatch);
    if (!canApprove) {
      throw new ForbiddenException(
        `This step requires the ${approval.roleSlug} role`,
      );
    }

    const status = dto.action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const updatedApproval = await this.prisma.questionPaperApproval.update({
      where: { id: approvalId },
      data: {
        status,
        comments: dto.comments,
        approverId: user.sub,
        actedAt: new Date(),
      },
    });

    if (status === 'REJECTED') {
      await this.prisma.questionPaper.update({
        where: { id: approval.paperId },
        data: { status: 'REJECTED' },
      });
      await this.audit(user, 'approval.rejected', approval.paperId, {
        after: updatedApproval,
      });
      return updatedApproval;
    }

    const remaining = await this.prisma.questionPaperApproval.count({
      where: {
        tenantId: user.tid,
        paperId: approval.paperId,
        status: 'PENDING',
      },
    });

    if (remaining === 0) {
      await this.prisma.questionPaper.update({
        where: { id: approval.paperId },
        data: {
          status: 'PUBLISHED',
          publishedById: user.sub,
          publishedAt: new Date(),
        },
      });
      await this.audit(user, 'paper.published', approval.paperId, {
        after: updatedApproval,
      });
    } else {
      await this.prisma.questionPaper.update({
        where: { id: approval.paperId },
        data: { status: 'PENDING_REVIEW' },
      });
      await this.audit(user, 'approval.approved', approval.paperId, {
        after: updatedApproval,
      });
    }

    return updatedApproval;
  }

  async publish(user: JwtUser, paperId: string) {
    const canPublish =
      this.hasPermission(user, 'question-bank:publish') ||
      this.hasPermission(user, 'question-bank:manage');
    if (!canPublish)
      throw new ForbiddenException('Missing question-bank:publish permission');

    const paper = await this.prisma.questionPaper.findFirst({
      where: { id: paperId, tenantId: user.tid, deletedAt: null },
      include: { approvals: true },
    });
    if (!paper) throw new NotFoundException('Paper not found');
    if (
      !['APPROVED', 'PENDING_REVIEW'].includes(paper.status) &&
      !this.hasPermission(user, 'question-bank:manage')
    ) {
      throw new BadRequestException('Paper must be approved before publishing');
    }

    const pending = paper.approvals.filter((a) => a.status === 'PENDING');
    if (pending.length && !this.hasPermission(user, 'question-bank:manage')) {
      throw new BadRequestException(
        'All approval steps must be completed before publishing',
      );
    }

    const updated = await this.prisma.questionPaper.update({
      where: { id: paperId },
      data: {
        status: 'PUBLISHED',
        publishedById: user.sub,
        publishedAt: new Date(),
      },
    });

    await this.audit(user, 'paper.published', paperId, { after: updated });
    return updated;
  }

  listPendingApprovals(tenantId: string, roleSlug?: string) {
    return this.prisma.questionPaperApproval.findMany({
      where: {
        tenantId,
        status: 'PENDING',
        ...(roleSlug ? { roleSlug } : {}),
      },
      include: {
        paper: {
          select: {
            id: true,
            paperCode: true,
            paperName: true,
            status: true,
            uploadedById: true,
            examYear: true,
            paperType: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
  }

  private audit(
    user: JwtUser,
    action: string,
    paperId: string,
    input: Record<string, unknown> = {},
  ) {
    return this.prisma.questionBankAuditLog.create({
      data: {
        tenantId: user.tid,
        paperId,
        actorId: user.sub,
        action,
        before: input.before as object | undefined,
        after: input.after as object | undefined,
        metadata: input.metadata as object | undefined,
      },
    });
  }
}
