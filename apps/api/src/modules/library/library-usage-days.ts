export function fillUsageDays(
  start: Date,
  dayCount: number,
  issued: Map<string, number>,
  returned: Map<string, number>,
) {
  return Array.from({ length: dayCount }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    const key = localDay(day);
    return {
      date: key,
      label: day.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
      }),
      issued: issued.get(key) ?? 0,
      returned: returned.get(key) ?? 0,
    };
  });
}

export function usageRange(query: {
  days?: number;
  from?: string;
  to?: string;
}) {
  if (query.from || query.to) {
    const from = parseDay(query.from);
    const end = parseDay(query.to);
    if (!from || !end || end < from) {
      throw new Error('Choose a start date and an end date.');
    }
    const to = new Date(end);
    to.setDate(to.getDate() + 1);
    const days = Math.round((to.getTime() - from.getTime()) / 86_400_000);
    if (days < 1 || days > 92) {
      throw new Error('The custom range must be from 1 to 92 days.');
    }
    return { from, to, days };
  }
  const days = query.days ?? 7;
  if (!Number.isInteger(days) || days < 1 || days > 92) {
    throw new Error(
      'Choose the last 7 days, the last 30 days, or a range up to 92 days.',
    );
  }
  const to = new Date();
  to.setHours(0, 0, 0, 0);
  to.setDate(to.getDate() + 1);
  const from = new Date(to);
  from.setDate(from.getDate() - days);
  return { from, to, days };
}

function parseDay(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function localDay(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
