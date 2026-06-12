export const STUDENT_NAME_DISPLAY_FORMATS = [
  'UPPERCASE',
  'ORIGINAL',
  'TITLE_CASE',
] as const;

export type StudentNameDisplayFormat =
  (typeof STUDENT_NAME_DISPLAY_FORMATS)[number];

export const DEFAULT_STUDENT_NAME_DISPLAY_FORMAT: StudentNameDisplayFormat =
  'UPPERCASE';

export function normalizeStudentNameDisplayFormat(
  value?: string | null,
): StudentNameDisplayFormat {
  const upper = String(value ?? '')
    .trim()
    .toUpperCase();
  if (upper === 'ORIGINAL') return 'ORIGINAL';
  if (upper === 'TITLE_CASE' || upper === 'TITLE CASE') return 'TITLE_CASE';
  return 'UPPERCASE';
}

export function formatStudentDisplayName(
  name?: string | null,
  format: StudentNameDisplayFormat = DEFAULT_STUDENT_NAME_DISPLAY_FORMAT,
): string {
  const raw = String(name ?? '').trim();
  if (!raw) return '';

  switch (format) {
    case 'ORIGINAL':
      return raw;
    case 'TITLE_CASE':
      return raw
        .split(/\s+/)
        .filter(Boolean)
        .map(
          (part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
        )
        .join(' ');
    case 'UPPERCASE':
    default:
      return raw.toUpperCase();
  }
}

export function studentDisplayInitials(
  name?: string | null,
  format: StudentNameDisplayFormat = DEFAULT_STUDENT_NAME_DISPLAY_FORMAT,
): string {
  const display = formatStudentDisplayName(name, format);
  const parts = display.split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}
