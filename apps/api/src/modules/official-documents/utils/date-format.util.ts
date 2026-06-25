const ORDINALS = ['th', 'st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th', 'th'];

function ordinal(day: number) {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`;
  return `${day}${ORDINALS[day % 10]}`;
}

export function formatOfficialDate(date: Date | string | null | undefined) {
  if (!date) return '—';
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  const day = d.getDate();
  const month = d.toLocaleString('en-GB', { month: 'long' });
  const year = d.getFullYear();
  return `${ordinal(day)} ${month} ${year}`;
}

export function currentAcademicYearLabel(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  if (month >= 6) return `${year}-${year + 1}`;
  return `${year - 1}-${year}`;
}
