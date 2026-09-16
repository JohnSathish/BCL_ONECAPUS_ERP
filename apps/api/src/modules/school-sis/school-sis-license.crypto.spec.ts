import {
  generateSchoolLicenseKeypair,
  signSchoolLicense,
  verifySchoolLicense,
  type SchoolLicenseClaims,
} from './school-sis-license.crypto';

describe('school license Ed25519', () => {
  const keys = generateSchoolLicenseKeypair();
  const claims: SchoolLicenseClaims = {
    v: 1,
    jti: '11111111-1111-1111-1111-111111111111',
    key: 'BCL-SLS-2026-TESTKEY1',
    instId: '22222222-2222-2222-2222-222222222222',
    instCode: 'st-lukes-tura',
    instName: "St. Luke's Secondary School",
    type: 'ANNUAL',
    status: 'ACTIVE',
    iat: '2026-09-16T00:00:00.000Z',
    nbf: '2026-09-16T00:00:00.000Z',
    exp: '2027-09-16T00:00:00.000Z',
    maxStudents: 2000,
    maxStaff: 250,
    maxAdmins: 50,
    installLimit: 3,
    modules: ['academic', 'students', 'transport'],
    graceDays: 15,
    offlineHours: 72,
    expiredPolicy: 'read_only',
    licVer: '1.0',
  };

  it('signs and verifies a license token', () => {
    const token = signSchoolLicense(claims, keys.privateKeyB64);
    expect(token.startsWith('BCL1.')).toBe(true);
    const parsed = verifySchoolLicense(token, keys.publicKeyB64);
    expect(parsed.key).toBe(claims.key);
    expect(parsed.exp).toBe(claims.exp);
    expect(parsed.modules).toContain('transport');
  });

  it('rejects a tampered expiry', () => {
    const token = signSchoolLicense(claims, keys.privateKeyB64);
    const [head, body, sig] = token.split('.');
    const raw = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    raw.exp = '2099-01-01T00:00:00.000Z';
    const tampered = `${head}.${Buffer.from(JSON.stringify(raw)).toString('base64url')}.${sig}`;
    expect(() => verifySchoolLicense(tampered, keys.publicKeyB64)).toThrow(
      'INVALID_LICENSE',
    );
  });

  it('rejects a token signed with another key', () => {
    const other = generateSchoolLicenseKeypair();
    const token = signSchoolLicense(claims, other.privateKeyB64);
    expect(() => verifySchoolLicense(token, keys.publicKeyB64)).toThrow(
      'INVALID_LICENSE',
    );
  });
});
