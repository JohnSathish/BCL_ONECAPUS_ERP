import type { RegistrationValidationContext } from '../registration-context';
import {
  categoryCreditValidator,
  selectionMetaValidator,
  semesterCreditTargetValidator,
  semesterStructureValidator,
} from './index';

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

describe('structure validators', () => {
  it('rejects missing mandatory category in semester 1', () => {
    const result = semesterStructureValidator(
      baseContext({
        categoryCounts: {
          MAJOR: 1,
          MINOR: 1,
          MDC: 1,
          AEC: 1,
          SEC: 1,
          VAC: 1,
        },
        selections: [
          {
            category: 'MAJOR',
            offeringId: 'off-1',
            offeringSectionId: 'sec-1',
          },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('CATEGORY_COUNT_MISMATCH');
  });

  it('rejects wrong category credits for semester 3 AEC', () => {
    const result = categoryCreditValidator(
      baseContext({
        semesterSequence: 3,
        categoryRequirements: {
          AEC: { count: 1, creditRule: 2, mandatory: true },
        },
        selections: [
          {
            category: 'AEC',
            offeringId: 'off-aec',
            offeringSectionId: 'sec-aec',
          },
        ],
        sectionMeta: new Map([
          [
            'sec-aec',
            {
              offeringId: 'off-aec',
              courseId: 'course-aec',
              category: 'AEC',
              subjectSlug: 'aec-eng',
              semesterSequence: 3,
              shiftId: 'shift-1',
              shiftCode: 'M',
              sectionCode: 'A',
              capacity: 30,
              waitlistCapacity: 5,
              confirmedCount: 0,
              waitlistCount: 0,
              courseCredits: 3,
              prerequisiteOfferingIds: [],
              allowedStreamIds: [],
              allowedStreamLabels: [],
              courseCode: 'TEST',
              courseTitle: 'Test Course',
            },
          ],
        ]),
        draftCreditsByCategory: { AEC: 3 },
        totalDraftCredits: 3,
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('CATEGORY_CREDIT_MISMATCH');
  });

  it('requires exact semester credit total of twenty', () => {
    const result = semesterCreditTargetValidator(
      baseContext({
        totalDraftCredits: 19,
        semesterCreditTarget: 20,
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('SEMESTER_CREDIT_TARGET_MISMATCH');
  });

  it('accepts shared pool section selections without programme-specific offering', () => {
    const result = selectionMetaValidator(
      baseContext({
        semesterSequence: 1,
        selections: [
          {
            category: 'MDC',
            offeringId: 'pool-off-1',
            offeringSectionId: 'pool-sec-1',
          },
        ],
        sectionMeta: new Map([
          [
            'pool-sec-1',
            {
              offeringId: 'pool-off-1',
              courseId: 'course-pool-1',
              category: 'MDC',
              subjectSlug: 'mdc101',
              semesterSequence: 1,
              shiftId: 'shift-1',
              shiftCode: 'DAY',
              sectionCode: 'A',
              capacity: 40,
              waitlistCapacity: 10,
              confirmedCount: 0,
              waitlistCount: 0,
              courseCredits: 3,
              prerequisiteOfferingIds: [],
              allowedStreamIds: [],
              allowedStreamLabels: [],
              courseCode: 'TEST',
              courseTitle: 'Test Course',
            },
          ],
        ]),
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('allows FYUGP Sem 1 minor via cross-programme MAJOR offering', () => {
    const result = selectionMetaValidator(
      baseContext({
        programVersionId: 'pv-eco',
        semesterSequence: 1,
        selections: [
          {
            category: 'MINOR',
            offeringId: 'pol-major-off',
            offeringSectionId: 'pol-sec-a',
          },
        ],
        sectionMeta: new Map([
          [
            'pol-sec-a',
            {
              offeringId: 'pol-major-off',
              programVersionId: 'pv-pol',
              courseId: 'course-pol-100',
              category: 'MAJOR',
              subjectSlug: 'politicalscience',
              semesterSequence: 1,
              shiftId: 'shift-1',
              shiftCode: 'DAY',
              sectionCode: 'A',
              capacity: 40,
              waitlistCapacity: 10,
              confirmedCount: 0,
              waitlistCount: 0,
              courseCredits: 4,
              prerequisiteOfferingIds: [],
              allowedStreamIds: [],
              allowedStreamLabels: [],
              courseCode: 'POL-100',
              courseTitle: 'Political Science',
            },
          ],
        ]),
      }),
    );
    expect(result.ok).toBe(true);
  });
});
