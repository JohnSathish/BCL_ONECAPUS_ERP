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
            code: 'ECO-304',
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
});
