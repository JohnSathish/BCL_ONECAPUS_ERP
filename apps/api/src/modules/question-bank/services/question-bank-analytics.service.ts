import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class QuestionBankAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(tenantId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [papers, pendingApprovals, downloadsThisMonth, topDownload] =
      await Promise.all([
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
        this.prisma.questionPaperAccessLog.groupBy({
          by: ['paperId'],
          where: { tenantId, action: 'DOWNLOAD' },
          _count: { paperId: true },
          orderBy: { _count: { paperId: 'desc' } },
          take: 1,
        }),
      ]);

    const published = papers.filter((p) => p.status === 'PUBLISHED');
    const departments = new Set(
      papers.map((p) => p.departmentId).filter(Boolean),
    );
    const subjects = new Set(papers.map((p) => p.courseId).filter(Boolean));
    const academicYears = new Set(
      papers.map((p) => p.academicYearId).filter(Boolean),
    );

    let topPaper: {
      id: string;
      paperName: string;
      paperCode: string;
      downloads: number;
    } | null = null;
    if (topDownload[0]) {
      const paper = papers.find((p) => p.id === topDownload[0].paperId);
      if (paper) {
        topPaper = {
          id: paper.id,
          paperName: paper.paperName,
          paperCode: paper.paperCode,
          downloads: topDownload[0]._count.paperId,
        };
      }
    }

    return {
      kpis: {
        totalPapers: papers.length,
        publishedPapers: published.length,
        departments: departments.size,
        subjects: subjects.size,
        academicYears: academicYears.size,
        downloadsThisMonth,
        pendingApprovals,
        topPaper,
        missingSubjects: Math.max(0, subjects.size > 0 ? 0 : 1),
      },
      statusMix: this.groupCount(papers, 'status'),
      papersByYear: this.groupCount(
        papers.filter((p) => p.examYear),
        'examYear',
      ),
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
