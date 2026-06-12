import {
  cycleTypeFromSemesterNumber,
  oppositeCycle,
  semesterNumbersForCycle,
  ODD_SEMESTER_NUMBERS,
  EVEN_SEMESTER_NUMBERS,
  MAX_FYUGP_SEMESTER,
} from './utils/cycle.util';
import { PromotionRunService } from './services/promotion-run.service';
import { PromotionEligibilityService } from './services/promotion-eligibility.service';

describe('Academic lifecycle cycle utilities', () => {
  it('maps semester numbers to ODD/EVEN cycles', () => {
    expect(cycleTypeFromSemesterNumber(1)).toBe('ODD');
    expect(cycleTypeFromSemesterNumber(2)).toBe('EVEN');
    expect(cycleTypeFromSemesterNumber(5)).toBe('ODD');
    expect(cycleTypeFromSemesterNumber(6)).toBe('EVEN');
  });

  it('returns parallel semester sets per cycle', () => {
    expect(semesterNumbersForCycle('ODD')).toEqual([...ODD_SEMESTER_NUMBERS]);
    expect(semesterNumbersForCycle('EVEN')).toEqual([...EVEN_SEMESTER_NUMBERS]);
    expect(oppositeCycle('ODD')).toBe('EVEN');
    expect(oppositeCycle('EVEN')).toBe('ODD');
  });

  it('caps FYUGP at semester 8', () => {
    expect(MAX_FYUGP_SEMESTER).toBe(8);
  });
});

describe('PromotionRunService pairs', () => {
  const service = Object.create(
    PromotionRunService.prototype,
  ) as PromotionRunService;

  it('derives ODD to EVEN promotion pairs for EVEN semester activation', () => {
    expect(service.promotionPairForEven(2)).toEqual({ from: 1, to: 2 });
    expect(service.promotionPairForEven(4)).toEqual({ from: 3, to: 4 });
    expect(service.promotionPairForEven(6)).toEqual({ from: 5, to: 6 });
    expect(service.promotionPairForEven(1)).toBeNull();
    expect(service.promotionPairForEven(5)).toBeNull();
  });
});

describe('PromotionEligibilityService institution rules', () => {
  const prisma = {
    studentAcademicStanding: { findUnique: jest.fn() },
    semesterRegistration: { findFirst: jest.fn() },
    studentSemesterProgress: { findUnique: jest.fn() },
  };
  const service = new PromotionEligibilityService(prisma as never);

  it('allows detained students to promote', async () => {
    prisma.studentAcademicStanding.findUnique.mockResolvedValue({
      currentSemesterSequence: 3,
      lifecycleState: 'DETAINED',
      promotionLocked: false,
      programmeStatus: 'IN_PROGRESS',
    });
    prisma.semesterRegistration.findFirst.mockResolvedValue(null);
    prisma.studentSemesterProgress.findUnique.mockResolvedValue(null);

    const result = await service.evaluateStudent('t', 's', 3, 4, 6);
    expect(result.eligible).toBe(true);
    expect(result.status).toBe('PROMOTED');
  });
});
