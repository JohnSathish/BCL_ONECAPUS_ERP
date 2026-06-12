import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class StaffSummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async getEnhancedSummary(tenantId: string) {
    const baseWhere = { tenantId, deletedAt: null };

    const [
      total,
      teaching,
      nonTeaching,
      guest,
      activeAccounts,
      pendingActivation,
      onLeave,
      rfidAssigned,
      timetableAssignedRows,
      departmentRows,
    ] = await Promise.all([
      this.prisma.staffProfile.count({ where: baseWhere }),
      this.prisma.staffProfile.count({
        where: { ...baseWhere, staffType: 'TEACHING' },
      }),
      this.prisma.staffProfile.count({
        where: { ...baseWhere, staffType: 'NON_TEACHING' },
      }),
      this.prisma.staffProfile.count({
        where: { ...baseWhere, staffType: { in: ['GUEST', 'VISITING'] } },
      }),
      this.prisma.staffProfile.count({
        where: {
          ...baseWhere,
          portalUserId: { not: null },
          portalUser: { isActive: true, deletedAt: null },
        },
      }),
      this.prisma.staffProfile.count({
        where: {
          ...baseWhere,
          portalUserId: { not: null },
          portalUser: {
            deletedAt: null,
            OR: [
              { isActive: false },
              { accountStatus: 'pending' },
              { mustResetPassword: true },
            ],
          },
        },
      }),
      this.prisma.staffProfile.count({
        where: { ...baseWhere, status: 'ON_LEAVE' },
      }),
      this.prisma.staffProfile.count({
        where: { ...baseWhere, rfidNo: { not: null } },
      }),
      this.prisma.staffProfile.findMany({
        where: {
          ...baseWhere,
          OR: [
            { offeringSections: { some: { deletedAt: null } } },
            { subjectAssignments: { some: {} } },
          ],
        },
        select: { id: true },
      }),
      this.prisma.staffProfile.findMany({
        where: { ...baseWhere, departmentId: { not: null } },
        select: { departmentId: true },
        distinct: ['departmentId'],
      }),
    ]);

    return {
      total,
      teaching,
      nonTeaching,
      guest,
      departments: departmentRows.length,
      activeAccounts,
      pendingActivation,
      onLeave,
      rfidAssigned,
      timetableAssigned: timetableAssignedRows.length,
    };
  }
}
