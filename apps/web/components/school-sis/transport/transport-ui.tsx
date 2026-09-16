'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AlertTriangle,
  Bus,
  Droplets,
  Fuel,
  MapPinned,
  Navigation,
  Route,
  Settings2,
  Shield,
  UserRound,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react';
import { cn } from '@/utils/cn';

const LINKS = [
  { href: '/admin/school-sis/transport', label: 'Dashboard', exact: true, icon: Bus },
  { href: '/admin/school-sis/transport/vehicles', label: 'Vehicles', icon: Bus },
  { href: '/admin/school-sis/transport/routes', label: 'Routes', icon: Route },
  { href: '/admin/school-sis/transport/stops', label: 'Stops', icon: MapPinned },
  { href: '/admin/school-sis/transport/drivers', label: 'Drivers', icon: UserRound },
  { href: '/admin/school-sis/transport/attendants', label: 'Attendants', icon: Shield },
  { href: '/admin/school-sis/transport/allocations', label: 'Allocation', icon: Users },
  { href: '/admin/school-sis/transport/trips', label: 'Trips', icon: Navigation },
  { href: '/admin/school-sis/transport/tracking', label: 'Tracking', icon: Navigation },
  { href: '/admin/school-sis/transport/incidents', label: 'Incidents', icon: AlertTriangle },
  { href: '/admin/school-sis/transport/maintenance', label: 'Maintenance', icon: Wrench },
  { href: '/admin/school-sis/transport/fuel', label: 'Fuel', icon: Fuel },
  { href: '/admin/school-sis/transport/fees', label: 'Fees', icon: Wallet },
  { href: '/admin/school-sis/transport/requests', label: 'Requests', icon: Droplets },
  { href: '/admin/school-sis/transport/settings', label: 'Settings', icon: Settings2 },
];

export function TransportSubnav() {
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

export function TransportShell({
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
  return (
    <div className="space-y-4 bg-[#f4f7fb] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Transport Management
          </p>
          <h1 className="text-xl font-semibold text-[#1e3a8a]">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {extra}
      </div>
      <TransportSubnav />
      {children}
    </div>
  );
}

export function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: 'blue' | 'green' | 'amber' | 'rose' | 'slate';
}) {
  const map = {
    blue: 'bg-sky-50 text-sky-800',
    green: 'bg-emerald-50 text-emerald-800',
    amber: 'bg-amber-50 text-amber-900',
    rose: 'bg-rose-50 text-rose-800',
    slate: 'bg-white text-slate-800',
  };
  return (
    <div className={`rounded-xl border border-slate-200 p-4 ${map[tone ?? 'slate']}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export function Badge({ value }: { value: string }) {
  const tone = /ACTIVE|VALID|BOARDED|DROPPED|COMPLETED|APPROVED/.test(value)
    ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
    : /EXPIRED|CRITICAL|OVER|OUT_OF_SERVICE|REJECTED/.test(value)
      ? 'bg-rose-50 text-rose-700 ring-rose-200'
      : /EXPIRING|NEAR|DELAY|PENDING|MAINTENANCE/.test(value)
        ? 'bg-amber-50 text-amber-800 ring-amber-200'
        : 'bg-slate-100 text-slate-600 ring-slate-200';
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${tone}`}
    >
      {value.replaceAll('_', ' ')}
    </span>
  );
}

export const fieldClass =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#2563eb]';

export function ConfirmBar({
  title,
  body,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm text-slate-600">{body}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-2 text-sm text-slate-600"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-[#2563eb] px-3 py-2 text-sm font-semibold text-white"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
