/** Normalize branding / document text and fix common UTF-8 mojibake. */
export function sanitizeDisplayText(value: string | null | undefined): string | undefined {
  if (value == null) return undefined;
  let text = value.trim();
  if (!text) return undefined;

  text = text
    .replace(/\u00C2\u00B7/g, ' - ')
    .replace(/Â·/g, ' - ')
    .replace(/\s*[·•]\s*/g, ' - ')
    .replace(/â€[""–—]/g, '-')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u00C2(?=[\u2013\u2014'""])/g, '')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return text || undefined;
}
