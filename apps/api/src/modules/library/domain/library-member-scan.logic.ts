const LOCAL_MOBILE_LENGTH = 10;
const MAX_PHONE_DIGITS = 15;

/**
 * A library scan is usually a roll number (HI26-15), an enrollment number, or a card id.
 * Those codes contain digits. Comparing those digits to mobile numbers with a substring
 * match returns a different student whose phone happens to contain the fragment
 * (HI26-15 → "2615" → 9862615600).
 *
 * A phone match is allowed only when the whole scan is a phone: no letters, 10–15 digits,
 * and the last 10 digits are a local mobile number.
 */
export function phoneDigitsFromScan(scanCode: string): string | null {
  const trimmed = scanCode.trim();
  if (!trimmed || /[A-Za-z]/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < LOCAL_MOBILE_LENGTH || digits.length > MAX_PHONE_DIGITS) {
    return null;
  }
  const local = digits.slice(-LOCAL_MOBILE_LENGTH);
  if (!/^[6-9]\d{9}$/.test(local)) return null;
  return local;
}
