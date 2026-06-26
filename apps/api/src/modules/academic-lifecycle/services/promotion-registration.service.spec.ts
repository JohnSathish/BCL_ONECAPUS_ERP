import { BadRequestException } from '@nestjs/common';
import { PromotionRegistrationService } from './promotion-registration.service';

describe('PromotionRegistrationService', () => {
  const prisma = {
    studentAcademicStanding: { findUnique: jest.fn() },
    student: { findFirst: jest.fn(), findFirstOrThrow: jest.fn() },
    semesterStructureRule: { findFirst: jest.fn() },
    semesterPromotionEntry: { findFirst: jest.fn() },
    semesterRegistration: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    semesterRegistrationLine: { deleteMany: jest.fn() },
    courseOffering: { findMany: jest.fn() },
  };

  const batchMapping = {
    resolveCalendarSemester: jest.fn(),
  };
  const adminRegistration = {
    buildAutoAssignLinesForStudent: jest.fn(),
  };
  const registrationEngine = {
    applyGeneratedLines: jest.fn(),
  };
  const engine = {
    createRegistration: jest.fn(),
  };
  const allocation = {
    allocateRegistration: jest.fn(),
  };

  const service = new PromotionRegistrationService(
    prisma as never,
    batchMapping as never,
    adminRegistration as never,
    registrationEngine as never,
    engine as never,
    allocation as never,
  );

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('rejects apply when validation fails', async () => {
    prisma.studentAcademicStanding.findUnique.mockResolvedValue({
      promotionLocked: true,
      currentSemesterSequence: 1,
    });
    prisma.student.findFirst.mockResolvedValue({ programVersionId: 'pv-1' });
    prisma.semesterStructureRule.findFirst.mockResolvedValue({ id: 'rule' });
    prisma.semesterPromotionEntry.findFirst.mockResolvedValue(null);
    batchMapping.resolveCalendarSemester.mockResolvedValue({ id: 'sem-2' });
    prisma.semesterRegistration.findFirst.mockResolvedValue(null);
    adminRegistration.buildAutoAssignLinesForStudent.mockRejectedValue(
      new Error('No eligible section'),
    );

    await expect(
      service.applyForStudent('tenant-1', {
        studentId: 'stu-1',
        institutionId: 'inst-1',
        fromSequence: 1,
        toSequence: 2,
        promotionRunId: 'run-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
