'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, LogOut, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  PRINCIPAL_DESK_NAV,
  isPrincipalNavItemActive,
  type PrincipalNavBadgeKey,
} from '@/config/principal-desk-nav';
import { useAuth, useAuthQueryEnabled } from '@/hooks/use-auth';
import { useInstitutionBranding } from '@/hooks/use-institution-branding';
import { SIDEBAR_WIDTH } from '@/lib/sidebar-layout';
import { broadcastSessionMessage } from '@/lib/auth/session-broadcast';
import { tokenRefreshManager } from '@/lib/auth/token-refresh-manager';
import { logout } from '@/services/auth';
import { fetchPrincipalCommsStats } from '@/services/principal-comms';
import { fetchPrincipalDashboard } from '@/services/principal-desk';
import { useAuthStore } from '@/store/auth-store';
import { useDashboardUiStore } from '@/store/dashboard-ui-store';
import { cn } from '@/utils/cn';

function Badge({ count }: { count: number }) {
  if (!count || count <= 0) return null;
  const label = count > 99 ? '99+' : String(count);
  return (
    <span className="ml-auto inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-sm">
      {label}
    </span>
  );
}

function initialOpenGroups() {
  const init: Record<string, boolean> = {};
  for (const group of PRINCIPAL_DESK_NAV) {
    init[group.id] = group.defaultExpanded !== false;
  }
  return init;
}

export function PrincipalSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { session } = useAuth();
  const branding = useInstitutionBranding();
  const permissions = session?.user?.permissions ?? [];
  const collapsed = useDashboardUiStore((s) => s.sidebarCollapsed);
  const mobileOpen = useDashboardUiStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useDashboardUiStore((s) => s.setMobileNavOpen);
  const toggleSidebar = useDashboardUiStore((s) => s.toggleSidebar);
  const enabled = useAuthQueryEnabled();

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(initialOpenGroups);

  const deskQ = useQuery({
    queryKey: ['principal-desk', 'dashboard'],
    queryFn: fetchPrincipalDashboard,
    enabled,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const canComms = permissions.includes('principal-comms:access');
  const mailQ = useQuery({
    queryKey: ['principal-comms', 'stats'],
    queryFn: fetchPrincipalCommsStats,
    enabled: enabled && canComms,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const badges = useMemo(() => {
    const map: Record<PrincipalNavBadgeKey, number> = {
      leavePending:
        deskQ.data?.navBadges?.leavePending ?? deskQ.data?.criticalAlerts?.leavePending?.count ?? 0,
      unreadEmails: deskQ.data?.navBadges?.unreadEmails ?? mailQ.data?.unread ?? 0,
    };
    return map;
  }, [deskQ.data, mailQ.data]);

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const group of PRINCIPAL_DESK_NAV) {
        const active = group.items.some((item) => isPrincipalNavItemActive(pathname, item));
        if (active) next[group.id] = true;
      }
      return next;
    });
  }, [pathname]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname, setMobileNavOpen]);

  const handleLogout = async () => {
    broadcastSessionMessage({ type: 'LOGOUT' });
    tokenRefreshManager.clearSchedule();
    useAuthStore.getState().clear();
    try {
      await logout();
    } catch {
      /* ignore */
    }
    router.replace('/principal-desk/login');
  };

  const visibleGroups = PRINCIPAL_DESK_NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.permission || permissions.includes(item.permission)),
  })).filter((g) => g.items.length > 0);

  const sidebarInner = (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          'flex items-center gap-2.5 border-b border-white/10 px-3 py-3.5',
          collapsed && 'justify-center px-2',
        )}
      >
        {branding.branding?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={branding.branding.logoUrl}
            alt=""
            className="h-10 w-10 rounded-xl object-contain bg-white/10 p-1 ring-1 ring-white/10"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500 text-sm font-bold text-white shadow-md shadow-indigo-900/40">
            {(branding.branding?.displayName ?? 'PC').slice(0, 2).toUpperCase()}
          </div>
        )}
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tracking-tight text-white">
              {branding.branding?.displayName ?? 'OneCampus'}
            </p>
            <p className="truncate text-[10px] font-medium uppercase tracking-[0.16em] text-indigo-200/85">
              Principal Desk
            </p>
          </div>
        ) : null}
        <button
          type="button"
          className="hidden rounded-lg p-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white md:inline-flex"
          onClick={toggleSidebar}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
        <button
          type="button"
          className="inline-flex rounded-lg p-1.5 text-slate-300 hover:bg-white/10 md:hidden"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="min-h-0 flex-1 space-y-3 overflow-y-auto px-2 py-3 scrollbar-thin">
        {visibleGroups.map((group) => {
          const expanded = collapsed ? true : openGroups[group.id] !== false;
          return (
            <div key={group.id} className="rounded-xl bg-white/[0.02] p-1">
              {!collapsed ? (
                <button
                  type="button"
                  className="mb-0.5 flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition hover:bg-white/5"
                  onClick={() => setOpenGroups((s) => ({ ...s, [group.id]: !expanded }))}
                  aria-expanded={expanded}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    {group.label}
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-3.5 w-3.5 text-slate-500 transition-transform',
                      expanded ? 'rotate-0' : '-rotate-90',
                    )}
                  />
                </button>
              ) : null}
              {expanded ? (
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = isPrincipalNavItemActive(pathname, item);
                    const Icon = item.icon;
                    const badge = item.badgeKey ? badges[item.badgeKey] : 0;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          title={item.label}
                          className={cn(
                            'relative flex items-center gap-3 rounded-xl px-2.5 py-2 text-[13px] font-medium transition-colors',
                            collapsed && 'justify-center px-2',
                            active
                              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/40'
                              : 'text-slate-300 hover:bg-white/10 hover:text-white',
                          )}
                        >
                          <span
                            className={cn(
                              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                              active ? 'bg-white/15' : 'bg-white/5',
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          {!collapsed ? (
                            <>
                              <span className="min-w-0 flex-1 truncate">{item.label}</span>
                              {item.optional ? (
                                <span className="rounded bg-white/10 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                                  Opt
                                </span>
                              ) : null}
                              <Badge count={badge} />
                            </>
                          ) : badge > 0 ? (
                            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-rose-500" />
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-2">
        <button
          type="button"
          onClick={() => void handleLogout()}
          className={cn(
            'flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white',
            collapsed && 'justify-center',
          )}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5">
            <LogOut className="h-4 w-4 shrink-0" />
          </span>
          {!collapsed ? <span>Sign Out</span> : null}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop + tablet persistent sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden border-r border-slate-900/50 bg-[#0B1220] text-white md:flex md:flex-col',
          'transition-[width] duration-200 ease-out',
        )}
        style={{
          width: collapsed ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.desktop,
        }}
      >
        {sidebarInner}
      </aside>

      {/* Phone drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
            aria-label="Close menu overlay"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-[min(300px,88vw)] bg-[#0B1220] shadow-2xl">
            {sidebarInner}
          </aside>
        </div>
      ) : null}
    </>
  );
}
