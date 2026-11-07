import { createHash } from 'crypto';

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object')
    return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(
    ([a], [b]) => a.localeCompare(b),
  );
  return `{${entries
    .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
    .join(',')}}`;
}

export type SecurityHashPayload = {
  tenantId: string;
  actorUserId: string | null;
  eventType: string;
  severity: string;
  module: string | null;
  entityType: string | null;
  entityId: string | null;
  action: string;
  ipAddress: string | null;
  summary: string;
  subjectKey: string | null;
  createdAt: string;
};

export function hashSecurityRecord(
  payload: SecurityHashPayload,
  prevHash: string | null,
): string {
  const body = canonicalJson({ ...payload, prevHash: prevHash ?? '' });
  return createHash('sha256').update(body).digest('hex');
}

export function verifySecurityChain(
  rows: Array<{
    prevHash: string | null;
    recordHash: string;
    payload: SecurityHashPayload;
  }>,
): { ok: boolean; brokenAt: number | null; checked: number } {
  let previous: string | null = null;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (index > 0 && (row.prevHash ?? null) !== previous) {
      return { ok: false, brokenAt: index, checked: index };
    }
    const expected = hashSecurityRecord(row.payload, row.prevHash ?? null);
    if (expected !== row.recordHash) {
      return { ok: false, brokenAt: index, checked: index };
    }
    previous = row.recordHash;
  }
  return { ok: true, brokenAt: null, checked: rows.length };
}
