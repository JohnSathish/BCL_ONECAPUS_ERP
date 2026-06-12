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
  });
});
