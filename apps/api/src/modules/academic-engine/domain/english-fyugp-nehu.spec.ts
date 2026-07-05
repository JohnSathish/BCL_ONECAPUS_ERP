import { ENGLISH_NEHU_PAPERS } from './english-fyugp-nehu';
import { isValidNehuCourseCode } from './course-code.util';

describe('english-fyugp-nehu', () => {
  it('lists NEHU English papers with standard ENG-### codes', () => {
    expect(ENGLISH_NEHU_PAPERS).toHaveLength(16);
    for (const paper of ENGLISH_NEHU_PAPERS) {
      expect(paper.code.startsWith('ENG-')).toBe(true);
      expect(isValidNehuCourseCode(paper.code)).toBe(true);
    }
    expect(ENGLISH_NEHU_PAPERS.map((paper) => paper.code)).toContain('ENG-303');
    expect(
      ENGLISH_NEHU_PAPERS.find((paper) => paper.code === 'ENG-302')?.notes,
    ).toContain('MINOR');
  });
});
