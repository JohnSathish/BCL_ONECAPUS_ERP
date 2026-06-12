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
});
