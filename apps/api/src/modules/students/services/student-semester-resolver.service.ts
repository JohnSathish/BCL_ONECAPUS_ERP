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
