export function formatAccessionNo(prefix: string, year: number, seq: number) {
  return `${prefix}-${year}-${String(seq).padStart(5, '0')}`;
}

export function accessionSeries(
  prefix: string,
  year: number,
  startSeq: number,
  count: number,
) {
  return Array.from({ length: count }, (_, index) =>
    formatAccessionNo(prefix, year, startSeq + index),
  );
}

export function availabilityToStatuses(availability: string) {
  switch (availability) {
    case 'CATALOGUED':
      return { accessionStatus: 'CATALOGUED', copyStatus: 'PROCESSING' };
    case 'ON_SHELF':
      return { accessionStatus: 'ON_SHELF', copyStatus: 'AVAILABLE' };
    case 'ISSUED':
      return { accessionStatus: 'ON_SHELF', copyStatus: 'ISSUED' };
    case 'LOST':
      return { accessionStatus: 'ON_SHELF', copyStatus: 'LOST' };
    case 'DAMAGED':
      return { accessionStatus: 'ON_SHELF', copyStatus: 'DAMAGED' };
    case 'WITHDRAWN':
      return { accessionStatus: 'WITHDRAWN', copyStatus: 'WITHDRAWN' };
    default:
      return { accessionStatus: 'PENDING', copyStatus: 'PROCESSING' };
  }
}

export function splitAuthors(value: string) {
  const names = value
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  return { primary: names[0] ?? '', additional: names.slice(1).join(', ') };
}
