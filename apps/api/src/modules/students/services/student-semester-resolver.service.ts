import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

export type ResolvedSemester = {
  semester: number;
  batchSemester: number | null;
  cycle: string | null;
  calendarSemesterId: string | null;
};

export type AcademicStatusLabel =
  | 'Studying'
  | 'Promoted'
  | 'Completed'
  | 'Alumni'
  | 'Dropped';

@Injectable()
export class StudentSemesterResolverService {
  constructor(private readonly prisma: PrismaService) {}

  mapAcademicStatus(
    standing: {
      lifecycleState: string;
      programmeStatus: string;
      alumniEligible: boolean;
      lastPromotedAt: Date | null;
    } | null,
  ): AcademicStatusLabel {
    if (!standing) return 'Studying';
    if (standing.programmeStatus === 'COMPLETED' || standing.alumniEligible) {
      return 'Alumni';
    }
    if (standing.lifecycleState === 'DETAINED') {
      return 'Dropped';
    }
    if (standing.lastPromotedAt) {
      const daysSince =
        (Date.now() - standing.lastPromotedAt.getTime()) / 86400000;
      if (daysSince <= 180) return 'Promoted';
    }
    return 'Studying';
  }

  /** Bulk resolver for student directory — avoids N+1 queries on list pages. */
  async resolveForStudents(
    tenantId: string,
    studentIds: string[],
  ): Promise<Map<string, ResolvedSemester>> {
    const map = new Map<string, ResolvedSemester>();
    if (!studentIds.length) return map;

    const [standings, profiles, students] = await Promise.all([
      this.prisma.studentAcademicStanding.findMany({
        where: { studentId: { in: studentIds } },
      }),
      this.prisma.studentAcademicProfile.findMany({
        where: { studentId: { in: studentIds } },
        include: {
          admissionBatch: { include: { semesterMapping: true } },
        },
      }),
      this.prisma.student.findMany({
        where: { id: { in: studentIds }, tenantId },
        select: { id: true, campusId: true },
      }),
    ]);

    const standingByStudent = new Map(
      standings.map((row) => [row.studentId, row] as const),
    );
    const profileByStudent = new Map(
      profiles.map((row) => [row.studentId, row] as const),
    );
    const campusByStudent = new Map(
      students.map((row) => [row.id, row.campusId] as const),
    );

    const campusIds = [
      ...new Set(
        students
          .map((row) => row.campusId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const campuses = campusIds.length
      ? await this.prisma.campus.findMany({
          where: { id: { in: campusIds } },
          select: { id: true, institutionId: true },
        })
      : [];
    const institutionIds = [
      ...new Set(campuses.map((row) => row.institutionId)),
    ];
    const configs = institutionIds.length
      ? await this.prisma.institutionAcademicConfig.findMany({
          where: { institutionId: { in: institutionIds } },
        })
      : [];

    const campusToInstitution = new Map(
      campuses.map((row) => [row.id, row.institutionId] as const),
    );
    const configByInstitution = new Map(
      configs.map((row) => [row.institutionId, row] as const),
    );

    for (const studentId of studentIds) {
      const standing = standingByStudent.get(studentId);
      const academicProfile = profileByStudent.get(studentId);
      const campusId = campusByStudent.get(studentId);

      let cycle: string | null = null;
      const batch = academicProfile?.admissionBatch;
      if (academicProfile?.admissionBatchId && batch && campusId) {
        const institutionId = campusToInstitution.get(campusId);
        if (institutionId) {
          const config = configByInstitution.get(institutionId);
          cycle = config?.currentCycle ?? batch.cycleType;
        }
      }

      map.set(studentId, {
        semester: standing?.currentSemesterSequence ?? 1,
        batchSemester: batch?.currentSemester ?? null,
        cycle,
        calendarSemesterId: batch?.semesterMapping?.calendarSemesterId ?? null,
      });
    }

    return map;
  }

  async resolveForStudent(
    tenantId: string,
    studentId: string,
  ): Promise<ResolvedSemester> {
    const standing = await this.prisma.studentAcademicStanding.findUnique({
      where: { studentId },
    });
    const academicProfile = await this.prisma.studentAcademicProfile.findUnique(
      {
        where: { studentId },
        include: {
          admissionBatch: {
            include: { semesterMapping: true },
          },
        },
      },
    );

    let cycle: string | null = null;
    if (academicProfile?.admissionBatchId) {
      const batch = academicProfile.admissionBatch;
      if (batch) {
        const campus = await this.prisma.student.findUnique({
          where: { id: studentId },
          select: { campusId: true },
        });
        if (campus?.campusId) {
          const campusRow = await this.prisma.campus.findUnique({
            where: { id: campus.campusId },
            select: { institutionId: true },
          });
          if (campusRow?.institutionId) {
            const config =
              await this.prisma.institutionAcademicConfig.findUnique({
                where: { institutionId: campusRow.institutionId },
              });
            cycle = config?.currentCycle ?? batch.cycleType;
          }
        }
      }
    }

    return {
      semester: standing?.currentSemesterSequence ?? 1,
      batchSemester: academicProfile?.admissionBatch?.currentSemester ?? null,
      cycle,
      calendarSemesterId:
        academicProfile?.admissionBatch?.semesterMapping?.calendarSemesterId ??
        null,
    };
  }

  async syncStandingToBatch(
    tenantId: string,
    studentId: string,
    batchId: string,
  ) {
    const batch = await this.prisma.admissionBatch.findFirst({
      where: { id: batchId, tenantId, deletedAt: null },
    });
    if (!batch) return;

    await this.prisma.studentAcademicStanding.upsert({
      where: { studentId },
      create: {
        tenantId,
        studentId,
        currentSemesterSequence: batch.currentSemester,
        lifecycleState: 'ACTIVE',
        programmeStatus: 'IN_PROGRESS',
      },
      update: {
        currentSemesterSequence: batch.currentSemester,
      },
    });
  }
}
