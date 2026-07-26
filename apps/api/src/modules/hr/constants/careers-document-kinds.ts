/** Typed careers application document kinds (stored in certificatesJson + disk). */
export const CAREERS_DOC_KINDS = [
  'resume',
  'photo',
  'ug',
  'pg',
  'experience',
  'net',
  'phd',
  'community',
  'other',
  /** Legacy catch-all from older clients */
  'certificate',
] as const;

export type CareersDocKind = (typeof CAREERS_DOC_KINDS)[number];

export type CareersStoredDocument = {
  kind: string;
  name: string;
  url: string;
  mimeType?: string | null;
  uploadedAt: string;
};

export function normalizeDocKind(kind: string): string {
  const k = kind.trim().toLowerCase();
  if (k === 'certificate') return 'other';
  return k;
}

export function docKindLabel(kind: string): string {
  switch (normalizeDocKind(kind)) {
    case 'resume':
      return 'Resume / CV';
    case 'photo':
      return 'Passport Photo';
    case 'ug':
      return 'UG Certificate';
    case 'pg':
      return 'PG Certificate';
    case 'experience':
      return 'Experience Certificate';
    case 'net':
      return 'NET / SET Certificate';
    case 'phd':
      return 'PhD Certificate';
    case 'community':
      return 'Community Certificate';
    default:
      return 'Other Document';
  }
}

export function isCareersDocKind(kind: string): boolean {
  return (CAREERS_DOC_KINDS as readonly string[]).includes(
    kind.trim().toLowerCase(),
  );
}
