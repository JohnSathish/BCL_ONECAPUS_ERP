import { isExactRollNumberQuery } from './student-directory-search';

describe('isExactRollNumberQuery', () => {
  it('treats a full roll number as an exact lookup', () => {
    expect(isExactRollNumberQuery('HI26-17')).toBe(true);
    expect(isExactRollNumberQuery('phi26-17')).toBe(true);
    expect(isExactRollNumberQuery('BA26-756')).toBe(true);
  });

  it('leaves names and partial text as a normal search', () => {
    expect(isExactRollNumberQuery('Sangma')).toBe(false);
    expect(isExactRollNumberQuery('HI26')).toBe(false);
    expect(isExactRollNumberQuery('6009293493')).toBe(false);
  });
});
