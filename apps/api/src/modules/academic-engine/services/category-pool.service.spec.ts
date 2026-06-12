import { CategoryPoolService } from './category-pool.service';
import { MAPPING_SOURCE } from '../domain/category-pools';

describe('CategoryPoolService', () => {
  const curriculum = {
    resolveProgramVersionInstitutionId: jest.fn(),
  };
  const prisma = {
    categoryPool: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    institution: { findFirst: jest.fn() },
    course: { findFirst: jest.fn() },
    programVersion: { findFirst: jest.fn(), findMany: jest.fn() },
    categoryPoolCourse: { upsert: jest.fn(), deleteMany: jest.fn() },
    courseOffering: {
      findFirst: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },
    programmePoolAssignment: {
      count: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    semesterRegistrationLine: { count: jest.fn() },
    programmePoolCourseExclusion: { findMany: jest.fn() },
    semesterStructureRule: { findMany: jest.fn() },
    tenantAcademicSettings: { findUnique: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn((ops: unknown[]) =>
      Promise.all(ops as Promise<unknown>[]),
    ),
  };

  const service = new CategoryPoolService(
    prisma as never,
    curriculum as never,
    {
      ensureDefaultSection: jest
        .fn()
        .mockResolvedValue({ created: true, sectionId: 'sec-1' }),
      provisionPoolOfferings: jest.fn(),
    } as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('rejects MAJOR category pools', async () => {
    prisma.institution.findFirst.mockResolvedValue({ id: 'inst-1' });
    await expect(
      service.createPool('tenant-1', 'user-1', {
        poolName: 'Bad pool',
        institutionId: 'inst-1',
        semesterNo: 1,
        categoryType: 'MAJOR',
      }),
    ).rejects.toThrow(/not eligible for shared pools/i);
  });

  it('syncs canonical offering when adding pool course', async () => {
    prisma.categoryPool.findFirst.mockResolvedValue({
      id: 'pool-1',
      semesterNo: 1,
      categoryType: 'MDC',
      poolName: 'MDC Pool',
      courses: [],
      offerings: [],
      assignments: [],
    });
    prisma.course.findFirst.mockResolvedValue({ id: 'course-1' });
    prisma.courseOffering.findFirst.mockResolvedValue(null);
    prisma.courseOffering.upsert.mockResolvedValue({ id: 'off-1' });
    prisma.categoryPoolCourse.upsert.mockResolvedValue({
      id: 'pc-1',
      course: { code: 'MDC101' },
    });

    await service.addPoolCourse('tenant-1', 'pool-1', { courseId: 'course-1' });

    expect(prisma.courseOffering.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          categoryPoolId_courseId: {
            categoryPoolId: 'pool-1',
            courseId: 'course-1',
          },
        },
        create: expect.objectContaining({
          mappingSource: MAPPING_SOURCE.SHARED_POOL,
          programVersionId: null,
          categoryPoolId: 'pool-1',
        }),
      }),
    );
  });
});
