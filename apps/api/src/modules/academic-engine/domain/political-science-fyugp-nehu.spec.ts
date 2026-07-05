import { POLITICAL_SCIENCE_NEHU_PAPERS } from './political-science-fyugp-nehu';
import { isValidNehuCourseCode } from './course-code.util';

describe('political-science-fyugp-nehu', () => {
  it('lists NEHU Political Science papers with standard POL-### codes', () => {
    expect(POLITICAL_SCIENCE_NEHU_PAPERS).toHaveLength(16);
    for (const paper of POLITICAL_SCIENCE_NEHU_PAPERS) {
      expect(paper.code.startsWith('POL-')).toBe(true);
      expect(isValidNehuCourseCode(paper.code)).toBe(true);
    }
    expect(POLITICAL_SCIENCE_NEHU_PAPERS.map((paper) => paper.code)).toContain(
      'POL-303',
    );
  });

  it('uses POL department prefix per NEHU (not PSC)', () => {
    expect(
      POLITICAL_SCIENCE_NEHU_PAPERS.find((paper) => paper.code === 'POL-100')
        ?.title,
    ).toBe('Political Theory');
    expect(
      POLITICAL_SCIENCE_NEHU_PAPERS.find((paper) => paper.code === 'POL-302')
        ?.notes,
    ).toContain('MINOR');
  });
});
