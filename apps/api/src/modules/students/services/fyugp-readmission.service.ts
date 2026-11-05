import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { buildFyugpStudentJourney } from '../domain/fyugp-journey';
import { RollNumberService } from './roll-number.service';

export const FYUGP_SEM7_READMISSION = 'FYUGP_SEM7_READMISSION';

type ReadmissionMeta = {
  status?: string;
  previousRollNumber?: string | null;
  newRollNumber?: string | null;
};

@Injectable()
export class FyugpReadmissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rollNumbers: RollNumberService,
  ) {}

  async apply(user: JwtUser) {
    const student = await this.loadStudent(user.tid, user.sub);
    const view = await this.journeyForStudent(
      user.tid,
      student.id,
      student.currentSemester,
    );
    if (!view.continuation?.canApply) {
      throw new BadRequestException(
        'Readmission for Semesters 7 and 8 opens after Semester 6 is completed.',
      );
    }
    const event = await this.prisma.studentLifecycleEvent.create({
      data: {
        tenantId: user.tid,
        studentId: student.id,
        actorId: user.sub,
        eventType: FYUGP_SEM7_READMISSION,
        effectiveDate: new Date(),
        reason: 'Student applied to continue FYUGP Semesters 7 and 8',
        metadata: {
          status: 'PENDING',
          previousRollNumber: student.rollNumber,
          newRollNumber: null,
        },
      },
    });
    return {
      id: event.id,
      status: 'PENDING',
      previousRollNumber: student.rollNumber,
    };
  }

  async approve(
    tenantId: string,
    studentId: string,
    actorId: string,
    newRollNumber: string,
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId, deletedAt: null },
      select: { id: true, rollNumber: true, userId: true },
    });
    if (!student) throw new NotFoundException('Student not found');
    const latest = await this.latestEvent(tenantId, studentId);
    const status = this.statusOf(latest?.metadata);
    if (status !== 'PENDING') {
      throw new BadRequestException(
        'There is no pending Semester 7 readmission application.',
      );
    }
    const nextRoll = newRollNumber.trim();
    if (!nextRoll)
      throw new BadRequestException('Enter the new College Roll Number.');
    const previousRoll = student.rollNumber;
    await this.rollNumbers.assignRollNumber(tenantId, studentId, nextRoll, {
      manualOverride: true,
      actorId,
      action: 'FYUGP_READMISSION',
      metadata: {
        previousRollNumber: previousRoll,
        stage: 'SEMESTER_7',
      },
    });
    await this.prisma.studentAcademicStanding.upsert({
      where: { studentId },
      create: {
        tenantId,
        studentId,
        currentSemesterSequence: 7,
        lifecycleState: 'ACTIVE',
        programmeStatus: 'IN_PROGRESS',
      },
      update: {
        currentSemesterSequence: 7,
        lifecycleState: 'ACTIVE',
        programmeStatus: 'IN_PROGRESS',
        promotionLocked: false,
        registrationLocked: false,
        alumniEligible: false,
        completedAt: null,
      },
    });
    await this.prisma.studentProfile.updateMany({
      where: { studentId },
      data: { studentStatus: 'STUDYING', admissionStatus: 'ACTIVE' },
    });
    await this.prisma.studentLifecycleEvent.create({
      data: {
        tenantId,
        studentId,
        actorId,
        eventType: FYUGP_SEM7_READMISSION,
        effectiveDate: new Date(),
        reason: 'College approved FYUGP continuation into Semester 7',
        metadata: {
          status: 'APPROVED',
          previousRollNumber: previousRoll,
          newRollNumber: nextRoll,
        } satisfies Prisma.InputJsonObject,
      },
    });
    return {
      status: 'APPROVED',
      previousRollNumber: previousRoll,
      newRollNumber: nextRoll,
      semesterSequence: 7,
    };
  }

  async statusForStudent(tenantId: string, studentId: string) {
    const latest = await this.latestEvent(tenantId, studentId);
    return this.statusOf(latest?.metadata);
  }

  private async journeyForStudent(
    tenantId: string,
    studentId: string,
    currentSemester: number | null,
  ) {
    const [registrations, progress, readmissionStatus] = await Promise.all([
      this.prisma.semesterRegistration.findMany({
        where: { tenantId, studentId },
        select: {
          status: true,
          semester: { select: { sequence: true } },
          lines: { select: { id: true } },
        },
      }),
      this.prisma.studentSemesterProgress.findMany({
        where: { tenantId, studentId },
        select: { semesterSequence: true, status: true },
      }),
      this.statusForStudent(tenantId, studentId),
    ]);
    return buildFyugpStudentJourney({
      totalSemesters: 8,
      currentSemester,
      readmissionStatus,
      progressCompletedSequences: progress
        .filter((row) =>
          ['completed', 'promoted', 'passed'].includes(
            row.status.toLowerCase(),
          ),
        )
        .map((row) => row.semesterSequence),
      registrations: registrations.map((row) => ({
        sequence: row.semester?.sequence ?? null,
        status: row.status,
        subjectCount: row.lines.length,
        credits: 0,
      })),
    });
  }

  private async loadStudent(tenantId: string, userId: string) {
    const student = await this.prisma.student.findFirst({
      where: { tenantId, userId, deletedAt: null },
      select: {
        id: true,
        rollNumber: true,
        academicStanding: { select: { currentSemesterSequence: true } },
      },
    });
    if (!student) throw new NotFoundException('Student not found');
    return {
      id: student.id,
      rollNumber: student.rollNumber,
      currentSemester:
        student.academicStanding?.currentSemesterSequence ?? null,
    };
  }

  private async latestEvent(tenantId: string, studentId: string) {
    return this.prisma.studentLifecycleEvent.findFirst({
      where: { tenantId, studentId, eventType: FYUGP_SEM7_READMISSION },
      orderBy: { createdAt: 'desc' },
      select: { metadata: true },
    });
  }

  private statusOf(
    metadata: unknown,
  ): 'NONE' | 'PENDING' | 'APPROVED' | 'DECLINED' {
    const status = String(
      (metadata as ReadmissionMeta | null)?.status ?? '',
    ).toUpperCase();
    if (status === 'PENDING' || status === 'APPROVED' || status === 'DECLINED')
      return status;
    return 'NONE';
  }
}
