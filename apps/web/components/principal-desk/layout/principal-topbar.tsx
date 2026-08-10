'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  CalendarDays,
  FileText,
  Mail,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  ScanLine,
  Search,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PRINCIPAL_FAB_ACTIONS, principalPageTitle } from '@/config/principal-desk-nav';
import { useAuth, useAuthQueryEnabled } from '@/hooks/use-auth';
import { useInstitutionBranding } from '@/hooks/use-institution-branding';
import { logoutClientSide } from '@/lib/auth/client-logout';
import { fetchPrincipalCommsStats } from '@/services/principal-comms';
import { fetchPrincipalDashboard } from '@/services/principal-desk';
import { useDashboardUiStore } from '@/store/dashboard-ui-store';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/utils/cn';

export function PrincipalTopbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { session } = useAuth();
  const branding = useInstitutionBranding();
  const permissions = session?.user?.permissions ?? [];
  const collapsed = useDashboardUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useDashboardUiStore((s) => s.toggleSidebar);
  const toggleMobileNavOpen = useDashboardUiStore((s) => s.toggleMobileNavOpen);
  const enabled = useAuthQueryEnabled();
  const [search, setSearch] = useState('');

  const deskQ = useQuery({
    queryKey: ['principal-desk', 'dashboard'],
    queryFn: fetchPrincipalDashboard,
    enabled,
    staleTime: 60_000,
  });

  const canComms = permissions.includes('principal-comms:access');
  const mailQ = useQuery({
    queryKey: ['principal-comms', 'stats'],
    queryFn: fetchPrincipalCommsStats,
    enabled: enabled && canComms,
    staleTime: 60_000,
  });

  const pageTitle = principalPageTitle(pathname);
  const institution = branding.branding?.displayName ?? 'OneCampus';
  const ay = deskQ.data?.institution?.academicYear;
  const sem = deskQ.data?.institution?.semester;
  const unread = deskQ.data?.navBadges?.unreadEmails ?? mailQ.data?.unread ?? 0;
  const leavePending =
    deskQ.data?.navBadges?.leavePending ?? deskQ.data?.criticalAlerts?.leavePending?.count ?? 0;
  const bellCount = unread + leavePending;

  const displayName =
    session?.user?.displayName || session?.user?.email?.split('@')[0] || 'Principal';

  const quickActions = useMemo(
    () =>
      PRINCIPAL_FAB_ACTIONS.filter(
        (a) => !('permission' in a && a.permission) || permissions.includes(a.permission as string),
      ),
    [permissions],
  );

  const handleLogout = () => {
    logoutClientSide(router, { redirectTo: '/principal-desk/login' });
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    if (!q) {
      router.push('/principal-desk/student-lookup');
      return;
    }
    router.push(`/principal-desk/student-lookup?q=${encodeURIComponent(q)}`);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md dark:border-border/60 dark:bg-card/95">
      <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
        <button
          type="button"
          className="inline-flex rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
          onClick={toggleMobileNavOpen}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <button
          type="button"
          className="hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:inline-flex"
          onClick={toggleSidebar}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-5 w-5" />
          ) : (
            <PanelLeftClose className="h-5 w-5" />
          )}
        </button>

        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900 dark:text-foreground">
            {institution}
          </p>
          <p className="truncate text-[11px] text-slate-500">
            {pageTitle}
            {ay ? ` · ${ay}` : ''}
            {sem ? ` · ${sem}` : ''}
          </p>
        </div>

        <form
          onSubmit={submitSearch}
          className="relative ml-2 hidden min-w-0 flex-1 max-w-xl lg:block"
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search students, staff, applications…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-16 text-sm outline-none ring-indigo-500/30 placeholder:text-slate-400 focus:bg-white focus:ring-2 dark:border-border dark:bg-muted/40"
          />
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400 sm:inline">
            ⌘K
          </kbd>
        </form>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => router.push('/principal-desk/student-lookup')}
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
                <Bell className="h-4 w-4" />
                {bellCount > 0 ? (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                    {bellCount > 9 ? '9+' : bellCount}
                  </span>
                ) : null}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {leavePending > 0 ? (
                <DropdownMenuItem asChild>
                  <Link href="/principal-desk/leave">
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {leavePending} leave request(s) pending
                  </Link>
                </DropdownMenuItem>
              ) : null}
              {unread > 0 && canComms ? (
                <DropdownMenuItem asChild>
                  <Link href="/principal-desk/communication-hub">
                    <Mail className="mr-2 h-4 w-4" />
                    {unread} unread email(s)
                  </Link>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem asChild>
                <Link href="/principal-desk/notices">
                  <FileText className="mr-2 h-4 w-4" />
                  View notices
                </Link>
              </DropdownMenuItem>
              {!leavePending && !unread ? (
                <p className="px-2 py-3 text-xs text-muted-foreground">
                  No critical alerts right now.
                </p>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                className="hidden gap-1 bg-indigo-600 text-white hover:bg-indigo-700 sm:inline-flex"
              >
                <Plus className="h-3.5 w-3.5" />
                Quick Action
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Quick actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {quickActions.map((a) => {
                const Icon = a.icon;
                return (
                  <DropdownMenuItem key={a.id} asChild>
                    <Link href={a.href}>
                      <Icon className="mr-2 h-4 w-4" />
                      {a.label}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  'flex max-w-[160px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-left text-sm hover:bg-slate-50 dark:border-border dark:bg-card',
                )}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                  {displayName.slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden min-w-0 sm:block">
                  <span className="block truncate font-medium text-slate-800 dark:text-foreground">
                    {displayName}
                  </span>
                  <span className="block truncate text-[10px] text-slate-500">Principal</span>
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{session?.user?.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/principal-desk/student-lookup">
                  <ScanLine className="mr-2 h-4 w-4" />
                  Student Lookup
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleLogout()}>Sign Out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
