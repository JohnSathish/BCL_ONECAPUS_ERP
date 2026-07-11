import { Sem5ImportCurriculumService } from './sem5-import-curriculum.service';

describe('Sem5ImportCurriculumService', () => {
  const prisma = {
    programVersion: { findFirst: jest.fn(), findMany: jest.fn() },
  };
  const curriculum = {
    resolveProgrammeCurriculum: jest.fn(),
  };
  const majorMinorEligibility = {
    listEligibleMinors: jest.fn(),
  };

  const service = new Sem5ImportCurriculumService(
    prisma as never,
    curriculum as never,
    majorMinorEligibility as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolveInternshipArea matches known areas case-insensitively', () => {
    expect(service.resolveInternshipArea('bank internship')).toBe(
      'Bank Internship',
    );
    expect(service.resolveInternshipArea('Unknown Area')).toBeUndefined();
  });

  it('resolveInternshipPaper matches registered course labels', () => {
    const catalog = {
      programVersionId: 'pv-1',
      programCode: 'BA-ECO',
      programName: 'BA Economics',
      curriculumLabel: 'FYUGP',
      semesterSequence: 5 as const,
      majorDepartments: [
        {
          departmentName: 'Economics',
          subjectSlug: 'economics',
          paper1: {
            title: 'P1',
            code: 'ECO-300',
            courseId: 'c1',
            offeringId: 'o1',
          },
          paper2: {
            title: 'P2',
            code: 'ECO-301',
            courseId: 'c2',
            offeringId: 'o2',
          },
          paper3: {
            title: 'P3',
            code: 'ECO-302',
            courseId: 'c3',
            offeringId: 'o3',
          },
          internship: {
            title: 'Internship',
            code: 'ECO-303',
            courseId: 'c4',
            offeringId: 'o4',
          },
        },
      ],
      minorDepartments: [],
      internshipAreas: ['ECO-303 — Internship'],
      minorByMajor: { economics: ['History'] },
    };

    expect(
      service.formatInternshipCourseLabel(
        catalog.majorDepartments[0]!.internship,
      ),
    ).toBe('ECO-303 — Internship');
    expect(
      service.resolveInternshipPaper(catalog, 'ECO-303 — Internship')?.code,
    ).toBe('ECO-303');
    expect(
      service.resolveInternshipPaper(
        catalog,
        'Internship',
        catalog.majorDepartments[0]!.internship,
      )?.code,
    ).toBe('ECO-303');
    expect(
      service.resolveInternshipPaper(
        catalog,
        'Internship',
        catalog.majorDepartments[0]!.internship,
      )?.code,
    ).toBe('ECO-303');
    expect(service.resolveInternshipPaper(catalog, 'eco-303')?.title).toBe(
      'Internship',
    );
    expect(
      service.resolveInternshipPaper(catalog, 'Bank Internship'),
    ).toBeUndefined();
  });

  it('resolveMajorDepartment finds department by normalized name', () => {
    const catalog = {
      programVersionId: 'pv-1',
      programCode: 'BA-ECO',
      programName: 'BA Economics',
      curriculumLabel: 'FYUGP',
      semesterSequence: 5 as const,
      majorDepartments: [
        {
          departmentName: 'Economics',
          subjectSlug: 'economics',
          paper1: {
            title: 'P1',
            code: 'ECO-300',
            courseId: 'c1',
            offeringId: 'o1',
          },
          paper2: {
            title: 'P2',
            code: 'ECO-301',
            courseId: 'c2',
            offeringId: 'o2',
          },
          paper3: {
            title: 'P3',
            code: 'ECO-302',
            courseId: 'c3',
            offeringId: 'o3',
          },
          internship: {
            title: 'Internship',
            code: 'ECO-303',
            courseId: 'c4',
            offeringId: 'o4',
          },
        },
      ],
      minorDepartments: [],
      internshipAreas: ['Bank Internship'],
      minorByMajor: { economics: ['History'] },
    };

    expect(
      service.resolveMajorDepartment(catalog, 'economics')?.departmentName,
    ).toBe('Economics');
    expect(
      service.resolveMinorDepartment(catalog, 'Economics', 'History'),
    ).toBe('History');
    expect(
      service.resolveMinorDepartment(catalog, 'Economics', 'Chemistry'),
    ).toBeUndefined();
  });

  it('curriculumLabelFromVersion prefers FYUGP template name', () => {
    expect(
      service.curriculumLabelFromVersion({
        structureTemplate: {
          structureType: 'FYUGP_4Y_8S',
          lastAppliedFyugpTemplate: {
            templateName: 'FYUGP Arts',
            programmeLevel: 'UG',
          },
        },
      }),
    ).toBe('FYUGP Arts');
  });

  it('buildTenantMinorByMajor merges minors from each programme version', async () => {
    prisma.programVersion.findMany.mockResolvedValue([
      { id: 'bcom-v' },
      { id: 'ba-eco-v' },
    ]);
    const buildCatalogSpy = jest
      .spyOn(service, 'buildCatalog')
      .mockResolvedValueOnce({
        minorByMajor: {
          commerce: ['Economics', 'Geography', 'Mathematics'],
        },
      } as never)
      .mockResolvedValueOnce({
        minorByMajor: {
          economics: ['Geography', 'History', 'Political Science', 'Sociology'],
        },
      } as never);

    const result = await service.buildTenantMinorByMajor('tenant-1', 'shift-1');

    expect(buildCatalogSpy).toHaveBeenNthCalledWith(1, 'tenant-1', {
      programVersionId: 'bcom-v',
      semesterSequence: 5,
      academicYearId: undefined,
      shiftId: 'shift-1',
    });
    expect(result.commerce).toEqual(['Economics', 'Geography', 'Mathematics']);
    expect(result.economics).toEqual([
      'Geography',
      'History',
      'Political Science',
      'Sociology',
    ]);
    buildCatalogSpy.mockRestore();
  });

  it('buildMinorDepartments excludes internship slot -303 courses', () => {
    const minors = (
      service as unknown as {
        buildMinorDepartments: (
          offerings: {
            course: {
              code: string;
              title: string;
              department?: { name: string; code: string } | null;
            };
          }[],
        ) => { departmentName: string }[];
      }
    ).buildMinorDepartments([
      {
        course: {
          code: 'GAR-303',
          title: 'Internship',
          department: { name: 'Garo', code: 'GAR' },
        },
      },
      {
        course: {
          code: 'GAR-302',
          title: 'Rabindra Sahitya',
          department: { name: 'Garo', code: 'GAR' },
        },
      },
    ]);
    expect(minors.map((row) => row.departmentName)).toEqual(['Garo']);
  });
});
