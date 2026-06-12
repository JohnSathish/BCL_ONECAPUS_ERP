'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Building2, KeyRound, LayoutDashboard, LogOut, Shield } from 'lucide-react';
import { broadcastSessionMessage } from '@/lib/auth/session-broadcast';
import { tokenRefreshManager } from '@/lib/auth/token-refresh-manager';
import { logout } from '@/services/auth';
import { useAuthStore } from '@/store/auth-store';
import { cn } from '@/utils/cn';

const NAV = [
  { href: '/platform', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/platform/licenses', label: 'Licenses', icon: Building2 },
  { href: '/platform/license-keys', label: 'Activation keys', icon: KeyRound },
];

export function PlatformShell({ children, title }: { children: React.ReactNode; title?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);

  const handleLogout = async () => {
    broadcastSessionMessage({ type: 'LOGOUT' });
    tokenRefreshManager.clearSchedule();
    useAuthStore.getState().clear();
    try {
      await logout();
    } catch {
      /* ignore */
    }
    router.replace('/login');
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-56 shrink-0 border-r border-border/60 bg-card/40 md:flex md:flex-col">
        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-5">
          <Shield className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-semibold">BaseCode Platform</p>
            <p className="text-xs text-muted-foreground">License console</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition',
                  active
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border/60 p-3 text-xs text-muted-foreground">
          <p className="truncate">{session?.user.email}</p>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-2 flex items-center gap-1.5 text-sm hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center border-b border-border/60 px-4 sm:px-6">
          <h1 className="text-lg font-semibold">{title ?? 'Platform'}</h1>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
