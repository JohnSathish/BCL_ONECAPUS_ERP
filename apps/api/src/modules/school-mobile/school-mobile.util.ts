export function compareSchoolMobileVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da < db ? -1 : 1;
  }
  return 0;
}

export function isSchoolMobileVersionBelow(
  current: string,
  minimum: string,
): boolean {
  return compareSchoolMobileVersions(current, minimum) < 0;
}

/** IST weekday Monday=1 … Sunday=7 (school is in Tura; VPS clocks are UTC). */
export function isoWeekday(now = new Date()): number {
  const weekday = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
  }).format(now);
  const map: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  return map[weekday] ?? 7;
}

export function weekdayLabel(weekday: number): string {
  return (
    [
      '',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ][weekday] ?? 'Today'
  );
}
