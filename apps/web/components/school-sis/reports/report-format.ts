export function formatInr(value: unknown) {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(n) || String(value ?? '').includes('₹')) {
    return value == null || value === '' ? '' : String(value);
  }
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
