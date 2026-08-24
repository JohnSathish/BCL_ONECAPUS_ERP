/** Normalize Class XII board + stream codes for master lookup. */

const STREAM_ALIASES: Record<string, string> = {
  ARTS: 'ARTS',
  ART: 'ARTS',
  HUMANITIES: 'ARTS',
  'HUMANITIES / ARTS STREAM': 'ARTS',
  'HUMANITIES/ARTS STREAM': 'ARTS',
  'HUMANITIES / ARTS': 'ARTS',
  SCIENCE: 'SCIENCE',
  SCI: 'SCIENCE',
  COMMERCE: 'COMMERCE',
  COM: 'COMMERCE',
  VOCATIONAL: 'VOCATIONAL',
  OTHERS: 'OTHERS',
  OTHER: 'OTHERS',
};

export const CLASS12_STREAM_OPTIONS = [
  { value: 'ARTS', label: 'Arts' },
  { value: 'SCIENCE', label: 'Science' },
  { value: 'COMMERCE', label: 'Commerce' },
] as const;

export function normalizeClass12Board(board?: string | null): string {
  return String(board ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

/** Expand "MBOSE (MBOSE)" into lookup keys that match Support Data board types. */
export function class12BoardLookupAliases(board?: string | null): string[] {
  const raw = normalizeClass12Board(board);
  if (!raw) return [];
  const aliases = new Set<string>([raw]);
  const stripped = raw.replace(/\s*\(([^)]*)\)\s*$/, '').trim();
  if (stripped) aliases.add(stripped);
  const inner = raw.match(/\(([^)]+)\)\s*$/);
  if (inner?.[1]) aliases.add(normalizeClass12Board(inner[1]));
  return [...aliases].filter(Boolean);
}

export function class12StreamLookupAliases(stream?: string | null): string[] {
  const code = normalizeClass12Stream(stream);
  if (!code) return [];
  const aliases = new Set<string>([code]);
  if (code === 'COMMERCE') {
    aliases.add('COM');
    aliases.add('BUSINESS');
  }
  if (code === 'ARTS') {
    aliases.add('ART');
    aliases.add('HUMANITIES');
  }
  if (code === 'SCIENCE') aliases.add('SCI');
  return [...aliases];
}

export function normalizeClass12Stream(stream?: string | null): string {
  const raw = String(stream ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
  if (!raw) return '';
  if (STREAM_ALIASES[raw]) return STREAM_ALIASES[raw];
  // Loose match for "Humanities / Arts Stream"
  if (raw.includes('HUMANITIES') || raw.includes('ARTS')) return 'ARTS';
  if (raw.includes('SCIENCE') || raw.includes('SCI')) return 'SCIENCE';
  if (raw.includes('COMMERCE') || raw.includes('COM')) return 'COMMERCE';
  return raw.replace(/[^A-Z0-9]+/g, '_');
}

export function slugifyClass12SubjectName(name: string): string {
  return String(name ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

export function buildClass12SubjectCode(
  board: string,
  stream: string,
  subjectName: string,
): string {
  const boardPart = normalizeClass12Board(board).replace(/[^A-Z0-9]+/g, '_');
  const streamPart = normalizeClass12Stream(stream);
  const namePart = slugifyClass12SubjectName(subjectName);
  return `${boardPart}_${streamPart}_${namePart}`.slice(0, 80);
}

export function normalizeClass12SubjectKey(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s*\(([^)]+)\)\s*$/, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toUpperCase();
}
