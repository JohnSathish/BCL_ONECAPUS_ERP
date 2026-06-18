import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { naacDb } from './naac-prisma.util';

@Injectable()
export class NaacAggregatorService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return naacDb(this.prisma);
  }

  private gov() {
    return this.prisma as unknown as Record<string, any>;
  }

  async summary(tenantId: string) {
    const [
      programmeCount,
      courseCount,
      publicationCount,
      studentCount,
      facultyCount,
      committeeCount,
      meetingCount,
      mouCount,
      extensionEvents,
      admissionApplications,
      enrolledStudents,
      scholarshipConcessions,
      openAtrCount,
      completedAtrCount,
      governanceDocuments,
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
      this.prisma.staffProfile
        .count({ where: { tenantId, deletedAt: null, status: 'ACTIVE' } })
        .catch(() => 0),
      this.gov().governanceCommittee?.count?.({ where: { tenantId } }) ?? 0,
      this.gov().governanceMeeting?.count?.({ where: { tenantId } }) ?? 0,
      this.db().naacMou.count({ where: { tenantId } }),
      this.gov().governanceEvent?.count?.({ where: { tenantId } }) ?? 0,
      this.prisma.admissionApplication
        .count({ where: { tenantId } })
        .catch(() => 0),
      this.prisma.student
        .count({
          where: { tenantId, deletedAt: null },
        })
        .catch(() => 0),
      this.prisma.feeConcession
        .count({ where: { tenantId, status: 'APPROVED' } })
        .catch(() => 0),
      this.gov().governanceActionItem?.count?.({
        where: { tenantId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
      }) ?? 0,
      this.gov().governanceActionItem?.count?.({
        where: { tenantId, status: 'COMPLETED' },
      }) ?? 0,
      this.gov().governanceDocument?.count?.({ where: { tenantId } }) ?? 0,
    ]);

    const ts = new Date().toISOString();
    const metric = (value: number, source: string) => ({
      value,
      source,
      asOf: ts,
    });

    return {
      programmes: metric(programmeCount, 'Program'),
      courses: metric(courseCount, 'Course'),
      publications: metric(publicationCount, 'StaffPublication'),
      students: metric(studentCount, 'Student'),
      faculty: metric(facultyCount, 'StaffProfile'),
      committees: metric(committeeCount, 'GovernanceCommittee'),
      meetings: metric(meetingCount, 'GovernanceMeeting'),
      mous: metric(mouCount, 'NaacMou'),
      extensionActivities: metric(extensionEvents, 'GovernanceEvent'),
      admissionApplications: metric(
        admissionApplications,
        'AdmissionApplication',
      ),
      enrolledStudents: metric(enrolledStudents, 'Student'),
      scholarshipRecipients: metric(scholarshipConcessions, 'FeeConcession'),
      openAtrItems: metric(openAtrCount, 'GovernanceActionItem'),
      completedAtrItems: metric(completedAtrCount, 'GovernanceActionItem'),
      governanceDocuments: metric(governanceDocuments, 'GovernanceDocument'),
    };
  }

  async forCriterion(tenantId: string, criterion: number) {
    const all = await this.summary(tenantId);
    switch (criterion) {
      case 1:
        return {
          programmes: all.programmes,
          courses: all.courses,
          faculty: all.faculty,
        };
      case 2:
        return {
          students: all.students,
          admissionApplications: all.admissionApplications,
          enrolledStudents: all.enrolledStudents,
        };
      case 3:
        return {
          publications: all.publications,
          extensionActivities: all.extensionActivities,
          mous: all.mous,
          faculty: all.faculty,
        };
      case 4:
        return {
          governanceDocuments: all.governanceDocuments,
          library: await this.libraryMetrics(tenantId),
        };
      case 5:
        return {
          students: all.students,
          enrolledStudents: all.enrolledStudents,
          scholarshipRecipients: all.scholarshipRecipients,
          placementOffers: {
            value: 0,
            source: 'Placement',
            asOf: all.students.asOf,
            pending: true,
            message: 'Placement module linkage pending',
          },
        };
      case 6:
        return {
          committees: all.committees,
          meetings: all.meetings,
          openAtrItems: all.openAtrItems,
          completedAtrItems: all.completedAtrItems,
        };
      case 7:
        return {
          extensionActivities: all.extensionActivities,
          governanceDocuments: all.governanceDocuments,
          message: 'Best practices from department submissions and IQAC ATR',
        };
      default:
        return {};
    }
  }

  private async libraryMetrics(tenantId: string) {
    const ts = new Date().toISOString();
    const metric = (value: number, source: string) => ({
      value,
      source,
      asOf: ts,
    });

    const [titles, copies, digital, visitsYear] = await Promise.all([
      this.prisma.libraryBook
        .count({ where: { tenantId, deletedAt: null } })
        .catch(() => 0),
      this.prisma.libraryBookCopy.count({ where: { tenantId } }).catch(() => 0),
      this.prisma.libraryDigitalAsset
        .count({ where: { tenantId, deletedAt: null } })
        .catch(() => 0),
      this.prisma.libraryVisit
        .count({
          where: {
            tenantId,
            entryAt: {
              gte: new Date(new Date().getFullYear(), 0, 1),
            },
          },
        })
        .catch(() => 0),
    ]);

    return {
      bookTitles: metric(titles, 'LibraryBook'),
      bookCopies: metric(copies, 'LibraryBookCopy'),
      digitalAssets: metric(digital, 'LibraryDigitalAsset'),
      annualFootfall: metric(visitsYear, 'LibraryVisit'),
    };
  }
}
