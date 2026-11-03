import { phoneDigitsFromScan } from './library-member-scan.logic';

describe('phoneDigitsFromScan', () => {
  it('does not treat roll-number digits as a mobile fragment', () => {
    expect(phoneDigitsFromScan('HI26-15')).toBeNull();
    expect(phoneDigitsFromScan('BS25-123')).toBeNull();
    expect(phoneDigitsFromScan('CHE26-06')).toBeNull();
    expect(phoneDigitsFromScan('BA24-062')).toBeNull();
  });

  it('ignores short numeric fragments and card serials', () => {
    expect(phoneDigitsFromScan('2615')).toBeNull();
    expect(phoneDigitsFromScan('0002635125')).toBeNull();
    expect(phoneDigitsFromScan('')).toBeNull();
  });

  it('accepts a full mobile number, including a country-code prefix', () => {
    expect(phoneDigitsFromScan('9862615600')).toBe('9862615600');
    expect(phoneDigitsFromScan('+91 9862615600')).toBe('9862615600');
    expect(phoneDigitsFromScan('919862615600')).toBe('9862615600');
  });
});
