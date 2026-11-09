/**
 * Department roll numbers are prefix + year + sequence.
 * Education is ED26-68, morning-shift numbers stay unpadded (ED26-128),
 * and older three-digit rolls such as BA26-001 still match.
 */
export const COLLEGE_ROLL_NUMBER_PATTERN = /^[A-Z]{2,4}\d{2}-\d{2,4}$/;

export function validateCollegeRollNumber(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!COLLEGE_ROLL_NUMBER_PATTERN.test(trimmed.toUpperCase())) {
    return 'Use format like ED26-68 (department prefix + year + sequence).';
  }
  return null;
}
