import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';

const OPEN_STATUSES = ['PENDING', 'IN_PROGRESS'];

@Injectable()
export class WorkflowEngineService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async upsertDefinition(
    user: JwtUser,
    dto: {
      code: string;
      name: string;
      description?: string;
      entityType: string;
      isActive?: boolean;
      metadata?: Record<string, unknown>;
      steps?: Array<{
        stepOrder: number;
        name: string;
        assigneeRole?: string;
        assigneePermission?: string;
        slaHours?: number;
        isParallel?: boolean;
      }>;
    },
    id?: string,
  ) {
    const existing = id
      ? await this.db().workflowDefinition.findFirst({
          where: { id, tenantId: user.tid },
        })
      : await this.db().workflowDefinition.findUnique({
          where: {
            tenantId_code: { tenantId: user.tid, code: dto.code },
          },
        });

    if (existing) {
      const updated = await this.db().workflowDefinition.update({
        where: { id: existing.id },
        data: {
          name: dto.name,
          description: dto.description ?? '',
          entityType: dto.entityType,
          isActive: dto.isActive ?? true,
          metadata: dto.metadata ?? {},
        },
      });
      if (dto.steps?.length) {
        await this.db().workflowStep.deleteMany({
          where: { definitionId: existing.id },
        });
        await this.db().workflowStep.createMany({
          data: dto.steps.map((s) => ({
            tenantId: user.tid,
            definitionId: existing.id,
            stepOrder: s.stepOrder,
            name: s.name,
            assigneeRole: s.assigneeRole,
            assigneePermission: s.assigneePermission,
            slaHours: s.slaHours,
            isParallel: s.isParallel ?? false,
          })),
        });
      }
      return this.getDefinition(user.tid, updated.id);
    }

    const created = await this.db().workflowDefinition.create({
      data: {
        tenantId: user.tid,
        code: dto.code,
        name: dto.name,
        description: dto.description ?? '',
        entityType: dto.entityType,
        isActive: dto.isActive ?? true,
        metadata: dto.metadata ?? {},
        steps: dto.steps?.length
          ? {
              create: dto.steps.map((s) => ({
                tenantId: user.tid,
                stepOrder: s.stepOrder,
                name: s.name,
                assigneeRole: s.assigneeRole,
                assigneePermission: s.assigneePermission,
                slaHours: s.slaHours,
                isParallel: s.isParallel ?? false,
              })),
            }
          : undefined,
      },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
    return created;
  }

  async listDefinitions(tenantId: string) {
    return this.db().workflowDefinition.findMany({
      where: { tenantId },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  async getDefinition(tenantId: string, id: string) {
    const row = await this.db().workflowDefinition.findFirst({
      where: { id, tenantId },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
    if (!row) throw new NotFoundException('Workflow definition not found');
    return row;
  }

  async ensureOfficialDocumentPilot(tenantId: string) {
    const existing = await this.db().workflowDefinition.findUnique({
      where: {
        tenantId_code: { tenantId, code: 'OFFICIAL_DOCUMENT_APPROVAL' },
      },
      include: { steps: true },
    });
    if (existing) return existing;

    return this.db().workflowDefinition.create({
      data: {
        tenantId,
        code: 'OFFICIAL_DOCUMENT_APPROVAL',
        name: 'Official Document Approval',
        description: 'Principal approval for official documents',
        entityType: 'OFFICIAL_DOCUMENT',
        isActive: true,
        steps: {
          create: [
            {
              tenantId,
              stepOrder: 1,
              name: 'Principal Approval',
              assigneePermission: 'official-documents:approve',
            },
          ],
        },
      },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
  }

  async startInstance(
    user: JwtUser,
    entityType: string,
    entityId: string,
    definitionCode?: string,
  ) {
    let definition;
    if (definitionCode) {
      definition = await this.db().workflowDefinition.findFirst({
        where: {
          tenantId: user.tid,
          code: definitionCode,
          isActive: true,
        },
        include: { steps: { orderBy: { stepOrder: 'asc' } } },
      });
    } else {
      definition = await this.db().workflowDefinition.findFirst({
        where: {
          tenantId: user.tid,
          entityType,
          isActive: true,
        },
        include: { steps: { orderBy: { stepOrder: 'asc' } } },
        orderBy: { createdAt: 'asc' },
      });
    }
    if (!definition) {
      throw new NotFoundException(
        `No active workflow definition for ${entityType}`,
      );
    }

    const open = await this.db().workflowInstance.findFirst({
      where: {
        tenantId: user.tid,
        entityType,
        entityId,
        status: { in: OPEN_STATUSES },
      },
    });
    if (open) return open;

    const instance = await this.db().workflowInstance.create({
      data: {
        tenantId: user.tid,
        definitionId: definition.id,
        entityType,
        entityId,
        status: 'PENDING',
        currentStepOrder: definition.steps[0]?.stepOrder ?? 1,
        startedById: user.sub,
      },
      include: {
        definition: { include: { steps: { orderBy: { stepOrder: 'asc' } } } },
      },
    });

    await this.db().workflowAuditLog.create({
      data: {
        tenantId: user.tid,
        instanceId: instance.id,
        event: 'STARTED',
        actorId: user.sub,
        payload: { entityType, entityId, definitionCode: definition.code },
      },
    });

    return instance;
  }

  async action(
    user: JwtUser,
    instanceId: string,
    action:
      | 'APPROVE'
      | 'REJECT'
      | 'COMPLETE'
      | 'REQUEST_CHANGES'
      | 'COMMENT'
      | 'REOPEN',
    note?: string,
    opts?: { skipRoleCheck?: boolean },
  ) {
    const instance = await this.db().workflowInstance.findFirst({
      where: { id: instanceId, tenantId: user.tid },
      include: {
        definition: { include: { steps: { orderBy: { stepOrder: 'asc' } } } },
      },
    });
    if (!instance) throw new NotFoundException('Workflow instance not found');

    if (action === 'COMMENT') {
      if (!note?.trim()) throw new BadRequestException('Comment required');
      await this.db().workflowAction.create({
        data: {
          tenantId: user.tid,
          instanceId: instance.id,
          action: 'COMMENT',
          note: note.trim(),
          actorId: user.sub,
        },
      });
      await this.db().workflowAuditLog.create({
        data: {
          tenantId: user.tid,
          instanceId: instance.id,
          event: 'COMMENT',
          actorId: user.sub,
          payload: { note: note.trim() },
        },
      });
      return instance;
    }

    if (action === 'REOPEN') {
      const first =
        (instance.definition.steps as Array<{ stepOrder: number }>)[0]
          ?.stepOrder ?? 1;
      const updated = await this.db().workflowInstance.update({
        where: { id: instance.id },
        data: {
          status: 'IN_PROGRESS',
          currentStepOrder: first,
          completedAt: null,
        },
      });
      await this.db().workflowAction.create({
        data: {
          tenantId: user.tid,
          instanceId: instance.id,
          action: 'REOPEN',
          note: note ?? null,
          actorId: user.sub,
        },
      });
      await this.db().workflowAuditLog.create({
        data: {
          tenantId: user.tid,
          instanceId: instance.id,
          event: 'REOPEN',
          actorId: user.sub,
          payload: { note },
        },
      });
      return updated;
    }

    const openOk =
      OPEN_STATUSES.includes(instance.status) ||
      (action === 'REQUEST_CHANGES' && instance.status === 'IN_PROGRESS');
    if (!OPEN_STATUSES.includes(instance.status)) {
      throw new BadRequestException('Workflow instance is not open');
    }
    void openOk;
    void opts;

    const steps = instance.definition.steps as Array<{
      id: string;
      stepOrder: number;
      assigneeRole?: string | null;
      assigneePermission?: string | null;
    }>;
    const currentStep =
      steps.find((s) => s.stepOrder === instance.currentStepOrder) ?? steps[0];

    // Soft permission check when assigneePermission set (unless skipped by facade)
    if (!opts?.skipRoleCheck && currentStep?.assigneePermission) {
      const meta = (instance.definition.metadata ?? {}) as Record<
        string,
        unknown
      >;
      const override = String(meta.overridePermission ?? '');
      const allowed =
        user.permissions?.includes(currentStep.assigneePermission) ||
        (override && user.permissions?.includes(override)) ||
        user.permissions?.includes('workflow:manage');
      if (!allowed) {
        throw new BadRequestException(
          `Permission ${currentStep.assigneePermission} required for this step`,
        );
      }
    }

    await this.db().workflowAction.create({
      data: {
        tenantId: user.tid,
        instanceId: instance.id,
        stepId: currentStep?.id,
        action,
        note,
        actorId: user.sub,
      },
    });

    let nextStatus = instance.status;
    let nextStep = instance.currentStepOrder;
    let completedAt: Date | null = null;

    if (action === 'REJECT') {
      nextStatus = 'REJECTED';
      completedAt = new Date();
    } else if (action === 'REQUEST_CHANGES') {
      nextStatus = 'CHANGES_REQUESTED';
      nextStep = steps[0]?.stepOrder ?? 1;
      completedAt = null;
    } else if (action === 'COMPLETE') {
      nextStatus = 'COMPLETED';
      completedAt = new Date();
    } else {
      const next = steps.find((s) => s.stepOrder > instance.currentStepOrder);
      if (next) {
        nextStatus = 'IN_PROGRESS';
        nextStep = next.stepOrder;
      } else {
        nextStatus = 'APPROVED';
        completedAt = new Date();
      }
    }

    const updated = await this.db().workflowInstance.update({
      where: { id: instance.id },
      data: {
        status: nextStatus,
        currentStepOrder: nextStep,
        completedAt,
      },
    });

    await this.db().workflowAuditLog.create({
      data: {
        tenantId: user.tid,
        instanceId: instance.id,
        event: action,
        actorId: user.sub,
        payload: { note, status: nextStatus },
      },
    });

    return updated;
  }

  /** Soft helper: find open instance for entity and apply action. */
  async actionForEntity(
    user: JwtUser,
    entityType: string,
    entityId: string,
    action: 'APPROVE' | 'REJECT' | 'COMPLETE',
    note?: string,
  ) {
    const open = await this.db().workflowInstance.findFirst({
      where: {
        tenantId: user.tid,
        entityType,
        entityId,
        status: { in: OPEN_STATUSES },
      },
    });
    if (!open) return null;
    return this.action(user, open.id, action, note);
  }

  async inbox(user: JwtUser) {
    return this.db().workflowInstance.findMany({
      where: {
        tenantId: user.tid,
        status: { in: OPEN_STATUSES },
      },
      include: {
        definition: { include: { steps: { orderBy: { stepOrder: 'asc' } } } },
        actions: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }

  async getTimeline(tenantId: string, instanceId: string) {
    const instance = await this.db().workflowInstance.findFirst({
      where: { id: instanceId, tenantId },
    });
    if (!instance) throw new NotFoundException('Workflow instance not found');
    const [actions, audits] = await Promise.all([
      this.db().workflowAction.findMany({
        where: { tenantId, instanceId },
        orderBy: { createdAt: 'asc' },
      }),
      this.db().workflowAuditLog.findMany({
        where: { tenantId, instanceId },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    return { actions, audits };
  }

  async findOpenForEntity(
    tenantId: string,
    entityType: string,
    entityId: string,
  ) {
    return this.db().workflowInstance.findFirst({
      where: {
        tenantId,
        entityType,
        entityId,
        status: { in: [...OPEN_STATUSES, 'CHANGES_REQUESTED'] },
      },
      include: {
        definition: { include: { steps: { orderBy: { stepOrder: 'asc' } } } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async audit(tenantId: string, instanceId: string) {
    const instance = await this.db().workflowInstance.findFirst({
      where: { id: instanceId, tenantId },
    });
    if (!instance) throw new NotFoundException('Workflow instance not found');
    return this.db().workflowAuditLog.findMany({
      where: { tenantId, instanceId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
