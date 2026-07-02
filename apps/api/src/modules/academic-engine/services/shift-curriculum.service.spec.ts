import { ShiftCurriculumService } from './shift-curriculum.service';

describe('ShiftCurriculumService', () => {
  const tenantId = 'tenant-1';
  const morningShiftId = 'shift-morning';
  const dayShiftId = 'shift-day';
  const programVersionId = 'pv-ba-eco';

  const prisma = {
    shift: { findFirst: jest.fn() },
    shiftProgrammeConfig: {
      findMany: jest.fn(),
      count: jest.fn(),
      upsert: jest.fn(),
    },
    shiftDepartmentConfig: {
      findMany: jest.fn(),
      count: jest.fn(),
      upsert: jest.fn(),
    },
    shiftCurriculumPolicy: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    programmePoolAssignment: { findMany: jest.fn() },
    categoryPool: { findMany: jest.fn() },
    program: { findMany: jest.fn() },
    programVersion: { findFirst: jest.fn(), updateMany: jest.fn() },
    department: { findMany: jest.fn() },
    offeringSection: { findFirst: jest.fn(), findMany: jest.fn() },
    course: { findFirst: jest.fn(), update: jest.fn() },
  };

  let service: ShiftCurriculumService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ShiftCurriculumService(prisma as never);
    prisma.shift.findFirst.mockResolvedValue({
      id: morningShiftId,
      code: 'MORNING',
      name: 'Morning Shift',
      status: 'ACTIVE',
    });
  });

  it('returns shift-specific pool ids when configured', async () => {
    prisma.programmePoolAssignment.findMany.mockResolvedValueOnce([
      { poolId: 'pool-morning-mdc' },
    ]);

    const poolIds = await service.resolveAssignedPoolIds(
      tenantId,
      programVersionId,
      1,
      morningShiftId,
    );

    expect(poolIds).toEqual(['pool-morning-mdc']);
    expect(prisma.programmePoolAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ shiftId: morningShiftId }),
      }),
    );
  });

  it('falls back to global pool assignments when shift-specific rows are absent', async () => {
    prisma.programmePoolAssignment.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ poolId: 'pool-day-mdc' }]);

    const poolIds = await service.resolveAssignedPoolIds(
      tenantId,
      programVersionId,
      1,
      dayShiftId,
    );

    expect(poolIds).toEqual(['pool-day-mdc']);
  });

  it('resolves Morning Sem 2 pool ids when semesterSequence is 2', async () => {
    prisma.programmePoolAssignment.findMany.mockResolvedValueOnce([
      { poolId: 'pool-morning-mdc-sem2' },
      { poolId: 'pool-morning-aec-sem2' },
    ]);

    const poolIds = await service.resolveAssignedPoolIds(
      tenantId,
      programVersionId,
      2,
      morningShiftId,
    );

    expect(poolIds).toEqual(['pool-morning-mdc-sem2', 'pool-morning-aec-sem2']);
    expect(prisma.programmePoolAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          shiftId: morningShiftId,
          semesterNo: 2,
        }),
      }),
    );
  });

  it('auto-assigns VAC when policy requires it', async () => {
    prisma.shiftCurriculumPolicy.findMany.mockResolvedValue([
      { categoryType: 'VAC', autoAssign: true },
    ]);
    prisma.offeringSection.findFirst.mockResolvedValue({ id: 'vac-section-1' });

    const result = await service.enrichSubjectSelections(tenantId, {
      shiftId: morningShiftId,
      programVersionId,
      semesterSequence: 1,
      selections: { MDC: 'mdc-section-1' },
    });

    expect(result.VAC).toBe('vac-section-1');
  });

  it('detects NCC enrollment from MDC-116 selection', async () => {
    prisma.offeringSection.findMany.mockResolvedValue([
      {
        id: 'sec-1',
        courseOffering: {
          course: {
            code: 'MDC-116',
            eligibilityRules: { triggersNccEnrollment: true },
          },
        },
      },
    ]);

    const triggers = await service.selectionTriggersNccEnrollment(tenantId, {
      MDC: 'sec-1',
    });

    expect(triggers).toBe(true);
  });

  it('filters majors by enabled shift departments when configured', async () => {
    prisma.shiftDepartmentConfig.count.mockResolvedValue(9);
    prisma.shiftDepartmentConfig.findMany.mockResolvedValue([
      {
        departmentId: 'dept-eco',
        enabled: true,
        department: { code: 'ECO', name: 'Economics', deletedAt: null },
      },
    ]);

    const filtered = await service.filterSubjectPathsByShift(
      tenantId,
      morningShiftId,
      [
        { departmentId: 'dept-eco', slug: 'economics', name: 'Economics' },
        { departmentId: 'dept-bot', slug: 'botany', name: 'Botany' },
      ],
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.slug).toBe('economics');
  });

  it('summarizes compound eligibility rules', () => {
    const summary = service.summarizeEligibilityRules({
      excludedMajorSubjectSlugs: ['english'],
      excludedWhenMajorAndClass12: [
        { majorSubjectSlug: 'sociology', class12SubjectSlug: 'sociology' },
      ],
    });
    expect(summary).toContain('english');
    expect(summary).toContain('sociology');
  });
});
