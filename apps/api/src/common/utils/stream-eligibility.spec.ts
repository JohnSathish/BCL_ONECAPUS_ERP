import {
  isSectionOpenToAllStreams,
  isStudentEligibleForSection,
} from './stream-eligibility';

describe('stream-eligibility', () => {
  it('treats empty eligibility as open', () => {
    expect(isSectionOpenToAllStreams([])).toBe(true);
    expect(isStudentEligibleForSection('arts-id', [])).toBe(true);
  });

  it('restricts to listed streams', () => {
    expect(isStudentEligibleForSection('arts-id', ['arts-id'])).toBe(true);
    expect(isStudentEligibleForSection('science-id', ['arts-id'])).toBe(false);
  });
});
