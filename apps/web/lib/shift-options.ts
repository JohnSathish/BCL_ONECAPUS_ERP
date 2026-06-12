import type { ShiftRow } from '@/services/shifts';

export type ShiftOption = {
  id: string;
  label: string;
  code: string;
};

/** Build select options from shift rows; optionally dedupe by code when listing all campuses. */
export function toShiftOptions(
  shifts: ShiftRow[],
  opts?: { dedupeByCode?: boolean },
): ShiftOption[] {
  const rows = opts?.dedupeByCode ? [...new Map(shifts.map((s) => [s.code, s])).values()] : shifts;
  return rows.map((s) => ({
    id: s.id,
    label: `${s.code} — ${s.name}`,
    code: s.code,
  }));
}
