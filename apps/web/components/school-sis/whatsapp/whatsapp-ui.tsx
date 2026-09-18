'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/utils/cn';

export const WA_LINKS = [
  { href: '/admin/school-sis/whatsapp', label: 'Dashboard', exact: true },
  { href: '/admin/school-sis/whatsapp/inbox', label: 'Inbox' },
  { href: '/admin/school-sis/whatsapp/contacts', label: 'Contacts' },
  { href: '/admin/school-sis/whatsapp/templates', label: 'Templates' },
  { href: '/admin/school-sis/whatsapp/campaigns', label: 'Campaigns' },
  { href: '/admin/school-sis/whatsapp/messaging', label: 'Messaging' },
  { href: '/admin/school-sis/whatsapp/automation', label: 'Automation' },
  { href: '/admin/school-sis/whatsapp/delivery', label: 'Delivery Status' },
  { href: '/admin/school-sis/whatsapp/scheduled', label: 'Scheduled' },
  { href: '/admin/school-sis/whatsapp/media', label: 'Media' },
  { href: '/admin/school-sis/whatsapp/flows', label: 'Flows' },
  { href: '/admin/school-sis/whatsapp/analytics', label: 'Analytics' },
  { href: '/admin/school-sis/whatsapp/opt-in', label: 'Opt-in' },
  { href: '/admin/school-sis/whatsapp/settings', label: 'Gateway' },
  { href: '/admin/school-sis/whatsapp/logs', label: 'Logs' },
];

export function WaShell({
  title,
  subtitle,
  extra,
  children,
}: {
  title: string;
  subtitle?: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className="space-y-4 bg-[#f4f7fb] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            WhatsApp
          </p>
          <h1 className="text-xl font-semibold text-[#1e3a8a]">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {extra}
      </div>
      <nav className="flex flex-wrap gap-2">
        {WA_LINKS.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname?.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 sm:text-sm',
                active
                  ? 'bg-[#2563eb] text-white ring-[#2563eb] shadow-sm'
                  : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50',
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}

export function WaBadge({ value }: { value: string }) {
  const map: Record<string, string> = {
    CONNECTED: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    ACTIVE: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    APPROVED: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    OPTED_IN: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    SENT: 'bg-sky-50 text-sky-800 ring-sky-200',
    PARTIALLY_SENT: 'bg-amber-50 text-amber-800 ring-amber-200',
    DELIVERED: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
    READ: 'bg-violet-50 text-violet-800 ring-violet-200',
    QUEUED: 'bg-slate-100 text-slate-700 ring-slate-200',
    PENDING: 'bg-amber-50 text-amber-800 ring-amber-200',
    DRAFT: 'bg-slate-100 text-slate-600 ring-slate-200',
    SCHEDULED: 'bg-sky-50 text-sky-800 ring-sky-200',
    PROCESSING: 'bg-amber-50 text-amber-800 ring-amber-200',
    FAILED: 'bg-rose-50 text-rose-800 ring-rose-200',
    REJECTED: 'bg-rose-50 text-rose-800 ring-rose-200',
    OPTED_OUT: 'bg-rose-50 text-rose-800 ring-rose-200',
    DISCONNECTED: 'bg-slate-100 text-slate-500 ring-slate-200',
    OPEN: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    CLOSED: 'bg-slate-100 text-slate-600 ring-slate-200',
    COMPLETED: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  };
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1',
        map[value] ?? 'bg-slate-100 text-slate-600 ring-slate-200',
      )}
    >
      {value}
    </span>
  );
}

export function WaCard({
  label,
  value,
  hint,
  className,
  children,
}: {
  label?: string;
  value?: string | number;
  hint?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn('rounded-2xl border border-slate-200 bg-white p-4 shadow-sm', className)}>
      {label != null ? <p className="text-xs font-medium text-slate-500">{label}</p> : null}
      {value != null ? <p className="mt-1 text-2xl font-semibold text-[#1e3a8a]">{value}</p> : null}
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
      {children}
    </div>
  );
}
