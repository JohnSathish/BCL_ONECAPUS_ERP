import { opacCopyAvailability } from './library-opac.logic';

describe('opacCopyAvailability', () => {
  it('never marks a reference copy as available for issue', () => {
    const row = opacCopyAvailability({
      status: 'AVAILABLE',
      onLoan: false,
      issueAllowed: false,
      copyType: 'REFERENCE',
    });
    expect(row.label).toBe('Reference only');
    expect(row.tone).toBe('reference');
  });

  it('marks an issuable copy on the shelf and a borrowed copy separately', () => {
    expect(
      opacCopyAvailability({
        status: 'AVAILABLE',
        onLoan: false,
        issueAllowed: true,
        copyType: 'GENERAL',
      }).label,
    ).toBe('Available for issue');
    expect(
      opacCopyAvailability({
        status: 'ISSUED',
        onLoan: true,
        issueAllowed: true,
        copyType: 'GENERAL',
      }).label,
    ).toBe('Borrowed');
  });
});
