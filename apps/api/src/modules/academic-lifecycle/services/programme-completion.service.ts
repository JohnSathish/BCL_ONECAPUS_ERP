import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class ProgrammeCompletionService {
  constructor(private readonly prisma: PrismaService) {}

  async markCompleted(tenantId: string, studentId: string) {
    return this.prisma.studentAcademicStanding.update({
      where: { studentId },
      data: {
        lifecycleState: 'COMPLETED',
        programmeStatus: 'COMPLETED',
        alumniEligible: true,
        promotionLocked: true,
        registrationLocked: true,
        completedAt: new Date(),
      },
    });
  }

  async applyPromotionStanding(
    tenantId: string,
    studentId: string,
    toSequence: number,
    terminalSemesterNumber: number,
    isCompleted: boolean,
  ) {
    if (isCompleted || toSequence >= terminalSemesterNumber) {
      return this.markCompleted(tenantId, studentId);
    }

    return this.prisma.studentAcademicStanding.update({
      where: { studentId },
      data: {
        currentSemesterSequence: toSequence,
        lifecycleState: 'ACTIVE',
        lastPromotedAt: new Date(),
      },
    });
  }
}
