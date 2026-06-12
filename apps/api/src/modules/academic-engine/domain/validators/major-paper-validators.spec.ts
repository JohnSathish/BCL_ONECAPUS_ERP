import type { RegistrationValidationContext } from '../registration-context';
import {
  duplicateMajorPaperValidator,
  majorPaperCurriculumValidator,
} from './index';

function baseContext(
  overrides: Partial<RegistrationValidationContext> = {},
): RegistrationValidationContext {
  return {
    tenantId: 'tenant-1',
    studentId: 'student-1',
    programVersionId: 'pv-1',
    semesterSequence: 3,
    semesterId: 'sem-3',
    selections: [],
    class12Subjects: [],
    activeChoices: [],
    categoryCounts: { MAJOR: 2 },
    continuityRules: {},
    categoryRequirements: {},
    semesterCreditTarget: 20,
    degreeMinCredits: 120,
    windowOpen: true,
    windowLocked: false,
    priorConfirmedByCategory: {},
    offeringMeta: new Map(),
    sectionMeta: new Map(),
    creditPolicy: { minCredits: 20, maxCredits: 20 },
    draftCreditsByCategory: {},
    totalDraftCredits: 0,
    confirmedCreditsByCategory: {},
    vacPolicy: {},
    shiftPolicy: {},
    eligibilityRules: {},
    ...overrides,
  };
}

describe('major paper validators', () => {
  it('rejects duplicate MAJOR course IDs', () => {
    const sectionMeta = new Map([
      [
        'sec-eco-200-a',
        {
          offeringId: 'off-eco-200',
          courseId: 'course-eco-200',
          category: 'MAJOR' as const,
          subjectSlug: 'economics',
          semesterSequence: 3,
          shiftId: 'shift-1',
          shiftCode: 'DAY',
          sectionCode: 'A',
          capacity: 80,
          waitlistCapacity: 0,
          confirmedCount: 0,
          waitlistCount: 0,
          courseCredits: 4,
          prerequisiteOfferingIds: [],
          allowedStreamIds: [],
          allowedStreamLabels: [],
          courseCode: 'ECO-200',
          courseTitle: 'Economics Paper',
        },
      ],
      [
        'sec-eco-200-b',
        {
          offeringId: 'off-eco-200-b',
          courseId: 'course-eco-200',
          category: 'MAJOR' as const,
          subjectSlug: 'economics',
          semesterSequence: 3,
          shiftId: 'shift-1',
          shiftCode: 'DAY',
          sectionCode: 'B',
          capacity: 80,
          waitlistCapacity: 0,
          confirmedCount: 0,
          waitlistCount: 0,
          courseCredits: 4,
          prerequisiteOfferingIds: [],
          allowedStreamIds: [],
          allowedStreamLabels: [],
          courseCode: 'ECO-200',
          courseTitle: 'Economics Paper',
        },
      ],
    ]);

    const result = duplicateMajorPaperValidator(
      baseContext({
        selections: [
          {
            category: 'MAJOR',
            offeringId: 'off-eco-200',
            offeringSectionId: 'sec-eco-200-a',
          },
          {
            category: 'MAJOR',
            offeringId: 'off-eco-200-b',
            offeringSectionId: 'sec-eco-200-b',
          },
        ],
        sectionMeta,
        offeringMeta: sectionMeta,
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('DUPLICATE_MAJOR_PAPER');
      expect(result.message).toBe('Duplicate major paper assignment detected');
    }
  });

  it('requires exactly N unique MAJOR papers from semester rule', () => {
    const sectionMeta = new Map([
      [
        'sec-eco-200',
        {
          offeringId: 'off-eco-200',
          courseId: 'course-eco-200',
          category: 'MAJOR' as const,
          subjectSlug: 'economics',
          semesterSequence: 3,
          shiftId: 'shift-1',
          shiftCode: 'DAY',
          sectionCode: 'A',
          capacity: 80,
          waitlistCapacity: 0,
          confirmedCount: 0,
          waitlistCount: 0,
          courseCredits: 4,
          prerequisiteOfferingIds: [],
          allowedStreamIds: [],
          allowedStreamLabels: [],
          courseCode: 'ECO-200',
          courseTitle: 'Economics Paper',
        },
      ],
      [
        'sec-eco-201',
        {
          offeringId: 'off-eco-201',
          courseId: 'course-eco-201',
          category: 'MAJOR' as const,
          subjectSlug: 'economics',
          semesterSequence: 3,
          shiftId: 'shift-1',
          shiftCode: 'DAY',
          sectionCode: 'A',
          capacity: 80,
          waitlistCapacity: 0,
          confirmedCount: 0,
          waitlistCount: 0,
          courseCredits: 4,
          prerequisiteOfferingIds: [],
          allowedStreamIds: [],
          allowedStreamLabels: [],
          courseCode: 'ECO-200',
          courseTitle: 'Economics Paper',
        },
      ],
    ]);

    const result = majorPaperCurriculumValidator(
      baseContext({
        selections: [
          {
            category: 'MAJOR',
            offeringId: 'off-eco-200',
            offeringSectionId: 'sec-eco-200',
          },
          {
            category: 'MAJOR',
            offeringId: 'off-eco-201',
            offeringSectionId: 'sec-eco-201',
          },
        ],
        sectionMeta,
        offeringMeta: sectionMeta,
      }),
    );

    expect(result.ok).toBe(true);
  });
});
