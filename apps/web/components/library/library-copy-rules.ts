export const COPY_TYPES = [
  'GENERAL',
  'REFERENCE',
  'RARE',
  'TEXTBOOK',
  'RESERVE',
  'RESTRICTED',
  'OTHER',
] as const;

export type CopyType = (typeof COPY_TYPES)[number];

export const COPY_TYPE_LABELS: Record<CopyType, string> = {
  GENERAL: 'General Book',
  REFERENCE: 'Reference Book',
  RARE: 'Rare Book',
  TEXTBOOK: 'Textbook',
  RESERVE: 'Reserve Book',
  RESTRICTED: 'Restricted Book',
  OTHER: 'Other',
};

export const DEFAULT_COPY_ISSUE: Record<CopyType, boolean> = {
  GENERAL: true,
  REFERENCE: false,
  RARE: false,
  TEXTBOOK: true,
  RESERVE: true,
  RESTRICTED: false,
  OTHER: true,
};

export function copyTypeForBookType(bookType: string): CopyType {
  const value = bookType.trim().toUpperCase();
  return (COPY_TYPES as readonly string[]).includes(value) ? (value as CopyType) : 'GENERAL';
}

export function mergeCopyIssue(raw: unknown): Record<CopyType, boolean> {
  const next = { ...DEFAULT_COPY_ISSUE };
  if (!raw || typeof raw !== 'object') return next;
  const source = raw as Record<string, unknown>;
  for (const key of COPY_TYPES) {
    if (typeof source[key] === 'boolean') next[key] = source[key];
  }
  return next;
}

export function previewAccessionNumbers(start: string, count: number) {
  if (!start || count < 1) return [];
  const match = start.match(/^(.*-)(\d+)$/);
  if (!match) return Array.from({ length: count }, () => start);
  const width = match[2].length;
  const base = Number(match[2]);
  return Array.from(
    { length: count },
    (_, index) => `${match[1]}${String(base + index).padStart(width, '0')}`,
  );
}
