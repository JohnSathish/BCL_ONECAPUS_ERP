import {
  DEFAULT_SHARED_POOL_SECTION_CAPACITY,
  isHonoursRestrictedSection,
  isLegacyDefaultPoolCapacity,
  isSharedPoolCapacityCategory,
  readSharedPoolCapacityFromPolicy,
  resolveSharedPoolSectionCapacity,
} from './section-capacity';

describe('section-capacity', () => {
  it('recognizes shared pool categories', () => {
    expect(isSharedPoolCapacityCategory('mdc')).toBe(true);
    expect(isSharedPoolCapacityCategory('MAJOR')).toBe(false);
  });

  it('reads tenant default from credit policy', () => {
    expect(readSharedPoolCapacityFromPolicy(null)).toBe(
      DEFAULT_SHARED_POOL_SECTION_CAPACITY,
    );
    expect(
      readSharedPoolCapacityFromPolicy({ defaultSharedPoolCapacity: 150 }),
    ).toBe(150);
  });

  it('uses tenant default for legacy offering capacity', () => {
    expect(
      resolveSharedPoolSectionCapacity({
        offeringCapacity: 40,
        tenantDefaultCapacity: 200,
      }),
    ).toBe(200);
  });

  it('preserves customized offering capacity', () => {
    expect(
      resolveSharedPoolSectionCapacity({
        offeringCapacity: 60,
        tenantDefaultCapacity: 200,
      }),
    ).toBe(60);
  });

  it('preserves explicit section capacity', () => {
    expect(
      resolveSharedPoolSectionCapacity({
        explicitCapacity: 25,
        offeringCapacity: 40,
        tenantDefaultCapacity: 200,
      }),
    ).toBe(25);
  });

  it('detects honours student groups', () => {
    expect(isHonoursRestrictedSection('Honours')).toBe(true);
    expect(isLegacyDefaultPoolCapacity(40)).toBe(true);
    expect(isLegacyDefaultPoolCapacity(200)).toBe(false);
  });
});
