/**
 * A finished roll such as HI26-17 or PHI26-17.
 * Partial text ("Sangma", "HI26") stays a normal search.
 */
export function isExactRollNumberQuery(term: string): boolean {
  return /^[A-Za-z]{1,12}\d{2}[-/]\d{1,6}$/.test(term.trim());
}
