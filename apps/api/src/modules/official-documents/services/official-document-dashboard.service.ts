import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { officialDb } from '../utils/official-documents-prisma.util';
import { OfficialDocumentAuditService } from './official-document-audit.service';

@Injectable()
export class OfficialDocumentDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: OfficialDocumentAuditService,
  ) {}

  private db() {
    return officialDb(this.prisma);
  }

  async getDashboard(tenantId: string) {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      total,
      today,
      thisMonth,
      pendingApproval,
      published,
      drafts,
      archived,
      recentlyPrinted,
      templates,
      scheduled,
      recentActivity,
      byType,
    ] = await Promise.all([
      this.db().officialDocument.count({ where: { tenantId } }),
      this.db().officialDocument.count({
        where: { tenantId, createdAt: { gte: startOfDay } },
      }),
      this.db().officialDocument.count({
        where: { tenantId, createdAt: { gte: startOfMonth } },
      }),
      this.db().officialDocument.count({
        where: { tenantId, status: 'PENDING_APPROVAL' },
      }),
      this.db().officialDocument.count({
        where: { tenantId, status: 'PUBLISHED' },
      }),
      this.db().officialDocument.count({
        where: { tenantId, status: 'DRAFT' },
      }),
      this.db().officialDocument.count({
        where: { tenantId, status: 'ARCHIVED' },
      }),
      this.db().officialDocument.findMany({
        where: { tenantId, printedAt: { not: null } },
        orderBy: { printedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          referenceNo: true,
          printedAt: true,
          printCount: true,
        },
      }),
      this.db().officialDocumentTemplate.findMany({
        where: { tenantId, active: true },
        orderBy: { sortOrder: 'asc' },
        take: 6,
        select: { id: true, name: true, documentType: true },
      }),
      this.db().officialDocument.findMany({
        where: {
          tenantId,
          scheduledAt: { gt: now },
          status: { in: ['DRAFT', 'PENDING_APPROVAL'] },
        },
        orderBy: { scheduledAt: 'asc' },
        take: 5,
        select: {
          id: true,
          title: true,
          scheduledAt: true,
          documentType: true,
        },
      }),
      this.audit.recentActivity(tenantId, 15),
      this.db().officialDocument.groupBy({
        by: ['documentType'],
        where: { tenantId },
        _count: { _all: true },
      }),
    ]);

    return {
      stats: {
        total,
        today,
        thisMonth,
        pendingApproval,
        published,
        drafts,
        archived,
      },
      recentlyPrinted,
      frequentTemplates: templates,
      upcomingScheduled: scheduled,
      recentActivity,
      byType: byType.map(
        (row: { documentType: string; _count: { _all: number } }) => ({
          documentType: row.documentType,
          count: row._count._all,
        }),
      ),
    };
  }
}
