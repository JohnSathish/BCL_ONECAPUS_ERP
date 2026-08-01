import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { naacDb } from './naac-prisma.util';

export type ErpMetricValue = {
  value: number | null;
  source: string;
  asOf: string;
  pending?: boolean;
  message?: string;
  unit?: string;
};

@Injectable()
export class NaacAggregatorService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return naacDb(this.prisma);
  }

  private gov() {
    return this.prisma as unknown as Record<string, any>;
  }

  private metric(
    value: number | null,
    source: string,
    asOf: string,
    extra?: Partial<ErpMetricValue>,
  ): ErpMetricValue {
    return { value, source, asOf, ...extra };
  }

  private pending(
    source: string,
    asOf: string,
    message: string,
  ): ErpMetricValue {
    return {
      value: null,
      source,
      asOf,
      pending: true,
      message,
    };
  }

  async summary(tenantId: string) {
    const ts = new Date().toISOString();
    const [
      programmeCount,
      courseCount,
      publicationCount,
      studentCount,
      facultyCount,
      teachingFaculty,
      phdFaculty,
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
      totalSeats,
      classroomCount,
      labCount,
      ictClassroomCount,
      placementOffers,
      studentAchievements,
      deptSubmissions,
      library,
      passPctResult,
      reservedFillPct,
      higherStudiesCount,
      computerCount,
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
      this.prisma.staffProfile
        .count({
          where: {
            tenantId,
            deletedAt: null,
            status: 'ACTIVE',
            staffType: 'TEACHING',
          },
        })
        .catch(() => 0),
      this.countPhdFaculty(tenantId),
      this.gov().governanceCommittee?.count?.({ where: { tenantId } }) ?? 0,
      this.gov().governanceMeeting?.count?.({ where: { tenantId } }) ?? 0,
      this.db().naacMou.count({ where: { tenantId } }),
      this.gov().governanceEvent?.count?.({ where: { tenantId } }) ?? 0,
      this.prisma.admissionApplication
        .count({ where: { tenantId } })
        .catch(() => 0),
      this.prisma.student
        .count({ where: { tenantId, deletedAt: null } })
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
      this.sumIntakeSeats(tenantId),
      this.prisma.classroom
        .count({ where: { tenantId, deletedAt: null } })
        .catch(() => 0),
      this.countLabs(tenantId),
      this.countIctClassrooms(tenantId),
      this.countPlacementOffers(tenantId),
      this.db().naacStudentAchievement.count({ where: { tenantId } }),
      this.db().naacDepartmentSubmission.count({
        where: { tenantId, status: { in: ['SUBMITTED', 'APPROVED'] } },
      }),
      this.libraryMetrics(tenantId),
      this.computePassPercentage(tenantId),
      this.computeReservedSeatsFilledPct(tenantId),
      this.computeHigherStudiesCount(tenantId),
      this.estimateComputerCount(tenantId),
    ]);

    const enrolmentPct =
      totalSeats > 0
        ? Math.round((enrolledStudents / totalSeats) * 1000) / 10
        : null;
    const studentTeacherRatio =
      teachingFaculty > 0
        ? Math.round((enrolledStudents / teachingFaculty) * 10) / 10
        : null;
    const phdFacultyPct =
      teachingFaculty > 0
        ? Math.round((phdFaculty / teachingFaculty) * 1000) / 10
        : null;
    const publicationsPerTeacher =
      teachingFaculty > 0
        ? Math.round((publicationCount / teachingFaculty) * 100) / 100
        : null;
    const ictClassroomPct =
      classroomCount > 0
        ? Math.round((ictClassroomCount / classroomCount) * 1000) / 10
        : null;
    const studentComputerRatio =
      computerCount != null && computerCount > 0 && enrolledStudents > 0
        ? Math.round((enrolledStudents / computerCount) * 10) / 10
        : null;

    return {
      programmes: this.metric(programmeCount, 'Program', ts),
      courses: this.metric(courseCount, 'Course', ts),
      publications: this.metric(publicationCount, 'StaffPublication', ts),
      students: this.metric(studentCount, 'Student', ts),
      faculty: this.metric(facultyCount, 'StaffProfile', ts),
      teachingFaculty: this.metric(
        teachingFaculty,
        'StaffProfile.TEACHING',
        ts,
      ),
      phdFaculty: this.metric(phdFaculty, 'StaffQualification', ts),
      committees: this.metric(committeeCount, 'GovernanceCommittee', ts),
      meetings: this.metric(meetingCount, 'GovernanceMeeting', ts),
      mous: this.metric(mouCount, 'NaacMou', ts),
      extensionActivities: this.metric(extensionEvents, 'GovernanceEvent', ts),
      admissionApplications: this.metric(
        admissionApplications,
        'AdmissionApplication',
        ts,
      ),
      enrolledStudents: this.metric(enrolledStudents, 'Student', ts),
      totalSeats: this.metric(totalSeats, 'AdmissionIntake', ts),
      enrolmentPct: this.metric(
        enrolmentPct,
        'Student/AdmissionIntake',
        ts,
        enrolmentPct == null
          ? {
              pending: true,
              message: 'No intake seats configured',
            }
          : { unit: '%' },
      ),
      reservedSeatsFilledPct:
        reservedFillPct != null
          ? this.metric(
              reservedFillPct,
              'AdmissionIntakeShift.reservedSeats',
              ts,
              {
                unit: '%',
              },
            )
          : this.pending(
              'AdmissionIntakeShift.reservedSeats',
              ts,
              'No reserved-seat allocation data found on intake shifts',
            ),
      studentTeacherRatio: this.metric(
        studentTeacherRatio,
        'Student/StaffProfile',
        ts,
        studentTeacherRatio == null
          ? { pending: true, message: 'No teaching faculty found' }
          : { unit: 'students/teacher' },
      ),
      mentorStudentRatio: this.metric(
        studentTeacherRatio,
        'Student/StaffProfile',
        ts,
        {
          unit: 'approx mentors=teaching faculty',
          message:
            'Using teaching faculty as mentor proxy until mentor assignments are linked',
        },
      ),
      facultyAgainstPosts: this.metric(
        teachingFaculty,
        'StaffProfile.TEACHING',
        ts,
        {
          message:
            'Sanctioned posts denominator not stored; reporting teaching headcount',
        },
      ),
      phdFacultyPct: this.metric(
        phdFacultyPct,
        'StaffQualification',
        ts,
        phdFacultyPct == null
          ? { pending: true, message: 'No teaching faculty found' }
          : { unit: '%' },
      ),
      passPercentage:
        passPctResult != null
          ? this.metric(passPctResult, 'ExamResultSummary', ts, { unit: '%' })
          : this.pending(
              'ExamResultSummary',
              ts,
              'No published exam result summaries found',
            ),
      publicationsPerTeacher: this.metric(
        publicationsPerTeacher,
        'StaffPublication/StaffProfile',
        ts,
        publicationsPerTeacher == null
          ? { pending: true, message: 'No teaching faculty found' }
          : undefined,
      ),
      scholarshipRecipients: this.metric(
        scholarshipConcessions,
        'FeeConcession',
        ts,
      ),
      openAtrItems: this.metric(openAtrCount, 'GovernanceActionItem', ts),
      completedAtrItems: this.metric(
        completedAtrCount,
        'GovernanceActionItem',
        ts,
      ),
      governanceDocuments: this.metric(
        governanceDocuments,
        'GovernanceDocument',
        ts,
      ),
      classroomCount: this.metric(classroomCount, 'Classroom', ts),
      labCount: this.metric(labCount, 'Classroom/RoomType', ts),
      ictClassroomCount: this.metric(
        ictClassroomCount,
        'Classroom.facilities',
        ts,
      ),
      ictClassroomPct: this.metric(
        ictClassroomPct,
        'Classroom.facilities',
        ts,
        ictClassroomPct == null
          ? { pending: true, message: 'No classrooms found' }
          : { unit: '%' },
      ),
      studentComputerRatio:
        studentComputerRatio != null
          ? this.metric(
              studentComputerRatio,
              'Classroom.facilities (ICT proxy)',
              ts,
              {
                unit: 'students/computer',
                message:
                  'Estimated from ICT-enabled classrooms × 20 seats until IT asset inventory exists',
              },
            )
          : this.pending(
              'IT Assets',
              ts,
              'Student–computer ratio needs ICT classrooms or IT asset inventory',
            ),
      libraryBookTitles: library.bookTitles,
      libraryFootfall: library.annualFootfall,
      library: library,
      placementOffers: this.metric(
        placementOffers,
        'PlacementApplication',
        ts,
        placementOffers === 0
          ? {
              message: 'No OFFERS/SELECTED placement applications found',
            }
          : undefined,
      ),
      higherStudies: this.metric(
        higherStudiesCount,
        'NaacStudentAchievement/PlacementApplication',
        ts,
        higherStudiesCount === 0
          ? {
              message:
                'No higher-studies achievements or progression records found — add student achievements tagged HIGHER_STUDIES',
            }
          : undefined,
      ),
      studentAchievements: this.metric(
        studentAchievements,
        'NaacStudentAchievement',
        ts,
      ),
      departmentSubmissions: this.metric(
        deptSubmissions,
        'NaacDepartmentSubmission',
        ts,
      ),
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
          totalSeats: all.totalSeats,
          enrolmentPct: all.enrolmentPct,
          reservedSeatsFilledPct: all.reservedSeatsFilledPct,
          studentTeacherRatio: all.studentTeacherRatio,
          teachingFaculty: all.teachingFaculty,
          phdFacultyPct: all.phdFacultyPct,
          passPercentage: all.passPercentage,
        };
      case 3:
        return {
          publications: all.publications,
          publicationsPerTeacher: all.publicationsPerTeacher,
          extensionActivities: all.extensionActivities,
          mous: all.mous,
          faculty: all.faculty,
        };
      case 4:
        return {
          classroomCount: all.classroomCount,
          labCount: all.labCount,
          ictClassroomPct: all.ictClassroomPct,
          studentComputerRatio: all.studentComputerRatio,
          library: all.library,
          governanceDocuments: all.governanceDocuments,
        };
      case 5:
        return {
          students: all.students,
          enrolledStudents: all.enrolledStudents,
          scholarshipRecipients: all.scholarshipRecipients,
          placementOffers: all.placementOffers,
          higherStudies: all.higherStudies,
          studentAchievements: all.studentAchievements,
        };
      case 6:
        return {
          committees: all.committees,
          meetings: all.meetings,
          openAtrItems: all.openAtrItems,
          completedAtrItems: all.completedAtrItems,
          governanceDocuments: all.governanceDocuments,
        };
      case 7:
        return {
          extensionActivities: all.extensionActivities,
          governanceDocuments: all.governanceDocuments,
          departmentSubmissions: all.departmentSubmissions,
          message: 'Best practices from department submissions and IQAC ATR',
        };
      default:
        return {};
    }
  }

  async pullExtendedProfile(tenantId: string, academicYear: string) {
    const all = await this.summary(tenantId);
    const settings = await this.db().naacSettings.findUnique({
      where: { tenantId },
    });
    return {
      academicYear,
      pulledAt: new Date().toISOString(),
      institutionProfile: settings?.institutionProfile ?? {},
      students: {
        enrolledStudents: all.enrolledStudents,
        admissionApplications: all.admissionApplications,
        totalSeats: all.totalSeats,
        enrolmentPct: all.enrolmentPct,
        scholarshipRecipients: all.scholarshipRecipients,
      },
      faculty: {
        faculty: all.faculty,
        teachingFaculty: all.teachingFaculty,
        phdFaculty: all.phdFaculty,
        phdFacultyPct: all.phdFacultyPct,
        publications: all.publications,
        publicationsPerTeacher: all.publicationsPerTeacher,
      },
      academic: {
        programmes: all.programmes,
        courses: all.courses,
      },
      infrastructure: {
        classroomCount: all.classroomCount,
        labCount: all.labCount,
        ictClassroomCount: all.ictClassroomCount,
        ictClassroomPct: all.ictClassroomPct,
        studentComputerRatio: all.studentComputerRatio,
      },
      library: all.library,
      researchExtension: {
        mous: all.mous,
        extensionActivities: all.extensionActivities,
      },
      studentSupport: {
        placementOffers: all.placementOffers,
        higherStudies: all.higherStudies,
        studentAchievements: all.studentAchievements,
      },
      governance: {
        committees: all.committees,
        meetings: all.meetings,
        openAtrItems: all.openAtrItems,
        completedAtrItems: all.completedAtrItems,
        governanceDocuments: all.governanceDocuments,
        departmentSubmissions: all.departmentSubmissions,
      },
    };
  }

  async hintsForMetric(
    tenantId: string,
    opts: {
      metricCode?: string;
      erpSourceKey?: string | null;
      criterion?: number;
    },
  ) {
    const all = await this.summary(tenantId);
    const key =
      opts.erpSourceKey || this.defaultKeyForCode(opts.metricCode) || null;

    const primary =
      key && key in all
        ? {
            key,
            ...((all as unknown as Record<string, ErpMetricValue>)[key] ?? {}),
          }
        : null;

    const criterionBundle =
      opts.criterion != null
        ? await this.forCriterion(tenantId, opts.criterion)
        : {};

    return {
      metricCode: opts.metricCode ?? null,
      erpSourceKey: key,
      primary,
      related: criterionBundle,
      pulledAt: new Date().toISOString(),
    };
  }

  private defaultKeyForCode(code?: string) {
    if (!code) return null;
    const map: Record<string, string> = {
      '1.1.2': 'programmes',
      '1.2.1': 'courses',
      '2.1.1': 'enrolmentPct',
      '2.2.2': 'studentTeacherRatio',
      '2.4.2': 'phdFacultyPct',
      '2.6.3': 'passPercentage',
      '3.3.1': 'publicationsPerTeacher',
      '3.4.3': 'extensionActivities',
      '3.5.1': 'mous',
      '4.1.3': 'ictClassroomPct',
      '4.2.3': 'libraryBookTitles',
      '5.1.1': 'scholarshipRecipients',
      '5.2.1': 'placementOffers',
      '6.5.3': 'completedAtrItems',
    };
    return map[code] ?? null;
  }

  private async sumIntakeSeats(tenantId: string) {
    try {
      const rows = await this.prisma.admissionIntake.findMany({
        where: { tenantId, deletedAt: null },
        select: { totalSeats: true },
      });
      return rows.reduce((s, r) => s + (r.totalSeats ?? 0), 0);
    } catch {
      return 0;
    }
  }

  private async countPhdFaculty(tenantId: string) {
    try {
      const quals = await this.prisma.staffQualification.findMany({
        where: {
          tenantId,
          OR: [
            { qualification: { contains: 'Ph', mode: 'insensitive' } },
            { qualification: { contains: 'Doctor', mode: 'insensitive' } },
            { qualification: { contains: 'D.Phil', mode: 'insensitive' } },
          ],
        },
        select: { staffProfileId: true },
        distinct: ['staffProfileId'],
      });
      return quals.length;
    } catch {
      return 0;
    }
  }

  private async countLabs(tenantId: string) {
    try {
      return await this.prisma.classroom.count({
        where: {
          tenantId,
          deletedAt: null,
          OR: [
            { isPracticalLab: true },
            { name: { contains: 'lab', mode: 'insensitive' } },
            { code: { contains: 'LAB', mode: 'insensitive' } },
          ],
        },
      });
    } catch {
      return 0;
    }
  }

  private async countIctClassrooms(tenantId: string) {
    try {
      const rooms = await this.prisma.classroom.findMany({
        where: { tenantId, deletedAt: null },
        select: { facilities: true },
      });
      return rooms.filter((r) => {
        const f = r.facilities;
        const text = JSON.stringify(f ?? {}).toLowerCase();
        return (
          text.includes('projector') ||
          text.includes('smart') ||
          text.includes('ict') ||
          text.includes('av') ||
          text.includes('computer')
        );
      }).length;
    } catch {
      return 0;
    }
  }

  private async countPlacementOffers(tenantId: string) {
    try {
      return await this.prisma.placementApplication.count({
        where: {
          tenantId,
          status: { in: ['OFFERED', 'SELECTED', 'JOINED', 'PLACED'] },
        },
      });
    } catch {
      return 0;
    }
  }

  private async libraryMetrics(tenantId: string) {
    const ts = new Date().toISOString();
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
      bookTitles: this.metric(titles, 'LibraryBook', ts),
      bookCopies: this.metric(copies, 'LibraryBookCopy', ts),
      digitalAssets: this.metric(digital, 'LibraryDigitalAsset', ts),
      annualFootfall: this.metric(visitsYear, 'LibraryVisit', ts),
    };
  }

  private async computePassPercentage(
    tenantId: string,
  ): Promise<number | null> {
    try {
      const results = await this.prisma.examResultSummary.findMany({
        where: { tenantId, deletedAt: null, publishStatus: 'PUBLISHED' },
        select: { resultStatus: true },
        take: 5000,
      });
      if (!results.length) return null;
      const passed = results.filter((r) =>
        ['PASS', 'PASSED', 'PROMOTED'].includes(
          (r.resultStatus ?? '').toUpperCase(),
        ),
      ).length;
      return Math.round((passed / results.length) * 1000) / 10;
    } catch {
      return null;
    }
  }

  private async computeReservedSeatsFilledPct(
    tenantId: string,
  ): Promise<number | null> {
    try {
      const shifts = await this.prisma.admissionIntakeShift.findMany({
        where: { tenantId },
        select: { reservedSeats: true },
        take: 200,
      });
      if (!shifts.length) return null;

      let reservedCap = 0;
      const categories = new Set<string>();
      for (const s of shifts) {
        const reserved = s.reservedSeats;
        if (
          reserved &&
          typeof reserved === 'object' &&
          !Array.isArray(reserved)
        ) {
          for (const [cat, v] of Object.entries(
            reserved as Record<string, unknown>,
          )) {
            const n = typeof v === 'number' ? v : Number(v);
            if (Number.isFinite(n) && n > 0) {
              reservedCap += n;
              categories.add(cat.toUpperCase());
            }
          }
        }
      }
      if (reservedCap <= 0 || categories.size === 0) return null;

      const admitted = await this.prisma.admissionApplication.count({
        where: {
          tenantId,
          category: { in: [...categories] },
          status: { in: ['ADMITTED', 'ENROLLED', 'SELECTED', 'CONFIRMED'] },
        },
      });
      return (
        Math.round((Math.min(admitted, reservedCap) / reservedCap) * 1000) / 10
      );
    } catch {
      return null;
    }
  }

  private async computeHigherStudiesCount(tenantId: string): Promise<number> {
    try {
      return await this.db().naacStudentAchievement.count({
        where: {
          tenantId,
          OR: [
            { achievementType: { contains: 'HIGHER', mode: 'insensitive' } },
            { title: { contains: 'higher stud', mode: 'insensitive' } },
            { title: { contains: 'PG admission', mode: 'insensitive' } },
            { title: { contains: 'post graduat', mode: 'insensitive' } },
          ],
        },
      });
    } catch {
      return 0;
    }
  }

  /** Proxy: ICT classrooms × 20 seats until a dedicated IT asset register exists. */
  private async estimateComputerCount(
    tenantId: string,
  ): Promise<number | null> {
    try {
      const ict = await this.countIctClassrooms(tenantId);
      if (ict <= 0) return null;
      return ict * 20;
    } catch {
      return null;
    }
  }
}
