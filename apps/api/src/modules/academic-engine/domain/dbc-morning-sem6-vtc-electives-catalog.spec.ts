import {
  MORNING_SEM6_VTC_CODES,
  DBC_MORNING_SEM6_VTC_COURSE_TITLES,
  buildDbcMorningSem6VtcCourses,
} from './dbc-morning-sem6-vtc-electives-catalog';
import { NEHU_VTC_CREDIT_PROFILE } from './dbc-vtc-sem3.util';

describe('dbc-morning-sem6-vtc-electives-catalog', () => {
  it('lists official Morning Shift Sem 6 VTC pool (8 choices)', () => {
    expect(MORNING_SEM6_VTC_CODES).toEqual([
      'VTC-360.3',
      'VTC-361.2',
      'VTC-363.2',
      'VTC-363.3',
      'VTC-364.2',
      'VTC-365.3',
      'VTC-366.1',
      'VTC-369.1',
    ]);
  });

  it('builds Sem 6 VTC courses with 4-credit (1T+3P) profile', () => {
    const courses = buildDbcMorningSem6VtcCourses();
    expect(courses).toHaveLength(8);
    for (const course of courses) {
      expect(course.semesterSequence).toBe(6);
      expect(course.deliveryType).toBe('THEORY_PRACTICAL');
      expect(course.credits).toBe(NEHU_VTC_CREDIT_PROFILE.credits);
      expect(course.totalContactHours).toBe(105);
    }
  });

  it('documents NEHU titles for all Morning Sem 6 VTC papers', () => {
    for (const code of MORNING_SEM6_VTC_CODES) {
      expect(DBC_MORNING_SEM6_VTC_COURSE_TITLES[code]).toBeTruthy();
    }
  });
});
