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
    registrationAuditLog: { create: jest.fn() },
  };

  const batchMapping = {
    resolveCalendarSemester: jest.fn(),
  };
  const adminRegistration = {
    buildAutoAssignLinesForStudent: jest.fn(),
    computeElectiveSlots: jest.fn(),
  };
  const registrationEngine = {
    applyGeneratedLines: jest.fn(),
  };
  const engine = {
    createRegistration: jest.fn(),
    getRegistration: jest.fn(),
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

  it('leaves draft with elective slots when leaveElectivesForStudentRenewal is true', async () => {
    jest.spyOn(service, 'validateStudent').mockResolvedValue({
      valid: true,
      messages: [],
    });
    jest.spyOn(service, 'resolveTargetLines').mockResolvedValue([
      {
        category: 'MAJOR',
        offeringId: 'off-1',
        offeringSectionId: 'sec-1',
      },
    ] as never);

    prisma.student.findFirstOrThrow.mockResolvedValue({
      id: 'stu-1',
      programVersionId: 'pv-1',
      primaryShiftId: null,
      academicProfile: null,
      programChoices: [],
    });
    batchMapping.resolveCalendarSemester.mockResolvedValue({ id: 'sem-2' });
    prisma.semesterRegistration.findMany.mockResolvedValue([]);
    prisma.semesterRegistration.findFirst.mockResolvedValue(null);
    engine.createRegistration.mockResolvedValue({
      id: 'reg-1',
      status: 'draft',
    });
    registrationEngine.applyGeneratedLines.mockResolvedValue(undefined);
    prisma.semesterRegistration.update.mockResolvedValue({});
    adminRegistration.computeElectiveSlots.mockResolvedValue([
      { category: 'MDC', required: 1, filled: 0, remaining: 1 },
    ]);
    prisma.registrationAuditLog.create.mockResolvedValue({});
    engine.getRegistration.mockResolvedValue({
      id: 'reg-1',
      status: 'draft',
      lines: [],
    });

    const result = await service.applyForStudent('tenant-1', {
      studentId: 'stu-1',
      institutionId: 'inst-1',
      fromSequence: 1,
      toSequence: 2,
      promotionRunId: 'run-1',
      leaveElectivesForStudentRenewal: true,
    });

    expect(allocation.allocateRegistration).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      id: 'reg-1',
      renewalDraft: true,
      electiveSlots: [{ category: 'MDC', remaining: 1 }],
    });
  });
});
