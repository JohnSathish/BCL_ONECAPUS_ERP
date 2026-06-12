import { CurriculumResolutionService } from './curriculum-resolution.service';
import { MAPPING_SOURCE } from '../domain/category-pools';

describe('CurriculumResolutionService', () => {
  const prisma = {
    programVersion: { findFirst: jest.fn() },
    programmePoolAssignment: { findMany: jest.fn() },
    programmePoolCourseExclusion: { findMany: jest.fn() },
    courseOffering: { findMany: jest.fn() },
    categoryPool: { findMany: jest.fn() },
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
});
