export function formatClientIp(raw?: string | null): string {
  if (!raw) return '—';
  const v = raw.trim();
  if (v.startsWith('::ffff:')) return v.slice(7);
  if (v === '::1') return '127.0.0.1 (localhost)';
  if (v === '127.0.0.1') return '127.0.0.1 (localhost)';
  return v;
}

export function formatFlagLabel(flag: string): string {
  return flag
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function flagTone(flag: string): 'danger' | 'warning' | 'info' | 'neutral' {
  const key = flag.toUpperCase();
  if (
    key.includes('BLOCK') ||
    key.includes('LOCK') ||
    key.includes('BRUTE') ||
    key.includes('EXCESSIVE')
  ) {
    return 'danger';
  }
  if (
    key.includes('NEW_COUNTRY') ||
    key.includes('GEO') ||
    key.includes('SUSPICIOUS') ||
    key.includes('MULTI_DEVICE')
  ) {
    return 'warning';
  }
  if (key.includes('NEW_DEVICE') || key.includes('NEW_')) return 'info';
  return 'neutral';
}

export function outcomeTone(outcome: string): 'success' | 'danger' | 'warning' | 'neutral' {
  const key = outcome.toLowerCase();
  if (key === 'success') return 'success';
  if (key === 'failure' || key === 'failed') return 'danger';
  if (key === 'lockout') return 'warning';
  return 'neutral';
}

export function statusTone(status: string): 'success' | 'danger' | 'warning' | 'info' | 'neutral' {
  const key = status.toUpperCase();
  if (key === 'ONLINE' || key === 'ACTIVE' || key === 'TRUSTED') return 'success';
  if (key === 'BLOCKED' || key === 'REVOKED') return 'danger';
  if (key === 'IDLE' || key === 'PENDING') return 'warning';
  if (key === 'MOBILE' || key === 'WEB' || key === 'ANDROID') return 'info';
  return 'neutral';
}
