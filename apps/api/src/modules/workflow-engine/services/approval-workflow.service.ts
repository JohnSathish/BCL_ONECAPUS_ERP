import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { UserNotificationsService } from '../../communication/services/user-notifications.service';
import { WorkflowEngineService } from './workflow-engine.service';

export type ApprovalAction =
  | 'APPROVE'
  | 'REJECT'
  | 'REQUEST_CHANGES'
  | 'COMMENT'
  | 'REOPEN';

export type ApprovalStepDef = {
  stepOrder: number;
  name: string;
  assigneeRole?: string;
  assigneePermission?: string;
  slaHours?: number;
};

/** Resolve portal user IDs who hold a given role on the entity. */
export type ApprovalAssigneeResolver = (
  tenantId: string,
  entityType: string,
  entityId: string,
  role: string,
) => Promise<string[]>;

/** Called when workflow status changes so domain can sync. */
export type ApprovalStatusHook = (
  tenantId: string,
  entityType: string,
  entityId: string,
  status: string,
  payload: {
    action: string;
    actorId: string;
    note?: string;
    currentStepOrder: number;
    instanceId: string;
  },
) => Promise<void>;

export const NAAC_METRIC_APPROVAL_STEPS: ApprovalStepDef[] = [
  {
    stepOrder: 1,
    name: 'Faculty submit / attest',
    assigneeRole: 'FACULTY',
  },
  {
    stepOrder: 2,
    name: 'Metric Coordinator',
    assigneeRole: 'METRIC_COORD',
  },
  {
    stepOrder: 3,
    name: 'Criterion Coordinator',
    assigneeRole: 'CRITERION_COORD',
  },
  {
    stepOrder: 4,
    name: 'IQAC Coordinator',
    assigneeRole: 'IQAC_COORD',
  },
  {
    stepOrder: 5,
    name: 'Principal',
    assigneeRole: 'PRINCIPAL',
  },
];

export const NAAC_DVV_APPROVAL_STEPS: ApprovalStepDef[] = [
  {
    stepOrder: 1,
    name: 'Metric Coordinator review',
    assigneeRole: 'METRIC_COORD',
  },
  {
    stepOrder: 2,
    name: 'IQAC Coordinator',
    assigneeRole: 'IQAC_COORD',
  },
  {
    stepOrder: 3,
    name: 'Principal',
    assigneeRole: 'PRINCIPAL',
  },
];

const OPEN = ['PENDING', 'IN_PROGRESS', 'CHANGES_REQUESTED'];

@Injectable()
export class ApprovalWorkflowService {
  private readonly resolvers = new Map<string, ApprovalAssigneeResolver>();
  private readonly statusHooks = new Map<string, ApprovalStatusHook>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: WorkflowEngineService,
    @Optional() private readonly notifications?: UserNotificationsService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  registerAssigneeResolver(
    entityType: string,
    resolver: ApprovalAssigneeResolver,
  ) {
    this.resolvers.set(entityType, resolver);
  }

  registerStatusHook(entityType: string, hook: ApprovalStatusHook) {
    this.statusHooks.set(entityType, hook);
  }

  async ensureDefinition(
    tenantId: string,
    opts: {
      code: string;
      name: string;
      description?: string;
      entityType: string;
      steps: ApprovalStepDef[];
      overridePermission?: string;
    },
  ) {
    const existing = await this.db().workflowDefinition.findUnique({
      where: { tenantId_code: { tenantId, code: opts.code } },
      include: { steps: true },
    });

    const metadata = {
      overridePermission: opts.overridePermission ?? 'naac-iqac:manage',
      approvalFacade: true,
    };

    if (existing) {
      await this.db().workflowDefinition.update({
        where: { id: existing.id },
        data: {
          name: opts.name,
          description: opts.description ?? existing.description,
          entityType: opts.entityType,
          isActive: true,
          metadata,
        },
      });
      await this.db().workflowStep.deleteMany({
        where: { definitionId: existing.id },
      });
      await this.db().workflowStep.createMany({
        data: opts.steps.map((s) => ({
          tenantId,
          definitionId: existing.id,
          stepOrder: s.stepOrder,
          name: s.name,
          assigneeRole: s.assigneeRole ?? null,
          assigneePermission: s.assigneePermission ?? null,
          slaHours: s.slaHours ?? null,
          isParallel: false,
        })),
      });
      return this.engine.getDefinition(tenantId, existing.id);
    }

    return this.db().workflowDefinition.create({
      data: {
        tenantId,
        code: opts.code,
        name: opts.name,
        description: opts.description ?? '',
        entityType: opts.entityType,
        isActive: true,
        metadata,
        steps: {
          create: opts.steps.map((s) => ({
            tenantId,
            stepOrder: s.stepOrder,
            name: s.name,
            assigneeRole: s.assigneeRole ?? null,
            assigneePermission: s.assigneePermission ?? null,
            slaHours: s.slaHours ?? null,
          })),
        },
      },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
  }

  async ensureNaacDefinitions(tenantId: string) {
    const metric = await this.ensureDefinition(tenantId, {
      code: 'NAAC_METRIC_APPROVAL',
      name: 'NAAC Metric Approval',
      description:
        'Faculty → Metric Coord → Criterion Coord → IQAC → Principal',
      entityType: 'NaacMetricWorkspace',
      steps: NAAC_METRIC_APPROVAL_STEPS,
      overridePermission: 'naac-iqac:manage',
    });
    const dvv = await this.ensureDefinition(tenantId, {
      code: 'NAAC_DVV_CLARIFICATION',
      name: 'NAAC DVV Clarification Approval',
      description: 'Metric Coord → IQAC → Principal',
      entityType: 'NaacDvvClarification',
      steps: NAAC_DVV_APPROVAL_STEPS,
      overridePermission: 'naac-iqac:manage',
    });
    return { metric, dvv };
  }

  async start(
    user: JwtUser,
    opts: {
      entityType: string;
      entityId: string;
      definitionCode: string;
      link?: string;
      title?: string;
    },
  ) {
    await this.ensureNaacDefinitions(user.tid);

    // Resume CHANGES_REQUESTED instance instead of creating parallel
    const existing = await this.db().workflowInstance.findFirst({
      where: {
        tenantId: user.tid,
        entityType: opts.entityType,
        entityId: opts.entityId,
        status: { in: [...OPEN, 'REJECTED'] },
      },
      include: {
        definition: { include: { steps: { orderBy: { stepOrder: 'asc' } } } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (existing && existing.status === 'CHANGES_REQUESTED') {
      const first = existing.definition.steps[0]?.stepOrder ?? 1;
      const resumed = await this.db().workflowInstance.update({
        where: { id: existing.id },
        data: {
          status: 'IN_PROGRESS',
          currentStepOrder: Math.max(first, 2), // advance past faculty after resubmit
          completedAt: null,
        },
        include: {
          definition: {
            include: { steps: { orderBy: { stepOrder: 'asc' } } },
          },
        },
      });
      await this.db().workflowAuditLog.create({
        data: {
          tenantId: user.tid,
          instanceId: resumed.id,
          event: 'RESUBMITTED',
          actorId: user.sub,
          payload: { entityType: opts.entityType, entityId: opts.entityId },
        },
      });
      await this.notifyPending(user.tid, resumed, opts.link, opts.title);
      await this.fireStatusHook(user.tid, resumed, 'RESUBMIT', user.sub);
      return resumed;
    }

    if (
      existing &&
      OPEN.includes(existing.status) &&
      existing.status !== 'CHANGES_REQUESTED'
    ) {
      return existing;
    }

    const instance = await this.engine.startInstance(
      user,
      opts.entityType,
      opts.entityId,
      opts.definitionCode,
    );

    // Faculty step: auto-approve submit as step 1 if starter is faculty / manage
    const full = await this.getInstance(user.tid, instance.id);
    const step1 = full.definition.steps.find(
      (s: { stepOrder: number }) => s.stepOrder === full.currentStepOrder,
    );
    if (step1?.assigneeRole === 'FACULTY') {
      await this.engine.action(
        user,
        full.id,
        'APPROVE',
        'Submitted by faculty',
        {
          skipRoleCheck: true,
        },
      );
      const advanced = await this.getInstance(user.tid, full.id);
      await this.notifyPending(user.tid, advanced, opts.link, opts.title);
      await this.fireStatusHook(user.tid, advanced, 'SUBMIT', user.sub);
      return advanced;
    }

    await this.notifyPending(user.tid, full, opts.link, opts.title);
    await this.fireStatusHook(user.tid, full, 'START', user.sub);
    return full;
  }

  async act(
    user: JwtUser,
    instanceId: string,
    action: ApprovalAction,
    note?: string,
    opts?: { link?: string; title?: string },
  ) {
    const instance = await this.getInstance(user.tid, instanceId);

    if (action === 'COMMENT') {
      if (!note?.trim()) throw new BadRequestException('Comment required');
      await this.assertCanView(user, instance);
      await this.db().workflowAction.create({
        data: {
          tenantId: user.tid,
          instanceId: instance.id,
          stepId: this.currentStep(instance)?.id,
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
      return this.getStatus(user.tid, instance.entityType, instance.entityId);
    }

    if (action === 'REOPEN') {
      this.assertOverride(user, instance);
      const first = instance.definition.steps[0]?.stepOrder ?? 1;
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
      const full = await this.getInstance(user.tid, updated.id);
      await this.fireStatusHook(user.tid, full, 'REOPEN', user.sub, note);
      return this.getStatus(user.tid, instance.entityType, instance.entityId);
    }

    if (action === 'REQUEST_CHANGES') {
      await this.assertCanAct(user, instance);
      if (!note?.trim()) {
        throw new BadRequestException('Remark required for request changes');
      }
      const first = instance.definition.steps[0]?.stepOrder ?? 1;
      await this.db().workflowAction.create({
        data: {
          tenantId: user.tid,
          instanceId: instance.id,
          stepId: this.currentStep(instance)?.id,
          action: 'REQUEST_CHANGES',
          note: note.trim(),
          actorId: user.sub,
        },
      });
      await this.db().workflowInstance.update({
        where: { id: instance.id },
        data: {
          status: 'CHANGES_REQUESTED',
          currentStepOrder: first,
          completedAt: null,
        },
      });
      await this.db().workflowAuditLog.create({
        data: {
          tenantId: user.tid,
          instanceId: instance.id,
          event: 'REQUEST_CHANGES',
          actorId: user.sub,
          payload: { note: note.trim() },
        },
      });
      const full = await this.getInstance(user.tid, instance.id);
      await this.notifyOriginator(
        user.tid,
        full,
        'APPROVAL_CHANGES_REQUESTED',
        'Changes requested',
        note.trim(),
        opts?.link,
      );
      await this.fireStatusHook(
        user.tid,
        full,
        'REQUEST_CHANGES',
        user.sub,
        note,
      );
      return this.getStatus(user.tid, instance.entityType, instance.entityId);
    }

    if (action === 'REJECT' || action === 'APPROVE') {
      await this.assertCanAct(user, instance);
      const updated = await this.engine.action(
        user,
        instance.id,
        action,
        note,
        { skipRoleCheck: true },
      );
      const full = await this.getInstance(user.tid, instance.id);
      if (action === 'APPROVE' && updated.status === 'APPROVED') {
        await this.notifyOriginator(
          user.tid,
          full,
          'APPROVAL_APPROVED',
          opts?.title ?? 'Approved',
          note ?? 'Fully approved',
          opts?.link,
        );
      } else if (action === 'APPROVE') {
        await this.notifyPending(user.tid, full, opts?.link, opts?.title);
      } else {
        await this.notifyOriginator(
          user.tid,
          full,
          'APPROVAL_REJECTED',
          'Rejected',
          note ?? 'Rejected',
          opts?.link,
        );
      }
      await this.fireStatusHook(user.tid, full, action, user.sub, note);
      return this.getStatus(user.tid, instance.entityType, instance.entityId);
    }

    throw new BadRequestException(`Unknown action ${action}`);
  }

  async actForEntity(
    user: JwtUser,
    entityType: string,
    entityId: string,
    action: ApprovalAction,
    note?: string,
    opts?: { link?: string; title?: string },
  ) {
    const open = await this.db().workflowInstance.findFirst({
      where: {
        tenantId: user.tid,
        entityType,
        entityId,
        status: { in: [...OPEN, 'APPROVED', 'REJECTED'] },
      },
      orderBy: { updatedAt: 'desc' },
    });
    if (!open) throw new NotFoundException('No workflow instance for entity');
    return this.act(user, open.id, action, note, opts);
  }

  async getStatus(tenantId: string, entityType: string, entityId: string) {
    const instance = await this.db().workflowInstance.findFirst({
      where: { tenantId, entityType, entityId },
      include: {
        definition: {
          include: { steps: { orderBy: { stepOrder: 'asc' } } },
        },
        actions: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
      orderBy: { updatedAt: 'desc' },
    });
    if (!instance) {
      return {
        exists: false,
        entityType,
        entityId,
        instance: null,
        currentStep: null,
        pendingRole: null,
        steps: [],
      };
    }
    const currentStep = this.currentStep(instance);
    return {
      exists: true,
      entityType,
      entityId,
      instance: {
        id: instance.id,
        status: instance.status,
        currentStepOrder: instance.currentStepOrder,
        startedById: instance.startedById,
        completedAt: instance.completedAt,
        definitionCode: instance.definition.code,
      },
      currentStep: currentStep
        ? {
            id: currentStep.id,
            stepOrder: currentStep.stepOrder,
            name: currentStep.name,
            assigneeRole: currentStep.assigneeRole,
            assigneePermission: currentStep.assigneePermission,
          }
        : null,
      pendingRole: currentStep?.assigneeRole ?? null,
      steps: instance.definition.steps.map(
        (s: {
          stepOrder: number;
          name: string;
          assigneeRole: string | null;
        }) => ({
          stepOrder: s.stepOrder,
          name: s.name,
          assigneeRole: s.assigneeRole,
          done:
            instance.status === 'APPROVED' ||
            (OPEN.includes(instance.status) &&
              s.stepOrder < instance.currentStepOrder) ||
            (instance.status === 'CHANGES_REQUESTED' && false),
          current:
            OPEN.includes(instance.status) &&
            s.stepOrder === instance.currentStepOrder,
        }),
      ),
    };
  }

  async getTimeline(tenantId: string, entityType: string, entityId: string) {
    const instance = await this.db().workflowInstance.findFirst({
      where: { tenantId, entityType, entityId },
      orderBy: { updatedAt: 'desc' },
    });
    if (!instance) return [];

    const [actions, audits] = await Promise.all([
      this.db().workflowAction.findMany({
        where: { tenantId, instanceId: instance.id },
        orderBy: { createdAt: 'asc' },
      }),
      this.db().workflowAuditLog.findMany({
        where: { tenantId, instanceId: instance.id },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const events = [
      ...actions.map(
        (a: {
          id: string;
          action: string;
          note: string | null;
          actorId: string | null;
          createdAt: Date;
        }) => ({
          id: `action-${a.id}`,
          kind: 'action' as const,
          event: a.action,
          note: a.note,
          actorId: a.actorId,
          at: a.createdAt,
        }),
      ),
      ...audits.map(
        (a: {
          id: string;
          event: string;
          payload: unknown;
          actorId: string | null;
          createdAt: Date;
        }) => ({
          id: `audit-${a.id}`,
          kind: 'audit' as const,
          event: a.event,
          note: null as string | null,
          payload: a.payload,
          actorId: a.actorId,
          at: a.createdAt,
        }),
      ),
    ];
    events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    return events;
  }

  async myInbox(user: JwtUser) {
    const open = await this.db().workflowInstance.findMany({
      where: {
        tenantId: user.tid,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
      include: {
        definition: {
          include: { steps: { orderBy: { stepOrder: 'asc' } } },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });

    const mine = [];
    for (const inst of open) {
      try {
        if (await this.userCanAct(user, inst)) {
          mine.push({
            id: inst.id,
            entityType: inst.entityType,
            entityId: inst.entityId,
            status: inst.status,
            currentStepOrder: inst.currentStepOrder,
            definitionCode: inst.definition.code,
            currentStep: this.currentStep(inst),
            updatedAt: inst.updatedAt,
          });
        }
      } catch {
        /* skip */
      }
    }
    return mine;
  }

  private async getInstance(tenantId: string, id: string) {
    const instance = await this.db().workflowInstance.findFirst({
      where: { id, tenantId },
      include: {
        definition: {
          include: { steps: { orderBy: { stepOrder: 'asc' } } },
        },
      },
    });
    if (!instance) throw new NotFoundException('Workflow instance not found');
    return instance;
  }

  private currentStep(instance: {
    currentStepOrder: number;
    definition: {
      steps: Array<{
        id?: string;
        stepOrder: number;
        name?: string;
        assigneeRole?: string | null;
        assigneePermission?: string | null;
      }>;
    };
  }) {
    return (
      instance.definition.steps.find(
        (s) => s.stepOrder === instance.currentStepOrder,
      ) ?? instance.definition.steps[0]
    );
  }

  private overridePermission(instance: {
    definition: { metadata?: unknown };
  }): string {
    const meta = (instance.definition.metadata ?? {}) as Record<
      string,
      unknown
    >;
    return String(meta.overridePermission ?? 'naac-iqac:manage');
  }

  private assertOverride(
    user: JwtUser,
    instance: { definition: { metadata?: unknown } },
  ) {
    const perm = this.overridePermission(instance);
    if (
      !user.permissions?.includes(perm) &&
      !user.permissions?.includes('workflow:manage')
    ) {
      throw new ForbiddenException(`${perm} required`);
    }
  }

  private async assertCanView(
    user: JwtUser,
    instance: {
      entityType: string;
      entityId: string;
      definition: { metadata?: unknown };
    },
  ) {
    if (user.permissions?.includes(this.overridePermission(instance))) return;
    if (user.permissions?.includes('workflow:read')) return;
    // allow if assigned any role on entity
    const resolver = this.resolvers.get(instance.entityType);
    if (!resolver) return;
    for (const role of [
      'FACULTY',
      'METRIC_COORD',
      'CRITERION_COORD',
      'IQAC_COORD',
      'NAAC_COORD',
      'PRINCIPAL',
      'VERIFIER',
    ]) {
      const ids = await resolver(
        user.tid,
        instance.entityType,
        instance.entityId,
        role,
      );
      if (ids.includes(user.sub)) return;
    }
    throw new ForbiddenException('Not allowed to view this approval');
  }

  private async userCanAct(
    user: JwtUser,
    instance: {
      entityType: string;
      entityId: string;
      currentStepOrder: number;
      status: string;
      definition: {
        metadata?: unknown;
        steps: Array<{
          stepOrder: number;
          assigneeRole?: string | null;
          assigneePermission?: string | null;
        }>;
      };
    },
  ): Promise<boolean> {
    if (!['PENDING', 'IN_PROGRESS'].includes(instance.status)) return false;
    const perm = this.overridePermission(instance);
    if (user.permissions?.includes(perm)) return true;
    if (user.permissions?.includes('workflow:manage')) return true;

    const step = this.currentStep(instance);
    if (!step) return false;
    if (
      step.assigneePermission &&
      user.permissions?.includes(step.assigneePermission)
    ) {
      return true;
    }
    if (!step.assigneeRole) return false;

    const resolver = this.resolvers.get(instance.entityType);
    if (!resolver) return false;
    const roles = [step.assigneeRole];
    // IQAC_COORD also matches NAAC_COORD assignments
    if (step.assigneeRole === 'IQAC_COORD') roles.push('NAAC_COORD');

    for (const role of roles) {
      const ids = await resolver(
        user.tid,
        instance.entityType,
        instance.entityId,
        role,
      );
      if (ids.includes(user.sub)) return true;
    }
    return false;
  }

  private async assertCanAct(
    user: JwtUser,
    instance: {
      entityType: string;
      entityId: string;
      currentStepOrder: number;
      status: string;
      definition: {
        metadata?: unknown;
        steps: Array<{
          stepOrder: number;
          assigneeRole?: string | null;
          assigneePermission?: string | null;
        }>;
      };
    },
  ) {
    if (!(await this.userCanAct(user, instance))) {
      throw new ForbiddenException(
        'You are not the assignee for the current approval step',
      );
    }
  }

  private async notifyPending(
    tenantId: string,
    instance: {
      id: string;
      entityType: string;
      entityId: string;
      currentStepOrder: number;
      definition: {
        steps: Array<{
          stepOrder: number;
          name: string;
          assigneeRole?: string | null;
        }>;
      };
    },
    link?: string,
    title?: string,
  ) {
    if (!this.notifications) return;
    const step = this.currentStep(instance);
    if (!step?.assigneeRole) return;
    const resolver = this.resolvers.get(instance.entityType);
    if (!resolver) return;
    const roles = [step.assigneeRole];
    if (step.assigneeRole === 'IQAC_COORD') roles.push('NAAC_COORD');
    const userIds = new Set<string>();
    for (const role of roles) {
      for (const id of await resolver(
        tenantId,
        instance.entityType,
        instance.entityId,
        role,
      )) {
        userIds.add(id);
      }
    }
    for (const userId of userIds) {
      await this.notifications.createInApp({
        tenantId,
        userId,
        type: 'APPROVAL_PENDING',
        title: title ?? `Approval pending: ${step.name}`,
        body: `Your action is required (${step.assigneeRole}).`,
        link: link ?? '/admin/naac',
        metadata: {
          instanceId: instance.id,
          entityType: instance.entityType,
          entityId: instance.entityId,
        },
      });
    }
  }

  private async notifyOriginator(
    tenantId: string,
    instance: {
      id: string;
      startedById?: string | null;
      entityType: string;
      entityId: string;
    },
    type: string,
    title: string,
    body: string,
    link?: string,
  ) {
    if (!this.notifications || !instance.startedById) return;
    await this.notifications.createInApp({
      tenantId,
      userId: instance.startedById,
      type,
      title,
      body,
      link: link ?? '/admin/naac',
      metadata: {
        instanceId: instance.id,
        entityType: instance.entityType,
        entityId: instance.entityId,
      },
    });
  }

  private async fireStatusHook(
    tenantId: string,
    instance: {
      id: string;
      entityType: string;
      entityId: string;
      status: string;
      currentStepOrder: number;
    },
    action: string,
    actorId: string,
    note?: string,
  ) {
    const hook = this.statusHooks.get(instance.entityType);
    if (!hook) return;
    await hook(
      tenantId,
      instance.entityType,
      instance.entityId,
      instance.status,
      {
        action,
        actorId,
        note,
        currentStepOrder: instance.currentStepOrder,
        instanceId: instance.id,
      },
    );
  }
}
