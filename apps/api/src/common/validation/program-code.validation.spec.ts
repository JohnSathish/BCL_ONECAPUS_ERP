import {
  assertProgrammeCodeNotCourseLike,
  looksLikeCourseCode,
  PROGRAMME_CODE_COURSE_WARNING,
} from './program-code.validation';

describe('program-code.validation', () => {
  it('detects course-like codes', () => {
    expect(looksLikeCourseCode('ECO-100')).toBe(true);
    expect(looksLikeCourseCode('PHY-201')).toBe(true);
    expect(looksLikeCourseCode('AEC-120')).toBe(true);
    expect(looksLikeCourseCode('MDC-210')).toBe(true);
  });

  it('allows real programme codes', () => {
    expect(looksLikeCourseCode('BA-ECO')).toBe(false);
    expect(looksLikeCourseCode('BA-EDU')).toBe(false);
    expect(looksLikeCourseCode('BCA')).toBe(false);
    expect(looksLikeCourseCode('BSC-BOT')).toBe(false);
  });

  it('throws with helpful message', () => {
    expect(() => assertProgrammeCodeNotCourseLike('ECO-100')).toThrow(
      PROGRAMME_CODE_COURSE_WARNING,
    );
  });
});
