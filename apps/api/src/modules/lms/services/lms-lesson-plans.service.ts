import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import type {
  CreateLmsLessonPlanDto,
  UpdateLmsLessonPlanDto,
} from '../dto/lms.dto';
import { LmsAccessService } from './lms-access.service';
import { LmsAuditService } from './lms-audit.service';

@Injectable()
export class LmsLessonPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: LmsAccessService,
    private readonly audit: LmsAuditService,
  ) {}

  async list(user: JwtUser, workspaceId: string) {
    await this.access.assertWorkspaceAccess(user, workspaceId, 'read');
    return this.prisma.lmsLessonPlan.findMany({
      where: { tenantId: user.tid, workspaceId, deletedAt: null },
      orderBy: [{ unit: 'asc' }, { topic: 'asc' }],
    });
  }

  async create(
    user: JwtUser,
    workspaceId: string,
    dto: CreateLmsLessonPlanDto,
  ) {
    await this.access.assertWorkspaceAccess(user, workspaceId, 'upload');
    if (
      !user.permissions.includes('lms:lesson-plans:manage') &&
      !this.access.hasAdminLms(user)
    ) {
      // faculty with workspace access may manage lesson plans
    }

    const plan = await this.prisma.lmsLessonPlan.create({
      data: {
        tenantId: user.tid,
        workspaceId,
        unit: dto.unit,
        topic: dto.topic,
        subtopic: dto.subtopic,
        learningOutcomes: dto.learningOutcomes,
        expectedHours: dto.expectedHours,
        teachingMethod: dto.teachingMethod,
        resources: (dto.resources ?? {}) as Prisma.InputJsonValue,
        status: dto.status ?? 'NOT_STARTED',
        scheduledDate: dto.scheduledDate
          ? new Date(dto.scheduledDate)
          : undefined,
        timetableEntryId: dto.timetableEntryId,
        createdById: user.sub,
      },
    });

    await this.audit.log({
      tenantId: user.tid,
      workspaceId,
      entityType: 'LESSON_PLAN',
      entityId: plan.id,
      action: 'CREATE',
      actorId: user.sub,
    });

    return plan;
  }

  async update(user: JwtUser, id: string, dto: UpdateLmsLessonPlanDto) {
    const plan = await this.prisma.lmsLessonPlan.findFirst({
      where: { id, tenantId: user.tid, deletedAt: null },
    });
    if (!plan) throw new NotFoundException('Lesson plan not found');
    await this.access.assertWorkspaceAccess(user, plan.workspaceId, 'upload');

    return this.prisma.lmsLessonPlan.update({
      where: { id },
      data: {
        ...(dto.unit ? { unit: dto.unit } : {}),
        ...(dto.topic ? { topic: dto.topic } : {}),
        ...(dto.subtopic !== undefined ? { subtopic: dto.subtopic } : {}),
        ...(dto.learningOutcomes !== undefined
          ? { learningOutcomes: dto.learningOutcomes }
          : {}),
        ...(dto.expectedHours != null
          ? { expectedHours: dto.expectedHours }
          : {}),
        ...(dto.teachingMethod !== undefined
          ? { teachingMethod: dto.teachingMethod }
          : {}),
        ...(dto.resources
          ? { resources: dto.resources as Prisma.InputJsonValue }
          : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.scheduledDate !== undefined
          ? {
              scheduledDate: dto.scheduledDate
                ? new Date(dto.scheduledDate)
                : null,
            }
          : {}),
        ...(dto.timetableEntryId !== undefined
          ? { timetableEntryId: dto.timetableEntryId }
          : {}),
      },
    });
  }

  async remove(user: JwtUser, id: string) {
    const plan = await this.prisma.lmsLessonPlan.findFirst({
      where: { id, tenantId: user.tid, deletedAt: null },
    });
    if (!plan) throw new NotFoundException('Lesson plan not found');
    await this.access.assertWorkspaceAccess(user, plan.workspaceId, 'upload');
    return this.prisma.lmsLessonPlan.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
