import {
  evaluateCourseEligibility,
  isRulesEmpty,
  normalizeCourseEligibilityRules,
} from './course-eligibility.engine';
import { buildEligibilityContext } from './course-eligibility.context';
import type { StudentEligibilityContext } from './course-eligibility.types';

const baseCtx = (): StudentEligibilityContext =>
  buildEligibilityContext({
    programId: '11111111-1111-4111-8111-111111111111',
    programVersionId: '22222222-2222-4222-8222-222222222222',
    streamCode: 'SCIENCE',
    majorSubjectSlug: 'physics',
    class12Subjects: [],
    completedStudy: [],
  });

describe('course-eligibility.engine', () => {
  describe('normalizeCourseEligibilityRules', () => {
    it('sanitizes invalid input to empty rules', () => {
      expect(normalizeCourseEligibilityRules(null)).toEqual({});
      expect(normalizeCourseEligibilityRules([])).toEqual({});
    });

    it('normalizes stream codes and slugs', () => {
      expect(
        normalizeCourseEligibilityRules({
          allowedStreams: ['science', 'ALL'],
          excludedMajorSubjectSlugs: ['English Major'],
        }),
      ).toEqual({
        allowedStreams: ['SCIENCE', 'ALL'],
        allowedProgramIds: [],
        excludedProgramIds: [],
        allowedProgramVersionIds: [],
        excludedProgramVersionIds: [],
        allowedMajorSubjectSlugs: [],
        excludedMajorSubjectSlugs: ['english-major'],
        excludedStreams: [],
        class12SubjectExclusions: [],
        priorStudyExclusions: [],
      });
    });
  });

  describe('example courses', () => {
    it('AEC-220 allows only Science stream', () => {
      const rules = { allowedStreams: ['SCIENCE'] };
      expect(
        evaluateCourseEligibility(rules, {
          ...baseCtx(),
          streamCode: 'SCIENCE',
        }).eligible,
      ).toBe(true);
      expect(
        evaluateCourseEligibility(rules, {
          ...baseCtx(),
          streamCode: 'COMMERCE',
        }).eligible,
      ).toBe(false);
    });

    it('AEC-221 allows only Commerce stream', () => {
      const rules = { allowedStreams: ['COMMERCE'] };
      expect(
        evaluateCourseEligibility(rules, {
          ...baseCtx(),
          streamCode: 'COMMERCE',
        }).eligible,
      ).toBe(true);
      expect(
        evaluateCourseEligibility(rules, {
          ...baseCtx(),
          streamCode: 'SCIENCE',
        }).eligible,
      ).toBe(false);
    });

    it('AEC-222 allows only Arts stream', () => {
      const rules = { allowedStreams: ['ARTS'] };
      expect(
        evaluateCourseEligibility(rules, {
          ...baseCtx(),
          streamCode: 'ARTS',
        }).eligible,
      ).toBe(true);
      expect(
        evaluateCourseEligibility(rules, {
          ...baseCtx(),
          streamCode: 'SCIENCE',
        }).eligible,
      ).toBe(false);
    });

    it('MDC-210 allows Arts/Science/Commerce but excludes English major', () => {
      const rules = {
        allowedStreams: ['ARTS', 'SCIENCE', 'COMMERCE'],
        excludedMajorSubjectSlugs: ['english'],
      };
      expect(
        evaluateCourseEligibility(rules, {
          ...baseCtx(),
          streamCode: 'SCIENCE',
          majorSubjectSlug: 'physics',
        }).eligible,
      ).toBe(true);
      expect(
        evaluateCourseEligibility(rules, {
          ...baseCtx(),
          streamCode: 'SCIENCE',
          majorSubjectSlug: 'english',
        }).eligible,
      ).toBe(false);
    });

    it('MDC-214 excludes Physics major', () => {
      const rules = { excludedMajorSubjectSlugs: ['physics'] };
      expect(
        evaluateCourseEligibility(rules, {
          ...baseCtx(),
          majorSubjectSlug: 'chemistry',
        }).eligible,
      ).toBe(true);
      expect(
        evaluateCourseEligibility(rules, {
          ...baseCtx(),
          majorSubjectSlug: 'physics',
        }).eligible,
      ).toBe(false);
    });

    it('MDC-215 excludes Education major', () => {
      const rules = { excludedMajorSubjectSlugs: ['education'] };
      expect(
        evaluateCourseEligibility(rules, {
          ...baseCtx(),
          majorSubjectSlug: 'history',
        }).eligible,
      ).toBe(true);
      expect(
        evaluateCourseEligibility(rules, {
          ...baseCtx(),
          majorSubjectSlug: 'education',
        }).eligible,
      ).toBe(false);
    });

    it('MDC-211 excludes Sociology in Class XII or Sem III', () => {
      const rules = {
        class12SubjectExclusions: [{ subjectSlug: 'sociology' }],
        priorStudyExclusions: [
          { subjectSlug: 'sociology', semesterSequence: 3 },
        ],
      };

      expect(
        evaluateCourseEligibility(rules, {
          ...baseCtx(),
          class12Subjects: [{ name: 'Physics' }],
          completedStudy: [],
        }).eligible,
      ).toBe(true);

      expect(
        evaluateCourseEligibility(rules, {
          ...baseCtx(),
          class12Subjects: [{ name: 'Sociology' }],
          completedStudy: [],
        }).eligible,
      ).toBe(false);

      expect(
        evaluateCourseEligibility(rules, {
          ...baseCtx(),
          class12Subjects: [],
          completedStudy: [
            {
              subjectSlug: 'sociology',
              category: 'MDC',
              semesterSequence: 3,
            },
          ],
        }).eligible,
      ).toBe(false);

      expect(
        evaluateCourseEligibility(rules, {
          ...baseCtx(),
          class12Subjects: [],
          completedStudy: [
            {
              subjectSlug: 'sociology',
              category: 'MDC',
              semesterSequence: 2,
            },
          ],
        }).eligible,
      ).toBe(true);
    });
  });

  describe('programme whitelist and blacklist', () => {
    it('respects allowed and excluded programme ids', () => {
      const programId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const versionId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

      expect(
        evaluateCourseEligibility(
          { allowedProgramIds: [programId] },
          { ...baseCtx(), programId, programVersionId: versionId },
        ).eligible,
      ).toBe(true);

      expect(
        evaluateCourseEligibility(
          { allowedProgramIds: [programId] },
          { ...baseCtx(), programId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' },
        ).eligible,
      ).toBe(false);

      expect(
        evaluateCourseEligibility(
          { excludedProgramVersionIds: [versionId] },
          { ...baseCtx(), programId, programVersionId: versionId },
        ).eligible,
      ).toBe(false);
    });
  });

  describe('MDC-115 excluded streams', () => {
    it('blocks Science stream when excludedStreams includes SCIENCE', () => {
      const rules = { excludedStreams: ['SCIENCE'] as const };
      expect(
        evaluateCourseEligibility(rules, {
          ...baseCtx(),
          streamCode: 'SCIENCE',
        }).eligible,
      ).toBe(false);
      expect(
        evaluateCourseEligibility(rules, {
          ...baseCtx(),
          streamCode: 'SCIENCE',
        }).reasons[0],
      ).toContain('Science students cannot take this subject');

      expect(
        evaluateCourseEligibility(rules, {
          ...baseCtx(),
          streamCode: 'ARTS',
        }).eligible,
      ).toBe(true);
      expect(
        evaluateCourseEligibility(rules, {
          ...baseCtx(),
          streamCode: 'COMMERCE',
        }).eligible,
      ).toBe(true);
    });
  });

  describe('isRulesEmpty', () => {
    it('returns true for empty rules', () => {
      expect(isRulesEmpty({})).toBe(true);
      expect(isRulesEmpty(normalizeCourseEligibilityRules({}))).toBe(true);
    });
  });
});
