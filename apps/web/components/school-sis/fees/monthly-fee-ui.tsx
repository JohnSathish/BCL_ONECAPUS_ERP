'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpen,
  Clock3,
  FileBarChart2,
  LayoutDashboard,
  Settings2,
  Wallet,
  ClipboardList,
  CreditCard,
} from 'lucide-react';
import { cn } from '@/utils/cn';

const LINKS = [
  {
    href: '/admin/school-sis/fees/monthly',
    label: 'Dashboard',
    exact: true,
    icon: LayoutDashboard,
  },
  { href: '/admin/school-sis/fees/collect', label: 'Collect', icon: Wallet },
  { href: '/admin/school-sis/fees/pending', label: 'Pending', icon: Clock3 },
  { href: '/admin/school-sis/fees/register', label: 'Register', icon: ClipboardList },
  { href: '/admin/school-sis/fees/reports', label: 'Reports', icon: FileBarChart2 },
  { href: '/admin/school-sis/fees/settings', label: 'Configuration', icon: Settings2 },
  { href: '/admin/school-sis/fees/gateways', label: 'Gateways', icon: CreditCard },
  { href: '/admin/school-sis/fees', label: 'Annual structure', icon: BookOpen },
];

export function MonthlyFeeSubnav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-2">
      {LINKS.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 sm:text-sm',
              active
                ? 'bg-[#2563eb] text-white ring-[#2563eb] shadow-sm'
                : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50',
            )}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
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

export function shortMonth(feeMonth: string) {
  const [y, m] = feeMonth.split('-').map(Number);
  if (!y || !m) return feeMonth;
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric',
  });
}

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function chunkToWords(n: number): string {
  if (n < 20) return ONES[n];
  if (n < 100) return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`;
  const rest = n % 100;
  return `${ONES[Math.floor(n / 100)]} Hundred${rest ? ` ${chunkToWords(rest)}` : ''}`;
}

export function rupeesInWords(amount: number) {
  const n = Math.round(Math.abs(Number(amount) || 0));
  if (!n) return 'Rupees Zero Only';
  const crore = Math.floor(n / 1_00_00_000);
  const lakh = Math.floor((n % 1_00_00_000) / 1_00_000);
  const thousand = Math.floor((n % 1_00_000) / 1000);
  const hundred = n % 1000;
  const parts = [
    crore ? `${chunkToWords(crore)} Crore` : '',
    lakh ? `${chunkToWords(lakh)} Lakh` : '',
    thousand ? `${chunkToWords(thousand)} Thousand` : '',
    hundred ? chunkToWords(hundred) : '',
  ].filter(Boolean);
  return `Rupees ${parts.join(' ')} Only`;
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
