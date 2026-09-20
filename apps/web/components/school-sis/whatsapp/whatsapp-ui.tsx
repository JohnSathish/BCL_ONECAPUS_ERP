'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Bot,
  CalendarDays,
  ChevronDown,
  Clock3,
  FileText,
  FolderOpen,
  Inbox,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Radio,
  Send,
  Settings,
  ShieldCheck,
  Users,
  Workflow,
} from 'lucide-react';
import { cn } from '@/utils/cn';

export const WA_LINKS: Array<{
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}> = [
  { href: '/admin/school-sis/whatsapp', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/school-sis/whatsapp/inbox', label: 'Inbox', icon: Inbox },
  { href: '/admin/school-sis/whatsapp/contacts', label: 'Contacts', icon: Users },
  { href: '/admin/school-sis/whatsapp/templates', label: 'Templates', icon: FileText },
  { href: '/admin/school-sis/whatsapp/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/admin/school-sis/whatsapp/messaging', label: 'Messaging', icon: MessageSquare },
  { href: '/admin/school-sis/whatsapp/automation', label: 'Automation', icon: Bot },
  { href: '/admin/school-sis/whatsapp/delivery', label: 'Delivery Status', icon: Clock3 },
  { href: '/admin/school-sis/whatsapp/scheduled', label: 'Scheduled', icon: CalendarDays },
  { href: '/admin/school-sis/whatsapp/media', label: 'Media', icon: FolderOpen },
  { href: '/admin/school-sis/whatsapp/flows', label: 'Flows', icon: Workflow },
  { href: '/admin/school-sis/whatsapp/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/school-sis/whatsapp/opt-in', label: 'Opt-in', icon: ShieldCheck },
  { href: '/admin/school-sis/whatsapp/settings', label: 'Gateway', icon: Radio },
  { href: '/admin/school-sis/whatsapp/logs', label: 'Logs', icon: Settings },
];

export function waWeekLabel() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 7);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function WaShell({
  title,
  subtitle,
  extra,
  notice,
  children,
}: {
  title?: string;
  subtitle?: string;
  extra?: React.ReactNode;
  notice?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? '';
  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="sls-wa-logo" aria-hidden>
            <MessageCircle className="h-6 w-6" />
          </span>
          <div>
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: 'var(--muted-foreground-hex, #94a3b8)' }}
            >
              Communication
            </p>
            <h1
              className="mt-1 text-2xl font-semibold"
              style={{ color: 'var(--heading, #0f172a)' }}
            >
              {title || 'WhatsApp Messaging'}
            </h1>
            <p
              className="mt-1 max-w-2xl text-sm"
              style={{ color: 'var(--muted-foreground-hex, #64748b)' }}
            >
              {subtitle || 'School parent communication on Meta Cloud API — not wa.me links.'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {extra}
          <span className="sls-sms-range">
            <CalendarDays className="h-4 w-4 opacity-70" />
            {waWeekLabel()}
            <ChevronDown className="h-3.5 w-3.5 opacity-50" />
          </span>
          <Link href="/admin/school-sis/whatsapp/messaging" className="sls-cta sls-sms-send">
            <Send className="h-4 w-4" />
            Send Message
          </Link>
        </div>
      </div>
      <nav className="flex flex-wrap gap-1.5">
        {WA_LINKS.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
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
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {notice}
        </p>
      ) : null}
      {children}
    </div>
  );
}

export function WaPanel({
  title,
  icon: Icon,
  action,
  flush,
  children,
  className,
}: {
  title?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  flush?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('sls-saas-panel', className)}>
      {title ? (
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
      ) : null}
      <div className={flush ? '' : 'p-4'}>{children}</div>
    </section>
  );
}

export function WaEmpty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
      <span
        className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl"
        style={{
          background: 'var(--sls-fill, #f1f5f9)',
          color: 'var(--muted-foreground-hex, #94a3b8)',
        }}
      >
        <MessageCircle className="h-5 w-5" />
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
