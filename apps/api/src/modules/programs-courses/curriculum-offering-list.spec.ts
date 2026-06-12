import {
  applyQuickToggle,
  computeEnrollmentStatus,
  computeMappingStatus,
  dedupeCurriculumOfferingRows,
  matchesMappingStatusFilter,
} from './domain/curriculum-offering-list.helpers';
import { CurriculumOfferingListService } from './curriculum-offering-list.service';
import { MAPPING_SOURCE } from '../academic-engine/domain/category-pools';

describe('curriculum-offering-list.helpers', () => {
  it('computes mapping status from sections', () => {
    expect(computeMappingStatus([])).toBe('UNMAPPED');
    expect(
      computeMappingStatus([
        {
          sectionCode: 'A',
          shiftId: 's1',
          capacity: 200,
          seatLedger: { confirmedCount: 0 },
        },
      ]),
    ).toBe('FULL');
    expect(
      computeMappingStatus([
        {
          sectionCode: 'A',
          shiftId: null,
          capacity: 200,
          seatLedger: { confirmedCount: 0 },
        },
      ]),
    ).toBe('PARTIAL');
  });

  it('computes enrollment status from seat ledger', () => {
    expect(
      computeEnrollmentStatus([
        {
          sectionCode: 'A',
          shiftId: 's1',
          capacity: 200,
          seatLedger: { confirmedCount: 0 },
        },
      ]),
    ).toBe('NO_ENROLLMENT');
    expect(
      computeEnrollmentStatus([
        {
          sectionCode: 'A',
          shiftId: 's1',
          capacity: 200,
          seatLedger: { confirmedCount: 200 },
        },
      ]),
    ).toBe('FULL');
    expect(
      computeEnrollmentStatus([
        {
          sectionCode: 'A',
          shiftId: 's1',
          capacity: 200,
          seatLedger: { confirmedCount: 185 },
        },
      ]),
    ).toBe('NEAR_FULL');
  });

  it('applies shared pool quick toggle', () => {
    expect(applyQuickToggle({ quickToggle: 'SHARED_POOLS' }).isSharedPool).toBe(
      true,
    );
    expect(applyQuickToggle({ quickToggle: 'COMMON_FYUGP' }).category).toEqual([
      'MDC',
      'AEC',
      'SEC',
      'VAC',
      'VTC',
    ]);
  });

  it('filters mapping status', () => {
    expect(matchesMappingStatusFilter('FULL', 'FULL')).toBe(true);
    expect(matchesMappingStatusFilter('PARTIAL', 'FULL')).toBe(false);
    expect(matchesMappingStatusFilter('UNMAPPED', undefined)).toBe(true);
  });

  it('dedupes curriculum offering rows by id', () => {
    const rows = [
      { id: 'a', course: { code: 'A' } },
      { id: 'b', course: { code: 'B' } },
      { id: 'a', course: { code: 'A-dup' } },
    ];
    expect(dedupeCurriculumOfferingRows(rows)).toEqual([
      { id: 'a', course: { code: 'A' } },
      { id: 'b', course: { code: 'B' } },
    ]);
  });
});

describe('CurriculumOfferingListService', () => {
  const prisma = {
    courseOffering: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    programmePoolAssignment: { findMany: jest.fn() },
    semesterStructureRule: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const curriculum = {
    resolveProgrammeCurriculum: jest.fn(),
  };

  const service = new CurriculumOfferingListService(
    prisma as never,
    curriculum as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (ops: Promise<unknown>[]) =>
      Promise.all(ops),
    );
  });

  it('merges direct and inherited pool offerings when programme is selected', async () => {
    prisma.programmePoolAssignment.findMany.mockResolvedValue([
      { semesterNo: 1 },
    ]);
    prisma.courseOffering.findMany
      .mockResolvedValueOnce([{ semesterSequence: 1 }])
      .mockResolvedValueOnce([]);
    prisma.semesterStructureRule.findMany.mockResolvedValue([]);
    curriculum.resolveProgrammeCurriculum.mockResolvedValue({
      directOfferings: [{ id: 'direct-1' }],
      inheritedPoolOfferings: [
        {
          offering: { id: 'pool-1' },
          poolId: 'pool-a',
          poolName: 'MDC Pool',
        },
      ],
    });
    prisma.courseOffering.count.mockResolvedValue(2);

    await service.listCurriculumOfferings('tenant-1', {
      programVersionId: 'pv-1',
      page: 1,
      limit: 30,
    });

    expect(curriculum.resolveProgrammeCurriculum).toHaveBeenCalledWith(
      'tenant-1',
      'pv-1',
      1,
    );
    const countArgs = prisma.courseOffering.count.mock.calls.at(-1)?.[0];
    expect(countArgs?.where?.AND).toEqual(
      expect.arrayContaining([{ id: { in: ['direct-1', 'pool-1'] } }]),
    );
  });

  it('filters shared pool rows via isSharedPool', async () => {
    prisma.courseOffering.count.mockResolvedValue(0);
    prisma.courseOffering.findMany.mockResolvedValue([]);

    await service.listCurriculumOfferings('tenant-1', {
      isSharedPool: true,
      page: 1,
      limit: 30,
    });

    const countArgs = prisma.courseOffering.count.mock.calls[0]?.[0];
    expect(countArgs?.where?.AND).toEqual(
      expect.arrayContaining([{ mappingSource: MAPPING_SOURCE.SHARED_POOL }]),
    );
  });

  it('paginates memory-filtered mapping status results', async () => {
    prisma.courseOffering.findMany.mockResolvedValue([
      {
        id: 'off-1',
        majorPaperIndex: null,
        mappingSource: MAPPING_SOURCE.DIRECT,
        programVersionId: 'pv-1',
        categoryPoolId: null,
        sections: [],
        course: { code: 'ENG101', title: 'English' },
      },
      {
        id: 'off-2',
        majorPaperIndex: null,
        mappingSource: MAPPING_SOURCE.DIRECT,
        programVersionId: 'pv-1',
        categoryPoolId: null,
        sections: [
          {
            sectionCode: 'A',
            shiftId: 'shift-1',
            capacity: 200,
            studentGroup: null,
            staffProfileId: 'staff-1',
            seatLedger: { confirmedCount: 0 },
            subjectAssignments: [],
          },
        ],
        course: { code: 'ECO101', title: 'Economics' },
      },
    ]);

    const result = await service.listCurriculumOfferings('tenant-1', {
      mappingStatus: 'FULL',
      page: 1,
      limit: 30,
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe('off-2');
    expect(result.data[0]?.mappingStatus).toBe('FULL');
    expect(result.meta.total).toBe(1);
  });
});
