import { CurriculumResolutionService } from './curriculum-resolution.service';
import { MAPPING_SOURCE } from '../domain/category-pools';

describe('CurriculumResolutionService', () => {
  const prisma = {
    programVersion: { findFirst: jest.fn() },
    programmePoolAssignment: { findMany: jest.fn() },
    programmePoolCourseExclusion: { findMany: jest.fn() },
    courseOffering: { findMany: jest.fn(), upsert: jest.fn() },
    categoryPool: { findMany: jest.fn() },
    semesterStructureRule: { findFirst: jest.fn() },
  };

  const service = new CurriculumResolutionService(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it('merges direct and inherited pool offerings', async () => {
    prisma.programmePoolAssignment.findMany.mockResolvedValue([
      { poolId: 'pool-1' },
    ]);
    prisma.programmePoolCourseExclusion.findMany.mockResolvedValue([]);
    prisma.courseOffering.findMany.mockResolvedValue([
      {
        id: 'direct-1',
        category: 'MAJOR',
        semesterSequence: 1,
        course: { code: 'MAJ101' },
      },
    ]);
    prisma.categoryPool.findMany.mockResolvedValue([
      {
        id: 'pool-1',
        poolName: 'MDC Semester 1 Pool',
        offerings: [
          {
            id: 'pool-off-1',
            category: 'MDC',
            semesterSequence: 1,
            courseId: 'course-mdc',
            course: { code: 'MDC101' },
            sections: [],
          },
        ],
      },
    ]);

    const result = await service.resolveProgrammeCurriculum(
      'tenant-1',
      'pv-1',
      1,
    );

    expect(result.directOfferings).toHaveLength(1);
    expect(result.inheritedPoolOfferings).toHaveLength(1);
    expect(result.inheritedPoolOfferings[0].poolName).toBe(
      'MDC Semester 1 Pool',
    );
    expect(result.inheritedPoolOfferings[0].mappingSource).toBe(
      MAPPING_SOURCE.SHARED_POOL,
    );
  });

  it('excludes programme-specific pool courses', async () => {
    prisma.programmePoolAssignment.findMany.mockResolvedValue([
      { poolId: 'pool-1' },
    ]);
    prisma.programmePoolCourseExclusion.findMany.mockResolvedValue([
      { poolId: 'pool-1', courseId: 'course-mdc' },
    ]);
    prisma.courseOffering.findMany.mockResolvedValue([]);
    prisma.categoryPool.findMany.mockResolvedValue([
      {
        id: 'pool-1',
        poolName: 'MDC Semester 1 Pool',
        offerings: [
          {
            id: 'pool-off-1',
            category: 'MDC',
            semesterSequence: 1,
            courseId: 'course-mdc',
            course: { code: 'MDC101' },
            sections: [],
          },
        ],
      },
    ]);

    const result = await service.resolveProgrammeCurriculum(
      'tenant-1',
      'pv-1',
      1,
    );
    expect(result.inheritedPoolOfferings).toHaveLength(0);
  });

  it('filters offerings whose course is soft-deleted', async () => {
    prisma.programmePoolAssignment.findMany.mockResolvedValue([]);
    prisma.programmePoolCourseExclusion.findMany.mockResolvedValue([]);
    prisma.courseOffering.findMany.mockResolvedValue([
      {
        id: 'edn-1',
        category: 'MAJOR',
        semesterSequence: 5,
        course: { code: 'EDN-300', deletedAt: null },
      },
    ]);
    prisma.categoryPool.findMany.mockResolvedValue([]);

    await service.resolveProgrammeCurriculum('tenant-1', 'pv-1', 5);

    expect(prisma.courseOffering.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          course: { deletedAt: null },
        }),
      }),
    );
  });

  it('uses the semester MDC pool when the programme has no pool assignment', async () => {
    prisma.programmePoolAssignment.findMany.mockResolvedValue([]);
    prisma.semesterStructureRule.findFirst.mockResolvedValue({
      categoryCounts: { MAJOR: 1, MDC: 1, AEC: 1 },
    });
    prisma.programVersion.findFirst.mockResolvedValue({
      program: { department: { institutionId: 'inst-1' } },
    });
    prisma.categoryPool.findMany.mockResolvedValue([
      { id: 'pool-mdc', categoryType: 'MDC', shiftId: null },
      { id: 'pool-aec', categoryType: 'AEC', shiftId: 'shift-morning' },
    ]);

    const ids = await service.getCatalogPoolIds(
      'tenant-1',
      'pv-1',
      1,
      'shift-day',
    );

    expect(ids).toEqual(expect.arrayContaining(['pool-mdc', 'pool-aec']));
  });
});
