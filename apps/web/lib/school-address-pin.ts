/**
 * Indian PIN Code helpers for school admission addresses.
 * Canonical storage key: permanentAddress.pinCode / presentAddress.pinCode
 * Legacy read fallback: .pin (preview/PDF historically expected this key)
 */

export function schoolAddressPinCode(address: Record<string, unknown> | null | undefined): string {
  if (!address || typeof address !== 'object') return '';
  const pinCode = typeof address.pinCode === 'string' ? address.pinCode.trim() : '';
  if (pinCode) return pinCode;
  const legacy = typeof address.pin === 'string' ? address.pin.trim() : '';
  return legacy;
}

export function isValidSchoolPinCode(value: string): boolean {
  return /^\d{6}$/.test(value.trim());
}

/** Digits only, max 6 characters — for controlled inputs. */
export function normalizeSchoolPinCodeInput(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 6);
}

export function displaySchoolPinCode(address: Record<string, unknown> | null | undefined): string {
  const pin = schoolAddressPinCode(address);
  return pin || '—';
}
