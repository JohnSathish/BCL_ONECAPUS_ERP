'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AlertTriangle,
  Ban,
  History,
  LayoutDashboard,
  Monitor,
  Settings2,
  Smartphone,
} from 'lucide-react';
import { cn } from '@/utils/cn';

const LINKS = [
  {
    href: '/admin/administration/device-login',
    label: 'Dashboard',
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: '/admin/administration/device-login/sessions',
    label: 'Sessions',
    icon: Monitor,
  },
  {
    href: '/admin/administration/device-login/history',
    label: 'History',
    icon: History,
  },
  {
    href: '/admin/administration/device-login/devices',
    label: 'Devices',
    icon: Smartphone,
  },
  {
    href: '/admin/administration/device-login/failed',
    label: 'Failed Logins',
    icon: AlertTriangle,
  },
  {
    href: '/admin/administration/device-login/blocked',
    label: 'Blocked',
    icon: Ban,
  },
  {
    href: '/admin/administration/device-login/policies',
    label: 'Policies',
    icon: Settings2,
  },
] as const;

export function DeviceLoginNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Device and login sections"
      className="mb-5 flex flex-wrap gap-1.5 rounded-xl border border-border/80 bg-muted/30 p-1.5"
    >
      {LINKS.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`);
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-background hover:text-foreground',
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
