import type {
  RegistrationValidationContext,
  SectionMeta,
} from '../registration-context';
import { continuityValidator, vtcTrackValidator } from './index';

function baseContext(
  overrides: Partial<RegistrationValidationContext> = {},
): RegistrationValidationContext {
  return {
    tenantId: 'tenant-1',
    studentId: 'student-1',
    programVersionId: 'pv-1',
    semesterSequence: 4,
    semesterId: 'sem-4',
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

function vtcSectionMeta(
  id: string,
  group: string,
  stage: number,
): [string, SectionMeta] {
  return [
    id,
    {
      offeringId: `off-${id}`,
      courseId: `course-${id}`,
      courseCode: `VTC-${group}`,
      courseTitle: 'VTC Course',
      category: 'VTC',
      subjectSlug: group,
      semesterSequence: 4,
      shiftId: 'shift-1',
      shiftCode: 'DAY',
      sectionCode: 'A',
      capacity: 30,
      waitlistCapacity: 0,
      confirmedCount: 0,
      waitlistCount: 0,
      courseCredits: 2,
      vtcTrackGroupCode: group,
      vtcTrackStage: stage,
      prerequisiteOfferingIds: [],
      allowedStreamIds: [],
      allowedStreamLabels: [],
    },
  ];
}

describe('track validators', () => {
  it('allows MDC change between semesters (no LOCK rule)', () => {
    const result = continuityValidator(
      baseContext({
        semesterSequence: 2,
        continuityRules: { MAJOR: 'LOCK', MINOR: 'LOCK' },
        priorConfirmedByCategory: { MDC: 'off-mdc-1' },
        selections: [
          {
            category: 'MDC',
            offeringId: 'off-mdc-2',
            offeringSectionId: 'sec-mdc-2',
          },
        ],
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('rejects VTC track switch in semester 4', () => {
    const sectionMeta = new Map<string, SectionMeta>([
      vtcSectionMeta('sec-vtc', '243.2', 2),
    ]);
    const result = vtcTrackValidator(
      baseContext({
        semesterSequence: 4,
        vtcTrackGroupCode: '263.2',
        selections: [
          {
            category: 'VTC',
            offeringId: 'off-vtc',
            offeringSectionId: 'sec-vtc',
          },
        ],
        sectionMeta,
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('VTC_TRACK_VIOLATION');
  });

  it('accepts matching VTC continuation in semester 6', () => {
    const sectionMeta = new Map<string, SectionMeta>([
      vtcSectionMeta('sec-vtc', 'DESKTOP_PUBLISHING', 3),
    ]);
    const result = vtcTrackValidator(
      baseContext({
        semesterSequence: 6,
        vtcTrackGroupCode: 'DESKTOP_PUBLISHING',
        selections: [
          {
            category: 'VTC',
            offeringId: 'off-vtc',
            offeringSectionId: 'sec-vtc',
          },
        ],
        sectionMeta,
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('rejects wrong VTC stage for semester', () => {
    const sectionMeta = new Map<string, SectionMeta>([
      vtcSectionMeta('sec-vtc', '243.2', 1),
    ]);
    const result = vtcTrackValidator(
      baseContext({
        semesterSequence: 4,
        vtcTrackGroupCode: '243.2',
        selections: [
          {
            category: 'VTC',
            offeringId: 'off-vtc',
            offeringSectionId: 'sec-vtc',
          },
        ],
        sectionMeta,
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('VTC_STAGE_MISMATCH');
  });
});
