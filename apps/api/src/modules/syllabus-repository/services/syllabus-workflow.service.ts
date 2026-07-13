import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import type { SyllabusApprovalDto } from '../dto/syllabus-repository.dto';
import { SyllabusPublishHooksService } from './syllabus-publish-hooks.service';

@Injectable()
export class SyllabusWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hooks: SyllabusPublishHooksService,
  ) {}

  private hasPermission(user: JwtUser, slug: string) {
    if (user.permissions?.includes(slug)) return true;
    // Academic admins can operate the syllabus repository before dedicated
    // syllabus-repository:* grants are seeded on every role.
    if (user.permissions?.includes('academic:manage')) {
      return [
        'syllabus-repository:manage',
        'syllabus-repository:publish',
        'syllabus-repository:approve',
        'syllabus-repository:contribute',
        'syllabus-repository:read',
        'syllabus-repository:download',
      ].includes(slug);
    }
    return false;
  }

  private defaultApprovalSteps(tenantId: string) {
    return [
      {
        tenantId,
        stepCode: 'HOD_REVIEW',
        stepName: 'HOD Review',
        roleSlug: 'hod',
        sequence: 1,
      },
      {
        tenantId,
        stepCode: 'ACADEMIC_ADMIN_REVIEW',
        stepName: 'Academic Admin Review',
        roleSlug: 'academic-admin',
        sequence: 2,
      },
    ];
  }

  async submit(user: JwtUser, documentId: string) {
    const doc = await this.prisma.syllabusDocument.findFirst({
      where: { id: documentId, tenantId: user.tid, deletedAt: null },
    });
    if (!doc) throw new NotFoundException('Syllabus document not found');
    if (!['DRAFT', 'REJECTED'].includes(doc.status)) {
      throw new BadRequestException(
        'Only draft or rejected syllabi can be submitted',
      );
    }
    const isOwner = doc.uploadedById === user.sub;
    if (!isOwner && !this.hasPermission(user, 'syllabus-repository:manage')) {
      throw new ForbiddenException('You can only submit your own syllabi');
    }
    if (!doc.filePath) throw new BadRequestException('Upload a file first');

    await this.prisma.syllabusApproval.deleteMany({
      where: { tenantId: user.tid, documentId },
    });

    const updated = await this.prisma.syllabusDocument.update({
      where: { id: documentId },
      data: {
        status: 'PENDING_APPROVAL',
        approvals: { create: this.defaultApprovalSteps(user.tid) },
      },
      include: { approvals: { orderBy: { sequence: 'asc' } } },
    });
    await this.audit(user, 'syllabus.submitted', documentId, {
      after: updated,
    });
    return updated;
  }

  async actOnApproval(
    user: JwtUser,
    approvalId: string,
    dto: SyllabusApprovalDto,
  ) {
    const approval = await this.prisma.syllabusApproval.findFirst({
      where: { tenantId: user.tid, id: approvalId },
      include: { document: true },
    });
    if (!approval) throw new NotFoundException('Approval step not found');
    if (approval.status !== 'PENDING') {
      throw new BadRequestException('This approval step is already completed');
    }
    if (!approval.document || approval.document.deletedAt) {
      throw new NotFoundException('Syllabus document not found');
    }

    const steps = await this.prisma.syllabusApproval.findMany({
      where: { tenantId: user.tid, documentId: approval.documentId },
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
      this.hasPermission(user, 'syllabus-repository:manage') ||
      (this.hasPermission(user, 'syllabus-repository:approve') && roleMatch) ||
      (this.hasPermission(user, 'syllabus-repository:publish') &&
        approval.roleSlug === 'academic-admin' &&
        roleMatch);
    if (!canApprove) {
      throw new ForbiddenException(
        `This step requires the ${approval.roleSlug} role`,
      );
    }

    const status = dto.action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const updatedApproval = await this.prisma.syllabusApproval.update({
      where: { id: approvalId },
      data: {
        status,
        comments: dto.comments,
        approverId: user.sub,
        actedAt: new Date(),
      },
    });

    if (status === 'REJECTED') {
      await this.prisma.syllabusDocument.update({
        where: { id: approval.documentId },
        data: { status: 'REJECTED' },
      });
      await this.audit(user, 'approval.rejected', approval.documentId, {
        after: updatedApproval,
      });
      return updatedApproval;
    }

    const remaining = await this.prisma.syllabusApproval.count({
      where: {
        tenantId: user.tid,
        documentId: approval.documentId,
        status: 'PENDING',
      },
    });
    await this.prisma.syllabusDocument.update({
      where: { id: approval.documentId },
      data: {
        status: remaining === 0 ? 'APPROVED' : 'PENDING_APPROVAL',
        ...(remaining === 0 ? { approvedById: user.sub } : {}),
      },
    });
    await this.audit(user, 'approval.approved', approval.documentId, {
      after: updatedApproval,
    });
    return updatedApproval;
  }

  async publish(user: JwtUser, documentId: string) {
    const canPublish =
      this.hasPermission(user, 'syllabus-repository:publish') ||
      this.hasPermission(user, 'syllabus-repository:manage');
    if (!canPublish) {
      throw new ForbiddenException(
        'Missing syllabus-repository:publish permission',
      );
    }

    const doc = await this.prisma.syllabusDocument.findFirst({
      where: { id: documentId, tenantId: user.tid, deletedAt: null },
      include: { approvals: true },
    });
    if (!doc) throw new NotFoundException('Syllabus document not found');
    if (
      !['APPROVED', 'PENDING_APPROVAL'].includes(doc.status) &&
      !this.hasPermission(user, 'syllabus-repository:manage')
    ) {
      throw new BadRequestException(
        'Syllabus must be approved before publishing',
      );
    }
    const pending = doc.approvals.filter(
      (approval) => approval.status === 'PENDING',
    );
    if (
      pending.length &&
      !this.hasPermission(user, 'syllabus-repository:manage')
    ) {
      throw new BadRequestException(
        'All approval steps must be completed before publishing',
      );
    }

    const updated = await this.prisma.syllabusDocument.update({
      where: { id: documentId },
      data: {
        status: 'PUBLISHED',
        publishedById: user.sub,
        publishedAt: new Date(),
      },
    });
    await this.audit(user, 'syllabus.published', documentId, {
      after: updated,
    });

    void this.hooks.ingestToKnowledgeBase(documentId).catch(() => undefined);
    void this.hooks.notifyStudents(documentId).catch(() => undefined);
    return updated;
  }

  listPendingApprovals(tenantId: string, roleSlug?: string) {
    return this.prisma.syllabusApproval.findMany({
      where: {
        tenantId,
        status: 'PENDING',
        ...(roleSlug ? { roleSlug } : {}),
      },
      include: {
        document: {
          select: {
            id: true,
            paperCode: true,
            paperTitle: true,
            status: true,
            uploadedById: true,
            category: true,
            semesterNo: true,
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
    documentId: string,
    input: Record<string, unknown> = {},
  ) {
    return this.prisma.syllabusAuditLog.create({
      data: {
        tenantId: user.tid,
        documentId,
        actorId: user.sub,
        action,
        before: input.before as object | undefined,
        after: input.after as object | undefined,
        metadata: input.metadata as object | undefined,
      },
    });
  }
}
