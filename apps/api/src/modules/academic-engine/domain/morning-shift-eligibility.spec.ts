import {
  evaluateCourseEligibility,
  normalizeCourseEligibilityRules,
} from './course-eligibility.engine';

const baseCtx = () => ({
  streamCode: 'ARTS' as const,
  class12Subjects: [] as { name: string }[],
  completedStudy: [] as {
    subjectSlug: string;
    category: string;
    semesterSequence: number;
  }[],
  majorSubjectSlug: undefined as string | undefined,
  minorSubjectSlug: undefined as string | undefined,
});

describe('Morning Shift NEHU eligibility rules', () => {
  it('blocks MDC-111 for Class XII Geography or Sociology', () => {
    const rules = normalizeCourseEligibilityRules({
      class12SubjectExclusions: [
        { subjectSlug: 'geography' },
        { subjectSlug: 'sociology' },
      ],
    });

    expect(
      evaluateCourseEligibility(rules, {
        ...baseCtx(),
        class12Subjects: [{ name: 'Geography' }],
      }).eligible,
    ).toBe(false);

    expect(
      evaluateCourseEligibility(rules, {
        ...baseCtx(),
        class12Subjects: [{ name: 'Economics' }],
      }).eligible,
    ).toBe(true);
  });

  it('blocks MDC-119 for Class XII Philosophy or Philosophy major', () => {
    const rules = normalizeCourseEligibilityRules({
      class12SubjectExclusions: [{ subjectSlug: 'philosophy' }],
      excludedMajorSubjectSlugs: ['philosophy'],
    });

    expect(
      evaluateCourseEligibility(rules, {
        ...baseCtx(),
        class12Subjects: [{ name: 'Philosophy' }],
      }).eligible,
    ).toBe(false);

    expect(
      evaluateCourseEligibility(rules, {
        ...baseCtx(),
        majorSubjectSlug: 'philosophy',
      }).eligible,
    ).toBe(false);
  });

  it('blocks MDC-211 only when Sociology major and Class XII Sociology', () => {
    const rules = normalizeCourseEligibilityRules({
      excludedWhenMajorAndClass12: [
        {
          majorSubjectSlug: 'sociology',
          class12SubjectSlug: 'sociology',
          label: 'Sociology',
        },
      ],
    });

    expect(
      evaluateCourseEligibility(rules, {
        ...baseCtx(),
        majorSubjectSlug: 'sociology',
        class12Subjects: [{ name: 'Sociology' }],
      }).eligible,
    ).toBe(false);

    expect(
      evaluateCourseEligibility(rules, {
        ...baseCtx(),
        majorSubjectSlug: 'sociology',
        class12Subjects: [{ name: 'Economics' }],
      }).eligible,
    ).toBe(true);
  });

  it('blocks MDC-215 for Education major or minor', () => {
    const rules = normalizeCourseEligibilityRules({
      excludedMajorSubjectSlugs: ['education'],
      excludedMinorSubjectSlugs: ['education'],
    });

    expect(
      evaluateCourseEligibility(rules, {
        ...baseCtx(),
        majorSubjectSlug: 'education',
      }).eligible,
    ).toBe(false);

    expect(
      evaluateCourseEligibility(rules, {
        ...baseCtx(),
        minorSubjectSlug: 'education',
      }).eligible,
    ).toBe(false);
  });
});
