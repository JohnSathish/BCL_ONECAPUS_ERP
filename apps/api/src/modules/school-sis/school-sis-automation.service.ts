import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SchoolSisService } from './school-sis.service';
import { SchoolSisPushService } from './school-sis-push.service';
import { SchoolSisWhatsappService } from './school-sis-whatsapp.service';
import { SchoolSisSmsService } from './school-sis-sms.service';
import type { SchoolErpEvent } from './school-sis-event-bus.service';
import {
  AUTO_ACTIONS,
  AUTO_TRIGGERS,
  AUTO_VARIABLES,
  DEFAULT_AUTO_TEMPLATES,
  WORKFLOW_PRESETS,
  evalConditionGroup,
  parseNaturalWorkflow,
  renderTemplate,
  type AutoGraph,
  type ConditionGroup,
  type GraphNode,
} from './school-sis-automation.catalog';
import type {
  AiWorkflowDto,
  RunAutomationDto,
  SaveAutomationSettingsDto,
  SaveAutomationTemplateDto,
  SaveAutomationWorkflowDto,
  TestAutomationDto,
} from './dto/school-automation.dto';

export type AutoActor = { userId: string; manage: boolean; execute: boolean };

const SYSTEM: AutoActor = {
  userId: '00000000-0000-0000-0000-000000000000',
  manage: true,
  execute: true,
};

@Injectable()
export class SchoolSisAutomationService implements OnModuleInit {
  private readonly logger = new Logger(SchoolSisAutomationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sis: SchoolSisService,
    private readonly push: SchoolSisPushService,
    private readonly wa: SchoolSisWhatsappService,
    private readonly sms: SchoolSisSmsService,
    @InjectQueue('school-automation') private readonly queue: Queue,
  ) {}

  async onModuleInit() {
    try {
      await this.queue.add(
        'tick',
        {},
        { repeat: { every: 300_000 }, jobId: 'school-auto-tick' },
      );
    } catch {
      /* scheduler already registered */
    }
  }

  private assert(actor: AutoActor, execute = false) {
    if (execute && !actor.execute && !actor.manage)
      throw new ForbiddenException('Not allowed');
    if (!actor.manage && !actor.execute)
      throw new ForbiddenException('Not allowed');
  }

  async ensureSetup(tenantId: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    await this.prisma.schoolAutomationSettings.upsert({
      where: { tenantId },
      create: { id: randomUUID(), tenantId },
      update: {},
    });
    if (
      (await this.prisma.schoolAutomationTemplate.count({
        where: { tenantId, deletedAt: null },
      })) === 0
    ) {
      for (const t of DEFAULT_AUTO_TEMPLATES) {
        await this.prisma.schoolAutomationTemplate.create({
          data: { id: randomUUID(), tenantId, ...t },
        });
      }
    }
  }

  private async audit(
    tenantId: string,
    actor: AutoActor,
    action: string,
    extra?: {
      workflowId?: string;
      oldJson?: object;
      newJson?: object;
      ip?: string;
    },
  ) {
    await this.prisma.schoolAutomationAuditLog.create({
      data: {
        id: randomUUID(),
        tenantId,
        userId: actor.userId,
        action,
        workflowId: extra?.workflowId,
        ip: extra?.ip,
        oldJson: (extra?.oldJson ?? {}) as Prisma.InputJsonValue,
        newJson: (extra?.newJson ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  catalog() {
    return {
      triggers: AUTO_TRIGGERS,
      actions: AUTO_ACTIONS,
      variables: AUTO_VARIABLES,
      presets: WORKFLOW_PRESETS,
    };
  }

  async dashboard(tenantId: string) {
    await this.ensureSetup(tenantId);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const week = new Date();
    week.setDate(week.getDate() - 7);
    const [
      active,
      today,
      success,
      failed,
      scheduled,
      queued,
      retrying,
      paused,
      recent,
      byDay,
    ] = await Promise.all([
      this.prisma.schoolAutomationWorkflow.count({
        where: { tenantId, status: 'ACTIVE', archivedAt: null },
      }),
      this.prisma.schoolAutomationExecution.count({
        where: { tenantId, createdAt: { gte: start } },
      }),
      this.prisma.schoolAutomationExecution.count({
        where: { tenantId, createdAt: { gte: start }, status: 'SUCCESS' },
      }),
      this.prisma.schoolAutomationExecution.count({
        where: { tenantId, createdAt: { gte: start }, status: 'FAILED' },
      }),
      this.prisma.schoolAutomationWorkflow.count({
        where: {
          tenantId,
          triggerType: { in: ['SCHEDULE', 'RELATIVE', 'RECURRING'] },
          status: 'ACTIVE',
        },
      }),
      this.prisma.schoolAutomationExecution.count({
        where: { tenantId, status: { in: ['QUEUED', 'WAITING'] } },
      }),
      this.prisma.schoolAutomationExecution.count({
        where: { tenantId, status: 'RETRYING' },
      }),
      this.prisma.schoolAutomationWorkflow.count({
        where: { tenantId, status: 'PAUSED' },
      }),
      this.prisma.schoolAutomationExecution.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 12,
        include: { workflow: { select: { name: true } } },
      }),
      this.prisma.schoolAutomationExecution.findMany({
        where: { tenantId, createdAt: { gte: week } },
        select: { createdAt: true },
      }),
    ]);
    const channels = await this.prisma.schoolAutomationExecutionStep.groupBy({
      by: ['channel', 'status'],
      where: { tenantId, createdAt: { gte: start }, channel: { not: null } },
      _count: true,
    });
    const seriesMap = new Map<string, number>();
    for (const row of byDay) {
      const key = row.createdAt.toISOString().slice(0, 10);
      seriesMap.set(key, (seriesMap.get(key) ?? 0) + 1);
    }
    return {
      active,
      executedToday: today,
      successful: success,
      failed,
      scheduled,
      queued,
      retrying,
      paused,
      messagesSent: success,
      recent,
      series: [...seriesMap.entries()].map(([date, count]) => ({
        date,
        count,
      })),
      channels,
    };
  }

  async listWorkflows(tenantId: string) {
    await this.ensureSetup(tenantId);
    return this.prisma.schoolAutomationWorkflow.findMany({
      where: { tenantId, archivedAt: null },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getWorkflow(tenantId: string, id: string) {
    const row = await this.prisma.schoolAutomationWorkflow.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Workflow not found');
    return row;
  }

  async saveWorkflow(
    tenantId: string,
    dto: SaveAutomationWorkflowDto,
    actor: AutoActor,
    id?: string,
  ) {
    this.assert(actor);
    await this.ensureSetup(tenantId);
    const graph = dto.graphJson as AutoGraph;
    if (!graph?.nodes?.length)
      throw new BadRequestException('Add at least a trigger node');
    if (id) {
      const current = await this.getWorkflow(tenantId, id);
      if (current.status === 'ACTIVE') {
        const copy = await this.prisma.schoolAutomationWorkflow.create({
          data: {
            id: randomUUID(),
            tenantId,
            name: dto.name,
            description: dto.description,
            module: dto.module ?? current.module,
            status: 'DRAFT',
            triggerType: dto.triggerType,
            triggerEvent: dto.triggerEvent,
            version: current.version + 1,
            parentId: current.parentId ?? current.id,
            graphJson: dto.graphJson as Prisma.InputJsonValue,
            scheduleJson: (dto.scheduleJson ?? {}) as Prisma.InputJsonValue,
            createdBy: actor.userId,
            updatedBy: actor.userId,
          },
        });
        await this.audit(tenantId, actor, 'CREATED', {
          workflowId: copy.id,
          newJson: dto,
        });
        return copy;
      }
      const updated = await this.prisma.schoolAutomationWorkflow.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
          module: dto.module,
          triggerType: dto.triggerType,
          triggerEvent: dto.triggerEvent,
          graphJson: dto.graphJson as Prisma.InputJsonValue,
          scheduleJson: (dto.scheduleJson ?? {}) as Prisma.InputJsonValue,
          updatedBy: actor.userId,
        },
      });
      await this.audit(tenantId, actor, 'UPDATED', {
        workflowId: id,
        oldJson: current,
        newJson: dto,
      });
      return updated;
    }
    const created = await this.prisma.schoolAutomationWorkflow.create({
      data: {
        id: randomUUID(),
        tenantId,
        name: dto.name,
        description: dto.description,
        module: dto.module ?? 'GENERAL',
        triggerType: dto.triggerType,
        triggerEvent: dto.triggerEvent,
        graphJson: dto.graphJson as Prisma.InputJsonValue,
        scheduleJson: (dto.scheduleJson ?? {}) as Prisma.InputJsonValue,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      },
    });
    await this.audit(tenantId, actor, 'CREATED', {
      workflowId: created.id,
      newJson: dto,
    });
    return created;
  }

  async setStatus(
    tenantId: string,
    id: string,
    status: string,
    actor: AutoActor,
  ) {
    this.assert(actor);
    await this.prisma.schoolAutomationWorkflow.updateMany({
      where: { id, tenantId },
      data: { status, updatedBy: actor.userId },
    });
    await this.audit(tenantId, actor, status, { workflowId: id });
    return this.getWorkflow(tenantId, id);
  }

  async archive(tenantId: string, id: string, actor: AutoActor) {
    this.assert(actor);
    await this.prisma.schoolAutomationWorkflow.updateMany({
      where: { id, tenantId },
      data: { archivedAt: new Date(), status: 'ARCHIVED' },
    });
    await this.audit(tenantId, actor, 'DELETED', { workflowId: id });
    return { ok: true };
  }

  async fromPreset(tenantId: string, presetId: string, actor: AutoActor) {
    const preset = WORKFLOW_PRESETS.find((p) => p.id === presetId);
    if (!preset) throw new NotFoundException('Preset not found');
    return this.saveWorkflow(
      tenantId,
      {
        name: preset.name,
        description: preset.description,
        module: preset.module,
        triggerType: preset.triggerType,
        triggerEvent: preset.triggerEvent,
        graphJson: preset.graph as unknown as Record<string, unknown>,
        scheduleJson: preset.scheduleJson,
      },
      actor,
    );
  }

  async fromPrompt(tenantId: string, dto: AiWorkflowDto, actor: AutoActor) {
    this.assert(actor);
    const preset = parseNaturalWorkflow(dto.prompt);
    const draft = await this.saveWorkflow(
      tenantId,
      {
        name: preset?.name ?? 'AI draft',
        description: `Generated from: ${dto.prompt.slice(0, 180)}`,
        module: preset?.module ?? 'GENERAL',
        triggerType: preset?.triggerType ?? 'EVENT',
        triggerEvent: preset?.triggerEvent ?? 'attendance.absent',
        graphJson: (preset?.graph ?? {
          nodes: [],
          edges: [],
        }) as unknown as Record<string, unknown>,
        scheduleJson: preset?.scheduleJson,
      },
      actor,
    );
    return { ...draft, reviewRequired: true, sourcePrompt: dto.prompt };
  }

  async test(
    tenantId: string,
    id: string,
    dto: TestAutomationDto,
    actor: AutoActor,
  ) {
    this.assert(actor, true);
    const wf = await this.getWorkflow(tenantId, id);
    return this.startExecution(
      tenantId,
      wf,
      {
        event: wf.triggerEvent,
        tenantId,
        studentId: dto.studentId,
        entityId: dto.studentId,
        data: dto.payload ?? {},
      },
      true,
    );
  }

  async runNow(
    tenantId: string,
    id: string,
    dto: RunAutomationDto,
    actor: AutoActor,
  ) {
    this.assert(actor, true);
    const wf = await this.getWorkflow(tenantId, id);
    if (!dto.confirm)
      throw new BadRequestException('Confirm before running this workflow');
    const ids = dto.studentIds?.length
      ? dto.studentIds
      : (
          await this.prisma.schoolStudent.findMany({
            where: { tenantId, status: 'ACTIVE', deletedAt: null },
            select: { id: true },
            take: 4000,
          })
        ).map((s) => s.id);
    if (ids.length > 40 && !dto.confirm) {
      throw new BadRequestException(
        `This workflow may send messages to ${ids.length} recipients.`,
      );
    }
    let queued = 0;
    for (const studentId of ids.slice(0, 2000)) {
      await this.queue.add('event', {
        event: wf.triggerEvent,
        tenantId,
        studentId,
        entityId: studentId,
        data: { runNow: true, workflowId: wf.id },
      });
      queued += 1;
    }
    await this.audit(tenantId, actor, 'EXECUTED', {
      workflowId: id,
      newJson: { queued },
    });
    return { queued };
  }

  async handleEvent(evt: SchoolErpEvent) {
    const workflows = await this.prisma.schoolAutomationWorkflow.findMany({
      where: {
        tenantId: evt.tenantId,
        status: 'ACTIVE',
        archivedAt: null,
        triggerEvent: evt.event,
        ...(evt.data?.workflowId ? { id: String(evt.data.workflowId) } : {}),
      },
    });
    for (const wf of workflows) {
      await this.startExecution(evt.tenantId, wf, evt, false);
    }
  }

  private async startExecution(
    tenantId: string,
    wf: {
      id: string;
      version: number;
      triggerEvent: string;
      graphJson: Prisma.JsonValue;
      name: string;
    },
    evt: SchoolErpEvent,
    testMode: boolean,
  ) {
    const day = new Date().toISOString().slice(0, 10);
    const idem = evt.data?.runNow
      ? `${wf.id}:${evt.event}:${evt.studentId ?? evt.entityId ?? 'x'}:run:${Date.now()}`
      : `${wf.id}:${evt.event}:${evt.studentId ?? evt.entityId ?? 'x'}:${day}`;
    const existing = await this.prisma.schoolAutomationExecution.findUnique({
      where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: idem } },
    });
    if (existing && !testMode) return { skipped: true, reason: 'DUPLICATE' };
    const startDay = new Date();
    startDay.setHours(0, 0, 0, 0);
    const n = await this.prisma.schoolAutomationExecution.count({
      where: { tenantId, createdAt: { gte: startDay } },
    });
    const code = `AUT-${day.replace(/-/g, '')}-${String(n + 1).padStart(6, '0')}`;
    const execution = await this.prisma.schoolAutomationExecution.create({
      data: {
        id: randomUUID(),
        tenantId,
        workflowId: wf.id,
        workflowVersion: wf.version,
        code,
        triggerEvent: evt.event,
        entityType: evt.entityType,
        entityId: evt.entityId,
        studentId: evt.studentId,
        status: 'QUEUED',
        idempotencyKey: testMode ? `${idem}:test:${randomUUID()}` : idem,
        testMode,
        payloadJson: (evt.data ?? {}) as Prisma.InputJsonValue,
      },
    });
    await this.queue.add(
      'execute',
      { tenantId, executionId: execution.id },
      {
        jobId: `exec__${execution.id}`,
        attempts: 5,
        backoff: { type: 'exponential', delay: 30_000 },
      },
    );
    return execution;
  }

  async processExecution(tenantId: string, executionId: string) {
    const execution = await this.prisma.schoolAutomationExecution.findFirst({
      where: { id: executionId, tenantId },
      include: { workflow: true },
    });
    if (
      !execution ||
      ['CANCELLED', 'SUCCESS', 'SKIPPED'].includes(execution.status)
    ) {
      return { skipped: true };
    }
    const settings = await this.prisma.schoolAutomationSettings.findUnique({
      where: { tenantId },
    });
    const emergency = Boolean(
      (execution.payloadJson as { emergency?: boolean })?.emergency,
    );
    if (
      settings?.quietHoursEnabled &&
      !emergency &&
      this.inQuiet(settings.quietFrom, settings.quietTo)
    ) {
      const delay = this.msUntil(settings.quietTo);
      await this.queue.add(
        'execute',
        { tenantId, executionId },
        { jobId: `exec__${executionId}__quiet`, delay, attempts: 3 },
      );
      await this.prisma.schoolAutomationExecution.update({
        where: { id: executionId },
        data: { status: 'WAITING' },
      });
      return { delayed: true };
    }
    await this.prisma.schoolAutomationExecution.update({
      where: { id: executionId },
      data: { status: 'RUNNING', startedAt: new Date() },
    });
    const graph = execution.workflow.graphJson as AutoGraph;
    const ctx = await this.buildContext(
      tenantId,
      execution.studentId,
      execution.payloadJson as Record<string, unknown>,
    );
    const start =
      graph.nodes.find((n) => n.type === 'TRIGGER') ?? graph.nodes[0];
    try {
      await this.walk(
        tenantId,
        execution.id,
        graph,
        start?.id,
        ctx,
        execution.testMode,
        settings?.retryAttempts ?? 5,
      );
      const failed = await this.prisma.schoolAutomationExecutionStep.count({
        where: { executionId, status: 'FAILED' },
      });
      const success = await this.prisma.schoolAutomationExecutionStep.count({
        where: { executionId, status: 'SUCCESS' },
      });
      await this.prisma.schoolAutomationExecution.update({
        where: { id: executionId },
        data: {
          status: failed && success ? 'PARTIAL' : failed ? 'FAILED' : 'SUCCESS',
          completedAt: new Date(),
          recipientLabel: String(ctx.parent_name || ctx.student_name || ''),
          channel: String(ctx._lastChannel || ''),
        },
      });
    } catch (err) {
      this.logger.error(err);
      await this.prisma.schoolAutomationExecution.update({
        where: { id: executionId },
        data: {
          status: 'FAILED',
          error: 'Unable to complete automation',
          completedAt: new Date(),
        },
      });
    }
    return { ok: true };
  }

  private nextNodes(graph: AutoGraph, source: string, handle?: 'yes' | 'no') {
    return graph.edges
      .filter(
        (e) =>
          e.source === source && (!handle || e.handle === handle || !e.handle),
      )
      .map((e) => graph.nodes.find((n) => n.id === e.target))
      .filter(Boolean) as GraphNode[];
  }

  private async walk(
    tenantId: string,
    executionId: string,
    graph: AutoGraph,
    nodeId: string | undefined,
    ctx: Record<string, unknown>,
    testMode: boolean,
    retries: number,
  ) {
    if (!nodeId) return;
    const node = graph.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    if (node.type === 'TRIGGER') {
      for (const n of this.nextNodes(graph, node.id))
        await this.walk(
          tenantId,
          executionId,
          graph,
          n.id,
          ctx,
          testMode,
          retries,
        );
      return;
    }
    if (node.type === 'CONDITION' || node.type === 'BRANCH') {
      const ok = evalConditionGroup(node.data.group as ConditionGroup, ctx);
      const next = this.nextNodes(graph, node.id, ok ? 'yes' : 'no');
      const fallback = ok ? this.nextNodes(graph, node.id) : [];
      for (const n of next.length ? next : fallback)
        await this.walk(
          tenantId,
          executionId,
          graph,
          n.id,
          ctx,
          testMode,
          retries,
        );
      return;
    }
    if (node.type === 'DELAY' || node.type === 'WAIT') {
      const ms =
        Number(node.data.ms ?? 0) || Number(node.data.minutes ?? 0) * 60_000;
      if (ms > 0 && !testMode) {
        await this.queue.add(
          'continue',
          {
            tenantId,
            executionId,
            nodeId: this.nextNodes(graph, node.id)[0]?.id,
            ctx,
          },
          { delay: ms, attempts: retries },
        );
        return;
      }
      for (const n of this.nextNodes(graph, node.id))
        await this.walk(
          tenantId,
          executionId,
          graph,
          n.id,
          ctx,
          testMode,
          retries,
        );
      return;
    }
    await this.runAction(tenantId, executionId, node, ctx, testMode);
    for (const n of this.nextNodes(graph, node.id))
      await this.walk(
        tenantId,
        executionId,
        graph,
        n.id,
        ctx,
        testMode,
        retries,
      );
  }

  async continueFrom(
    tenantId: string,
    executionId: string,
    nodeId: string,
    ctx: Record<string, unknown>,
  ) {
    const execution = await this.prisma.schoolAutomationExecution.findFirst({
      where: { id: executionId, tenantId },
      include: { workflow: true },
    });
    if (!execution) return;
    const graph = execution.workflow.graphJson as AutoGraph;
    await this.walk(
      tenantId,
      executionId,
      graph,
      nodeId,
      ctx,
      execution.testMode,
      5,
    );
  }

  private async runAction(
    tenantId: string,
    executionId: string,
    node: GraphNode,
    ctx: Record<string, unknown>,
    testMode: boolean,
  ) {
    const type = String(node.data.type || node.type);
    const channel = type.includes('WHATSAPP')
      ? 'WHATSAPP'
      : type.includes('SMS')
        ? 'SMS'
        : type.includes('EMAIL')
          ? 'EMAIL'
          : type.includes('PUSH') ||
              type.includes('NOTIFY') ||
              type.includes('IN_APP')
            ? 'PUSH'
            : type.includes('WEBHOOK')
              ? 'WEBHOOK'
              : 'SYSTEM';
    ctx._lastChannel = channel;
    const body = renderTemplate(
      String(node.data.body || node.data.title || type),
      ctx as Record<string, string>,
    );
    const title = renderTemplate(
      String(node.data.title || 'School notice'),
      ctx as Record<string, string>,
    );
    const step = await this.prisma.schoolAutomationExecutionStep.create({
      data: {
        id: randomUUID(),
        tenantId,
        executionId,
        nodeId: node.id,
        actionType: type,
        channel,
        status: testMode ? 'SUCCESS' : 'RUNNING',
        startedAt: new Date(),
        preview: body,
        provider: testMode ? 'test' : undefined,
      },
    });
    if (testMode) {
      await this.prisma.schoolAutomationExecutionStep.update({
        where: { id: step.id },
        data: { completedAt: new Date(), status: 'SUCCESS' },
      });
      return;
    }
    try {
      if (
        type === 'SEND_WHATSAPP' ||
        (type === 'SEND_SMS' && node.data.fallback && ctx._waFailed)
      ) {
        const phone = String(ctx.mobile_number || '');
        if (!phone) throw new Error('Invalid phone number');
        await this.wa.sendText(
          tenantId,
          { to: phone, body },
          {
            userId: SYSTEM.userId,
            manage: true,
            send: true,
            campaigns: true,
            settings: true,
          },
        );
      } else if (type === 'SEND_SMS') {
        const phone = String(ctx.mobile_number || '');
        await this.sms.sendTemplate(tenantId, {
          templateKey: String(node.data.templateKey || 'EMERGENCY'),
          studentId: ctx.studentId ? String(ctx.studentId) : undefined,
          mobile: phone || undefined,
          variables: Object.fromEntries(
            Object.entries(ctx).map(([k, v]) => [k, String(v ?? '')]),
          ),
          idempotencyKey: `auto:${executionId}:${node.id}:${ctx.studentId || phone || 'na'}`,
        });
      } else if (type === 'SEND_EMAIL') {
        throw new Error('Email is not configured');
      } else if (type === 'CALL_WEBHOOK' || node.type === 'WEBHOOK') {
        const url = String(node.data.url || '');
        if (!url) throw new Error('Webhook URL missing');
        const res = await fetch(url, {
          method: String(node.data.method || 'POST'),
          headers: {
            'Content-Type': 'application/json',
            ...(node.data.headers as object),
          },
          body: JSON.stringify({ tenantId, executionId, data: ctx }),
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) throw new Error('Webhook failed');
      } else if (
        type === 'SEND_PUSH' ||
        type === 'SEND_IN_APP' ||
        type === 'NOTIFY_PARENT' ||
        type === 'NOTIFY_STUDENT' ||
        type === 'NOTIFY_STAFF'
      ) {
        const userIds = (ctx._userIds as string[]) ?? [];
        if (!userIds.length) throw new Error('Invalid recipient');
        await this.push.compose(
          tenantId,
          {
            title,
            body,
            category: 'SYSTEM',
            audience: { kind: 'CUSTOM', userIds },
            confirm: true,
          },
          { userId: SYSTEM.userId, manage: true, send: true },
          true,
        );
      }
      await this.prisma.schoolAutomationExecutionStep.update({
        where: { id: step.id },
        data: {
          status: 'SUCCESS',
          completedAt: new Date(),
          provider: channel.toLowerCase(),
        },
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to complete action';
      const permanent =
        /invalid|not configured|permission|template|recipient|phone/i.test(
          message,
        );
      if (type === 'SEND_WHATSAPP') ctx._waFailed = true;
      await this.prisma.schoolAutomationExecutionStep.update({
        where: { id: step.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          error: permanent ? message : 'Unable to complete action',
        },
      });
      if (!permanent) throw err;
    }
  }

  private async buildContext(
    tenantId: string,
    studentId?: string | null,
    extra?: Record<string, unknown>,
  ) {
    const year = await this.sis.currentYear(tenantId).catch(() => null);
    const ctx: Record<string, unknown> = {
      school_name: "St. Luke's Secondary School",
      academic_year: year?.name,
      attendance_date: new Date().toLocaleDateString('en-IN'),
      ...extra,
    };
    if (!studentId) return ctx;
    const student = await this.prisma.schoolStudent.findFirst({
      where: { id: studentId, tenantId },
      include: {
        guardians: { include: { guardian: true } },
        enrollments: {
          where: { status: 'ACTIVE', deletedAt: null },
          include: { section: { include: { grade: true } } },
          take: 1,
        },
        personAccounts: true,
      },
    });
    if (!student) return ctx;
    const enr = student.enrollments[0];
    const parent =
      student.guardians.find((g) =>
        /father|parent|guardian/i.test(g.guardian.relation),
      ) ?? student.guardians[0];
    const mother = student.guardians.find((g) =>
      /mother/i.test(g.guardian.relation),
    );
    const parentUsers = student.personAccounts
      .filter((p) => p.personType === 'GUARDIAN')
      .map((p) => p.userId);
    const studentUsers = student.personAccounts
      .filter((p) => p.personType === 'STUDENT')
      .map((p) => p.userId);
    ctx.student_name = student.fullName;
    ctx.admission_number = student.admissionNumber;
    ctx.roll_number = enr?.rollNumber;
    ctx.class_name = enr?.section.grade.name;
    ctx.section = enr?.section.name;
    ctx.parent_name = parent?.guardian.fullName;
    ctx.father_name = parent?.guardian.fullName;
    ctx.mother_name = mother?.guardian.fullName;
    ctx.mobile_number = parent?.guardian.phone || student.phone;
    ctx.student_status = student.status;
    ctx._userIds = [...new Set([...parentUsers, ...studentUsers])];
    return ctx;
  }

  async tick() {
    const tenants = await this.prisma.schoolAutomationSettings.findMany({
      select: { tenantId: true },
    });
    for (const row of tenants) {
      await this.scanRelative(row.tenantId).catch((err) =>
        this.logger.error(err),
      );
      await this.retryDue(row.tenantId).catch((err) => this.logger.error(err));
    }
  }

  private async scanRelative(tenantId: string) {
    const workflows = await this.prisma.schoolAutomationWorkflow.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        archivedAt: null,
        triggerType: { in: ['RELATIVE', 'RECURRING', 'SCHEDULE'] },
      },
    });
    const year = await this.sis.currentYear(tenantId).catch(() => null);
    if (!year) return;
    for (const wf of workflows) {
      if (
        wf.triggerEvent === 'fee.due_soon' ||
        wf.triggerEvent === 'fee.due_today' ||
        wf.triggerEvent === 'fee.overdue'
      ) {
        const dues = await this.prisma.schoolFeeMonthAccount.findMany({
          where: {
            tenantId,
            academicYearId: year.id,
            status: { in: ['DUE', 'PARTIAL'] },
          },
          take: 500,
        });
        for (const due of dues) {
          await this.handleEvent({
            event: wf.triggerEvent,
            tenantId,
            studentId: due.studentId,
            entityId: due.id,
            data: {
              fee_status: 'UNPAID',
              balance_amount: Math.max(0, due.dueAmount - due.paidAmount),
              fee_amount: due.dueAmount,
              paid_amount: due.paidAmount,
              due_date: due.feeMonth,
            },
          });
        }
      }
      if (wf.triggerEvent === 'student.birthday') {
        const today = new Date();
        const people = await this.prisma.schoolStudent.findMany({
          where: {
            tenantId,
            status: 'ACTIVE',
            deletedAt: null,
            dateOfBirth: { not: null },
          },
          take: 8000,
        });
        for (const s of people) {
          const dob = s.dateOfBirth;
          if (!dob) continue;
          if (
            dob.getUTCDate() === today.getDate() &&
            dob.getUTCMonth() === today.getMonth()
          ) {
            await this.handleEvent({
              event: 'student.birthday',
              tenantId,
              studentId: s.id,
              entityId: s.id,
              data: {},
            });
          }
        }
      }
    }
  }

  private async retryDue(tenantId: string) {
    const due = await this.prisma.schoolAutomationExecutionStep.findMany({
      where: { tenantId, status: 'FAILED', nextRetryAt: { lte: new Date() } },
      take: 50,
    });
    for (const step of due) {
      await this.queue.add('execute', {
        tenantId,
        executionId: step.executionId,
      });
    }
  }

  async listExecutions(tenantId: string, status?: string) {
    return this.prisma.schoolAutomationExecution.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      include: {
        workflow: { select: { name: true, module: true } },
        steps: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 120,
    });
  }

  async getExecution(tenantId: string, id: string) {
    const row = await this.prisma.schoolAutomationExecution.findFirst({
      where: { id, tenantId },
      include: { workflow: true, steps: true },
    });
    if (!row) throw new NotFoundException('Execution not found');
    return row;
  }

  async failedJobs(tenantId: string) {
    return this.prisma.schoolAutomationExecutionStep.findMany({
      where: { tenantId, status: 'FAILED' },
      include: {
        execution: { include: { workflow: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async retryStep(tenantId: string, stepId: string, actor: AutoActor) {
    this.assert(actor, true);
    const step = await this.prisma.schoolAutomationExecutionStep.findFirst({
      where: { id: stepId, tenantId },
    });
    if (!step) throw new NotFoundException('Job not found');
    if (/invalid|not configured|permission|template/i.test(step.error ?? '')) {
      throw new BadRequestException('This failure cannot be retried');
    }
    await this.prisma.schoolAutomationExecutionStep.update({
      where: { id: stepId },
      data: { status: 'QUEUED', retryCount: { increment: 1 } },
    });
    await this.queue.add('execute', {
      tenantId,
      executionId: step.executionId,
    });
    await this.audit(tenantId, actor, 'RETRIED', {
      workflowId: undefined,
      newJson: { stepId },
    });
    return { ok: true };
  }

  async retryAllFailed(tenantId: string, actor: AutoActor) {
    const rows = await this.failedJobs(tenantId);
    let n = 0;
    for (const row of rows) {
      if (/invalid|not configured|permission/i.test(row.error ?? '')) continue;
      await this.retryStep(tenantId, row.id, actor);
      n += 1;
    }
    return { retried: n };
  }

  async reports(tenantId: string) {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const [total, success, failed, steps] = await Promise.all([
      this.prisma.schoolAutomationExecution.count({
        where: { tenantId, createdAt: { gte: start } },
      }),
      this.prisma.schoolAutomationExecution.count({
        where: { tenantId, createdAt: { gte: start }, status: 'SUCCESS' },
      }),
      this.prisma.schoolAutomationExecution.count({
        where: { tenantId, createdAt: { gte: start }, status: 'FAILED' },
      }),
      this.prisma.schoolAutomationExecutionStep.groupBy({
        by: ['channel', 'status'],
        where: { tenantId, createdAt: { gte: start } },
        _count: true,
      }),
    ]);
    return {
      total,
      success,
      failed,
      successRate: total ? success / total : 0,
      failureRate: total ? failed / total : 0,
      channels: steps,
    };
  }

  async listTemplates(tenantId: string) {
    await this.ensureSetup(tenantId);
    return this.prisma.schoolAutomationTemplate.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async saveTemplate(
    tenantId: string,
    dto: SaveAutomationTemplateDto,
    actor: AutoActor,
    id?: string,
  ) {
    this.assert(actor);
    if (id) {
      await this.prisma.schoolAutomationTemplate.updateMany({
        where: { id, tenantId },
        data: dto,
      });
    } else {
      await this.prisma.schoolAutomationTemplate.create({
        data: { id: randomUUID(), tenantId, ...dto },
      });
    }
    return this.listTemplates(tenantId);
  }

  async getSettings(tenantId: string) {
    await this.ensureSetup(tenantId);
    return this.prisma.schoolAutomationSettings.findUniqueOrThrow({
      where: { tenantId },
    });
  }

  async saveSettings(
    tenantId: string,
    dto: SaveAutomationSettingsDto,
    actor: AutoActor,
  ) {
    this.assert(actor);
    await this.ensureSetup(tenantId);
    return this.prisma.schoolAutomationSettings.update({
      where: { tenantId },
      data: dto,
    });
  }

  async logs(tenantId: string) {
    return this.prisma.schoolAutomationAuditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async createIncomingWebhook(
    tenantId: string,
    name: string,
    actor: AutoActor,
  ) {
    this.assert(actor);
    const token = randomBytes(24).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await this.prisma.schoolAutomationWebhook.create({
      data: { id: randomUUID(), tenantId, name, tokenHash },
    });
    return { token, name };
  }

  async receiveIncoming(
    token: string,
    body: {
      event: string;
      studentId?: string;
      entityId?: string;
      data?: object;
    },
    ip?: string,
  ) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const hook = await this.prisma.schoolAutomationWebhook.findFirst({
      where: { tokenHash, active: true },
    });
    if (!hook) throw new NotFoundException('Unknown webhook');
    if (
      hook.allowedIps &&
      ip &&
      !hook.allowedIps
        .split(',')
        .map((s) => s.trim())
        .includes(ip)
    ) {
      throw new ForbiddenException('Not allowed');
    }
    await this.prisma.schoolAutomationWebhook.update({
      where: { id: hook.id },
      data: { lastUsedAt: new Date() },
    });
    await this.handleEvent({
      event: body.event,
      tenantId: hook.tenantId,
      studentId: body.studentId,
      entityId: body.entityId,
      data: (body.data ?? {}) as Record<string, unknown>,
    });
    return { ok: true };
  }

  private inQuiet(from: string, to: string) {
    const [fh, fm] = from.split(':').map(Number);
    const [th, tm] = to.split(':').map(Number);
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const fromM = fh * 60 + fm;
    const toM = th * 60 + tm;
    return fromM > toM
      ? mins >= fromM || mins < toM
      : mins >= fromM && mins < toM;
  }

  private msUntil(hhmm: string) {
    const [h, m] = hhmm.split(':').map(Number);
    const next = new Date();
    next.setHours(h, m, 0, 0);
    if (next <= new Date()) next.setDate(next.getDate() + 1);
    return next.getTime() - Date.now();
  }
}
