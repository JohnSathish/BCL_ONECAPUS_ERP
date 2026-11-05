import {
  class12BoardReportLabel,
  isOthersClass12Board,
} from './class12-board-name';

describe('Class XII other board name', () => {
  it('treats only the Others choice as the extra board name', () => {
    expect(isOthersClass12Board('Others')).toBe(true);
    expect(isOthersClass12Board('OTHER')).toBe(true);
    expect(isOthersClass12Board('MBOSE')).toBe(false);
    expect(isOthersClass12Board('State Board')).toBe(false);
  });

  it('groups Others students by the saved board name', () => {
    expect(
      class12BoardReportLabel('Others', 'Assam State School Education Board'),
    ).toBe('Assam State School Education Board');
    expect(
      class12BoardReportLabel('MBOSE', 'Assam State School Education Board'),
    ).toBe('MBOSE');
    expect(class12BoardReportLabel('CBSE', null)).toBe('CBSE');
  });
});
