export const BIOMETRIC_ID_MAX_LENGTH = 50;

export function normalizeBiometricId(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, BIOMETRIC_ID_MAX_LENGTH);
}

export function validateBiometricId(value: string): string | null {
  const trimmed = normalizeBiometricId(value);
  if (!trimmed) return null;
  if (trimmed.length > BIOMETRIC_ID_MAX_LENGTH) {
    return `Biometric ID must be at most ${BIOMETRIC_ID_MAX_LENGTH} characters.`;
  }
  return null;
}
