import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { StorageService } from '../../../shared/storage/storage.service';
import { UserNotificationsService } from '../../communication/services/user-notifications.service';
import { ApprovalWorkflowService } from '../../workflow-engine/services/approval-workflow.service';
import { naacDb } from './naac-prisma.util';

const WORKSPACE_STATUSES = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'EVIDENCE_PENDING',
  'SUBMITTED',
  'UNDER_REVIEW',
  'CHANGES_REQUESTED',
  'APPROVED',
  'LOCKED',
] as const;

const ASSIGNMENT_ROLES = [
  'NAAC_COORD',
  'IQAC_COORD',
  'CRITERION_COORD',
  'METRIC_COORD',
  'FACULTY',
  'VERIFIER',
  'PRINCIPAL',
] as const;

const STATUS_PROGRESS: Record<string, number> = {
  NOT_STARTED: 0,
  IN_PROGRESS: 25,
  EVIDENCE_PENDING: 40,
  SUBMITTED: 60,
  UNDER_REVIEW: 75,
  CHANGES_REQUESTED: 50,
  APPROVED: 100,
  LOCKED: 100,
};

@Injectable()
export class NaacMetricWorkspaceService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly notifications: UserNotificationsService,
    @Optional() private readonly approvals?: ApprovalWorkflowService,
  ) {}

  onModuleInit() {
    if (!this.approvals) return;

    this.approvals.registerAssigneeResolver(
      'NaacMetricWorkspace',
      async (tenantId, _entityType, entityId, role) => {
        const roles =
          role === 'IQAC_COORD' ? ['IQAC_COORD', 'NAAC_COORD'] : [role];
        const assignments = await this.db().naacMetricAssignment.findMany({
          where: {
            tenantId,
            workspaceId: entityId,
            role: { in: roles },
          },
          select: { staffProfileId: true },
        });
        return this.userIdsForStaff(
          tenantId,
          assignments.map((a: { staffProfileId: string }) => a.staffProfileId),
        );
      },
    );

    this.approvals.registerStatusHook(
      'NaacMetricWorkspace',
      async (tenantId, _entityType, entityId, wfStatus, payload) => {
        let nextStatus = 'UNDER_REVIEW';
        if (wfStatus === 'APPROVED') nextStatus = 'APPROVED';
        else if (wfStatus === 'CHANGES_REQUESTED' || wfStatus === 'REJECTED') {
          nextStatus = 'CHANGES_REQUESTED';
        } else if (
          payload.action === 'SUBMIT' ||
          payload.action === 'START' ||
          payload.action === 'RESUBMIT'
        ) {
          nextStatus =
            payload.currentStepOrder <= 1 ? 'SUBMITTED' : 'UNDER_REVIEW';
        } else if (payload.action === 'REOPEN') {
          nextStatus = 'IN_PROGRESS';
        } else if (wfStatus === 'IN_PROGRESS' || wfStatus === 'PENDING') {
          nextStatus =
            payload.currentStepOrder <= 1 ? 'SUBMITTED' : 'UNDER_REVIEW';
        }

        await this.db().naacMetricWorkspace.update({
          where: { id: entityId },
          data: {
            status: nextStatus,
            progressPct: STATUS_PROGRESS[nextStatus] ?? 75,
          },
        });

        await this.db().naacMetricApproval.create({
          data: {
            tenantId,
            workspaceId: entityId,
            step: payload.action,
            remark: payload.note ?? null,
            actorId: payload.actorId,
          },
        });

        await this.audit(
          tenantId,
          'NaacMetricWorkspace',
          entityId,
          payload.action,
          payload.actorId,
          {
            workflowStatus: wfStatus,
            status: nextStatus,
            instanceId: payload.instanceId,
            remark: payload.note,
          },
        );
      },
    );
  }
  private db() {
    return naacDb(this.prisma);
  }

  private canManage(user: JwtUser) {
    return user.permissions?.includes('naac-iqac:manage') ?? false;
  }

  private async resolveStaffProfile(user: JwtUser) {
    return this.prisma.staffProfile.findFirst({
      where: { tenantId: user.tid, portalUserId: user.sub, deletedAt: null },
      select: { id: true, fullName: true, employeeCode: true },
    });
  }

  private async resolveAcademicYear(tenantId: string, year?: string) {
    if (year) return year;
    const settings = await this.db().naacSettings.findUnique({
      where: { tenantId },
    });
    return settings?.activeAqarYear ?? '2025-26';
  }

  private async audit(
    tenantId: string,
    entityType: string,
    entityId: string,
    action: string,
    actorId: string | null,
    payload?: Record<string, unknown>,
  ) {
    await this.db().naacAuditEvent.create({
      data: {
        tenantId,
        entityType,
        entityId,
        action,
        actorId,
        payload: payload ?? {},
      },
    });
  }

  private async userIdsForStaff(tenantId: string, staffProfileIds: string[]) {
    if (!staffProfileIds.length) return [] as string[];
    const rows = await this.prisma.staffProfile.findMany({
      where: {
        tenantId,
        id: { in: staffProfileIds },
        deletedAt: null,
        portalUserId: { not: null },
      },
      select: { portalUserId: true },
    });
    return [
      ...new Set(
        rows
          .map((r) => r.portalUserId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
  }

  private async notifyUsers(
    tenantId: string,
    userIds: string[],
    type: string,
    title: string,
    body: string,
    link: string,
    metadata?: Record<string, unknown>,
  ) {
    for (const userId of userIds) {
      await this.notifications.createInApp({
        tenantId,
        userId,
        type,
        title,
        body,
        link,
        metadata,
      });
    }
  }

  async ensureWorkspaces(tenantId: string, academicYear: string) {
    const metrics = await this.db().naacMetric.findMany({
      where: { tenantId },
      select: { id: true },
    });
    for (const metric of metrics) {
      await this.db().naacMetricWorkspace.upsert({
        where: {
          tenantId_metricId_academicYear: {
            tenantId,
            metricId: metric.id,
            academicYear,
          },
        },
        update: {},
        create: {
          tenantId,
          metricId: metric.id,
          academicYear,
          status: 'NOT_STARTED',
          progressPct: 0,
        },
      });
    }
  }

  async getCriteriaTree(
    user: JwtUser,
    opts?: {
      academicYear?: string;
      status?: string;
      assigneeId?: string;
      mandatoryOnly?: boolean | string;
    },
  ) {
    const academicYear = await this.resolveAcademicYear(
      user.tid,
      opts?.academicYear,
    );
    await this.ensureWorkspaces(user.tid, academicYear);
    const mandatoryOnly =
      opts?.mandatoryOnly === true ||
      opts?.mandatoryOnly === 'true' ||
      opts?.mandatoryOnly === '1';

    const criteria = await this.db().naacCriterion.findMany({
      where: { tenantId: user.tid },
      orderBy: { sortOrder: 'asc' },
      include: {
        keyIndicators: {
          orderBy: { sortOrder: 'asc' },
          include: {
            metrics: {
              orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
              where: mandatoryOnly ? { isMandatory: true } : undefined,
            },
          },
        },
        metrics: {
          where: {
            keyIndicatorId: null,
            ...(mandatoryOnly ? { isMandatory: true } : {}),
          },
          orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
        },
      },
    });

    const workspaces = await this.db().naacMetricWorkspace.findMany({
      where: { tenantId: user.tid, academicYear },
      include: {
        assignments: true,
        _count: { select: { evidence: true, comments: true } },
      },
    });
    const wsByMetric = new Map(
      workspaces.map((w: { metricId: string }) => [w.metricId, w]),
    );

    const mapMetric = (m: {
      id: string;
      code: string;
      title: string;
      dataType: string;
      metricType: string;
      isMandatory: boolean;
      weightage: number | null;
    }) => {
      const ws = wsByMetric.get(m.id) as
        | {
            id: string;
            status: string;
            progressPct: number;
            deadline: Date | null;
            assignments: Array<{
              id: string;
              staffProfileId: string;
              role: string;
            }>;
            _count: { evidence: number; comments: number };
          }
        | undefined;
      if (opts?.status && ws?.status !== opts.status) return null;
      if (
        opts?.assigneeId &&
        !ws?.assignments.some((a) => a.staffProfileId === opts.assigneeId)
      ) {
        return null;
      }
      return {
        id: m.id,
        code: m.code,
        title: m.title,
        dataType: m.dataType,
        metricType: m.metricType,
        isMandatory: m.isMandatory,
        weightage: m.weightage,
        workspace: ws
          ? {
              id: ws.id,
              status: ws.status,
              progressPct: ws.progressPct,
              deadline: ws.deadline,
              evidenceCount: ws._count.evidence,
              commentCount: ws._count.comments,
              assignees: ws.assignments.map((a) => ({
                id: a.id,
                staffProfileId: a.staffProfileId,
                role: a.role,
              })),
            }
          : null,
      };
    };

    return {
      academicYear,
      criteria: criteria.map(
        (c: {
          id: string;
          criterion: number;
          title: string;
          description: string | null;
          keyIndicators: Array<{
            id: string;
            code: string;
            title: string;
            metrics: Array<{
              id: string;
              code: string;
              title: string;
              dataType: string;
              metricType: string;
              isMandatory: boolean;
              weightage: number | null;
            }>;
          }>;
          metrics: Array<{
            id: string;
            code: string;
            title: string;
            dataType: string;
            metricType: string;
            isMandatory: boolean;
            weightage: number | null;
          }>;
        }) => {
          const keyIndicators = c.keyIndicators
            .map((ki) => ({
              id: ki.id,
              code: ki.code,
              title: ki.title,
              metrics: ki.metrics.map(mapMetric).filter(Boolean),
            }))
            .filter((ki) => ki.metrics.length > 0 || !opts?.status);
          const orphanMetrics = c.metrics.map(mapMetric).filter(Boolean);
          const allMetrics = [
            ...keyIndicators.flatMap((ki) => ki.metrics),
            ...orphanMetrics,
          ];
          const approved = allMetrics.filter(
            (m) =>
              m &&
              (m.workspace?.status === 'APPROVED' ||
                m.workspace?.status === 'LOCKED'),
          ).length;
          const avgProgress =
            allMetrics.length > 0
              ? Math.round(
                  allMetrics.reduce(
                    (s, m) => s + (m?.workspace?.progressPct ?? 0),
                    0,
                  ) / allMetrics.length,
                )
              : 0;
          return {
            id: c.id,
            criterion: c.criterion,
            title: c.title,
            description: c.description,
            progressPct: avgProgress,
            approvedCount: approved,
            metricCount: allMetrics.length,
            keyIndicators,
            metrics: orphanMetrics,
          };
        },
      ),
    };
  }

  async getWorkspaceByMetricCode(
    user: JwtUser,
    code: string,
    academicYear?: string,
  ) {
    const year = await this.resolveAcademicYear(user.tid, academicYear);
    await this.ensureWorkspaces(user.tid, year);

    const metric = await this.db().naacMetric.findFirst({
      where: { tenantId: user.tid, code },
      include: {
        criterion: true,
        keyIndicator: true,
      },
    });
    if (!metric) throw new NotFoundException('Metric not found');

    let workspace = await this.db().naacMetricWorkspace.findUnique({
      where: {
        tenantId_metricId_academicYear: {
          tenantId: user.tid,
          metricId: metric.id,
          academicYear: year,
        },
      },
      include: {
        assignments: true,
        evidence: {
          orderBy: { createdAt: 'desc' },
          include: { versions: { orderBy: { versionNo: 'desc' } } },
        },
        comments: { orderBy: { createdAt: 'asc' } },
        approvals: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');

    await this.assertCanViewWorkspace(user, workspace);

    const staffIds = [
      ...new Set(
        workspace.assignments.map(
          (a: { staffProfileId: string }) => a.staffProfileId,
        ),
      ),
    ] as string[];
    const staffRows = staffIds.length
      ? await this.prisma.staffProfile.findMany({
          where: { tenantId: user.tid, id: { in: staffIds } },
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            departmentId: true,
          },
        })
      : [];
    const staffMap = new Map(staffRows.map((s) => [s.id, s]));

    const audit = await this.db().naacAuditEvent.findMany({
      where: {
        tenantId: user.tid,
        entityType: 'NaacMetricWorkspace',
        entityId: workspace.id,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const approval = this.approvals
      ? await this.approvals.getStatus(
          user.tid,
          'NaacMetricWorkspace',
          workspace.id,
        )
      : { exists: false };
    const approvalTimeline = this.approvals
      ? await this.approvals.getTimeline(
          user.tid,
          'NaacMetricWorkspace',
          workspace.id,
        )
      : [];

    return {
      academicYear: year,
      metric,
      workspace: {
        ...workspace,
        assignments: workspace.assignments.map(
          (a: {
            id: string;
            staffProfileId: string;
            role: string;
            assignedById: string | null;
            createdAt: Date;
          }) => ({
            ...a,
            staff: staffMap.get(a.staffProfileId) ?? null,
          }),
        ),
      },
      history: audit,
      approval,
      approvalTimeline,
    };
  }

  private async assertCanViewWorkspace(
    user: JwtUser,
    workspace: { assignments: Array<{ staffProfileId: string }> },
  ) {
    if (this.canManage(user)) return;
    if (user.permissions?.includes('naac-iqac:reports')) return;
    if (user.permissions?.includes('naac-iqac:read')) return;
    const staff = await this.resolveStaffProfile(user);
    if (!staff) {
      throw new ForbiddenException('No staff profile linked to your account');
    }
    const assigned = workspace.assignments.some(
      (a) => a.staffProfileId === staff.id,
    );
    if (!assigned) {
      throw new ForbiddenException('You are not assigned to this metric');
    }
  }

  private async loadWorkspace(tenantId: string, id: string) {
    const workspace = await this.db().naacMetricWorkspace.findFirst({
      where: { id, tenantId },
      include: {
        assignments: true,
        metric: {
          include: { criterion: true },
        },
      },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');
    return workspace;
  }

  async patchWorkspace(
    user: JwtUser,
    id: string,
    dto: {
      progressPct?: number;
      deadline?: string | null;
      narrativeDraft?: string;
      status?: string;
      erpSourceHints?: Record<string, unknown>;
    },
  ) {
    const workspace = await this.loadWorkspace(user.tid, id);
    await this.assertCanViewWorkspace(user, workspace);
    if (workspace.status === 'LOCKED' && !this.canManage(user)) {
      throw new ForbiddenException('Workspace is locked');
    }

    if (dto.status && !WORKSPACE_STATUSES.includes(dto.status as any)) {
      throw new BadRequestException('Invalid status');
    }

    const data: Record<string, unknown> = {};
    if (dto.progressPct !== undefined) data.progressPct = dto.progressPct;
    if (dto.deadline !== undefined) {
      data.deadline = dto.deadline ? new Date(dto.deadline) : null;
    }
    if (dto.narrativeDraft !== undefined)
      data.narrativeDraft = dto.narrativeDraft;
    if (dto.erpSourceHints !== undefined)
      data.erpSourceHints = dto.erpSourceHints;
    if (dto.status) {
      if (!this.canManage(user)) {
        throw new ForbiddenException('Only managers can set status directly');
      }
      data.status = dto.status;
      if (dto.progressPct === undefined) {
        data.progressPct = STATUS_PROGRESS[dto.status] ?? workspace.progressPct;
      }
    } else if (
      workspace.status === 'NOT_STARTED' &&
      (dto.narrativeDraft || dto.progressPct)
    ) {
      data.status = 'IN_PROGRESS';
      if (dto.progressPct === undefined) data.progressPct = 25;
    }

    const updated = await this.db().naacMetricWorkspace.update({
      where: { id },
      data,
    });
    await this.audit(
      user.tid,
      'NaacMetricWorkspace',
      id,
      'UPDATE',
      user.sub,
      data,
    );
    return updated;
  }

  async addAssignment(
    user: JwtUser,
    workspaceId: string,
    dto: { staffProfileId: string; role: string },
  ) {
    if (!this.canManage(user)) {
      throw new ForbiddenException('Manage permission required');
    }
    if (!ASSIGNMENT_ROLES.includes(dto.role as any)) {
      throw new BadRequestException('Invalid assignment role');
    }
    const workspace = await this.loadWorkspace(user.tid, workspaceId);
    const staff = await this.prisma.staffProfile.findFirst({
      where: {
        id: dto.staffProfileId,
        tenantId: user.tid,
        deletedAt: null,
      },
    });
    if (!staff) throw new NotFoundException('Staff profile not found');

    const row = await this.db().naacMetricAssignment.upsert({
      where: {
        workspaceId_staffProfileId_role: {
          workspaceId,
          staffProfileId: dto.staffProfileId,
          role: dto.role,
        },
      },
      update: {},
      create: {
        tenantId: user.tid,
        workspaceId,
        staffProfileId: dto.staffProfileId,
        role: dto.role,
        assignedById: user.sub,
      },
    });

    if (dto.role === 'CRITERION_COORD') {
      await this.db().naacMetricWorkspace.update({
        where: { id: workspaceId },
        data: { criterionCoordinatorId: dto.staffProfileId },
      });
    }

    await this.audit(
      user.tid,
      'NaacMetricWorkspace',
      workspaceId,
      'ASSIGN',
      user.sub,
      { staffProfileId: dto.staffProfileId, role: dto.role },
    );

    const userIds = await this.userIdsForStaff(user.tid, [dto.staffProfileId]);
    const code = workspace.metric?.code ?? '';
    await this.notifyUsers(
      user.tid,
      userIds,
      'NAAC_METRIC_ASSIGNED',
      `Assigned to NAAC metric ${code}`,
      `You were assigned as ${dto.role} for metric ${code}.`,
      `/admin/naac/criteria?metric=${code}`,
      { workspaceId, role: dto.role },
    );

    return row;
  }

  async removeAssignment(
    user: JwtUser,
    workspaceId: string,
    assignmentId: string,
  ) {
    if (!this.canManage(user)) {
      throw new ForbiddenException('Manage permission required');
    }
    const row = await this.db().naacMetricAssignment.findFirst({
      where: { id: assignmentId, workspaceId, tenantId: user.tid },
    });
    if (!row) throw new NotFoundException('Assignment not found');
    await this.db().naacMetricAssignment.delete({
      where: { id: assignmentId },
    });
    await this.audit(
      user.tid,
      'NaacMetricWorkspace',
      workspaceId,
      'UNASSIGN',
      user.sub,
      { assignmentId, staffProfileId: row.staffProfileId, role: row.role },
    );
    return { ok: true };
  }

  async addEvidence(
    user: JwtUser,
    workspaceId: string,
    dto: {
      title: string;
      evidenceType?: string;
      notes?: string;
      externalUrl?: string;
      storageKey?: string;
      fileName?: string;
      mimeType?: string;
      fileSize?: number;
      changeNote?: string;
    },
    file?: Express.Multer.File,
  ) {
    const workspace = await this.loadWorkspace(user.tid, workspaceId);
    await this.assertCanViewWorkspace(user, workspace);
    if (workspace.status === 'LOCKED') {
      throw new ForbiddenException('Workspace is locked');
    }

    let storageKey = dto.storageKey ?? null;
    let fileName = dto.fileName ?? null;
    let mimeType = dto.mimeType ?? null;
    let fileSize = dto.fileSize ?? null;
    let externalUrl = dto.externalUrl ?? null;

    if (file?.buffer?.length) {
      storageKey = `naac/${user.tid}/workspace/${workspaceId}/${Date.now()}-${file.originalname}`;
      await this.storage.put(storageKey, file.buffer, {
        contentType: file.mimetype,
      });
      fileName = file.originalname;
      mimeType = file.mimetype;
      fileSize = file.size;
    }

    if (!storageKey && !externalUrl) {
      throw new BadRequestException('File or external URL is required');
    }

    const evidenceType =
      dto.evidenceType ?? (externalUrl && !storageKey ? 'LINK' : 'FILE');

    const item = await this.db().naacEvidenceItem.create({
      data: {
        tenantId: user.tid,
        workspaceId,
        title: dto.title,
        evidenceType,
        notes: dto.notes,
        createdById: user.sub,
        versions: {
          create: {
            tenantId: user.tid,
            versionNo: 1,
            storageKey,
            fileName,
            mimeType,
            fileSize,
            externalUrl,
            changeNote: dto.changeNote ?? 'Initial upload',
            uploadedById: user.sub,
          },
        },
      },
      include: { versions: true },
    });

    if (
      workspace.status === 'NOT_STARTED' ||
      workspace.status === 'CHANGES_REQUESTED'
    ) {
      await this.db().naacMetricWorkspace.update({
        where: { id: workspaceId },
        data: {
          status:
            workspace.status === 'CHANGES_REQUESTED'
              ? 'IN_PROGRESS'
              : 'EVIDENCE_PENDING',
          progressPct:
            workspace.status === 'CHANGES_REQUESTED'
              ? 50
              : Math.max(workspace.progressPct, 40),
        },
      });
    }

    await this.audit(
      user.tid,
      'NaacEvidenceItem',
      item.id,
      'CREATE',
      user.sub,
      { workspaceId, title: dto.title },
    );
    return item;
  }

  async addEvidenceVersion(
    user: JwtUser,
    evidenceId: string,
    dto: {
      externalUrl?: string;
      changeNote?: string;
      storageKey?: string;
      fileName?: string;
      mimeType?: string;
      fileSize?: number;
    },
    file?: Express.Multer.File,
  ) {
    const item = await this.db().naacEvidenceItem.findFirst({
      where: { id: evidenceId, tenantId: user.tid },
      include: {
        workspace: { include: { assignments: true } },
        versions: { orderBy: { versionNo: 'desc' }, take: 1 },
      },
    });
    if (!item) throw new NotFoundException('Evidence not found');
    await this.assertCanViewWorkspace(user, item.workspace);
    if (item.workspace.status === 'LOCKED') {
      throw new ForbiddenException('Workspace is locked');
    }

    let storageKey = dto.storageKey ?? null;
    let fileName = dto.fileName ?? null;
    let mimeType = dto.mimeType ?? null;
    let fileSize = dto.fileSize ?? null;
    let externalUrl = dto.externalUrl ?? null;

    if (file?.buffer?.length) {
      storageKey = `naac/${user.tid}/workspace/${item.workspaceId}/${Date.now()}-v-${file.originalname}`;
      await this.storage.put(storageKey, file.buffer, {
        contentType: file.mimetype,
      });
      fileName = file.originalname;
      mimeType = file.mimetype;
      fileSize = file.size;
    }
    if (!storageKey && !externalUrl) {
      throw new BadRequestException('File or external URL is required');
    }

    const nextNo = (item.versions[0]?.versionNo ?? 0) + 1;
    const version = await this.db().naacEvidenceVersion.create({
      data: {
        tenantId: user.tid,
        evidenceItemId: evidenceId,
        versionNo: nextNo,
        storageKey,
        fileName,
        mimeType,
        fileSize,
        externalUrl,
        changeNote: dto.changeNote ?? `Version ${nextNo}`,
        uploadedById: user.sub,
      },
    });

    await this.db().naacEvidenceItem.update({
      where: { id: evidenceId },
      data: { verificationStatus: 'PENDING' },
    });

    await this.audit(
      user.tid,
      'NaacEvidenceItem',
      evidenceId,
      'VERSION',
      user.sub,
      { versionNo: nextNo },
    );
    return version;
  }

  async verifyEvidence(
    user: JwtUser,
    evidenceId: string,
    dto: { verificationStatus: string; notes?: string },
  ) {
    if (!['PENDING', 'VERIFIED', 'REJECTED'].includes(dto.verificationStatus)) {
      throw new BadRequestException('Invalid verification status');
    }
    const item = await this.db().naacEvidenceItem.findFirst({
      where: { id: evidenceId, tenantId: user.tid },
      include: { workspace: { include: { assignments: true } } },
    });
    if (!item) throw new NotFoundException('Evidence not found');

    const manage = this.canManage(user);
    const staff = await this.resolveStaffProfile(user);
    const isVerifier = item.workspace.assignments.some(
      (a: { staffProfileId: string; role: string }) =>
        staff &&
        a.staffProfileId === staff.id &&
        (a.role === 'VERIFIER' ||
          a.role === 'METRIC_COORD' ||
          a.role === 'CRITERION_COORD'),
    );
    if (!manage && !isVerifier) {
      throw new ForbiddenException('Verifier or manage permission required');
    }

    const updated = await this.db().naacEvidenceItem.update({
      where: { id: evidenceId },
      data: {
        verificationStatus: dto.verificationStatus,
        notes: dto.notes ?? item.notes,
      },
    });
    await this.audit(
      user.tid,
      'NaacEvidenceItem',
      evidenceId,
      'VERIFY',
      user.sub,
      { verificationStatus: dto.verificationStatus },
    );
    return updated;
  }

  private async transition(
    user: JwtUser,
    workspaceId: string,
    step: string,
    nextStatus: string,
    remark?: string,
    notifyType?: string,
    notifyTitle?: string,
  ) {
    const workspace = await this.loadWorkspace(user.tid, workspaceId);
    await this.assertCanViewWorkspace(user, workspace);
    if (workspace.status === 'LOCKED' && step !== 'REOPEN') {
      throw new ForbiddenException('Workspace is locked');
    }

    const updated = await this.db().naacMetricWorkspace.update({
      where: { id: workspaceId },
      data: {
        status: nextStatus,
        progressPct: STATUS_PROGRESS[nextStatus] ?? workspace.progressPct,
      },
    });

    await this.db().naacMetricApproval.create({
      data: {
        tenantId: user.tid,
        workspaceId,
        step,
        remark: remark ?? null,
        actorId: user.sub,
      },
    });

    await this.audit(
      user.tid,
      'NaacMetricWorkspace',
      workspaceId,
      step,
      user.sub,
      { status: nextStatus, remark },
    );

    if (notifyType && notifyTitle) {
      const staffIds = workspace.assignments.map(
        (a: { staffProfileId: string }) => a.staffProfileId,
      );
      const userIds = await this.userIdsForStaff(user.tid, staffIds);
      const code = workspace.metric?.code ?? '';
      await this.notifyUsers(
        user.tid,
        userIds,
        notifyType,
        notifyTitle,
        remark || `Metric ${code} is now ${nextStatus}`,
        `/admin/naac/criteria?metric=${code}`,
        { workspaceId, status: nextStatus },
      );
    }

    return updated;
  }

  async submit(user: JwtUser, workspaceId: string, remark?: string) {
    const workspace = await this.loadWorkspace(user.tid, workspaceId);
    await this.assertCanViewWorkspace(user, workspace);
    if (workspace.status === 'LOCKED') {
      throw new ForbiddenException('Workspace is locked');
    }

    if (this.approvals) {
      await this.approvals.ensureNaacDefinitions(user.tid);
      const code = workspace.metric?.code ?? '';
      await this.approvals.start(user, {
        entityType: 'NaacMetricWorkspace',
        entityId: workspaceId,
        definitionCode: 'NAAC_METRIC_APPROVAL',
        link: `/admin/naac/criteria?metric=${code}`,
        title: `NAAC metric ${code} submitted`,
      });
      if (remark?.trim()) {
        await this.approvals.actForEntity(
          user,
          'NaacMetricWorkspace',
          workspaceId,
          'COMMENT',
          remark,
        );
      }
      return this.loadWorkspace(user.tid, workspaceId);
    }

    return this.transition(
      user,
      workspaceId,
      'SUBMITTED',
      'SUBMITTED',
      remark,
      'NAAC_METRIC_SUBMITTED',
      'NAAC metric submitted for review',
    );
  }

  async verify(user: JwtUser, workspaceId: string, remark?: string) {
    // Legacy "verify" = approve current workflow step (Metric Coord+)
    if (this.approvals) {
      return this.approvalAct(user, workspaceId, 'APPROVE', remark);
    }
    if (!this.canManage(user)) {
      const workspace = await this.loadWorkspace(user.tid, workspaceId);
      const staff = await this.resolveStaffProfile(user);
      const ok = workspace.assignments.some(
        (a: { staffProfileId: string; role: string }) =>
          staff &&
          a.staffProfileId === staff.id &&
          [
            'VERIFIER',
            'METRIC_COORD',
            'CRITERION_COORD',
            'NAAC_COORD',
            'IQAC_COORD',
          ].includes(a.role),
      );
      if (!ok) throw new ForbiddenException('Verifier role required');
    }
    return this.transition(
      user,
      workspaceId,
      'VERIFIED',
      'UNDER_REVIEW',
      remark,
      'NAAC_METRIC_UNDER_REVIEW',
      'NAAC metric under review',
    );
  }

  async approve(user: JwtUser, workspaceId: string, remark?: string) {
    if (this.approvals) {
      return this.approvalAct(user, workspaceId, 'APPROVE', remark);
    }
    if (!this.canManage(user)) {
      throw new ForbiddenException('Manage permission required to approve');
    }
    return this.transition(
      user,
      workspaceId,
      'APPROVED',
      'APPROVED',
      remark,
      'NAAC_METRIC_APPROVED',
      'NAAC metric approved',
    );
  }

  async reject(user: JwtUser, workspaceId: string, remark?: string) {
    if (this.approvals) {
      return this.approvalAct(user, workspaceId, 'REQUEST_CHANGES', remark);
    }
    if (!this.canManage(user)) {
      throw new ForbiddenException('Manage permission required to reject');
    }
    return this.transition(
      user,
      workspaceId,
      'REJECTED',
      'CHANGES_REQUESTED',
      remark,
      'NAAC_METRIC_CHANGES_REQUESTED',
      'Changes requested on NAAC metric',
    );
  }

  async reopen(user: JwtUser, workspaceId: string, remark?: string) {
    if (this.approvals) {
      return this.approvalAct(user, workspaceId, 'REOPEN', remark);
    }
    if (!this.canManage(user)) {
      throw new ForbiddenException('Manage permission required to reopen');
    }
    return this.transition(
      user,
      workspaceId,
      'REOPEN',
      'IN_PROGRESS',
      remark,
      'NAAC_METRIC_REOPENED',
      'NAAC metric reopened',
    );
  }

  private async approvalAct(
    user: JwtUser,
    workspaceId: string,
    action: 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT' | 'REOPEN' | 'COMMENT',
    remark?: string,
  ) {
    const workspace = await this.loadWorkspace(user.tid, workspaceId);
    await this.assertCanViewWorkspace(user, workspace);
    const code = workspace.metric?.code ?? '';
    await this.approvals!.actForEntity(
      user,
      'NaacMetricWorkspace',
      workspaceId,
      action,
      remark,
      {
        link: `/admin/naac/criteria?metric=${code}`,
        title: `NAAC metric ${code}`,
      },
    );
    return this.loadWorkspace(user.tid, workspaceId);
  }

  async getApprovalStatus(user: JwtUser, workspaceId: string) {
    await this.assertCanViewWorkspace(
      user,
      await this.loadWorkspace(user.tid, workspaceId),
    );
    if (!this.approvals) return { exists: false };
    return this.approvals.getStatus(
      user.tid,
      'NaacMetricWorkspace',
      workspaceId,
    );
  }

  async getApprovalTimeline(user: JwtUser, workspaceId: string) {
    await this.assertCanViewWorkspace(
      user,
      await this.loadWorkspace(user.tid, workspaceId),
    );
    if (!this.approvals) return [];
    return this.approvals.getTimeline(
      user.tid,
      'NaacMetricWorkspace',
      workspaceId,
    );
  }

  async lock(user: JwtUser, workspaceId: string, remark?: string) {
    if (!this.canManage(user)) {
      throw new ForbiddenException('Manage permission required to lock');
    }
    return this.transition(user, workspaceId, 'LOCKED', 'LOCKED', remark);
  }

  async listComments(user: JwtUser, workspaceId: string) {
    const workspace = await this.loadWorkspace(user.tid, workspaceId);
    await this.assertCanViewWorkspace(user, workspace);
    return this.db().naacMetricComment.findMany({
      where: { tenantId: user.tid, workspaceId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addComment(user: JwtUser, workspaceId: string, body: string) {
    if (!body?.trim()) throw new BadRequestException('Comment body required');
    const workspace = await this.loadWorkspace(user.tid, workspaceId);
    await this.assertCanViewWorkspace(user, workspace);
    const row = await this.db().naacMetricComment.create({
      data: {
        tenantId: user.tid,
        workspaceId,
        body: body.trim(),
        authorId: user.sub,
      },
    });
    await this.audit(
      user.tid,
      'NaacMetricWorkspace',
      workspaceId,
      'COMMENT',
      user.sub,
      { commentId: row.id },
    );
    return row;
  }

  async myWorkspaces(user: JwtUser, academicYear?: string) {
    const year = await this.resolveAcademicYear(user.tid, academicYear);
    await this.ensureWorkspaces(user.tid, year);

    if (this.canManage(user)) {
      const items = await this.db().naacMetricWorkspace.findMany({
        where: { tenantId: user.tid, academicYear: year },
        include: {
          metric: {
            include: {
              criterion: { select: { criterion: true, title: true } },
              keyIndicator: { select: { code: true, title: true } },
            },
          },
          assignments: true,
          _count: { select: { evidence: true, comments: true } },
        },
        orderBy: { updatedAt: 'desc' },
      });
      return { academicYear: year, scope: 'manage', items };
    }

    const staff = await this.resolveStaffProfile(user);
    if (!staff) {
      return { academicYear: year, scope: 'assigned', items: [] };
    }

    const assignments = await this.db().naacMetricAssignment.findMany({
      where: { tenantId: user.tid, staffProfileId: staff.id },
      select: { workspaceId: true, role: true },
    });
    const workspaceIds = [
      ...new Set(
        assignments.map((a: { workspaceId: string }) => a.workspaceId),
      ),
    ];
    if (!workspaceIds.length) {
      return { academicYear: year, scope: 'assigned', items: [] };
    }

    const items = await this.db().naacMetricWorkspace.findMany({
      where: {
        tenantId: user.tid,
        academicYear: year,
        id: { in: workspaceIds },
      },
      include: {
        metric: {
          include: {
            criterion: { select: { criterion: true, title: true } },
            keyIndicator: { select: { code: true, title: true } },
          },
        },
        assignments: true,
        _count: { select: { evidence: true, comments: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return { academicYear: year, scope: 'assigned', items };
  }

  async notifyApproachingDeadlines(tenantId: string) {
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const rows = await this.db().naacMetricWorkspace.findMany({
      where: {
        tenantId,
        deadline: { gte: now, lte: in7 },
        status: {
          notIn: ['APPROVED', 'LOCKED'],
        },
      },
      include: {
        assignments: true,
        metric: { select: { code: true, title: true } },
      },
    });
    let notified = 0;
    for (const ws of rows) {
      const staffIds = ws.assignments.map(
        (a: { staffProfileId: string }) => a.staffProfileId,
      );
      const userIds = await this.userIdsForStaff(tenantId, staffIds);
      const due = new Date(ws.deadline!).toLocaleDateString('en-IN');
      const link = `/admin/naac/criteria?metric=${ws.metric.code}`;
      for (const userId of userIds) {
        const existing = await this.prisma.userNotification.count({
          where: {
            tenantId,
            userId,
            type: 'NAAC_METRIC_DEADLINE',
            link,
          },
        });
        if (existing > 0) continue;
        await this.notifications.createInApp({
          tenantId,
          userId,
          type: 'NAAC_METRIC_DEADLINE',
          title: `NAAC deadline soon: ${ws.metric.code}`,
          body: `${ws.metric.title} due ${due}`,
          link,
          metadata: { workspaceId: ws.id },
        });
        notified += 1;
      }
    }
    return { notified };
  }
}
