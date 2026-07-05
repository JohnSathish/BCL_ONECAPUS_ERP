import {
  DAY_SEM3_AEC_CODES,
  DAY_SEM3_MDC_CODES,
  DAY_SEM3_SEC_CODES,
  DAY_SEM3_VTC_CODES,
  DBC_DAY_SEM3_COURSE_TITLES,
  buildDbcDaySem3VtcCourses,
} from './dbc-day-sem3-electives-catalog';
import { NEHU_VTC_SEM3_CREDIT_PROFILE } from './dbc-vtc-sem3.util';

describe('dbc-day-sem3-electives-catalog', () => {
  it('lists official Day Shift Sem 3 MDC pool (6 choices)', () => {
    expect(DAY_SEM3_MDC_CODES).toEqual([
      'MDC-210',
      'MDC-211',
      'MDC-212',
      'MDC-213',
      'MDC-214',
      'MDC-215',
    ]);
  });

  it('lists official Day Shift Sem 3 AEC pool (3 choices)', () => {
    expect(DAY_SEM3_AEC_CODES).toEqual(['AEC-220', 'AEC-221', 'AEC-222']);
  });

  it('lists official Day Shift Sem 3 SEC pool (4 choices)', () => {
    expect(DAY_SEM3_SEC_CODES).toEqual([
      'SEC-230',
      'SEC-232',
      'SEC-233',
      'SEC-234',
    ]);
  });

  it('lists official Day Shift Sem 3 VTC pool (13 choices)', () => {
    expect(DAY_SEM3_VTC_CODES).toHaveLength(13);
    expect(DAY_SEM3_VTC_CODES).toContain('VTC-243.2');
    expect(DAY_SEM3_VTC_CODES).toContain('VTC-245.5');
  });

  it('builds VTC courses with NEHU 4-credit (1T+3P) profile', () => {
    const courses = buildDbcDaySem3VtcCourses();
    expect(courses).toHaveLength(13);
    for (const course of courses) {
      expect(course.deliveryType).toBe('THEORY_PRACTICAL');
      expect(course.credits).toBe(NEHU_VTC_SEM3_CREDIT_PROFILE.credits);
      expect(course.theoryCredits).toBe(1);
      expect(course.practicalCredits).toBe(3);
      expect(course.totalContactHours).toBe(105);
    }
  });

  it('documents NEHU titles for all Day Sem 3 pool courses', () => {
    for (const code of [
      ...DAY_SEM3_MDC_CODES,
      ...DAY_SEM3_AEC_CODES,
      ...DAY_SEM3_SEC_CODES,
      ...DAY_SEM3_VTC_CODES,
    ]) {
      expect(DBC_DAY_SEM3_COURSE_TITLES[code]).toBeTruthy();
    }
  });
});
