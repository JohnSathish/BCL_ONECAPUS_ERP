import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { NAAC_CRITERIA } from '../constants/naac.constants';
import { naacDb } from './naac-prisma.util';
import { NaacEvidenceService } from './naac-evidence.service';
import { NaacAggregatorService } from './naac-aggregator.service';
import { NaacCalendarNotifyService } from './naac-calendar-notify.service';

@Injectable()
export class NaacDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evidence: NaacEvidenceService,
    private readonly aggregator: NaacAggregatorService,
    private readonly calendarNotify: NaacCalendarNotifyService,
  ) {}

  private db() {
    return naacDb(this.prisma);
  }

  async dashboard(tenantId: string) {
    const settings = await this.db().naacSettings.findUnique({
      where: { tenantId },
    });
    const academicYear = settings?.activeAqarYear ?? '2025-26';

    const [criterionStatus, pending, upcoming, aggregates, aqar] =
      await Promise.all([
        this.buildCriterionStatus(tenantId, academicYear),
        this.pendingCounts(tenantId, academicYear),
        this.db().naacCalendarEvent.findMany({
          where: { tenantId, dueDate: { gte: new Date() } },
          orderBy: { dueDate: 'asc' },
          take: 5,
        }),
        this.aggregator.summary(tenantId),
        this.db().naacAqar.findFirst({ where: { tenantId, academicYear } }),
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

    await this.db().naacReadinessSnapshot.upsert({
      where: { tenantId_academicYear: { tenantId, academicYear } },
      update: {
        overallScore: overallReadiness,
        criterionScores: criterionStatus,
        pendingCounts: pending,
        computedAt: new Date(),
      },
      create: {
        tenantId,
        academicYear,
        overallScore: overallReadiness,
        criterionScores: criterionStatus,
        pendingCounts: pending,
      },
    });

    return {
      academicYear,
      overallReadiness,
      evidenceCompleteness,
      aqarCompletionPct: aqar?.completionPct ?? 0,
      aqarStatus: aqar?.status ?? 'DRAFT',
      criterionStatus,
      pending,
      upcomingDeadlines: upcoming,
      aggregates,
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
      (c) => c.evidenceCount > 0,
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

    const statuses = await Promise.all(
      NAAC_CRITERIA.map(async (c) => {
        const metricCount = await this.db().naacMetric.count({
          where: { tenantId, criterion: { criterion: c.criterion } },
        });
        const evidenceCount = evidenceCounts[c.criterion] ?? 0;
        const baseScore = Math.min(80, evidenceCount * 8);
        const metricBonus = metricCount > 0 ? 12 : 0;
        const score = Math.min(100, baseScore + metricBonus);

        return {
          criterion: c.criterion,
          title: c.title,
          score,
          evidenceCount,
          metricCount,
          status:
            score >= 80 ? 'GOOD' : score >= 50 ? 'PARTIAL' : 'NEEDS_ATTENTION',
        };
      }),
    );

    return statuses;
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

    const [missingEvidence, deptPending, facultyPending, mandatoryTotal] =
      await Promise.all([
        this.db().naacMetric.count({
          where: {
            tenantId,
            isMandatory: true,
            code: { notIn: taggedCodes as string[] },
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
