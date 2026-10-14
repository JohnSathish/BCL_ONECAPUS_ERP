export type DutyBand = { upTo: number; invigilators: number };

export const DEFAULT_DUTY_BANDS: DutyBand[] = [
  { upTo: 40, invigilators: 1 },
  { upTo: 80, invigilators: 2 },
  { upTo: 120, invigilators: 3 },
  { upTo: 160, invigilators: 4 },
  { upTo: 100000, invigilators: 5 },
];

export function normalizeDutyBands(value: unknown): DutyBand[] {
  if (!Array.isArray(value))
    return DEFAULT_DUTY_BANDS.map((band) => ({ ...band }));
  const bands = value
    .map((band) => {
      if (!band || typeof band !== 'object') return null;
      const upTo = Number((band as { upTo?: unknown }).upTo);
      const invigilators = Number(
        (band as { invigilators?: unknown }).invigilators,
      );
      if (
        !Number.isFinite(upTo) ||
        !Number.isFinite(invigilators) ||
        upTo < 1 ||
        invigilators < 1
      ) {
        return null;
      }
      return { upTo: Math.floor(upTo), invigilators: Math.floor(invigilators) };
    })
    .filter((band): band is DutyBand => Boolean(band))
    .sort((a, b) => a.upTo - b.upTo);
  return bands.length ? bands : DEFAULT_DUTY_BANDS.map((band) => ({ ...band }));
}

export function requiredInvigilators(
  studentCount: number,
  bands: DutyBand[],
  minimum: number,
  specialRoom: boolean,
  specialHallExtra: number,
) {
  const count = Math.max(0, Math.floor(studentCount));
  if (count === 0) return 0;
  const usable = normalizeDutyBands(bands);
  const matched =
    usable.find((band) => count <= band.upTo) ?? usable[usable.length - 1]!;
  const base = Math.max(minimum, matched.invigilators);
  return base + (specialRoom ? Math.max(0, specialHallExtra) : 0);
}
