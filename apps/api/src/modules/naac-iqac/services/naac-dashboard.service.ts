import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { NAAC_CRITERIA } from '../constants/naac.constants';
import { naacDb } from './naac-prisma.util';
import { NaacEvidenceService } from './naac-evidence.service';
import { NaacAggregatorService } from './naac-aggregator.service';
import { NaacCalendarNotifyService } from './naac-calendar-notify.service';
import { NaacMetricWorkspaceService } from './naac-metric-workspace.service';

@Injectable()
export class NaacDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evidence: NaacEvidenceService,
    private readonly aggregator: NaacAggregatorService,
    private readonly calendarNotify: NaacCalendarNotifyService,
    @Inject(forwardRef(() => NaacMetricWorkspaceService))
    private readonly workspaces: NaacMetricWorkspaceService,
  ) {}

  private db() {
    return naacDb(this.prisma);
  }

  async dashboard(tenantId: string) {
    const settings = await this.db().naacSettings.findUnique({
      where: { tenantId },
    });
    const academicYear = settings?.activeAqarYear ?? '2025-26';

    await this.workspaces.ensureWorkspaces(tenantId, academicYear);

    const [
      criterionStatus,
      pending,
      upcoming,
      aggregates,
      aqar,
      workspaceRollup,
    ] = await Promise.all([
      this.buildCriterionStatus(tenantId, academicYear),
      this.pendingCounts(tenantId, academicYear),
      this.db().naacCalendarEvent.findMany({
        where: { tenantId, dueDate: { gte: new Date() } },
        orderBy: { dueDate: 'asc' },
        take: 5,
      }),
      this.aggregator.summary(tenantId),
      this.db().naacAqar.findFirst({ where: { tenantId, academicYear } }),
      this.workspacePendingSummary(tenantId, academicYear),
    ]);

    const overallReadiness =
      criterionStatus.length > 0
        ? Math.round(
            criterionStatus.reduce((s, c) => s + c.score, 0) /
              criterionStatus.length,
          )
        : 0;

    const evidenceCompleteness = this.buildEvidenceCompleteness(
      criterionStatus,
      pending,
    );

    void this.calendarNotify.processUpcomingReminders(tenantId);
    void this.workspaces.notifyApproachingDeadlines(tenantId);

    await this.db().naacReadinessSnapshot.upsert({
      where: { tenantId_academicYear: { tenantId, academicYear } },
      update: {
        overallScore: overallReadiness,
        criterionScores: criterionStatus,
        pendingCounts: { ...pending, ...workspaceRollup },
        computedAt: new Date(),
      },
      create: {
        tenantId,
        academicYear,
        overallScore: overallReadiness,
        criterionScores: criterionStatus,
        pendingCounts: { ...pending, ...workspaceRollup },
      },
    });

    return {
      academicYear,
      overallReadiness,
      evidenceCompleteness,
      aqarCompletionPct: aqar?.completionPct ?? 0,
      aqarStatus: aqar?.status ?? 'DRAFT',
      criterionStatus,
      pending: { ...pending, ...workspaceRollup },
      upcomingDeadlines: upcoming,
      aggregates,
      workspaceRollup,
    };
  }

  /** KPI pack: evidence coverage vs mandatory metrics and criterion gaps. */
  private buildEvidenceCompleteness(
    criterionStatus: Array<{
      criterion: number | string;
      title: string;
      score: number;
      evidenceCount: number;
      status: string;
    }>,
    pending: {
      missingEvidence: number;
      metricsPending: number;
      departmentPending: number;
      facultyPending: number;
    },
  ) {
    const criteriaCovered = criterionStatus.filter(
      (c) => c.evidenceCount > 0 || (c as { score: number }).score > 0,
    ).length;
    const criteriaTotal = criterionStatus.length || 1;
    const criteriaCoveragePct = Math.round(
      (criteriaCovered / criteriaTotal) * 100,
    );
    const mandatoryTotal = pending.metricsPending || 0;
    const mandatoryCovered = Math.max(
      0,
      mandatoryTotal - (pending.missingEvidence ?? 0),
    );
    const mandatoryCoveragePct =
      mandatoryTotal > 0
        ? Math.round((mandatoryCovered / mandatoryTotal) * 100)
        : 100;
    const gaps = criterionStatus
      .filter((c) => c.status === 'NEEDS_ATTENTION')
      .map((c) => ({
        criterion: String(c.criterion),
        title: c.title,
        evidenceCount: c.evidenceCount,
        score: c.score,
      }));

    return {
      criteriaCoveragePct,
      criteriaCovered,
      criteriaTotal: criterionStatus.length,
      mandatoryCoveragePct,
      mandatoryCovered,
      mandatoryTotal,
      missingEvidence: pending.missingEvidence,
      departmentPending: pending.departmentPending,
      facultyPending: pending.facultyPending,
      gaps,
    };
  }

  private async buildCriterionStatus(tenantId: string, academicYear: string) {
    const evidenceCounts = await this.evidence.countByCriterion(
      tenantId,
      academicYear,
    );

    const workspaces = await this.db().naacMetricWorkspace.findMany({
      where: { tenantId, academicYear },
      include: {
        metric: {
          select: {
            isMandatory: true,
            criterion: { select: { criterion: true } },
          },
        },
        _count: { select: { evidence: true } },
      },
    });

    const byCriterion = new Map<
      number,
      {
        total: number;
        approved: number;
        progressSum: number;
        evidenceCount: number;
        overdue: number;
      }
    >();

    for (const ws of workspaces) {
      const cNum = ws.metric?.criterion?.criterion as number | undefined;
      if (!cNum) continue;
      const bucket = byCriterion.get(cNum) ?? {
        total: 0,
        approved: 0,
        progressSum: 0,
        evidenceCount: 0,
        overdue: 0,
      };
      bucket.total += 1;
      bucket.progressSum += ws.progressPct ?? 0;
      bucket.evidenceCount += ws._count?.evidence ?? 0;
      if (ws.status === 'APPROVED' || ws.status === 'LOCKED') {
        bucket.approved += 1;
      }
      if (
        ws.deadline &&
        new Date(ws.deadline) < new Date() &&
        !['APPROVED', 'LOCKED'].includes(ws.status)
      ) {
        bucket.overdue += 1;
      }
      byCriterion.set(cNum, bucket);
    }

    return NAAC_CRITERIA.map((c) => {
      const bucket = byCriterion.get(c.criterion);
      const tagEvidence = evidenceCounts[c.criterion] ?? 0;
      const workspaceScore =
        bucket && bucket.total > 0
          ? Math.round(bucket.progressSum / bucket.total)
          : 0;
      const evidenceScore = Math.min(40, tagEvidence * 4);
      const score =
        bucket && bucket.total > 0
          ? Math.min(
              100,
              Math.round(workspaceScore * 0.85 + evidenceScore * 0.15),
            )
          : Math.min(100, evidenceScore + 12);

      return {
        criterion: c.criterion,
        title: c.title,
        score,
        evidenceCount: (bucket?.evidenceCount ?? 0) + tagEvidence,
        metricCount: bucket?.total ?? 0,
        approvedCount: bucket?.approved ?? 0,
        overdueCount: bucket?.overdue ?? 0,
        progressPct: workspaceScore,
        status:
          score >= 80 ? 'GOOD' : score >= 50 ? 'PARTIAL' : 'NEEDS_ATTENTION',
      };
    });
  }

  private async workspacePendingSummary(
    tenantId: string,
    academicYear: string,
  ) {
    const now = new Date();
    const [pendingApproval, overdueDeadlines, changesRequested] =
      await Promise.all([
        this.db().naacMetricWorkspace.count({
          where: {
            tenantId,
            academicYear,
            status: { in: ['SUBMITTED', 'UNDER_REVIEW'] },
          },
        }),
        this.db().naacMetricWorkspace.count({
          where: {
            tenantId,
            academicYear,
            deadline: { lt: now },
            status: { notIn: ['APPROVED', 'LOCKED'] },
          },
        }),
        this.db().naacMetricWorkspace.count({
          where: { tenantId, academicYear, status: 'CHANGES_REQUESTED' },
        }),
      ]);
    return { pendingApproval, overdueDeadlines, changesRequested };
  }

  private async pendingCounts(tenantId: string, academicYear: string) {
    const taggedMetrics = await this.db().naacEvidenceTag.findMany({
      where: { tenantId, academicYear, metricCode: { not: null } },
      select: { metricCode: true },
      distinct: ['metricCode'],
    });
    const taggedCodes = taggedMetrics
      .map((t: { metricCode: string | null }) => t.metricCode)
      .filter(Boolean);

    const workspaceWithEvidence = await this.db().naacMetricWorkspace.findMany({
      where: {
        tenantId,
        academicYear,
        evidence: { some: {} },
      },
      select: { metric: { select: { code: true } } },
    });
    const wsCodes = new Set(
      workspaceWithEvidence
        .map((e: { metric?: { code?: string } }) => e.metric?.code)
        .filter(Boolean) as string[],
    );
    const coveredCodes = [
      ...new Set([...(taggedCodes as string[]), ...wsCodes]),
    ];

    const [missingEvidence, deptPending, facultyPending, mandatoryTotal] =
      await Promise.all([
        this.db().naacMetric.count({
          where: {
            tenantId,
            isMandatory: true,
            code: { notIn: coveredCodes },
          },
        }),
        this.db().naacDepartmentSubmission.count({
          where: { tenantId, academicYear, status: 'SUBMITTED' },
        }),
        this.db().naacFacultyAchievement.count({
          where: { tenantId, status: 'PENDING' },
        }),
        this.db().naacMetric.count({ where: { tenantId, isMandatory: true } }),
      ]);

    return {
      missingEvidence,
      departmentPending: deptPending,
      facultyPending,
      metricsPending: mandatoryTotal,
    };
  }
}
