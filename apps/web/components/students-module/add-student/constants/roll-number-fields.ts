/** College roll number format: BA26-001 */
export const COLLEGE_ROLL_NUMBER_PATTERN = /^[A-Z]{2,4}\d{2}-\d{3,4}$/;

export function validateCollegeRollNumber(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!COLLEGE_ROLL_NUMBER_PATTERN.test(trimmed.toUpperCase())) {
    return 'Use format like BA26-001 (prefix + year + sequence).';
  }
  return null;
}
