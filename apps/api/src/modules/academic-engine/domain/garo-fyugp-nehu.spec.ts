import { GARO_NEHU_PAPERS } from './garo-fyugp-nehu';
import { isValidNehuCourseCode } from './course-code.util';

describe('garo-fyugp-nehu', () => {
  it('lists NEHU Garo papers with standard GAR-### codes', () => {
    expect(GARO_NEHU_PAPERS).toHaveLength(16);
    for (const paper of GARO_NEHU_PAPERS) {
      expect(paper.code.startsWith('GAR-')).toBe(true);
      expect(isValidNehuCourseCode(paper.code)).toBe(true);
    }
    expect(GARO_NEHU_PAPERS.map((paper) => paper.code)).toContain('GAR-303');
    expect(
      GARO_NEHU_PAPERS.find((paper) => paper.code === 'GAR-302')?.notes,
    ).toContain('MINOR');
  });
});
