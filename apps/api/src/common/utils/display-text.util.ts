/** Normalize branding / document text and fix common UTF-8 mojibake. */
export function sanitizeDisplayText(
  value: string | null | undefined,
): string | undefined {
  if (value == null) return undefined;
  let text = value.trim();
  if (!text) return undefined;

  text = text
    // Middle dot read as Latin-1 (Â·)
    .replace(/\u00C2\u00B7/g, ' - ')
    .replace(/Â·/g, ' - ')
    // Proper middle dot / bullet separators → ASCII
    .replace(/\s*[·•]\s*/g, ' - ')
    // En/em dash mojibake and unicode dashes → ASCII hyphen
    .replace(/â€[""–—]/g, '-')
    .replace(/[\u2013\u2014]/g, '-')
    // Stray Â before punctuation
    .replace(/\u00C2(?=[\u2013\u2014'""])/g, '')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return text || undefined;
}
