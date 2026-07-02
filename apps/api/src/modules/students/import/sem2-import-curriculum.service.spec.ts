import { Sem2ImportCurriculumService } from './sem2-import-curriculum.service';

describe('Sem2ImportCurriculumService', () => {
  const service = new Sem2ImportCurriculumService(
    {} as never,
    {} as never,
    {} as never,
  );

  const morningMdc = [
    {
      title: 'Environmental Ethics',
      code: 'MDC-162',
      courseId: 'c1',
      offeringId: 'o1',
    },
    {
      title: 'Fundamentals of Statistics',
      code: 'MDC-163',
      courseId: 'c2',
      offeringId: 'o2',
    },
  ];

  const dayOnlyMdc = {
    title: 'Entrepreneurship',
    code: 'MDC-161',
    courseId: 'c-day',
    offeringId: 'o-day',
  };

  it('resolveCategoryPaper matches pool paper titles', () => {
    expect(
      service.resolveCategoryPaper(morningMdc, 'environmental ethics', 'MDC')
        ?.code,
    ).toBe('MDC-162');
  });

  it('morning catalog excludes Day-only MDC titles when not in options', () => {
    const morningCatalog = {
      programVersionId: 'pv-1',
      programCode: 'BA-ECO',
      programName: 'BA Economics',
      curriculumLabel: 'FYUGP',
      semesterSequence: 2 as const,
      shiftId: 'shift-morning',
      majorDepartments: [
        {
          departmentName: 'Economics',
          subjectSlug: 'economics',
          paper: {
            title: 'Macroeconomics I',
            code: 'ECO-150',
            courseId: 'c-major',
            offeringId: 'o-major',
          },
        },
      ],
      mdcPapers: morningMdc,
      aecPapers: [],
      secPapers: [],
      vacPapers: [
        {
          title: 'Life Skills Education',
          code: 'VAC-191',
          courseId: 'c-vac',
          offeringId: 'o-vac',
        },
      ],
      minorByMajor: { economics: ['Political Science'] },
    };

    expect(
      service.resolveCategoryPaper(
        morningCatalog.mdcPapers,
        'Entrepreneurship',
        'MDC',
      ),
    ).toBeUndefined();
    expect(
      service.resolveMajorDepartment(morningCatalog, 'Economics')?.paper.code,
    ).toBe('ECO-150');
    expect(
      service.resolveCategoryPaper(
        [...morningCatalog.mdcPapers, dayOnlyMdc],
        'Entrepreneurship',
        'MDC',
      )?.code,
    ).toBe('MDC-161');
  });
});
