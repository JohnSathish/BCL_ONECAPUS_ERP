const SENSITIVE_KEY =
  /pass(word)?|secret|token|authorization|api[_-]?key|cookie|refresh|credential|private[_-]?key|dlt.?entity/i;

export function redactText(value: string): string {
  return value
    .replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, '$1[REDACTED]')
    .replace(
      /(password|secret|token|api[_-]?key)\s*[:=]\s*\S+/gi,
      '$1=[REDACTED]',
    );
}

export function redactDeep(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[truncated]';
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value))
    return value.slice(0, 200).map((v) => redactDeep(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? '[REDACTED]' : redactDeep(v, depth + 1);
    }
    return out;
  }
  return value;
}

export function maskLicenseKey(key?: string | null): string | null {
  if (!key) return null;
  const clean = key.replace(/\s/g, '');
  if (clean.length <= 8) return '••••';
  return `${clean.slice(0, 4)}••••${clean.slice(-4)}`;
}
