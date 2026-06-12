/** NEHU Roll Number — alphanumeric with / and - allowed */
export const NEHU_ROLL_NUMBER_PATTERN = /^[A-Za-z0-9/-]{2,24}$/;

export const NEHU_REGISTRATION_PATTERN = /^[A-Za-z0-9/-]{2,32}$/;

export function validateNehuRollNumber(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!NEHU_ROLL_NUMBER_PATTERN.test(trimmed)) {
    return 'Use 2–24 characters: letters, numbers, / or - only.';
  }
  return null;
}

export function validateNehuRegistrationNumber(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return 'NEHU Registration Number is required.';
  if (!NEHU_REGISTRATION_PATTERN.test(trimmed)) {
    return 'Use letters, numbers, / or - only.';
  }
  return null;
}
