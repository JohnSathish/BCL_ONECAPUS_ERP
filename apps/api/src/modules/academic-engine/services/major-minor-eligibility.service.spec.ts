import { MajorMinorEligibilityService } from './major-minor-eligibility.service';

describe('MajorMinorEligibilityService', () => {
  const tenantId = 'tenant-1';
  const institutionId = 'inst-1';
  const programVersionId = 'pv-ba-eco';

  const subjects = {
    economics: {
      id: 'sub-eco',
      slug: 'economics',
      name: 'Economics',
      programmeGroup: 'ARTS',
    },
    geography: {
      id: 'sub-geo',
      slug: 'geography',
      name: 'Geography',
      programmeGroup: 'ARTS',
    },
    history: {
      id: 'sub-his',
      slug: 'history',
      name: 'History',
      programmeGroup: 'ARTS',
    },
    'political-science': {
      id: 'sub-pol',
      slug: 'political-science',
      name: 'Political Science',
      programmeGroup: 'ARTS',
    },
    sociology: {
      id: 'sub-soc',
      slug: 'sociology',
      name: 'Sociology',
      programmeGroup: 'ARTS',
    },
    physics: {
      id: 'sub-phy',
      slug: 'physics',
      name: 'Physics',
      programmeGroup: 'SCIENCE',
    },
    chemistry: {
      id: 'sub-che',
      slug: 'chemistry',
      name: 'Chemistry',
      programmeGroup: 'SCIENCE',
    },
    mathematics: {
      id: 'sub-mth',
      slug: 'mathematics',
      name: 'Mathematics',
      programmeGroup: 'SCIENCE',
    },
    'accounting-for-business': {
      id: 'sub-afb',
      slug: 'accounting-for-business',
      name: 'Accounting For Business',
      programmeGroup: 'COMMERCE',
    },
  };

  const prisma = {
    programVersion: { findFirst: jest.fn() },
    academicSubject: { findMany: jest.fn(), findFirst: jest.fn() },
    majorMinorRule: { findMany: jest.fn(), findFirst: jest.fn() },
  };

  const curriculum = {
    resolveProgrammeCurriculum: jest.fn(),
  };

  const service = new MajorMinorEligibilityService(
    prisma as never,
    curriculum as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.programVersion.findFirst.mockResolvedValue({
      id: programVersionId,
      program: { department: { institutionId } },
    });
  });

  function mockCurriculumOfferings(majorSlugs: string[], minorSlugs: string[]) {
    curriculum.resolveProgrammeCurriculum.mockImplementation(
      async (
        _t: string,
        _pv: string,
        _sem: number,
        opts?: { category?: string },
      ) => {
        const slugs = opts?.category === 'MAJOR' ? majorSlugs : minorSlugs;
        return {
          directOfferings: slugs.map((slug) => ({
            course: {
              subjectSlug: slug,
              title: slug,
              department: { name: slug.replace(/-/g, ' ') },
            },
          })),
          inheritedPoolOfferings: [],
        };
      },
    );
  }

  function mockAcademicSubjects(slugs: string[]) {
    prisma.academicSubject.findMany.mockImplementation(
      async (args: { where: { slug: { in: string[] } } }) => {
        const wanted = new Set(args.where.slug.in);
        return [...wanted]
          .map((slug) => subjects[slug as keyof typeof subjects])
          .filter(Boolean)
          .map((s) => ({
            ...s,
            departmentId: null,
            department: null,
            isActive: true,
            deletedAt: null,
          }));
      },
    );
    prisma.academicSubject.findFirst.mockImplementation(
      async (args: { where: { slug: string } }) => {
        return subjects[args.where.slug as keyof typeof subjects] ?? null;
      },
    );
  }

  it('lists Accounting for Business major when course department slug differs from subject path', async () => {
    mockCurriculumOfferings(
      ['commerce'],
      ['economics', 'mathematics', 'geography'],
    );
    curriculum.resolveProgrammeCurriculum.mockResolvedValueOnce({
      directOfferings: [
        {
          course: {
            subjectSlug: null,
            title: 'Accounting for Business',
            department: { name: 'Commerce' },
          },
        },
      ],
      inheritedPoolOfferings: [],
    });
    mockAcademicSubjects(['accounting-for-business']);

    const majors = await service.listEligibleMajors(
      tenantId,
      programVersionId,
      1,
    );
    expect(majors).toHaveLength(1);
    expect(majors[0]?.slug).toBe('accounting-for-business');
  });

  it('lists Economics major with exactly four eligible minors', async () => {
    mockCurriculumOfferings(
      ['economics'],
      ['geography', 'history', 'political-science', 'sociology', 'philosophy'],
    );
    mockAcademicSubjects([
      'economics',
      'geography',
      'history',
      'political-science',
      'sociology',
    ]);

    prisma.majorMinorRule.findMany.mockResolvedValue([
      { allowedMinorSubject: subjects.geography },
      { allowedMinorSubject: subjects.history },
      { allowedMinorSubject: subjects['political-science'] },
      { allowedMinorSubject: subjects.sociology },
    ]);

    const majors = await service.listEligibleMajors(
      tenantId,
      programVersionId,
      1,
    );
    expect(majors).toHaveLength(1);
    expect(majors[0]?.slug).toBe('economics');

    const minors = await service.listEligibleMinors(
      tenantId,
      programVersionId,
      'economics',
      1,
    );
    expect(minors).toHaveLength(4);
    expect(minors.map((m) => m.slug).sort()).toEqual([
      'geography',
      'history',
      'political-science',
      'sociology',
    ]);
  });

  it('lists Physics major with Chemistry and Mathematics minors only', async () => {
    mockCurriculumOfferings(
      ['physics'],
      ['chemistry', 'mathematics', 'economics'],
    );
    mockAcademicSubjects(['physics', 'chemistry', 'mathematics']);

    prisma.majorMinorRule.findMany.mockResolvedValue([
      { allowedMinorSubject: subjects.chemistry },
      { allowedMinorSubject: subjects.mathematics },
    ]);

    const minors = await service.listEligibleMinors(
      tenantId,
      programVersionId,
      'physics',
      1,
    );
    expect(minors).toHaveLength(2);
    expect(minors.map((m) => m.slug).sort()).toEqual([
      'chemistry',
      'mathematics',
    ]);
  });

  it('allows Accounting for Business with Economics, Mathematics, Geography and blocks Chemistry', async () => {
    mockAcademicSubjects([
      'accounting-for-business',
      'economics',
      'mathematics',
      'geography',
      'chemistry',
    ]);

    prisma.majorMinorRule.findMany.mockResolvedValue([
      { allowedMinorSubject: subjects.economics },
      { allowedMinorSubject: subjects.mathematics },
      { allowedMinorSubject: subjects.geography },
    ]);

    prisma.majorMinorRule.findFirst.mockImplementation(
      async (args: {
        where: { majorSubjectId: string; allowedMinorSubjectId: string };
      }) => {
        const allowed = new Set(['sub-eco', 'sub-mth', 'sub-geo']);
        return allowed.has(args.where.allowedMinorSubjectId)
          ? { id: 'rule' }
          : null;
      },
    );

    for (const slug of ['economics', 'mathematics', 'geography']) {
      const ok = await service.validateMajorMinorPair(
        tenantId,
        'accounting-for-business',
        slug,
      );
      expect(ok.ok).toBe(true);
    }

    const blocked = await service.validateMajorMinorPair(
      tenantId,
      'accounting-for-business',
      'chemistry',
    );
    expect(blocked.ok).toBe(false);
    expect(
      blocked.issues.some((i) => i.code === 'INVALID_MAJOR_MINOR_PAIR'),
    ).toBe(true);
  });

  it('rejects Economics + Physics with INVALID_MAJOR_MINOR_PAIR', async () => {
    mockAcademicSubjects(['economics', 'physics']);
    prisma.majorMinorRule.findFirst.mockResolvedValue(null);

    const result = await service.validateMajorMinorPair(
      tenantId,
      'economics',
      'physics',
    );
    expect(result.ok).toBe(false);
    expect(result.issues[0]?.code).toBe('INVALID_MAJOR_MINOR_PAIR');
  });
});
