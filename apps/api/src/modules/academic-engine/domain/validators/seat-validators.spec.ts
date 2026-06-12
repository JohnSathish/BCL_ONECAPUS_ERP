import type { RegistrationValidationContext } from '../registration-context';
import { seatAvailabilityValidator } from './index';

function baseContext(
  overrides: Partial<RegistrationValidationContext> = {},
): RegistrationValidationContext {
  return {
    tenantId: 'tenant-1',
    studentId: 'student-1',
    programVersionId: 'pv-1',
    semesterSequence: 1,
    semesterId: 'sem-1',
    selections: [],
    class12Subjects: [],
    activeChoices: [],
    categoryCounts: {},
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

describe('seatAvailabilityValidator', () => {
  it('rejects when section is full and waitlist exhausted', () => {
    const sectionMeta = new Map([
      [
        'sec-1',
        {
          offeringId: 'off-1',
          courseId: 'course-1',
          category: 'MDC' as const,
          subjectSlug: 'culture',
          semesterSequence: 1,
          shiftId: 'shift-1',
          shiftCode: 'MOR',
          sectionCode: 'MDC-A',
          capacity: 80,
          waitlistCapacity: 0,
          confirmedCount: 80,
          waitlistCount: 0,
          courseCredits: 3,
          prerequisiteOfferingIds: [],
          allowedStreamIds: [],
          allowedStreamLabels: [],
          courseCode: 'TEST',
          courseTitle: 'Test Course',
        },
      ],
    ]);

    const result = seatAvailabilityValidator(
      baseContext({
        selections: [
          {
            category: 'MDC',
            offeringId: 'off-1',
            offeringSectionId: 'sec-1',
          },
        ],
        sectionMeta,
        offeringMeta: sectionMeta,
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('SECTION_FULL');
  });

  it('passes when seats remain', () => {
    const sectionMeta = new Map([
      [
        'sec-1',
        {
          offeringId: 'off-1',
          courseId: 'course-1',
          category: 'MDC' as const,
          subjectSlug: 'culture',
          semesterSequence: 1,
          shiftId: 'shift-1',
          shiftCode: 'MOR',
          sectionCode: 'MDC-A',
          capacity: 80,
          waitlistCapacity: 10,
          confirmedCount: 50,
          waitlistCount: 0,
          courseCredits: 3,
          prerequisiteOfferingIds: [],
          allowedStreamIds: [],
          allowedStreamLabels: [],
          courseCode: 'TEST',
          courseTitle: 'Test Course',
        },
      ],
    ]);

    const result = seatAvailabilityValidator(
      baseContext({
        selections: [
          {
            category: 'MDC',
            offeringId: 'off-1',
            offeringSectionId: 'sec-1',
          },
        ],
        sectionMeta,
        offeringMeta: sectionMeta,
      }),
    );

    expect(result.ok).toBe(true);
  });
});
