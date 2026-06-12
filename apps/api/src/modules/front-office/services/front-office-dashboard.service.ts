import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class FrontOfficeDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(tenantId: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [
      todayEnquiries,
      openEnquiries,
      openComplaints,
      highPriorityComplaints,
      activeGatePasses,
      visitorsInside,
      todayGatePasses,
    ] = await Promise.all([
      this.prisma.frontOfficeEnquiry.count({
        where: { tenantId, createdAt: { gte: startOfDay } },
      }),
      this.prisma.frontOfficeEnquiry.count({
        where: { tenantId, status: { in: ['OPEN', 'IN_PROGRESS'] } },
      }),
      this.prisma.frontOfficeComplaint.count({
        where: {
          tenantId,
          status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] },
        },
      }),
      this.prisma.frontOfficeComplaint.count({
        where: {
          tenantId,
          priority: 'HIGH',
          status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] },
        },
      }),
      this.prisma.frontOfficeGatePass.count({
        where: {
          tenantId,
          status: { in: ['ACTIVE', 'CHECKED_IN'] },
          validUntil: { gte: new Date() },
        },
      }),
      this.prisma.frontOfficeGatePass.count({
        where: { tenantId, status: 'CHECKED_IN' },
      }),
      this.prisma.frontOfficeGatePass.count({
        where: { tenantId, createdAt: { gte: startOfDay } },
      }),
    ]);

    const recentEnquiries = await this.prisma.frontOfficeEnquiry.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const recentComplaints = await this.prisma.frontOfficeComplaint.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const pendingAdmissions = await this.prisma.admissionApplication.count({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ['submitted', 'under_review', 'pending_documents'] },
      },
    });

    return {
      todayEnquiries,
      openEnquiries,
      openComplaints,
      highPriorityComplaints,
      activeGatePasses,
      visitorsInside,
      todayGatePasses,
      pendingAdmissions,
      admissionsHref: '/admin/admissions',
      recentEnquiries,
      recentComplaints,
    };
  }
}
