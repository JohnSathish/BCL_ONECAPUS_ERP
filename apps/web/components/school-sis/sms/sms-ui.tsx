'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  CalendarDays,
  ChevronDown,
  Clock3,
  CreditCard,
  FileText,
  History,
  LayoutDashboard,
  Megaphone,
  Radio,
  Send,
  Settings,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { cn } from '@/utils/cn';

export const SMS_LINKS: Array<{
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
}> = [
  { label: 'Dashboard', href: '/admin/school-sis/sms', icon: LayoutDashboard, exact: true },
  { label: 'Send', href: '/admin/school-sis/sms/send', icon: Send },
  { label: 'Templates', href: '/admin/school-sis/sms/templates', icon: FileText },
  { label: 'Campaigns', href: '/admin/school-sis/sms/campaigns', icon: Megaphone },
  { label: 'Scheduled', href: '/admin/school-sis/sms/scheduled', icon: CalendarDays },
  { label: 'History', href: '/admin/school-sis/sms/history', icon: History },
  { label: 'Delivery', href: '/admin/school-sis/sms/delivery', icon: Clock3 },
  { label: 'Failed', href: '/admin/school-sis/sms/failed', icon: TriangleAlert },
  { label: 'DLT', href: '/admin/school-sis/sms/dlt', icon: ShieldCheck },
  { label: 'Gateways', href: '/admin/school-sis/sms/gateways', icon: Radio },
  { label: 'Credits', href: '/admin/school-sis/sms/credits', icon: CreditCard },
  { label: 'Settings', href: '/admin/school-sis/sms/settings', icon: Settings },
];

export function smsWeekLabel() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 7);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function SmsShell({
  children,
  extra,
  notice,
}: {
  children: React.ReactNode;
  extra?: React.ReactNode;
  notice?: string | null;
}) {
  const path = usePathname() ?? '';
  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: 'var(--muted-foreground-hex, #94a3b8)' }}
          >
            Communication
          </p>
          <h1 className="mt-1 text-2xl font-semibold" style={{ color: 'var(--heading, #0f172a)' }}>
            SMS
          </h1>
          <p
            className="mt-1 max-w-2xl text-sm"
            style={{ color: 'var(--muted-foreground-hex, #64748b)' }}
          >
            Multi-gateway school SMS with DLT checks, queued sending, and delivery callbacks.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {extra}
          <span className="sls-sms-range">
            <CalendarDays className="h-4 w-4 opacity-70" />
            {smsWeekLabel()}
            <ChevronDown className="h-3.5 w-3.5 opacity-50" />
          </span>
          <Link href="/admin/school-sis/sms/send" className="sls-cta sls-sms-send">
            <Send className="h-4 w-4" />
            Send SMS
          </Link>
        </div>
      </div>
      <nav className="flex flex-wrap gap-1.5">
        {SMS_LINKS.map((item) => {
          const active = item.exact
            ? path === item.href
            : path === item.href || path.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={cn('sls-tab', active && 'is-active')}>
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      {notice ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {notice}
        </p>
      ) : null}
      {children}
    </div>
  );
}

export function SmsPanel({
  title,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('sls-saas-panel', className)}>
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <h2
          className="flex items-center gap-2 text-sm font-semibold"
          style={{ color: 'var(--heading, #0f172a)' }}
        >
          {Icon ? <Icon className="h-4 w-4 opacity-70" /> : null}
          {title}
        </h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function SmsEmpty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
      <span
        className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl"
        style={{
          background: 'var(--sls-fill, #f1f5f9)',
          color: 'var(--muted-foreground-hex, #94a3b8)',
        }}
      >
        <FileText className="h-5 w-5" />
      </span>
      <p className="text-sm font-semibold" style={{ color: 'var(--heading, #0f172a)' }}>
        {title}
      </p>
      <p
        className="mt-1 max-w-xs text-xs"
        style={{ color: 'var(--muted-foreground-hex, #64748b)' }}
      >
        {hint}
      </p>
    </div>
  );
}
