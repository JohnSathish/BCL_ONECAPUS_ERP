export function inr(amount: number) {
  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function initials(name?: string | null) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'S';
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function monthTitle(months: string[], labels: Record<string, string>) {
  if (!months.length) return 'Fee payment';
  if (months.length === 1) {
    const label = labels[months[0]] || months[0];
    return `Monthly Fee (${label})`;
  }
  return `${months.length} months`;
}
