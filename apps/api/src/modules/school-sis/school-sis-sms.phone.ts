import { createHash } from 'crypto';

const GSM7 = /^[\x00-\x7F]*$/;

export function normalizeInMobile(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `91${digits}`;
  if (
    digits.length === 12 &&
    digits.startsWith('91') &&
    /^91[6-9]/.test(digits)
  )
    return digits;
  if (digits.length === 11 && digits.startsWith('0') && /^0[6-9]/.test(digits))
    return `91${digits.slice(1)}`;
  return null;
}

export function maskMobile(mobile: string) {
  if (mobile.length < 4) return '****';
  return `${'*'.repeat(Math.max(0, mobile.length - 4))}${mobile.slice(-4)}`;
}

export function displayInMobile(mobile: string | null | undefined): string {
  if (!mobile) return '';
  const n = mobile.replace(/\D/g, '');
  if (n.length === 12 && n.startsWith('91')) {
    return `+91 ${n.slice(2, 7)} ${n.slice(7)}`;
  }
  if (n.length === 10) return `+91 ${n.slice(0, 5)} ${n.slice(5)}`;
  return mobile;
}

export function smsSegments(text: string) {
  const unicode = !GSM7.test(text) || text.includes('₹');
  const single = unicode ? 70 : 160;
  const concat = unicode ? 67 : 153;
  const segments = text.length <= single ? 1 : Math.ceil(text.length / concat);
  return {
    chars: text.length,
    limit: single,
    segments,
    unicode,
    estimatedCostUnits: segments,
  };
}

export function extractVariables(body: string) {
  return [...body.matchAll(/\{([a-z0-9_]+)\}/gi)].map((m) =>
    m[1].toLowerCase(),
  );
}

export function renderSms(
  body: string,
  vars: Record<string, string | number | null | undefined>,
) {
  return body.replace(/\{([a-z0-9_]+)\}/gi, (_, key: string) => {
    const v = vars[key] ?? vars[key.toLowerCase()];
    return v == null || v === '' ? `{${key}}` : String(v);
  });
}

export function pickSmsVariables(
  template: string,
  vars: Record<string, string | number | null | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of extractVariables(template)) {
    const v = vars[key] ?? vars[key.toLowerCase()];
    if (v == null || v === '' || String(v).startsWith('{')) continue;
    out[key] = String(v);
  }
  return out;
}

export function missingVariables(
  body: string,
  vars: Record<string, string | number | null | undefined>,
) {
  return extractVariables(body).filter((k) => {
    const v = vars[k] ?? vars[k.toLowerCase()];
    return v == null || v === '' || String(v).startsWith('{');
  });
}

export function hashOtp(
  tenantId: string,
  purpose: string,
  mobile: string,
  code: string,
) {
  return createHash('sha256')
    .update(`${tenantId}:${purpose}:${mobile}:${code}`)
    .digest('hex');
}
