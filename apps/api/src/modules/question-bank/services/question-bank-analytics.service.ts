import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class QuestionBankAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(tenantId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      papers,
      pendingApprovals,
      downloadsThisMonth,
      uploadedToday,
      topDownloads,
    ] = await Promise.all([
      this.prisma.questionPaper.findMany({
        where: { tenantId, deletedAt: null },
        select: {
          id: true,
          status: true,
          courseId: true,
          departmentId: true,
          examYear: true,
          academicYearId: true,
          paperName: true,
          paperCode: true,
          fileSizeBytes: true,
          createdAt: true,
        },
      }),
      this.prisma.questionPaperApproval.count({
        where: { tenantId, status: 'PENDING' },
      }),
      this.prisma.questionPaperAccessLog.count({
        where: {
          tenantId,
          action: 'DOWNLOAD',
          createdAt: { gte: monthStart },
        },
      }),
      this.prisma.questionPaper.count({
        where: {
          tenantId,
          deletedAt: null,
          createdAt: { gte: dayStart },
        },
      }),
      this.prisma.questionPaperAccessLog.groupBy({
        by: ['paperId'],
        where: { tenantId, action: 'DOWNLOAD' },
        _count: { paperId: true },
        orderBy: { _count: { paperId: 'desc' } },
        take: 10,
      }),
    ]);

    const published = papers.filter((p) => p.status === 'PUBLISHED');
    const approved = papers.filter((p) =>
      ['APPROVED', 'PUBLISHED'].includes(p.status),
    );
    const pending = papers.filter((p) =>
      ['SUBMITTED', 'IN_REVIEW', 'PENDING_HOD', 'PENDING_EXAM_CELL'].includes(
        p.status,
      ),
    );
    const departments = new Set(
      papers.map((p) => p.departmentId).filter(Boolean),
    );
    const subjects = new Set(papers.map((p) => p.courseId).filter(Boolean));
    const academicYears = new Set(
      papers.map((p) => p.academicYearId).filter(Boolean),
    );
    const storageUsedBytes = papers.reduce(
      (sum, p) => sum + (p.fileSizeBytes ?? 0),
      0,
    );

    const deptIds = [...departments] as string[];
    const depts = deptIds.length
      ? await this.prisma.department.findMany({
          where: { id: { in: deptIds } },
          select: { id: true, name: true, code: true },
        })
      : [];
    const deptNameMap = new Map(depts.map((d) => [d.id, d.name || d.code]));

    const papersByDepartmentBuckets = new Map<string, number>();
    for (const p of papers) {
      const label = p.departmentId
        ? (deptNameMap.get(p.departmentId) ?? 'Unknown')
        : 'Unassigned';
      papersByDepartmentBuckets.set(
        label,
        (papersByDepartmentBuckets.get(label) ?? 0) + 1,
      );
    }
    const papersByDepartment = Array.from(papersByDepartmentBuckets.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

    const topPaperIds = topDownloads.map((t) => t.paperId);
    const topPaperRows = topPaperIds.length
      ? papers.filter((p) => topPaperIds.includes(p.id))
      : [];
    const mostDownloaded = topDownloads.map((t) => {
      const paper = topPaperRows.find((p) => p.id === t.paperId);
      return {
        id: t.paperId,
        paperName: paper?.paperName ?? 'Unknown',
        paperCode: paper?.paperCode ?? '',
        downloads: t._count.paperId,
      };
    });

    let topPaper: (typeof mostDownloaded)[number] | null =
      mostDownloaded[0] ?? null;

    return {
      kpis: {
        totalPapers: papers.length,
        publishedPapers: published.length,
        approvedPapers: approved.length,
        pendingPapers: pending.length,
        uploadedToday,
        departments: departments.size,
        subjects: subjects.size,
        academicYears: academicYears.size,
        downloadsThisMonth,
        pendingApprovals,
        storageUsedBytes,
        topPaper,
        missingSubjects: Math.max(0, subjects.size > 0 ? 0 : 1),
      },
      statusMix: this.groupCount(papers, 'status'),
      papersByYear: this.groupCount(
        papers.filter((p) => p.examYear),
        'examYear',
      ),
      papersByDepartment,
      mostDownloaded,
    };
  }

  async logAccess(input: {
    tenantId: string;
    paperId: string;
    userId?: string;
    action: 'VIEW' | 'DOWNLOAD' | 'PREVIEW';
    ipAddress?: string;
  }) {
    return this.prisma.questionPaperAccessLog.create({ data: input });
  }

  async reportsSummary(tenantId: string) {
    const [views, downloads, papers] = await Promise.all([
      this.prisma.questionPaperAccessLog.count({
        where: { tenantId, action: 'VIEW' },
      }),
      this.prisma.questionPaperAccessLog.count({
        where: { tenantId, action: 'DOWNLOAD' },
      }),
      this.prisma.questionPaper.count({
        where: { tenantId, deletedAt: null, status: 'PUBLISHED' },
      }),
    ]);
    return { views, downloads, publishedPapers: papers };
  }

  private groupCount(rows: { [key: string]: unknown }[], field: string) {
    const buckets = new Map<string, number>();
    for (const row of rows) {
      const key = String(row[field] ?? 'UNKNOWN');
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    return Array.from(buckets.entries()).map(([label, value]) => ({
      label,
      value,
    }));
  }
}
