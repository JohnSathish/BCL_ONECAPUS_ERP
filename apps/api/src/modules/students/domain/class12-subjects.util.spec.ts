import {
  class12BoardLookupAliases,
  class12StreamLookupAliases,
  normalizeClass12Stream,
} from './class12-subjects.util';

describe('class12 board/stream aliases', () => {
  it('expands MBOSE (MBOSE) into lookup keys', () => {
    expect(class12BoardLookupAliases('MBOSE (MBOSE)')).toEqual(
      expect.arrayContaining(['MBOSE (MBOSE)', 'MBOSE']),
    );
  });

  it('maps Commerce stream to COMMERCE plus COM', () => {
    expect(normalizeClass12Stream('Commerce')).toBe('COMMERCE');
    expect(class12StreamLookupAliases('Commerce')).toEqual(
      expect.arrayContaining(['COMMERCE', 'COM']),
    );
  });
});
