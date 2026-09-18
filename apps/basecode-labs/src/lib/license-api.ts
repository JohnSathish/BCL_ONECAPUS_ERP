import { NextRequest, NextResponse } from 'next/server';

const WEAK = new Set([
  '',
  'dev-secret',
  'dev-license-secret',
  'replace-with-a-long-random-secret',
  'replace-with-a-second-long-random-secret',
]);

export function isProductionRuntime() {
  return process.env.NODE_ENV === 'production';
}

export function licenseApiSecret() {
  return process.env.BASECODE_LICENSE_API_SECRET?.trim() ?? '';
}

export function assertProductionSecretsConfigured() {
  if (!isProductionRuntime()) return null;
  if (WEAK.has((process.env.JWT_SECRET ?? '').trim())) {
    return NextResponse.json(
      { error: 'JWT_SECRET must be set to a unique value in production' },
      { status: 503 },
    );
  }
  if (WEAK.has((process.env.LICENSE_SIGNING_SECRET ?? '').trim())) {
    return NextResponse.json(
      { error: 'LICENSE_SIGNING_SECRET must be set to a unique value in production' },
      { status: 503 },
    );
  }
  return null;
}

/** Shared guard for /api/license/* machine endpoints. */
export function requireLicenseApi(req: NextRequest) {
  const prod = assertProductionSecretsConfigured();
  if (prod) return prod;
  const expected = licenseApiSecret();
  if (isProductionRuntime() && !expected) {
    return NextResponse.json(
      { error: 'BASECODE_LICENSE_API_SECRET is required in production' },
      { status: 503 },
    );
  }
  if (!expected) return null;
  const got = req.headers.get('x-bcl-license-secret') ?? '';
  if (got.length !== expected.length || !timingSafeEqualString(got, expected)) {
    return NextResponse.json({ error: 'Unauthorized license API' }, { status: 401 });
  }
  return null;
}

function timingSafeEqualString(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
