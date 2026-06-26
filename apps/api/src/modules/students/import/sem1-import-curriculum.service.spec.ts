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
      minorByMajor: { economics: ['History'] },
    };

    const minor = service.resolveMinorDepartment(
      catalog,
      'Economics',
      'History',
    );
    expect(minor?.paper.code).toBe('HIS-100');
  });
});
