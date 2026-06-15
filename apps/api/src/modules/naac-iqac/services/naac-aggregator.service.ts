import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { naacDb } from './naac-prisma.util';

@Injectable()
export class NaacAggregatorService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return naacDb(this.prisma);
  }

  async summary(tenantId: string) {
    const [
      programmeCount,
      courseCount,
      publicationCount,
      studentCount,
      committeeCount,
      meetingCount,
      mouCount,
      extensionEvents,
    ] = await Promise.all([
      this.prisma.program
        .count({ where: { tenantId, deletedAt: null } })
        .catch(() => 0),
      this.prisma.course
        .count({ where: { tenantId, deletedAt: null } })
        .catch(() => 0),
      this.prisma.staffPublication
        .count({ where: { tenantId } })
        .catch(() => 0),
      this.prisma.student
        .count({ where: { tenantId, deletedAt: null } })
        .catch(() => 0),
      (
        this.prisma as unknown as Record<string, any>
      ).governanceCommittee?.count?.({ where: { tenantId } }) ?? 0,
      (
        this.prisma as unknown as Record<string, any>
      ).governanceMeeting?.count?.({ where: { tenantId } }) ?? 0,
      this.db().naacMou.count({ where: { tenantId } }),
      (this.prisma as unknown as Record<string, any>).governanceEvent?.count?.({
        where: { tenantId },
      }) ?? 0,
    ]);

    return {
      programmes: {
        value: programmeCount,
        source: 'Program',
        asOf: new Date().toISOString(),
      },
      courses: {
        value: courseCount,
        source: 'Course',
        asOf: new Date().toISOString(),
      },
      publications: {
        value: publicationCount,
        source: 'StaffPublication',
        asOf: new Date().toISOString(),
      },
      students: {
        value: studentCount,
        source: 'Student',
        asOf: new Date().toISOString(),
      },
      committees: {
        value: committeeCount,
        source: 'GovernanceCommittee',
        asOf: new Date().toISOString(),
      },
      meetings: {
        value: meetingCount,
        source: 'GovernanceMeeting',
        asOf: new Date().toISOString(),
      },
      mous: {
        value: mouCount,
        source: 'NaacMou',
        asOf: new Date().toISOString(),
      },
      extensionActivities: {
        value: extensionEvents,
        source: 'GovernanceEvent',
        asOf: new Date().toISOString(),
      },
    };
  }

  async forCriterion(tenantId: string, criterion: number) {
    const all = await this.summary(tenantId);
    switch (criterion) {
      case 1:
        return { programmes: all.programmes, courses: all.courses };
      case 2:
        return { students: all.students };
      case 3:
        return {
          publications: all.publications,
          extensionActivities: all.extensionActivities,
          mous: all.mous,
        };
      case 4:
        return {
          pending: true,
          message: 'Infrastructure aggregates pending module linkage',
        };
      case 5:
        return {
          students: all.students,
          pending: true,
          message: 'Placement/scholarship stubs',
        };
      case 6:
        return { committees: all.committees, meetings: all.meetings };
      case 7:
        return {
          pending: true,
          message: 'Best practices from NIMS submissions',
        };
      default:
        return {};
    }
  }
}
