import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  DEFAULT_DEGREE_MIN_CREDITS,
  DEFAULT_SEMESTER_CREDIT_TARGET,
} from '../../academic-engine/domain/fyugp-templates';
import {
  resolveDegreeMinCredits,
  resolveSemesterCreditTarget,
} from '../../academic-engine/services/structure-rules.helper';

export type EligibilityResult = {
  eligible: boolean;
  status: 'PROMOTED' | 'DETAINED' | 'PENDING' | 'COMPLETED' | 'FAILED';
  messages: string[];
  snapshot: Record<string, unknown>;
};

@Injectable()
export class PromotionEligibilityService {
  constructor(private readonly prisma: PrismaService) {}

  async evaluateStudent(
    tenantId: string,
    studentId: string,
    fromSequence: number,
    toSequence: number,
    terminalSemesterNumber: number,
  ): Promise<EligibilityResult> {
    const messages: string[] = [];
    const standing = await this.prisma.studentAcademicStanding.findUnique({
      where: { studentId },
    });

    if (!standing) {
      return {
        eligible: false,
        status: 'FAILED',
        messages: ['No academic standing record'],
        snapshot: {},
      };
    }

    if (standing.promotionLocked || standing.lifecycleState === 'COMPLETED') {
      messages.push(
        'Student has completed the programme or promotion is locked',
      );
    }

    if (standing.programmeStatus === 'COMPLETED') {
      messages.push('Programme already completed');
    }

    if (standing.currentSemesterSequence !== fromSequence) {
      messages.push(
        `Expected current semester ${fromSequence}, found ${standing.currentSemesterSequence}`,
      );
    }

    const priorReg = await this.prisma.semesterRegistration.findFirst({
      where: {
        tenantId,
        studentId,
        semesterSequence: fromSequence,
        status: 'completed',
      },
    });

    const progress = await this.prisma.studentSemesterProgress.findUnique({
      where: {
        studentId_semesterSequence: {
          studentId,
          semesterSequence: fromSequence,
        },
      },
    });

    const creditsEarned = progress ? Number(progress.creditsEarned) : 0;
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
      select: { programVersionId: true },
    });
    const creditsRequired = student?.programVersionId
      ? await resolveSemesterCreditTarget(
          this.prisma,
          tenantId,
          student.programVersionId,
          fromSequence,
        )
      : progress
        ? Number(progress.creditsRequired)
        : DEFAULT_SEMESTER_CREDIT_TARGET;

    const isTerminalPromotion = toSequence >= terminalSemesterNumber;
    if (isTerminalPromotion && student?.programVersionId) {
      const degreeMinCredits = await resolveDegreeMinCredits(
        this.prisma,
        tenantId,
        student.programVersionId,
      );
      const ledger = await this.prisma.creditLedgerEntry.findMany({
        where: { tenantId, studentId, entryType: 'registration' },
      });
      const lifetimeCredits = ledger.reduce(
        (sum, entry) => sum + Number(entry.credits),
        0,
      );
      if (lifetimeCredits < degreeMinCredits) {
        messages.push(
          `Degree requires minimum ${degreeMinCredits} credits; student has ${lifetimeCredits}`,
        );
      }
    }
    const blocking = messages.filter((m) => !m.includes('informational'));
    const eligible = blocking.length === 0;

    let status: EligibilityResult['status'] = eligible ? 'PROMOTED' : 'FAILED';
    if (isTerminalPromotion && eligible) {
      status = 'COMPLETED';
    }

    return {
      eligible,
      status,
      messages,
      snapshot: {
        creditsEarned,
        creditsRequired,
        priorRegistrationCompleted: Boolean(priorReg),
        informationalOnly: {
          attendance: 'not required for promotion',
          fees: 'not required for promotion',
          examination: 'not required for promotion',
          registration: priorReg
            ? 'completed'
            : 'incomplete — promotion still allowed',
        },
        lifecycleState: standing.lifecycleState,
        currentSemesterSequence: standing.currentSemesterSequence,
      },
    };
  }

  async findCandidateStudentIds(
    tenantId: string,
    fromSequence: number,
    filters: {
      campusId?: string;
      shiftId?: string;
      departmentId?: string;
      programVersionId?: string;
      admissionBatchId?: string;
    },
  ) {
    return this.prisma.student.findMany({
      where: {
        tenantId,
        deletedAt: null,
        academicStanding: {
          currentSemesterSequence: fromSequence,
          lifecycleState: { in: ['ACTIVE', 'DETAINED'] },
          promotionLocked: false,
          programmeStatus: { not: 'COMPLETED' },
        },
        ...(filters.campusId ? { campusId: filters.campusId } : {}),
        ...(filters.shiftId ? { primaryShiftId: filters.shiftId } : {}),
        ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
        ...(filters.programVersionId
          ? { programVersionId: filters.programVersionId }
          : {}),
        ...(filters.admissionBatchId
          ? {
              academicProfile: {
                admissionBatchId: filters.admissionBatchId,
              },
            }
          : {}),
      },
      select: { id: true },
    });
  }
}
