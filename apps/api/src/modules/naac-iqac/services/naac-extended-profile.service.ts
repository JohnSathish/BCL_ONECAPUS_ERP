import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { NaacAggregatorService } from './naac-aggregator.service';
import { naacDb } from './naac-prisma.util';

@Injectable()
export class NaacExtendedProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aggregator: NaacAggregatorService,
  ) {}

  private db() {
    return naacDb(this.prisma);
  }

  private canManage(user: JwtUser) {
    return (
      user.permissions?.includes('naac-iqac:manage') ||
      user.permissions?.includes('naac-iqac:collect') ||
      false
    );
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

  async get(tenantId: string, academicYear?: string) {
    const year = await this.resolveAcademicYear(tenantId, academicYear);
    const row = await this.db().naacExtendedProfile.findUnique({
      where: { tenantId_academicYear: { tenantId, academicYear: year } },
    });
    return {
      academicYear: year,
      profile: row,
      exists: Boolean(row),
    };
  }

  async pull(user: JwtUser, academicYear?: string) {
    if (!this.canManage(user)) {
      throw new ForbiddenException('collect or manage permission required');
    }
    const year = await this.resolveAcademicYear(user.tid, academicYear);
    const sections = await this.aggregator.pullExtendedProfile(user.tid, year);
    const row = await this.db().naacExtendedProfile.upsert({
      where: {
        tenantId_academicYear: { tenantId: user.tid, academicYear: year },
      },
      update: {
        sections,
        lastPulledAt: new Date(),
        pulledById: user.sub,
      },
      create: {
        tenantId: user.tid,
        academicYear: year,
        sections,
        lastPulledAt: new Date(),
        pulledById: user.sub,
      },
    });
    await this.audit(
      user.tid,
      'NaacExtendedProfile',
      row.id,
      'PULL_ERP',
      user.sub,
      { academicYear: year },
    );
    return row;
  }

  async pullWorkspaceErp(user: JwtUser, workspaceId: string) {
    if (
      !this.canManage(user) &&
      !user.permissions?.includes('naac-iqac:read')
    ) {
      // collect already in canManage; portal assignees use collect via portal routes
    }
    if (
      !user.permissions?.includes('naac-iqac:manage') &&
      !user.permissions?.includes('naac-iqac:collect')
    ) {
      throw new ForbiddenException('collect or manage permission required');
    }

    const workspace = await this.db().naacMetricWorkspace.findFirst({
      where: { id: workspaceId, tenantId: user.tid },
      include: {
        metric: {
          include: { criterion: { select: { criterion: true } } },
        },
        assignments: true,
      },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');

    if (!user.permissions?.includes('naac-iqac:manage')) {
      const staff = await this.prisma.staffProfile.findFirst({
        where: {
          tenantId: user.tid,
          portalUserId: user.sub,
          deletedAt: null,
        },
        select: { id: true },
      });
      const assigned = workspace.assignments.some(
        (a: { staffProfileId: string }) =>
          staff && a.staffProfileId === staff.id,
      );
      if (!assigned && !user.permissions?.includes('naac-iqac:read')) {
        throw new ForbiddenException('Not assigned to this metric');
      }
    }

    const hints = await this.aggregator.hintsForMetric(user.tid, {
      metricCode: workspace.metric.code,
      erpSourceKey: workspace.metric.erpSourceKey,
      criterion: workspace.metric.criterion?.criterion,
    });

    const data: Record<string, unknown> = {
      erpSourceHints: hints,
    };
    if (workspace.status === 'NOT_STARTED') {
      data.status = 'IN_PROGRESS';
      data.progressPct = Math.max(workspace.progressPct ?? 0, 25);
    }

    const updated = await this.db().naacMetricWorkspace.update({
      where: { id: workspaceId },
      data,
    });

    await this.audit(
      user.tid,
      'NaacMetricWorkspace',
      workspaceId,
      'PULL_ERP',
      user.sub,
      {
        metricCode: workspace.metric.code,
        erpSourceKey: workspace.metric.erpSourceKey,
      },
    );

    return { workspace: updated, hints };
  }

  async pullErpBulk(
    user: JwtUser,
    opts?: { criterion?: number; academicYear?: string },
  ) {
    if (!user.permissions?.includes('naac-iqac:manage')) {
      throw new ForbiddenException('manage permission required');
    }
    const year = await this.resolveAcademicYear(user.tid, opts?.academicYear);
    const where: Record<string, unknown> = {
      tenantId: user.tid,
      academicYear: year,
    };
    if (opts?.criterion) {
      where.metric = { criterion: { criterion: opts.criterion } };
    }

    const workspaces = await this.db().naacMetricWorkspace.findMany({
      where,
      include: {
        metric: {
          include: { criterion: { select: { criterion: true } } },
        },
      },
    });

    let updated = 0;
    for (const ws of workspaces) {
      const hints = await this.aggregator.hintsForMetric(user.tid, {
        metricCode: ws.metric.code,
        erpSourceKey: ws.metric.erpSourceKey,
        criterion: ws.metric.criterion?.criterion,
      });
      const data: Record<string, unknown> = { erpSourceHints: hints };
      if (ws.status === 'NOT_STARTED') {
        data.status = 'IN_PROGRESS';
        data.progressPct = Math.max(ws.progressPct ?? 0, 25);
      }
      await this.db().naacMetricWorkspace.update({
        where: { id: ws.id },
        data,
      });
      updated += 1;
    }

    await this.audit(
      user.tid,
      'NaacExtendedProfile',
      user.tid,
      'PULL_ERP_BULK',
      user.sub,
      {
        academicYear: year,
        criterion: opts?.criterion ?? null,
        updated,
      },
    );

    return { academicYear: year, updated };
  }
}
