import { FeeEnforcementService } from './fee-enforcement.service';

describe('FeeEnforcementService', () => {
  const prisma = {
    studentAcademicStanding: { findUnique: jest.fn() },
    academicFeeCycle: { findFirst: jest.fn() },
    studentFeeDemand: { findFirst: jest.fn(), findMany: jest.fn() },
  };
  const settings = {
    get: jest.fn(),
  };

  const service = new FeeEnforcementService(prisma as never, settings as never);

  beforeEach(() => {
    jest.clearAllMocks();
    settings.get.mockResolvedValue({
      studentPortalFeesEnabled: true,
      blockRegistrationOnDue: true,
      blockHallTicketOnDue: true,
    });
    prisma.studentAcademicStanding.findUnique.mockResolvedValue({
      currentSemesterSequence: 5,
    });
    prisma.academicFeeCycle.findFirst.mockResolvedValue({
      id: 'cycle-3',
      name: 'Admission Cycle 3',
      totalAmount: 9500,
    });
    prisma.studentFeeDemand.findMany.mockResolvedValue([]);
  });

  it('does not block REGISTRATION when the semester cycle demand is not yet generated', async () => {
    prisma.studentFeeDemand.findFirst.mockResolvedValue(null);

    const result = await service.checkFeesClear(
      'tenant-1',
      'stu-1',
      'REGISTRATION',
    );

    expect(result.blocked).toBe(false);
    expect(result.outstandingAmount).toBe(0);
    expect(result.reasons).toEqual([]);
  });

  it('still blocks HALL_TICKET when the semester cycle demand is not generated', async () => {
    prisma.studentFeeDemand.findFirst.mockResolvedValue(null);

    const result = await service.checkFeesClear(
      'tenant-1',
      'stu-1',
      'HALL_TICKET',
    );

    expect(result.blocked).toBe(true);
    expect(result.outstandingAmount).toBe(9500);
    expect(result.reasons[0]).toMatch(/not yet generated\/paid/);
  });

  it('blocks REGISTRATION when a generated cycle demand still has a balance', async () => {
    prisma.studentFeeDemand.findFirst.mockResolvedValue({
      balanceAmount: 9500,
    });

    const result = await service.checkFeesClear(
      'tenant-1',
      'stu-1',
      'REGISTRATION',
    );

    expect(result.blocked).toBe(true);
    expect(result.outstandingAmount).toBe(9500);
    expect(result.reasons[0]).toMatch(/₹9500 outstanding/);
  });
});
