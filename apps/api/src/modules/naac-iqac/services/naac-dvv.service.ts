import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { NAAC_CRITERIA } from '../constants/naac.constants';
import { naacDb } from './naac-prisma.util';

@Injectable()
export class NaacDvvService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return naacDb(this.prisma);
  }

  async readiness(tenantId: string, academicYear = '2025-26') {
    const [
      mandatoryMetrics,
      evidenceTags,
      departments,
      facultyPending,
      studentPending,
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
    ]);

    const taggedCodes = new Set(
      evidenceTags
        .map((t: { metricCode: string | null }) => t.metricCode)
        .filter(Boolean),
    );

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
      const criterionMetricsMissing = metricsMissing.filter(
        (m: { criterion: number }) => m.criterion === c.criterion,
      ).length;
      return {
        criterion: c.criterion,
        title: c.title,
        evidenceCount: criterionEvidence,
        metricsMissing: criterionMetricsMissing,
        ready: criterionMetricsMissing === 0 && criterionEvidence > 0,
      };
    });

    const totalChecks = mandatoryMetrics.length + departments.length;
    const passedChecks =
      mandatoryMetrics.length -
      metricsMissing.length +
      (departments.length - departmentsPending.length);
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
    };
  }
}
