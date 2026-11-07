const SECRET_KEY =
  /password|passwd|secret|token|otp|authorization|cookie|mfa|recovery|aadhaar|accountnumber|bankaccount|cvv|pin\b|pan(number)?/i;

export function redactSecurityValue(value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (depth > 4) return '[truncated]';
  if (typeof value === 'string') {
    return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value
      .slice(0, 20)
      .map((item) => redactSecurityValue(item, depth + 1));
  }
  if (typeof value !== 'object') return undefined;

  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SECRET_KEY.test(key)
      ? '[redacted]'
      : redactSecurityValue(child, depth + 1);
  }
  return out;
}

/** Mask an account identifier before it is placed in an email or in-app notice. */
export function maskSecurityIdentifier(
  value: string | null | undefined,
): string {
  const raw = (value ?? '').trim();
  if (!raw) return 'an account';
  const at = raw.indexOf('@');
  if (at > 0) {
    return `${raw.slice(0, 1)}***${raw.slice(at)}`;
  }
  if (raw.length <= 2) return '***';
  return `${raw.slice(0, 2)}***`;
}
