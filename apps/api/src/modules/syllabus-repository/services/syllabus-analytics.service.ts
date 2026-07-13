import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class SyllabusAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(tenantId: string) {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [docs, downloadsThisMonth, totalViews, activeCourses] =
      await Promise.all([
        this.prisma.syllabusDocument.findMany({
          where: { tenantId, deletedAt: null },
          select: {
            id: true,
            status: true,
            courseId: true,
            departmentId: true,
            paperCode: true,
            paperTitle: true,
            category: true,
            viewCount: true,
            downloadCount: true,
            fileSizeBytes: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: 'desc' },
        }),
        this.prisma.syllabusAccessLog.count({
          where: {
            tenantId,
            action: 'DOWNLOAD',
            createdAt: { gte: monthStart },
          },
        }),
        this.prisma.syllabusAccessLog.count({
          where: { tenantId, action: 'VIEW' },
        }),
        this.prisma.course.findMany({
          where: { tenantId, deletedAt: null, status: 'ACTIVE' },
          select: { id: true },
        }),
      ]);

    const publishedCourseIds = new Set(
      docs
        .filter((doc) => doc.status === 'PUBLISHED')
        .map((doc) => doc.courseId)
        .filter(Boolean),
    );
    const departmentIds = [
      ...new Set(docs.map((doc) => doc.departmentId).filter(Boolean)),
    ] as string[];
    const departments = departmentIds.length
      ? await this.prisma.department.findMany({
          where: { id: { in: departmentIds } },
          select: { id: true, code: true, name: true },
        })
      : [];
    const deptMap = new Map(departments.map((d) => [d.id, d.name || d.code]));

    const statusMixMap = new Map<string, number>();
    const categoryMap = new Map<string, number>();
    const byDepartment = new Map<string, number>();
    let storageUsedBytes = 0;

    for (const doc of docs) {
      statusMixMap.set(doc.status, (statusMixMap.get(doc.status) ?? 0) + 1);
      const category = doc.category || 'Uncategorized';
      categoryMap.set(category, (categoryMap.get(category) ?? 0) + 1);
      const deptLabel = doc.departmentId
        ? (deptMap.get(doc.departmentId) ?? 'Unknown')
        : 'Unassigned';
      byDepartment.set(deptLabel, (byDepartment.get(deptLabel) ?? 0) + 1);
      storageUsedBytes += Number(doc.fileSizeBytes ?? 0);
    }

    const top = [...docs].sort(
      (a, b) => (b.downloadCount ?? 0) - (a.downloadCount ?? 0),
    )[0];

    const toBars = (map: Map<string, number>) =>
      [...map.entries()]
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value);

    return {
      kpis: {
        totalDocuments: docs.length,
        publishedDocuments: docs.filter((doc) => doc.status === 'PUBLISHED')
          .length,
        approvedDocuments: docs.filter((doc) => doc.status === 'APPROVED')
          .length,
        pendingDocuments: docs.filter((doc) =>
          ['PENDING_APPROVAL', 'PENDING_REVIEW'].includes(doc.status),
        ).length,
        pendingApprovals: docs.filter((doc) =>
          ['PENDING_APPROVAL', 'PENDING_REVIEW'].includes(doc.status),
        ).length,
        downloadsThisMonth,
        storageUsedBytes,
        departments: departmentIds.length,
        missingCourses: activeCourses.filter(
          (course) => !publishedCourseIds.has(course.id),
        ).length,
        topDocument: top
          ? {
              id: top.id,
              title: top.paperTitle,
              paperCode: top.paperCode,
              downloads: top.downloadCount ?? 0,
            }
          : null,
      },
      statusMix: toBars(statusMixMap),
      documentsByCategory: toBars(categoryMap),
      documentsByDepartment: toBars(byDepartment),
      mostDownloaded: [...docs]
        .sort((a, b) => (b.downloadCount ?? 0) - (a.downloadCount ?? 0))
        .slice(0, 5)
        .map((doc) => ({
          id: doc.id,
          title: doc.paperTitle,
          paperCode: doc.paperCode,
          downloads: doc.downloadCount ?? 0,
        })),
      meta: { totalViews },
    };
  }

  async logAccess(input: {
    tenantId: string;
    documentId: string;
    userId?: string;
    action: 'VIEW' | 'DOWNLOAD';
    ipAddress?: string;
  }) {
    const increment =
      input.action === 'DOWNLOAD'
        ? { downloadCount: { increment: 1 } }
        : { viewCount: { increment: 1 } };
    const [log] = await this.prisma.$transaction([
      this.prisma.syllabusAccessLog.create({ data: input }),
      this.prisma.syllabusDocument.update({
        where: { id: input.documentId },
        data: increment,
      }),
    ]);
    return log;
  }
}
