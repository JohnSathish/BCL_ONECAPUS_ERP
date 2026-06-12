export type FineCalculationSettings = {
  finePerDay: number | { toString(): string };
  graceDays: number;
  maxFine: number | { toString(): string };
};

export function calculateOverdueFine(
  dueAt: Date,
  asOf: Date,
  settings: FineCalculationSettings,
): number {
  const graceEnd = new Date(dueAt);
  graceEnd.setDate(graceEnd.getDate() + settings.graceDays);
  if (asOf <= graceEnd) return 0;

  const daysOverdue = Math.ceil(
    (asOf.getTime() - graceEnd.getTime()) / (24 * 60 * 60 * 1000),
  );
  return Math.min(
    Number(settings.maxFine),
    daysOverdue * Number(settings.finePerDay),
  );
}

export function startOfUtcDay(date = new Date()): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
