import { PHILOSOPHY_NEHU_PAPERS } from './philosophy-fyugp-nehu';
import { isValidNehuCourseCode } from './course-code.util';

describe('philosophy-fyugp-nehu', () => {
  it('lists NEHU Philosophy papers with standard PHI-### codes', () => {
    expect(PHILOSOPHY_NEHU_PAPERS).toHaveLength(16);
    for (const paper of PHILOSOPHY_NEHU_PAPERS) {
      expect(paper.code.startsWith('PHI-')).toBe(true);
      expect(isValidNehuCourseCode(paper.code)).toBe(true);
    }
    expect(PHILOSOPHY_NEHU_PAPERS.map((paper) => paper.code)).toContain(
      'PHI-303',
    );
  });

  it('aligns Sem 1 and Sem 5 dual-listed papers with NEHU PDF', () => {
    expect(
      PHILOSOPHY_NEHU_PAPERS.find((paper) => paper.code === 'PHI-100')?.title,
    ).toBe('Understanding Philosophy');
    expect(
      PHILOSOPHY_NEHU_PAPERS.find((paper) => paper.code === 'PHI-302')?.notes,
    ).toContain('MINOR');
  });
});
