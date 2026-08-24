import {
  courseMatchesSubjectPath,
  resolveCourseSubjectSlugCandidates,
} from './course-subject-slug';

describe('course-subject-slug', () => {
  it('matches mathematics minor path via department slug', () => {
    const course = {
      subjectSlug: null,
      title: 'Fundamental Mathematics-I',
      department: { name: 'Mathematics' },
    };
    expect(resolveCourseSubjectSlugCandidates(course)).toEqual([
      'fundamental-mathematics-i',
      'mathematics',
    ]);
    expect(courseMatchesSubjectPath(course, 'mathematics')).toBe(true);
  });

  it('matches commerce path via department code COM', () => {
    const course = {
      subjectSlug: null,
      title: 'Accounting for Business',
      department: { name: 'Commerce', code: 'COM' },
    };
    expect(courseMatchesSubjectPath(course, 'commerce')).toBe(true);
    expect(courseMatchesSubjectPath(course, 'com')).toBe(true);
  });
});
