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
import { ApprovalWorkflowService } from '../../workflow-engine/services/approval-workflow.service';
import { NAAC_CRITERIA } from '../constants/naac.constants';
import { naacDb } from './naac-prisma.util';

@Injectable()
export class NaacDvvService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly approvals?: ApprovalWorkflowService,
  ) {}

  private db() {
    return naacDb(this.prisma);
  }

  private canManage(user: JwtUser) {
    return user.permissions?.includes('naac-iqac:manage') ?? false;
  }

  onModuleInit() {
    if (!this.approvals) return;
    this.approvals.registerAssigneeResolver(
      'NaacDvvClarification',
      async (tenantId, _entityType, entityId, role) => {
        const row = await this.db().naacDvvClarification.findFirst({
          where: { id: entityId, tenantId },
          include: {
            workspace: { include: { assignments: true } },
          },
        });
        if (!row) return [];
        const roles =
          role === 'IQAC_COORD' ? ['IQAC_COORD', 'NAAC_COORD'] : [role];
        const staffIds = (row.workspace?.assignments ?? [])
          .filter((a: { role: string }) => roles.includes(a.role))
          .map((a: { staffProfileId: string }) => a.staffProfileId);
        if (role === 'METRIC_COORD' && row.assignedFacultyId) {
          staffIds.push(row.assignedFacultyId);
        }
        if (!staffIds.length) return [];
        const staff = await this.prisma.staffProfile.findMany({
          where: {
            tenantId,
            id: { in: staffIds },
            portalUserId: { not: null },
          },
          select: { portalUserId: true },
        });
        return [
          ...new Set(
            staff
              .map((s) => s.portalUserId)
              .filter((id): id is string => Boolean(id)),
          ),
        ];
      },
    );

    this.approvals.registerStatusHook(
      'NaacDvvClarification',
      async (tenantId, _et, entityId, wfStatus, payload) => {
        let status = 'IN_PROGRESS';
        if (wfStatus === 'APPROVED') status = 'SUBMITTED';
        else if (wfStatus === 'CHANGES_REQUESTED' || wfStatus === 'REJECTED') {
          status = 'CHANGES_REQUESTED';
        } else if (payload.action === 'SUBMIT' || payload.action === 'START') {
          status = 'RESPONSE_READY';
        }
        await this.db().naacDvvClarification.update({
          where: { id: entityId },
          data: {
            status,
            workflowInstanceId: payload.instanceId,
          },
        });
      },
    );
  }

  async readiness(tenantId: string, academicYear = '2025-26') {
    const [
      mandatoryMetrics,
      evidenceTags,
      departments,
      facultyPending,
      studentPending,
      workspaceCovered,
    ] = await Promise.all([
      this.db().naacMetric.findMany({
        where: { tenantId, isMandatory: true },
        include: { criterion: { select: { criterion: true, title: true } } },
      }),
      this.db().naacEvidenceTag.findMany({
        where: { tenantId, academicYear },
        select: { metricCode: true, criterion: true },
      }),
      this.prisma.department.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true, name: true, code: true },
      }),
      this.db().naacFacultyAchievement.count({
        where: { tenantId, status: 'PENDING' },
      }),
      this.db().naacStudentAchievement.count({
        where: { tenantId, status: 'PENDING' },
      }),
      this.db().naacMetricWorkspace.findMany({
        where: {
          tenantId,
          academicYear,
          OR: [
            { status: { in: ['APPROVED', 'LOCKED'] } },
            { evidence: { some: {} } },
          ],
        },
        select: {
          status: true,
          metric: { select: { code: true, isMandatory: true } },
          _count: { select: { evidence: true } },
        },
      }),
    ]);

    const taggedCodes = new Set(
      evidenceTags
        .map((t: { metricCode: string | null }) => t.metricCode)
        .filter(Boolean),
    );

    for (const ws of workspaceCovered) {
      const code = ws.metric?.code as string | undefined;
      if (!code) continue;
      if (
        ws.status === 'APPROVED' ||
        ws.status === 'LOCKED' ||
        (ws._count?.evidence ?? 0) > 0
      ) {
        taggedCodes.add(code);
      }
    }

    const metricsMissing = mandatoryMetrics
      .filter((m: { code: string }) => !taggedCodes.has(m.code))
      .map(
        (m: {
          code: string;
          title: string;
          criterion: { criterion: number; title: string };
        }) => ({
          code: m.code,
          title: m.title,
          criterion: m.criterion.criterion,
          criterionTitle: m.criterion.title,
        }),
      );

    const submissions = await this.db().naacDepartmentSubmission.findMany({
      where: {
        tenantId,
        academicYear,
        status: { in: ['SUBMITTED', 'APPROVED'] },
      },
      select: { departmentId: true },
    });
    const submittedDeptIds = new Set(
      submissions.map((s: { departmentId: string }) => s.departmentId),
    );
    const departmentsPending = departments.filter(
      (d) => !submittedDeptIds.has(d.id),
    );

    const criterionCoverage = NAAC_CRITERIA.map((c) => {
      const criterionEvidence = evidenceTags.filter(
        (t: { criterion: number }) => t.criterion === c.criterion,
      ).length;
      const workspaceEvidence = workspaceCovered.filter(
        (w: {
          metric?: { code?: string };
          _count?: { evidence: number };
          status: string;
        }) => {
          const code = w.metric?.code ?? '';
          const criterionNum = Number(code.split('.')[0]);
          return (
            criterionNum === c.criterion &&
            ((w._count?.evidence ?? 0) > 0 ||
              w.status === 'APPROVED' ||
              w.status === 'LOCKED')
          );
        },
      ).length;
      const criterionMetricsMissing = metricsMissing.filter(
        (m: { criterion: number }) => m.criterion === c.criterion,
      ).length;
      return {
        criterion: c.criterion,
        title: c.title,
        evidenceCount: criterionEvidence + workspaceEvidence,
        metricsMissing: criterionMetricsMissing,
        ready:
          criterionMetricsMissing === 0 &&
          criterionEvidence + workspaceEvidence > 0,
      };
    });

    const approvedMandatory = mandatoryMetrics.filter((m: { code: string }) =>
      taggedCodes.has(m.code),
    ).length;

    const totalChecks = mandatoryMetrics.length + departments.length;
    const passedChecks =
      approvedMandatory + (departments.length - departmentsPending.length);
    const readinessScore =
      totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;

    return {
      academicYear,
      readinessScore,
      documentsMissing: metricsMissing.length,
      metricsMissing,
      departmentsPending,
      facultyPending,
      studentPending,
      criterionCoverage,
      workspaceApprovedOrEvidenced: workspaceCovered.length,
    };
  }

  async listClarifications(
    user: JwtUser,
    opts?: {
      academicYear?: string;
      status?: string;
      metricCode?: string;
      assignedToMe?: boolean | string;
    },
  ) {
    const year = opts?.academicYear ?? '2025-26';
    const where: Record<string, unknown> = {
      tenantId: user.tid,
      academicYear: year,
    };
    if (opts?.status) where.status = opts.status;

    if (opts?.metricCode) {
      const metric = await this.db().naacMetric.findFirst({
        where: { tenantId: user.tid, code: opts.metricCode },
      });
      if (metric) where.metricId = metric.id;
    }

    if (opts?.assignedToMe === true || opts?.assignedToMe === 'true') {
      const staff = await this.prisma.staffProfile.findFirst({
        where: {
          tenantId: user.tid,
          portalUserId: user.sub,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!staff) return [];
      where.assignedFacultyId = staff.id;
    }

    return this.db().naacDvvClarification.findMany({
      where,
      include: {
        metric: {
          select: {
            code: true,
            title: true,
            criterion: { select: { criterion: true, title: true } },
          },
        },
        responses: { orderBy: { versionNo: 'desc' }, take: 1 },
        _count: { select: { comments: true, evidenceLinks: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getClarification(user: JwtUser, id: string) {
    const row = await this.db().naacDvvClarification.findFirst({
      where: { id, tenantId: user.tid },
      include: {
        metric: {
          include: { criterion: true, keyIndicator: true },
        },
        evidenceLinks: true,
        responses: { orderBy: { versionNo: 'desc' } },
        comments: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!row) throw new NotFoundException('Clarification not found');
    const approval = this.approvals
      ? await this.approvals.getStatus(user.tid, 'NaacDvvClarification', id)
      : { exists: false };
    const timeline = this.approvals
      ? await this.approvals.getTimeline(user.tid, 'NaacDvvClarification', id)
      : [];
    return { ...row, approval, timeline };
  }

  async createClarification(
    user: JwtUser,
    dto: {
      metricCode: string;
      academicYear?: string;
      queryCode: string;
      title: string;
      naacQueryText: string;
      dueDate?: string;
      assignedFacultyId?: string;
    },
  ) {
    if (
      !this.canManage(user) &&
      !user.permissions?.includes('naac-iqac:collect')
    ) {
      throw new ForbiddenException('collect or manage required');
    }
    const year = dto.academicYear ?? '2025-26';
    const metric = await this.db().naacMetric.findFirst({
      where: { tenantId: user.tid, code: dto.metricCode },
    });
    if (!metric) throw new NotFoundException('Metric not found');

    const workspace = await this.db().naacMetricWorkspace.findUnique({
      where: {
        tenantId_metricId_academicYear: {
          tenantId: user.tid,
          metricId: metric.id,
          academicYear: year,
        },
      },
    });

    return this.db().naacDvvClarification.create({
      data: {
        tenantId: user.tid,
        metricId: metric.id,
        workspaceId: workspace?.id ?? null,
        academicYear: year,
        queryCode: dto.queryCode,
        title: dto.title,
        naacQueryText: dto.naacQueryText,
        status: dto.assignedFacultyId ? 'ASSIGNED' : 'OPEN',
        assignedFacultyId: dto.assignedFacultyId ?? null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        createdById: user.sub,
      },
    });
  }

  async updateClarification(
    user: JwtUser,
    id: string,
    dto: {
      title?: string;
      naacQueryText?: string;
      status?: string;
      assignedFacultyId?: string | null;
      dueDate?: string | null;
    },
  ) {
    const row = await this.getClarification(user, id);
    if (!this.canManage(user) && row.assignedFacultyId) {
      const staff = await this.prisma.staffProfile.findFirst({
        where: { tenantId: user.tid, portalUserId: user.sub, deletedAt: null },
      });
      if (!staff || staff.id !== row.assignedFacultyId) {
        throw new ForbiddenException('Not assigned to this clarification');
      }
    }

    return this.db().naacDvvClarification.update({
      where: { id },
      data: {
        title: dto.title ?? row.title,
        naacQueryText: dto.naacQueryText ?? row.naacQueryText,
        status:
          dto.status ??
          (dto.assignedFacultyId && row.status === 'OPEN'
            ? 'ASSIGNED'
            : row.status),
        assignedFacultyId:
          dto.assignedFacultyId === undefined
            ? row.assignedFacultyId
            : dto.assignedFacultyId,
        dueDate:
          dto.dueDate === undefined
            ? row.dueDate
            : dto.dueDate
              ? new Date(dto.dueDate)
              : null,
      },
    });
  }

  async addEvidenceLink(
    user: JwtUser,
    id: string,
    dto: {
      evidenceItemId?: string;
      vaultDocumentId?: string;
      note?: string;
    },
  ) {
    await this.getClarification(user, id);
    return this.db().naacDvvEvidenceLink.create({
      data: {
        tenantId: user.tid,
        clarificationId: id,
        evidenceItemId: dto.evidenceItemId ?? null,
        vaultDocumentId: dto.vaultDocumentId ?? null,
        note: dto.note ?? null,
      },
    });
  }

  async upsertResponse(user: JwtUser, id: string, body: string) {
    if (!body?.trim()) throw new BadRequestException('Response body required');
    await this.getClarification(user, id);
    const last = await this.db().naacDvvResponseDraft.findFirst({
      where: { clarificationId: id },
      orderBy: { versionNo: 'desc' },
    });
    const versionNo = (last?.versionNo ?? 0) + 1;
    const draft = await this.db().naacDvvResponseDraft.create({
      data: {
        tenantId: user.tid,
        clarificationId: id,
        versionNo,
        body: body.trim(),
        createdById: user.sub,
      },
    });
    await this.db().naacDvvClarification.update({
      where: { id },
      data: { status: 'IN_PROGRESS' },
    });
    return draft;
  }

  async addComment(user: JwtUser, id: string, body: string) {
    if (!body?.trim()) throw new BadRequestException('Comment required');
    await this.getClarification(user, id);
    return this.db().naacDvvComment.create({
      data: {
        tenantId: user.tid,
        clarificationId: id,
        body: body.trim(),
        authorId: user.sub,
      },
    });
  }

  async submitForReview(user: JwtUser, id: string, remark?: string) {
    const row = await this.getClarification(user, id);
    if (!row.responses?.length) {
      throw new BadRequestException('Add a response draft before submitting');
    }
    await this.db().naacDvvClarification.update({
      where: { id },
      data: { status: 'RESPONSE_READY' },
    });
    if (this.approvals) {
      await this.approvals.ensureNaacDefinitions(user.tid);
      const started = await this.approvals.start(user, {
        entityType: 'NaacDvvClarification',
        entityId: id,
        definitionCode: 'NAAC_DVV_CLARIFICATION',
        link: `/admin/naac/dvv?id=${id}`,
        title: `DVV ${row.queryCode}`,
      });
      if (remark?.trim()) {
        await this.approvals.act(user, started.id, 'COMMENT', remark);
      }
      await this.db().naacDvvClarification.update({
        where: { id },
        data: { workflowInstanceId: started.id },
      });
    }
    return this.getClarification(user, id);
  }

  async approvalAct(
    user: JwtUser,
    id: string,
    action: 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT' | 'REOPEN' | 'COMMENT',
    note?: string,
  ) {
    await this.getClarification(user, id);
    if (!this.approvals) {
      throw new BadRequestException('Approval engine not available');
    }
    await this.approvals.actForEntity(
      user,
      'NaacDvvClarification',
      id,
      action,
      note,
      { link: `/admin/naac/dvv?id=${id}`, title: 'DVV clarification' },
    );
    return this.getClarification(user, id);
  }
}
