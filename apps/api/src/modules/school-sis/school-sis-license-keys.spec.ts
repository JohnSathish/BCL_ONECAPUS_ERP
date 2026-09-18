import {
  isCollegeErpLicenseKey,
  isBaseCodeCentralProductKey,
  isOneCampusCentralKey,
} from './school-sis-license-keys';

describe('school license key classifiers', () => {
  it('does not treat BaseCode Central OneCampus keys as college ERP keys', () => {
    expect(isCollegeErpLicenseKey('BCL-ONC-FAB5-D30F-117F')).toBe(false);
    expect(isBaseCodeCentralProductKey('BCL-ONC-FAB5-D30F-117F')).toBe(true);
    expect(isOneCampusCentralKey('BCL-ONC-FAB5-D30F-117F')).toBe(true);
  });

  it("does not activate St. Luke's from a GST Central key", () => {
    expect(isBaseCodeCentralProductKey('BCL-GST-FAB5-D30F-117F')).toBe(true);
    expect(isOneCampusCentralKey('BCL-GST-FAB5-D30F-117F')).toBe(false);
  });

  it('still flags Don Bosco college hex keys', () => {
    expect(isCollegeErpLicenseKey('BCL-65BD-AAAA-BBBB')).toBe(true);
  });

  it('keeps school human keys local', () => {
    expect(isCollegeErpLicenseKey('BCL-SLS-2026-AABBCCDD')).toBe(false);
    expect(isBaseCodeCentralProductKey('BCL-SLS-2026-AABBCCDD')).toBe(false);
    expect(isOneCampusCentralKey('BCL-SLS-2026-AABBCCDD')).toBe(false);
  });
});
