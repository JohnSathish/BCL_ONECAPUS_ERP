import { Sem1ImportCurriculumService } from './sem1-import-curriculum.service';

describe('Sem1ImportCurriculumService', () => {
  const service = new Sem1ImportCurriculumService(
    {} as never,
    {} as never,
    {} as never,
  );

  it('resolveCategoryPaper matches MDC paper titles', () => {
    const options = [
      {
        title: 'Financial Literacy',
        code: 'MDC-114',
        courseId: 'c1',
        offeringId: 'o1',
      },
    ];
    expect(
      service.resolveCategoryPaper(options, 'financial literacy', 'MDC')?.code,
    ).toBe('MDC-114');
  });

  it('resolveMajorDepartment finds department by name', () => {
    const catalog = {
      programVersionId: 'pv-1',
      programCode: 'BA-ECO',
      programName: 'BA Economics',
      curriculumLabel: 'FYUGP',
      semesterSequence: 1 as const,
      majorDepartments: [
        {
          departmentName: 'Economics',
          subjectSlug: 'economics',
          papers: [
            {
              title: 'Microeconomics I',
              code: 'ECO-100',
              courseId: 'c1',
              offeringId: 'o1',
            },
          ],
          paper: {
            title: 'Microeconomics I',
            code: 'ECO-100',
            courseId: 'c1',
            offeringId: 'o1',
          },
        },
        {
          departmentName: 'History',
          subjectSlug: 'history',
          papers: [
            {
              title: 'History I',
              code: 'HIS-100',
              courseId: 'c2',
              offeringId: 'o2',
            },
          ],
          paper: {
            title: 'History I',
            code: 'HIS-100',
            courseId: 'c2',
            offeringId: 'o2',
          },
        },
      ],
      mdcDepartments: [],
      aecPapers: [],
      secPapers: [],
      vacPaper: {
        title: 'Environmental Studies',
        code: 'VAC-140',
        courseId: 'c3',
        offeringId: 'o3',
      },
      minorDepartments: [],
      minorByMajor: { economics: ['History'] },
    };

    const minor = service.resolveMinorDepartment(
      catalog,
      'Economics',
      'History',
    );
    expect(minor?.paper.code).toBe('HIS-100');
  });

  it('buildTenantMinorByMajor uses the official table for every major department', async () => {
    const service = new Sem1ImportCurriculumService(
      {} as never,
      {} as never,
      {} as never,
    );
    jest.spyOn(service, 'buildTenantMajorDepartments').mockResolvedValue([
      {
        departmentName: 'Education',
        subjectSlug: 'education',
        papers: [],
        paper: {
          title: 'Introduction to Education',
          code: 'EDN-100',
          courseId: 'c1',
          offeringId: 'o1',
        },
      },
      {
        departmentName: 'Physics',
        subjectSlug: 'physics',
        papers: [],
        paper: {
          title: 'Mechanics',
          code: 'PHY-100',
          courseId: 'c2',
          offeringId: 'o2',
        },
      },
    ]);

    const result = await service.buildTenantMinorByMajor('tenant-1');
    expect(result.education).toEqual(['Garo', 'History', 'Philosophy']);
    expect(result.physics).toEqual(['Chemistry', 'Mathematics']);
  });

  it('uses the official First Semester matrix for Education minors', () => {
    const catalog = {
      programVersionId: 'pv-1',
      programCode: 'BA-EDU',
      programName: 'BA Education',
      curriculumLabel: 'FYUGP',
      semesterSequence: 1 as const,
      majorDepartments: [
        {
          departmentName: 'Education',
          subjectSlug: 'education',
          papers: [],
          paper: {
            title: 'Introduction to Education',
            code: 'EDN-100',
            courseId: 'c1',
            offeringId: 'o1',
          },
        },
      ],
      mdcDepartments: [],
      aecPapers: [],
      secPapers: [],
      vacPaper: {
        title: 'Environmental Studies',
        code: 'VAC-140',
        courseId: 'c3',
        offeringId: 'o3',
      },
      minorDepartments: [
        {
          departmentName: 'Garo',
          subjectSlug: 'garo',
          papers: [],
          paper: {
            title: 'Garo I',
            code: 'GAR-100',
            courseId: 'c4',
            offeringId: 'o4',
          },
        },
        {
          departmentName: 'Philosophy',
          subjectSlug: 'philosophy',
          papers: [],
          paper: {
            title: 'Philosophy I',
            code: 'PHI-100',
            courseId: 'c5',
            offeringId: 'o5',
          },
        },
      ],
      minorByMajor: {},
    };

    expect(
      service.resolveMinorDepartment(catalog, 'Education', 'Garo')?.paper.code,
    ).toBe('GAR-100');
    expect(
      service.resolveMinorDepartment(catalog, 'Education', 'Philosophy')?.paper
        .code,
    ).toBe('PHI-100');
    expect(
      service.resolveMinorDepartment(catalog, 'Education', 'Economics'),
    ).toBeUndefined();
  });

  it('resolves a minor paper from another programme when this catalogue has none', () => {
    const englishCatalog = {
      programVersionId: 'pv-eng',
      programCode: 'BA-ENG',
      programName: 'BA English',
      curriculumLabel: 'FYUGP',
      semesterSequence: 1 as const,
      majorDepartments: [
        {
          departmentName: 'English',
          subjectSlug: 'english',
          papers: [],
          paper: {
            title: 'English I',
            code: 'ENG-100',
            courseId: 'c-eng',
            offeringId: 'o-eng',
          },
        },
      ],
      mdcDepartments: [],
      aecPapers: [],
      secPapers: [],
      vacPaper: {
        title: 'Environmental Studies',
        code: 'VAC-140',
        courseId: 'c3',
        offeringId: 'o3',
      },
      minorDepartments: [],
      minorByMajor: {},
    };
    const educationPaper = {
      departmentName: 'Education',
      subjectSlug: 'education',
      papers: [],
      paper: {
        title: 'Introduction to Education',
        code: 'EDN-100',
        courseId: 'c-edn',
        offeringId: 'o-edn',
      },
    };

    expect(
      service.resolveMinorDepartment(englishCatalog, 'English', 'Education'),
    ).toBeUndefined();
    expect(
      service.resolveMinorDepartment(englishCatalog, 'English', 'Education', [
        educationPaper,
      ])?.paper.code,
    ).toBe('EDN-100');
  });
});
