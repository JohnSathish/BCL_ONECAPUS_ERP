/**
 * Indian PIN Code helpers for school admission addresses.
 * Canonical: permanentAddress.pinCode / presentAddress.pinCode
 * Legacy fallback: .pin
 */

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function schoolAddressPinCode(
  address: Record<string, unknown> | null | undefined,
): string {
  if (!address || typeof address !== 'object') return '';
  return text(address.pinCode) || text(address.pin);
}

export function isValidSchoolPinCode(value: string): boolean {
  return /^\d{6}$/.test(value.trim());
}

/** Persist canonical pinCode on address objects when a PIN is present (incl. legacy .pin). */
export function normalizeSchoolAddressPins(
  formData: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...formData };
  for (const key of ['permanentAddress', 'presentAddress'] as const) {
    const addr = asRecord(next[key]);
    if (!Object.keys(addr).length) continue;
    const pinCode = schoolAddressPinCode(addr);
    if (!pinCode) continue;
    next[key] = { ...addr, pinCode };
  }
  return next;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}
