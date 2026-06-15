import { PromotionEligibilityService } from './promotion-eligibility.service';

describe('PromotionEligibilityService', () => {
  const prisma = {
    studentAcademicStanding: { findUnique: jest.fn() },
    semesterRegistration: { findFirst: jest.fn() },
    studentSemesterProgress: { findUnique: jest.fn() },
    student: { findMany: jest.fn(), findFirst: jest.fn() },
  };

  const service = new PromotionEligibilityService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.student.findFirst.mockResolvedValue({ programVersionId: null });
  });

  it('promotes even when prior semester registration is incomplete', async () => {
    prisma.studentAcademicStanding.findUnique.mockResolvedValue({
      currentSemesterSequence: 1,
      lifecycleState: 'ACTIVE',
      promotionLocked: false,
      programmeStatus: 'IN_PROGRESS',
    });
    prisma.semesterRegistration.findFirst.mockResolvedValue(null);
    prisma.studentSemesterProgress.findUnique.mockResolvedValue(null);

    const result = await service.evaluateStudent(
      'tenant-1',
      'student-1',
      1,
      2,
      6,
    );

    expect(result.eligible).toBe(true);
    expect(result.status).toBe('PROMOTED');
  });

  it('marks terminal promotion as COMPLETED when eligible', async () => {
    prisma.studentAcademicStanding.findUnique.mockResolvedValue({
      currentSemesterSequence: 5,
      lifecycleState: 'ACTIVE',
      promotionLocked: false,
      programmeStatus: 'IN_PROGRESS',
    });
    prisma.semesterRegistration.findFirst.mockResolvedValue(null);
    prisma.studentSemesterProgress.findUnique.mockResolvedValue(null);

    const result = await service.evaluateStudent(
      'tenant-1',
      'student-1',
      5,
      6,
      6,
    );

    expect(result.eligible).toBe(true);
    expect(result.status).toBe('COMPLETED');
  });

  it('blocks promotion when programme is completed', async () => {
    prisma.studentAcademicStanding.findUnique.mockResolvedValue({
      currentSemesterSequence: 6,
      lifecycleState: 'COMPLETED',
      promotionLocked: true,
      programmeStatus: 'COMPLETED',
    });
    prisma.semesterRegistration.findFirst.mockResolvedValue({ id: 'reg-1' });
    prisma.studentSemesterProgress.findUnique.mockResolvedValue(null);

    const result = await service.evaluateStudent(
      'tenant-1',
      'student-1',
      6,
      6,
      6,
    );

    expect(result.eligible).toBe(false);
    expect(result.status).toBe('FAILED');
  });
});
