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

/** JS Sunday=0 → ISO weekday Monday=1 … Sunday=7 */
export function isoWeekday(now = new Date()): number {
  const day = now.getDay();
  return day === 0 ? 7 : day;
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
