import { pickEquivalentOfferingSection } from './shift-section-match';

function section(overrides: {
  id: string;
  courseId: string;
  code: string;
  title: string;
  semester?: number | null;
  category?: string | null;
  sectionCode?: string;
  status?: string;
  titleOverride?: string | null;
}) {
  return {
    id: overrides.id,
    sectionCode: overrides.sectionCode ?? 'A',
    status: overrides.status ?? 'active',
    courseOfferingId: `offering-${overrides.id}`,
    courseOffering: {
      id: `offering-${overrides.id}`,
      category: overrides.category ?? 'MAJOR',
      semesterSequence: overrides.semester ?? 1,
      titleOverride: overrides.titleOverride ?? null,
      course: {
        id: overrides.courseId,
        code: overrides.code,
        title: overrides.title,
      },
    },
  };
}

describe('pickEquivalentOfferingSection', () => {
  const source = {
    courseId: 'course-history',
    courseCode: 'HIS-101',
    courseTitle: 'History of India',
    category: 'MAJOR',
    semesterSequence: 1,
    sectionCode: 'A',
  };

  it('matches the same paper when the destination code uses different punctuation', () => {
    const picked = pickEquivalentOfferingSection(
      [
        section({
          id: 'other',
          courseId: 'course-english',
          code: 'ENG-101',
          title: 'English',
        }),
        section({
          id: 'history',
          courseId: 'course-history-copy',
          code: 'HIS 101',
          title: 'History of India',
          category: 'Major',
        }),
      ],
      source,
    );
    expect(picked?.id).toBe('history');
  });

  it('prefers the same course row over a title lookalike', () => {
    const picked = pickEquivalentOfferingSection(
      [
        section({
          id: 'lookalike',
          courseId: 'other-history',
          code: 'HIS-201',
          title: 'History of India',
        }),
        section({
          id: 'same',
          courseId: 'course-history',
          code: 'HIS-101',
          title: 'History of India',
          sectionCode: 'B',
        }),
      ],
      source,
    );
    expect(picked?.id).toBe('same');
  });

  it('ignores a closed destination section', () => {
    const picked = pickEquivalentOfferingSection(
      [
        section({
          id: 'closed',
          courseId: 'course-history',
          code: 'HIS-101',
          title: 'History of India',
          status: 'CLOSED',
        }),
      ],
      source,
    );
    expect(picked).toBeNull();
  });
});
