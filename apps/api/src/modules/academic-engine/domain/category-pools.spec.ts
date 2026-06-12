import {
  assertPoolEligibleCategory,
  isPoolEligibleCategory,
} from './category-pools';

describe('category-pools domain', () => {
  it('allows pool-eligible categories', () => {
    expect(isPoolEligibleCategory('MDC')).toBe(true);
    expect(isPoolEligibleCategory('VTC')).toBe(true);
  });

  it('blocks INTERNSHIP from shared pools', () => {
    expect(isPoolEligibleCategory('INTERNSHIP')).toBe(false);
    expect(() => assertPoolEligibleCategory('INTERNSHIP')).toThrow(
      /not eligible/i,
    );
  });

  it('blocks MAJOR from pools', () => {
    expect(isPoolEligibleCategory('MAJOR')).toBe(false);
    expect(() => assertPoolEligibleCategory('MAJOR')).toThrow(/not eligible/i);
  });
});
