'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AlertTriangle,
  AtSign,
  BarChart3,
  Bell,
  Calendar,
  FileBarChart,
  Layers,
  LayoutDashboard,
  Mail,
  Megaphone,
  MessageSquare,
  Phone,
  ScrollText,
  Send,
  Settings,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';
import { useRequireAdminPortal } from '@/hooks/use-require-admin-portal';
import { COMM_CENTER_NAV } from '@/components/communication/comm-center-nav';
import { cn } from '@/utils/cn';

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Send,
  Megaphone,
  Mail,
  Users,
  Calendar,
  Layers,
  Bell,
  AtSign,
  MessageSquare,
  Phone,
  Smartphone,
  ScrollText,
  FileBarChart,
  AlertTriangle,
  BarChart3,
  ShieldCheck,
  Settings,
  Sparkles,
};

export function CommCenterShell({ children }: { children: React.ReactNode }) {
  useRequireAuth();
  useRequireAdminPortal();
  const pathname = usePathname();

  return (
    <DashboardShell role="admin" title="Communication Center">
      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="shrink-0 lg:w-56">
          <nav className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {COMM_CENTER_NAV.map((item) => {
              const Icon = ICONS[item.icon] ?? LayoutDashboard;
              const active =
                item.href === '/admin/communication'
                  ? pathname === '/admin/communication'
                  : pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="whitespace-nowrap">{item.label}</span>
                  {'soon' in item && item.soon ? (
                    <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">
                      Soon
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </DashboardShell>
  );
}
