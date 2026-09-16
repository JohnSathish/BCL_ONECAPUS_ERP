import { createHash, generateKeyPairSync, sign, verify } from 'crypto';

export type SchoolLicenseClaims = {
  v: 1;
  jti: string;
  key: string;
  instId: string;
  instCode: string;
  instName: string;
  type: string;
  status: string;
  iat: string;
  nbf: string;
  exp: string | null;
  maxStudents: number;
  maxStaff: number;
  maxAdmins: number;
  installLimit: number;
  modules: string[];
  graceDays: number;
  offlineHours: number;
  expiredPolicy: 'read_only' | 'lock';
  licVer: string;
};

export type SchoolLicenseKeypair = {
  publicKeyB64: string;
  privateKeyB64: string;
};

const PREFIX = 'BCL1.';

export function generateSchoolLicenseKeypair(): SchoolLicenseKeypair {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    publicKeyB64: publicKey
      .export({ type: 'spki', format: 'der' })
      .toString('base64'),
    privateKeyB64: privateKey
      .export({ type: 'pkcs8', format: 'der' })
      .toString('base64'),
  };
}

export function fingerprintToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function generateHumanLicenseKey(year = new Date().getUTCFullYear()) {
  const n = createHash('sha256')
    .update(`${Date.now()}-${Math.random()}`)
    .digest('hex')
    .slice(0, 8)
    .toUpperCase();
  return `BCL-SLS-${year}-${n}`;
}

function b64url(buf: Buffer) {
  return buf.toString('base64url');
}

function fromB64url(s: string) {
  return Buffer.from(s, 'base64url');
}

export function signSchoolLicense(
  claims: SchoolLicenseClaims,
  privateKeyB64: string,
): string {
  const body = b64url(Buffer.from(JSON.stringify(claims), 'utf8'));
  const sig = sign(null, Buffer.from(body, 'utf8'), {
    key: Buffer.from(privateKeyB64, 'base64'),
    format: 'der',
    type: 'pkcs8',
  });
  return `${PREFIX}${body}.${b64url(sig)}`;
}

export function verifySchoolLicense(
  token: string,
  publicKeyB64: string,
): SchoolLicenseClaims {
  if (!token?.startsWith(PREFIX)) {
    throw new Error('INVALID_LICENSE');
  }
  const rest = token.slice(PREFIX.length);
  const dot = rest.lastIndexOf('.');
  if (dot < 1) throw new Error('INVALID_LICENSE');
  const body = rest.slice(0, dot);
  const sig = rest.slice(dot + 1);
  const ok = verify(
    null,
    Buffer.from(body, 'utf8'),
    {
      key: Buffer.from(publicKeyB64, 'base64'),
      format: 'der',
      type: 'spki',
    },
    fromB64url(sig),
  );
  if (!ok) throw new Error('INVALID_LICENSE');
  const claims = JSON.parse(
    fromB64url(body).toString('utf8'),
  ) as SchoolLicenseClaims;
  if (claims.v !== 1 || !claims.key || !claims.instCode) {
    throw new Error('INVALID_LICENSE');
  }
  return claims;
}

export function daysRemainingFrom(expiresAt: string | null, now = new Date()) {
  if (!expiresAt) return null;
  const exp = new Date(expiresAt);
  return Math.ceil((exp.getTime() - now.getTime()) / 86400000);
}
