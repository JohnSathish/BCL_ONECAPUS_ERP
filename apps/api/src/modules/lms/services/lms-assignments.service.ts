import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import type {
  CreateLmsAssignmentDto,
  EvaluateLmsSubmissionDto,
  ReturnLmsSubmissionDto,
  SubmitLmsAssignmentDto,
  UpdateLmsAssignmentDto,
} from '../dto/lms.dto';
import { LmsAccessService } from './lms-access.service';
import { LmsAuditService } from './lms-audit.service';
import { LmsNotificationService } from './lms-notification.service';
import { LmsSettingsService } from './lms-settings.service';

@Injectable()
export class LmsAssignmentsService {
  private readonly uploadRoot = resolveTenantUploadRoot();

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: LmsAccessService,
    private readonly settings: LmsSettingsService,
    private readonly audit: LmsAuditService,
    private readonly notifications: LmsNotificationService,
  ) {}

  private canManage(user: JwtUser): boolean {
    return (
      user.permissions.includes('lms:assignments:manage') ||
      this.access.hasAdminLms(user)
    );
  }

  async list(user: JwtUser, workspaceId: string) {
    await this.access.assertWorkspaceAccess(user, workspaceId, 'read');
    const studentView = user.roles.includes('student');

    const assignments = await this.prisma.lmsAssignment.findMany({
      where: {
        tenantId: user.tid,
        workspaceId,
        deletedAt: null,
        ...(studentView ? { status: 'PUBLISHED' } : {}),
      },
      include: {
        createdBy: { select: { id: true, displayName: true, email: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
    });

    if (!studentView) {
      return assignments;
    }

    const studentId = await this.access.getStudentId(user);
    if (!studentId) return assignments;

    const mySubs = await this.prisma.lmsAssignmentSubmission.findMany({
      where: {
        tenantId: user.tid,
        studentId,
        assignmentId: { in: assignments.map((a) => a.id) },
      },
      include: {
        feedback: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    const subByAssignment = new Map(mySubs.map((s) => [s.assignmentId, s]));

    return assignments.map((a) => ({
      ...a,
      mySubmission: subByAssignment.get(a.id) ?? null,
    }));
  }

  async create(
    user: JwtUser,
    workspaceId: string,
    dto: CreateLmsAssignmentDto,
  ) {
    await this.access.assertWorkspaceAccess(user, workspaceId, 'upload');
    if (!this.canManage(user)) {
      throw new ForbiddenException('Missing lms:assignments:manage permission');
    }

    const assignment = await this.prisma.lmsAssignment.create({
      data: {
        tenantId: user.tid,
        workspaceId,
        title: dto.title,
        instructions: dto.instructions,
        submissionType: dto.submissionType,
        maxMarks: dto.maxMarks != null ? dto.maxMarks : undefined,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        allowLateSubmission: dto.allowLateSubmission ?? false,
        status: 'DRAFT',
        createdById: user.sub,
      },
    });

    await this.audit.log({
      tenantId: user.tid,
      workspaceId,
      entityType: 'ASSIGNMENT',
      entityId: assignment.id,
      action: 'CREATE',
      actorId: user.sub,
    });

    return assignment;
  }

  async update(
    user: JwtUser,
    assignmentId: string,
    dto: UpdateLmsAssignmentDto,
  ) {
    const assignment = await this.getAssignmentOrThrow(user.tid, assignmentId);
    await this.access.assertWorkspaceAccess(
      user,
      assignment.workspaceId,
      'upload',
    );
    if (!this.canManage(user)) {
      throw new ForbiddenException('Missing lms:assignments:manage permission');
    }
    if (assignment.status !== 'DRAFT') {
      throw new BadRequestException('Only draft assignments can be edited');
    }

    return this.prisma.lmsAssignment.update({
      where: { id: assignmentId },
      data: {
        ...(dto.title ? { title: dto.title } : {}),
        ...(dto.instructions !== undefined
          ? { instructions: dto.instructions }
          : {}),
        ...(dto.submissionType ? { submissionType: dto.submissionType } : {}),
        ...(dto.maxMarks != null ? { maxMarks: dto.maxMarks } : {}),
        ...(dto.dueAt !== undefined
          ? { dueAt: dto.dueAt ? new Date(dto.dueAt) : null }
          : {}),
        ...(dto.allowLateSubmission != null
          ? { allowLateSubmission: dto.allowLateSubmission }
          : {}),
      },
    });
  }

  async publish(user: JwtUser, assignmentId: string) {
    const assignment = await this.getAssignmentOrThrow(user.tid, assignmentId);
    await this.access.assertWorkspaceAccess(
      user,
      assignment.workspaceId,
      'publish',
    );
    if (!this.canManage(user)) {
      throw new ForbiddenException('Missing lms:assignments:manage permission');
    }
    if (assignment.status !== 'DRAFT') {
      throw new BadRequestException(
        'Assignment is already published or closed',
      );
    }

    const updated = await this.prisma.lmsAssignment.update({
      where: { id: assignmentId },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });

    await this.audit.log({
      tenantId: user.tid,
      workspaceId: assignment.workspaceId,
      entityType: 'ASSIGNMENT',
      entityId: assignmentId,
      action: 'PUBLISH',
      actorId: user.sub,
    });

    void this.notifications.notify({
      tenantId: user.tid,
      type: 'LMS_ASSIGNMENT_PUBLISHED',
      title: `New assignment: ${updated.title}`,
      body: updated.instructions ?? 'A new assignment has been published',
      workspaceId: assignment.workspaceId,
      metadata: {
        assignmentId,
        dueAt: updated.dueAt?.toISOString() ?? null,
        dueReminder: true,
      },
    });

    return updated;
  }

  async close(user: JwtUser, assignmentId: string) {
    const assignment = await this.getAssignmentOrThrow(user.tid, assignmentId);
    await this.access.assertWorkspaceAccess(
      user,
      assignment.workspaceId,
      'publish',
    );
    if (!this.canManage(user)) {
      throw new ForbiddenException('Missing lms:assignments:manage permission');
    }
    if (assignment.status !== 'PUBLISHED') {
      throw new BadRequestException('Only published assignments can be closed');
    }

    return this.prisma.lmsAssignment.update({
      where: { id: assignmentId },
      data: { status: 'CLOSED', closedAt: new Date() },
    });
  }

  async listSubmissions(user: JwtUser, assignmentId: string) {
    const assignment = await this.getAssignmentOrThrow(user.tid, assignmentId);
    await this.access.assertWorkspaceAccess(
      user,
      assignment.workspaceId,
      'read',
    );
    if (!this.canManage(user)) {
      throw new ForbiddenException('Missing lms:assignments:manage permission');
    }

    return this.prisma.lmsAssignmentSubmission.findMany({
      where: { tenantId: user.tid, assignmentId },
      include: {
        student: {
          select: {
            id: true,
            enrollmentNumber: true,
            masterProfile: { select: { fullName: true } },
          },
        },
        feedback: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { submittedAt: 'desc' },
    });
  }

  async getMySubmission(user: JwtUser, assignmentId: string) {
    const assignment = await this.getAssignmentOrThrow(user.tid, assignmentId);
    await this.access.assertWorkspaceAccess(
      user,
      assignment.workspaceId,
      'read',
    );
    const studentId = await this.access.getStudentId(user);
    if (!studentId) throw new ForbiddenException('Student profile required');

    return this.prisma.lmsAssignmentSubmission.findFirst({
      where: { tenantId: user.tid, assignmentId, studentId },
      include: {
        feedback: { orderBy: { createdAt: 'desc' } },
      },
    });
  }

  async submit(
    user: JwtUser,
    assignmentId: string,
    dto: SubmitLmsAssignmentDto,
    file?: Express.Multer.File,
  ) {
    const assignment = await this.getAssignmentOrThrow(user.tid, assignmentId);
    await this.access.assertWorkspaceAccess(
      user,
      assignment.workspaceId,
      'read',
    );
    const studentId = await this.access.getStudentId(user);
    if (!studentId) throw new ForbiddenException('Student profile required');

    if (assignment.status !== 'PUBLISHED') {
      throw new BadRequestException('Assignment is not open for submission');
    }

    const now = new Date();
    if (
      assignment.dueAt &&
      now > assignment.dueAt &&
      !assignment.allowLateSubmission
    ) {
      throw new BadRequestException('Submission deadline has passed');
    }

    this.assertSubmissionPayload(assignment.submissionType, dto, file);

    const existing = await this.prisma.lmsAssignmentSubmission.findUnique({
      where: { assignmentId_studentId: { assignmentId, studentId } },
    });

    if (existing && existing.status === 'EVALUATED') {
      throw new BadRequestException(
        'This assignment has already been evaluated',
      );
    }
    if (existing && existing.status === 'SUBMITTED') {
      throw new BadRequestException(
        'Submission already received. Wait for faculty feedback.',
      );
    }

    let filePath: string | undefined;
    let mimeType: string | undefined;
    let fileSize: number | undefined;
    const submissionId = existing?.id ?? randomUUID();

    if (file?.buffer?.length) {
      const settings = await this.settings.getOrCreate(user.tid);
      const allowed = (settings.allowedMimeTypes as string[]) ?? [];
      if (allowed.length && !allowed.includes(file.mimetype)) {
        throw new BadRequestException(
          `File type ${file.mimetype} is not allowed`,
        );
      }
      if (file.size > settings.maxUploadMb * 1024 * 1024) {
        throw new BadRequestException(
          `File exceeds ${settings.maxUploadMb} MB limit`,
        );
      }

      const ext = extname(file.originalname) || '';
      const dir = join(
        this.uploadRoot,
        user.tid,
        'lms',
        'workspaces',
        assignment.workspaceId,
        'assignments',
        assignmentId,
        submissionId,
      );
      await mkdir(dir, { recursive: true });
      const filename = `attempt-${(existing?.attemptNo ?? 0) + 1}${ext}`;
      await writeFile(join(dir, filename), file.buffer);
      filePath = `/uploads/tenants/${user.tid}/lms/workspaces/${assignment.workspaceId}/assignments/${assignmentId}/${submissionId}/${filename}`;
      mimeType = file.mimetype;
      fileSize = file.size;
    }

    const payload = {
      status: 'SUBMITTED' as const,
      textContent: dto.textContent,
      linkUrl: dto.linkUrl,
      filePath,
      mimeType,
      fileSize,
      submittedAt: now,
    };

    const submission = existing
      ? await this.prisma.lmsAssignmentSubmission.update({
          where: { id: existing.id },
          data: {
            ...payload,
            attemptNo: existing.attemptNo + 1,
          },
        })
      : await this.prisma.lmsAssignmentSubmission.create({
          data: {
            id: submissionId,
            tenantId: user.tid,
            assignmentId,
            studentId,
            ...payload,
          },
        });

    await this.audit.log({
      tenantId: user.tid,
      workspaceId: assignment.workspaceId,
      entityType: 'ASSIGNMENT_SUBMISSION',
      entityId: submission.id,
      action: existing ? 'RESUBMIT' : 'SUBMIT',
      actorId: user.sub,
    });

    return submission;
  }

  async evaluate(
    user: JwtUser,
    submissionId: string,
    dto: EvaluateLmsSubmissionDto,
  ) {
    const submission = await this.getSubmissionOrThrow(user.tid, submissionId);
    const assignment = await this.getAssignmentOrThrow(
      user.tid,
      submission.assignmentId,
    );
    await this.access.assertWorkspaceAccess(
      user,
      assignment.workspaceId,
      'upload',
    );
    if (!this.canManage(user)) {
      throw new ForbiddenException('Missing lms:assignments:manage permission');
    }
    if (submission.status !== 'SUBMITTED') {
      throw new BadRequestException('Only submitted work can be evaluated');
    }

    if (assignment.maxMarks != null && dto.marksAwarded != null) {
      if (dto.marksAwarded > Number(assignment.maxMarks)) {
        throw new BadRequestException(
          `Marks cannot exceed ${assignment.maxMarks}`,
        );
      }
    }

    await this.prisma.lmsAssignmentFeedback.create({
      data: {
        tenantId: user.tid,
        submissionId,
        action: 'EVALUATE',
        marksAwarded: dto.marksAwarded != null ? dto.marksAwarded : undefined,
        feedbackText: dto.feedbackText,
        evaluatedById: user.sub,
      },
    });

    const updated = await this.prisma.lmsAssignmentSubmission.update({
      where: { id: submissionId },
      data: { status: 'EVALUATED' },
    });

    await this.audit.log({
      tenantId: user.tid,
      workspaceId: assignment.workspaceId,
      entityType: 'ASSIGNMENT_SUBMISSION',
      entityId: submissionId,
      action: 'EVALUATE',
      actorId: user.sub,
      metadata: { marksAwarded: dto.marksAwarded ?? null },
    });

    void this.notifications.notify({
      tenantId: user.tid,
      type: 'LMS_ASSIGNMENT_EVALUATED',
      title: `Graded: ${assignment.title}`,
      body: dto.feedbackText ?? 'Your assignment has been evaluated',
      workspaceId: assignment.workspaceId,
      metadata: { assignmentId: assignment.id, submissionId },
    });

    return updated;
  }

  async returnForRevision(
    user: JwtUser,
    submissionId: string,
    dto: ReturnLmsSubmissionDto,
  ) {
    const submission = await this.getSubmissionOrThrow(user.tid, submissionId);
    const assignment = await this.getAssignmentOrThrow(
      user.tid,
      submission.assignmentId,
    );
    await this.access.assertWorkspaceAccess(
      user,
      assignment.workspaceId,
      'upload',
    );
    if (!this.canManage(user)) {
      throw new ForbiddenException('Missing lms:assignments:manage permission');
    }
    if (submission.status !== 'SUBMITTED') {
      throw new BadRequestException('Only submitted work can be returned');
    }

    await this.prisma.lmsAssignmentFeedback.create({
      data: {
        tenantId: user.tid,
        submissionId,
        action: 'RETURN',
        feedbackText: dto.feedbackText,
        evaluatedById: user.sub,
      },
    });

    const updated = await this.prisma.lmsAssignmentSubmission.update({
      where: { id: submissionId },
      data: { status: 'RETURNED' },
    });

    await this.audit.log({
      tenantId: user.tid,
      workspaceId: assignment.workspaceId,
      entityType: 'ASSIGNMENT_SUBMISSION',
      entityId: submissionId,
      action: 'RETURN',
      actorId: user.sub,
    });

    void this.notifications.notify({
      tenantId: user.tid,
      type: 'LMS_ASSIGNMENT_RETURNED',
      title: `Revision requested: ${assignment.title}`,
      body: dto.feedbackText,
      workspaceId: assignment.workspaceId,
      metadata: { assignmentId: assignment.id, submissionId },
    });

    return updated;
  }

  async countPendingEvaluations(
    tenantId: string,
    staffProfileId: string,
  ): Promise<number> {
    const assignments = await this.prisma.subjectTeachingAssignment.findMany({
      where: {
        tenantId,
        staffProfileId,
        deletedAt: null,
        canAccessSubjectWorkspace: true,
      },
      select: { offeringSectionId: true, courseOfferingId: true },
    });

    const sectionIds = assignments
      .map((a) => a.offeringSectionId)
      .filter(Boolean) as string[];
    const offeringIds = [
      ...new Set(assignments.map((a) => a.courseOfferingId).filter(Boolean)),
    ] as string[];

    const workspaces = await this.prisma.lmsWorkspace.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { offeringSectionId: { in: sectionIds } },
          { workspaceType: 'POOL', courseOfferingId: { in: offeringIds } },
        ],
      },
      select: { id: true },
    });

    if (!workspaces.length) return 0;

    return this.prisma.lmsAssignmentSubmission.count({
      where: {
        tenantId,
        status: 'SUBMITTED',
        assignment: {
          workspaceId: { in: workspaces.map((w) => w.id) },
          status: 'PUBLISHED',
          deletedAt: null,
        },
      },
    });
  }

  async countDueForStudent(
    tenantId: string,
    studentId: string,
  ): Promise<number> {
    const lines = await this.prisma.semesterRegistrationLine.findMany({
      where: {
        tenantId,
        status: { in: ['approved', 'confirmed', 'registered', 'pending'] },
        registration: { studentId },
      },
      select: { offeringSectionId: true, offeringId: true },
    });

    const sectionIds = lines
      .map((l) => l.offeringSectionId)
      .filter(Boolean) as string[];
    const offeringIds = [...new Set(lines.map((l) => l.offeringId))];

    const workspaceIds = (
      await this.prisma.lmsWorkspace.findMany({
        where: {
          tenantId,
          deletedAt: null,
          OR: [
            { offeringSectionId: { in: sectionIds } },
            { workspaceType: 'POOL', courseOfferingId: { in: offeringIds } },
          ],
        },
        select: { id: true },
      })
    ).map((w) => w.id);

    if (!workspaceIds.length) return 0;

    const now = new Date();
    const openAssignments = await this.prisma.lmsAssignment.findMany({
      where: {
        tenantId,
        workspaceId: { in: workspaceIds },
        status: 'PUBLISHED',
        deletedAt: null,
        OR: [{ dueAt: null }, { dueAt: { gte: now } }],
      },
      select: { id: true },
    });

    if (!openAssignments.length) return 0;

    const submitted = await this.prisma.lmsAssignmentSubmission.findMany({
      where: {
        tenantId,
        studentId,
        assignmentId: { in: openAssignments.map((a) => a.id) },
        status: { in: ['SUBMITTED', 'EVALUATED'] },
      },
      select: { assignmentId: true },
    });

    const done = new Set(submitted.map((s) => s.assignmentId));
    return openAssignments.filter((a) => !done.has(a.id)).length;
  }

  private assertSubmissionPayload(
    submissionType: string,
    dto: SubmitLmsAssignmentDto,
    file?: Express.Multer.File,
  ) {
    const hasFile = Boolean(file?.buffer?.length);
    const hasText = Boolean(dto.textContent?.trim());
    const hasLink = Boolean(dto.linkUrl?.trim());

    if (submissionType === 'FILE' && !hasFile) {
      throw new BadRequestException('A file upload is required');
    }
    if (submissionType === 'TEXT' && !hasText) {
      throw new BadRequestException('Text submission is required');
    }
    if (submissionType === 'LINK' && !hasLink) {
      throw new BadRequestException('A link is required');
    }
    if (submissionType === 'MIXED' && !hasFile && !hasText && !hasLink) {
      throw new BadRequestException('Provide a file, text, or link');
    }
  }

  private async getAssignmentOrThrow(tenantId: string, assignmentId: string) {
    const assignment = await this.prisma.lmsAssignment.findFirst({
      where: { id: assignmentId, tenantId, deletedAt: null },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');
    return assignment;
  }

  private async getSubmissionOrThrow(tenantId: string, submissionId: string) {
    const submission = await this.prisma.lmsAssignmentSubmission.findFirst({
      where: { id: submissionId, tenantId },
    });
    if (!submission) throw new NotFoundException('Submission not found');
    return submission;
  }
}
