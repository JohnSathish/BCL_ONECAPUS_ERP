import { HISTORY_NEHU_PAPERS } from './history-fyugp-nehu';
import { isValidNehuCourseCode } from './course-code.util';

describe('history-fyugp-nehu', () => {
  it('lists NEHU History papers with standard HIS-### codes', () => {
    expect(HISTORY_NEHU_PAPERS).toHaveLength(16);
    for (const paper of HISTORY_NEHU_PAPERS) {
      expect(paper.code.startsWith('HIS-')).toBe(true);
      expect(isValidNehuCourseCode(paper.code)).toBe(true);
    }
    expect(HISTORY_NEHU_PAPERS.map((paper) => paper.code)).toContain('HIS-303');
  });

  it('documents provisional Sem 1–2 and official Sem 3+ from NEHU PDF', () => {
    expect(
      HISTORY_NEHU_PAPERS.find((paper) => paper.code === 'HIS-100')?.notes,
    ).toContain('Provisional');
    expect(
      HISTORY_NEHU_PAPERS.find((paper) => paper.code === 'HIS-200')?.title,
    ).toContain('Early Medieval');
    expect(
      HISTORY_NEHU_PAPERS.find((paper) => paper.code === 'HIS-302')?.notes,
    ).toContain('MINOR');
  });
});
