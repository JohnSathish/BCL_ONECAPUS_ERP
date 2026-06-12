import { ProgramVersionLifecycleService } from './program-version-lifecycle.service';

describe('ProgramVersionLifecycleService helpers', () => {
  const prisma = {
    programVersion: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
    program: { findFirst: jest.fn() },
    courseOffering: {
      count: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    student: { count: jest.fn() },
    registration: { count: jest.fn() },
    outcomeAttainmentRun: { count: jest.fn() },
    registrationApprovalPolicy: { count: jest.fn() },
    programmePoolAssignment: { count: jest.fn(), deleteMany: jest.fn() },
    semesterStructureRule: { count: jest.fn(), deleteMany: jest.fn() },
    offeringSection: { count: jest.fn(), updateMany: jest.fn() },
    staffSubjectAssignment: { count: jest.fn() },
    programOutcome: { count: jest.fn(), updateMany: jest.fn() },
    programmePoolCourseExclusion: { deleteMany: jest.fn() },
    programStructureTemplate: { deleteMany: jest.fn() },
    $transaction: jest.fn(),
  };

  const service = new ProgramVersionLifecycleService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
    );
  });

  it('relabels version number while keeping the same id', async () => {
    prisma.programVersion.findFirst
      .mockResolvedValueOnce({
        id: 'pv-3',
        tenantId: 't1',
        programId: 'prog-1',
        version: 3,
        status: 'DRAFT',
      })
      .mockResolvedValueOnce(null);
    prisma.programVersion.update.mockResolvedValue({
      id: 'pv-3',
      tenantId: 't1',
      programId: 'prog-1',
      version: 1,
      status: 'DRAFT',
      program: { id: 'prog-1', code: 'BA-EDU', name: 'BA Education' },
      createdBy: null,
      archivedBy: null,
    });

    const result = await service.relabelVersion('t1', 'pv-3', 1);

    expect(prisma.programVersion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pv-3' },
        data: { version: 1 },
      }),
    );
    expect(result.version).toBe(1);
  });
});
