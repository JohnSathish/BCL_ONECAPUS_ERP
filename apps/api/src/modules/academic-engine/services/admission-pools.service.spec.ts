import { AdmissionPoolsService } from './admission-pools.service';

describe('AdmissionPoolsService', () => {
  const prisma = { offeringSection: { findMany: jest.fn() } };
  const engine = {
    getStructure: jest.fn().mockResolvedValue({
      rules: [
        { semesterSequence: 1, categoryCounts: { MAJOR: 1, MINOR: 1, MDC: 1 } },
      ],
      template: { semesterCreditTarget: 20 },
    }),
  };
  const offerings = { listOfferings: jest.fn() };
  const eligibility = {
    listEligibleMajors: jest.fn(),
    listEligibleMinors: jest.fn(),
    normalizeSlug: jest.fn((v: string) => v.toLowerCase().replace(/\s+/g, '-')),
    validateMajorMinorPair: jest.fn(),
  };
  const semesterRules = {
    getSemesterRule: jest.fn(),
    resolveHonoursTrackForStudent: jest.fn(),
  };
  const courseEligibility = {
    resolveContext: jest.fn(),
    buildContextFromStudent: jest.fn(),
  };

  const service = new AdmissionPoolsService(
    prisma as never,
    engine as never,
    offerings as never,
    eligibility as never,
    semesterRules as never,
    courseEligibility as never,
  );

  beforeEach(() => jest.clearAllMocks());

  function mockSemesterRule(
    semesterSequence: number,
    categoryCounts: Record<string, number>,
  ) {
    semesterRules.getSemesterRule.mockResolvedValue({
      semesterSequence,
      categoryCounts,
      continuityRules: {},
      categoryMeta: {},
      semesterCreditTarget: 20,
      summary: 'mock',
    });
  }

  it('returns all distinct MINOR pool offerings without collapsing to one', async () => {
    mockSemesterRule(1, { MAJOR: 1, MINOR: 1, MDC: 1 });
    eligibility.listEligibleMajors.mockResolvedValue([
      { id: 'sub-eco', slug: 'economics', name: 'Economics' },
    ]);
    eligibility.listEligibleMinors.mockResolvedValue([
      { id: 'sub-geo', slug: 'geography', name: 'Geography' },
      { id: 'sub-his', slug: 'history', name: 'History' },
      { id: 'sub-pol', slug: 'political-science', name: 'Political Science' },
      { id: 'sub-soc', slug: 'sociology', name: 'Sociology' },
    ]);

    const minorRows = [
      {
        id: 'off-geo',
        category: 'MINOR',
        mappingSource: 'DIRECT',
        course: {
          id: 'c-geo',
          code: 'GEO-100',
          title: 'Introduction to Human Geography',
          credits: 4,
          subjectSlug: 'geography',
          department: { id: 'd-geo', name: 'Geography', code: 'GEO' },
        },
      },
      {
        id: 'off-his',
        category: 'MINOR',
        mappingSource: 'DIRECT',
        course: {
          id: 'c-his',
          code: 'HIS-100',
          title: 'History of India',
          credits: 4,
          subjectSlug: 'history',
          department: { id: 'd-his', name: 'History', code: 'HIS' },
        },
      },
      {
        id: 'off-pol',
        category: 'MINOR',
        mappingSource: 'DIRECT',
        course: {
          id: 'c-pol',
          code: 'POL-100',
          title: 'Political Theory',
          credits: 4,
          subjectSlug: 'political-science',
          department: { id: 'd-pol', name: 'Political Science', code: 'POL' },
        },
      },
      {
        id: 'off-soc',
        category: 'MINOR',
        mappingSource: 'DIRECT',
        course: {
          id: 'c-soc',
          code: 'SOC-100',
          title: 'Introduction to Sociology',
          credits: 4,
          subjectSlug: 'sociology',
          department: { id: 'd-soc', name: 'Sociology', code: 'SOC' },
        },
      },
    ];

    offerings.listOfferings.mockImplementation(
      async (_tenantId: string, filters: { category?: string }) => {
        if (filters.category === 'MAJOR') {
          return [
            {
              id: 'off-eco',
              category: 'MAJOR',
              course: {
                code: 'ECO-100',
                title: 'Microeconomics-I',
                credits: 4,
                subjectSlug: 'economics',
              },
            },
          ];
        }
        if (filters.category === 'MINOR') return minorRows;
        return [];
      },
    );

    const result = await service.getAdmissionPools(
      'tenant-1',
      'pv-1',
      1,
      undefined,
      'economics',
    );

    expect(eligibility.listEligibleMinors).toHaveBeenCalledWith(
      'tenant-1',
      'pv-1',
      'economics',
      1,
    );
    expect(result.minor).toHaveLength(4);
    expect(result.semesterSummary).toBe('mock');
  });

  it('skips minor pool when semester rule has no minor', async () => {
    mockSemesterRule(3, { MAJOR: 2, MDC: 1, AEC: 1, SEC: 1, VTC: 1 });
    eligibility.listEligibleMajors.mockResolvedValue([]);
    offerings.listOfferings.mockResolvedValue([]);

    const result = await service.getAdmissionPools('tenant-1', 'pv-1', 3);

    expect(eligibility.listEligibleMinors).not.toHaveBeenCalled();
    expect(result.minor).toEqual([]);
  });

  it('dedupes by offering id, not by category', async () => {
    offerings.listOfferings.mockResolvedValue([
      {
        id: 'dup-id',
        category: 'MINOR',
        course: { code: 'GEO-100', title: 'Geography', credits: 4 },
      },
      {
        id: 'dup-id',
        category: 'MINOR',
        course: { code: 'GEO-100', title: 'Geography', credits: 4 },
      },
    ]);

    const rows = await service.listPoolByNepRole(
      'tenant-1',
      'pv-1',
      1,
      'MINOR',
    );
    expect(rows).toHaveLength(1);
  });

  it('validates major/minor pair in subject basket', async () => {
    mockSemesterRule(1, { MAJOR: 1, MINOR: 1, MDC: 1 });
    eligibility.validateMajorMinorPair.mockResolvedValue({
      ok: false,
      issues: [{ code: 'INVALID_MAJOR_MINOR_PAIR', message: 'Invalid pair' }],
    });
    eligibility.listEligibleMajors.mockResolvedValue([]);
    offerings.listOfferings.mockResolvedValue([]);

    const result = await service.validateSubjectBasket('tenant-1', {
      programVersionId: 'pv-1',
      semesterSequence: 1,
      majorSubjectSlug: 'economics',
      minorSubjectSlug: 'physics',
      selections: {},
    });

    expect(result.ok).toBe(false);
    expect(
      result.issues.some((i) => i.code === 'INVALID_MAJOR_MINOR_PAIR'),
    ).toBe(true);
  });

  it('does not validate major/minor pair when minor is not required', async () => {
    mockSemesterRule(3, { MAJOR: 2, VTC: 1, MDC: 1, AEC: 1, SEC: 1 });
    eligibility.listEligibleMajors.mockResolvedValue([]);
    offerings.listOfferings.mockResolvedValue([]);

    await service.validateSubjectBasket('tenant-1', {
      programVersionId: 'pv-1',
      semesterSequence: 3,
      majorSubjectSlug: 'economics',
      minorSubjectSlug: 'geography',
      selections: {},
    });

    expect(eligibility.validateMajorMinorPair).not.toHaveBeenCalled();
  });
});
