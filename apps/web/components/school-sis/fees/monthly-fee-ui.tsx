'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/utils/cn';

const LINKS = [
  { href: '/admin/school-sis/fees/monthly', label: 'Dashboard', exact: true },
  { href: '/admin/school-sis/fees/collect', label: 'Collect' },
  { href: '/admin/school-sis/fees/pending', label: 'Pending' },
  { href: '/admin/school-sis/fees/register', label: 'Register' },
  { href: '/admin/school-sis/fees/settings', label: 'Configuration' },
  { href: '/admin/school-sis/fees', label: 'Annual structure' },
];

export function MonthlyFeeSubnav() {
  const pathname = usePathname();
  return (
    <nav className="sls-chip-row -mx-1 px-1 pb-1">
      {LINKS.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-medium ring-1 sm:text-sm',
              active
                ? 'bg-[var(--school-erp-primary)] text-white ring-[var(--school-erp-primary)]'
                : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function rs(n: number) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function currentFeeMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function FeeStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PAID: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    PARTIAL: 'bg-amber-50 text-amber-800 ring-amber-200',
    DUE: 'bg-sky-50 text-sky-800 ring-sky-200',
    OVERDUE: 'bg-rose-50 text-rose-800 ring-rose-200',
    VOIDED: 'bg-slate-100 text-slate-600 ring-slate-200',
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ${map[status] ?? 'bg-slate-50 text-slate-600 ring-slate-200'}`}
    >
      {status}
    </span>
  );
}
