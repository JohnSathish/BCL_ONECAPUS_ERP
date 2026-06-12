import { formatStreamIneligibleMessage } from '../../../../common/utils/stream-eligibility';
import type { RegistrationValidationContext } from '../registration-context';
import { streamEligibilityValidator } from './index';

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
    categoryCounts: { MDC: 1 },
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
    studentStreamId: 'stream-commerce',
    studentStreamLabel: 'COMMERCE',
    ...overrides,
  };
}

describe('streamEligibilityValidator', () => {
  it('names the blocking course, section, and allowed streams', () => {
    const sectionMeta = new Map([
      [
        'sec-mdc',
        {
          offeringId: 'off-mdc',
          courseId: 'course-mdc',
          courseCode: 'MDC-112',
          courseTitle: 'Fundamentals of Computer Systems',
          category: 'MDC' as const,
          subjectSlug: 'computer-science',
          semesterSequence: 1,
          shiftId: 'shift-day',
          shiftCode: 'DAY',
          sectionCode: 'A',
          capacity: 80,
          waitlistCapacity: 0,
          confirmedCount: 0,
          waitlistCount: 0,
          courseCredits: 3,
          prerequisiteOfferingIds: [],
          allowedStreamIds: ['stream-arts'],
          allowedStreamLabels: ['ARTS'],
        },
      ],
    ]);

    const result = streamEligibilityValidator(
      baseContext({
        selections: [
          {
            category: 'MDC',
            offeringId: 'off-mdc',
            offeringSectionId: 'sec-mdc',
          },
        ],
        sectionMeta,
        offeringMeta: sectionMeta,
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('STREAM_INELIGIBLE');
      expect(result.message).toContain(
        'MDC-112 — Fundamentals of Computer Systems',
      );
      expect(result.message).toContain('Section A');
      expect(result.message).toContain('COMMERCE');
      expect(result.message).toContain('Allowed streams on this section: ARTS');
      expect(result.message).toContain('Course Master');
    }
  });

  it('formats actionable guidance via helper', () => {
    expect(
      formatStreamIneligibleMessage({
        courseCode: 'VAC-140',
        courseTitle: 'Environmental Studies',
        category: 'VAC',
        sectionCode: 'A',
        studentStreamLabel: 'COMMERCE',
        allowedStreamLabels: ['ARTS', 'SCIENCE'],
      }),
    ).toContain('VAC-140 — Environmental Studies');
  });
});
