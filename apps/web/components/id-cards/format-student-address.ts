import type { StudentAddress } from '@/types/student-profile';

export function formatAddressParts(parts: Array<string | null | undefined>): string | null {
  const line = parts.filter(Boolean).join(', ');
  return line || null;
}

export function formatPortalAddress(
  address:
    | {
        line1?: string | null;
        line2?: string | null;
        city?: string | null;
        state?: string | null;
        pinCode?: string | null;
      }
    | null
    | undefined,
): string | null {
  if (!address) return null;
  return formatAddressParts([
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.pinCode,
  ]);
}

export function formatStudentAddresses(addresses?: StudentAddress[] | null): string | null {
  if (!addresses?.length) return null;
  const current =
    addresses.find((a) => a.addressType.toUpperCase() === 'CURRENT') ??
    addresses.find((a) => a.addressType.toUpperCase() === 'PERMANENT') ??
    addresses[0];
  return formatAddressParts([
    current.line1,
    current.line2,
    current.city,
    current.district,
    current.state,
    current.pinCode,
  ]);
}
