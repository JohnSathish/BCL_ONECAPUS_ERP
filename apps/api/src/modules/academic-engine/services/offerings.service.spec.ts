import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { OfferingsService } from './offerings.service';

describe('OfferingsService catalog with pools', () => {
  const prisma = {
    offeringSection: { findMany: jest.fn() },
    categoryPool: { findMany: jest.fn() },
    programmePoolAssignment: { findMany: jest.fn() },
    courseOffering: { findMany: jest.fn() },
    semesterStructureRule: { findMany: jest.fn() },
    student: { findFirst: jest.fn() },
  };
  const academicCatalog = { listOfferingsForEngine: jest.fn() };
  const shiftScope = {
    assertCanUseShiftId: jest.fn((_, id) => id),
    resolveScope: jest.fn(() => ({})),
    applyToWhere: jest.fn((w) => w),
  };
  const sectionStreams = {
    syncForSection: jest.fn(),
    eligibleStreamIdsFromSection: jest.fn(),
  };
  const curriculum = {
    resolveCatalogSectionWhere: jest.fn(),
    filterSectionsByPoolExclusions: jest.fn(
      async (_t, _pv, sections) => sections,
    ),
    annotateSection: jest.fn((section, poolMeta) => ({
      ...section,
      mappingSource: section.courseOffering.mappingSource,
      poolName: poolMeta?.get(section.courseOffering.categoryPoolId)?.poolName,
    })),
    resolveProgrammeCurriculum: jest.fn(),
    getAssignedPoolIds: jest.fn(),
    getCatalogPoolIds: jest.fn(),
    materializePoolOfferings: jest.fn(),
    getExcludedCourseIdsByPool: jest.fn(async () => new Map()),
  };
  const poolSections = {
    ensureDefaultSection: jest.fn(),
  };

  const courseEligibility = {
    filterSections: jest.fn((_ctx, sections) => sections),
    partitionSections: jest.fn((_sections, _ctx) => ({
      eligible: _sections,
      ineligible: [],
    })),
    buildContextFromStudent: jest.fn(),
    resolveContext: jest.fn(),
  };

  const service = new OfferingsService(
    prisma as never,
    academicCatalog as never,
    shiftScope as never,
    sectionStreams as never,
    curriculum as never,
    courseEligibility as never,
    undefined,
    poolSections as never,
  );

  const user = {
    tid: 'tenant-1',
    sub: 'user-1',
    roles: ['admin'],
  } as JwtUser;

  beforeEach(() => jest.clearAllMocks());

  it('includes pool metadata on catalog sections', async () => {
    curriculum.resolveCatalogSectionWhere.mockResolvedValue({
      tenantId: 'tenant-1',
      deletedAt: null,
      status: 'active',
    });
    prisma.offeringSection.findMany.mockResolvedValue([
      {
        id: 'sec-1',
        courseOffering: {
          id: 'off-pool',
          mappingSource: 'SHARED_POOL',
          categoryPoolId: 'pool-1',
          category: 'MDC',
          course: { code: 'MDC101' },
        },
      },
    ]);
    prisma.categoryPool.findMany.mockResolvedValue([
      { id: 'pool-1', poolName: 'MDC Semester 1 Pool' },
    ]);

    const rows = (await service.catalog(user, {
      programVersionId: 'pv-1',
      semesterSequence: 1,
    })) as any[];

    expect(rows).toHaveLength(1);
    expect(curriculum.filterSectionsByPoolExclusions).toHaveBeenCalled();
    expect(rows[0].mappingSource).toBe('SHARED_POOL');
    expect(rows[0].poolName).toBe('MDC Semester 1 Pool');
    expect(poolSections.ensureDefaultSection).not.toHaveBeenCalled();
  });

  it('opens pool section A on the student shift when none exists', async () => {
    curriculum.resolveCatalogSectionWhere.mockResolvedValue({
      tenantId: 'tenant-1',
      deletedAt: null,
      status: 'active',
    });
    curriculum.getCatalogPoolIds.mockResolvedValue(['pool-mdc']);
    curriculum.getExcludedCourseIdsByPool.mockResolvedValue(new Map());
    prisma.courseOffering.findMany.mockResolvedValue([
      {
        id: 'off-mdc',
        courseId: 'course-mdc',
        category: 'MDC',
        categoryPoolId: 'pool-mdc',
        sections: [],
      },
    ]);
    poolSections.ensureDefaultSection.mockResolvedValue({
      created: true,
      sectionId: 'sec-new',
    });
    prisma.offeringSection.findMany.mockResolvedValue([
      {
        id: 'sec-new',
        courseOffering: {
          id: 'off-mdc',
          mappingSource: 'SHARED_POOL',
          categoryPoolId: 'pool-mdc',
          category: 'MDC',
          course: { code: 'MDC101' },
        },
      },
    ]);
    prisma.categoryPool.findMany.mockResolvedValue([
      { id: 'pool-mdc', poolName: 'MDC Pool' },
    ]);

    const rows = (await service.catalog(user, {
      programVersionId: 'pv-1',
      semesterSequence: 1,
      shiftId: 'shift-morning',
    })) as any[];

    expect(poolSections.ensureDefaultSection).toHaveBeenCalledWith(
      'tenant-1',
      'off-mdc',
      { shiftId: 'shift-morning', sectionCode: 'A' },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].courseOffering.category).toBe('MDC');
  });
});
