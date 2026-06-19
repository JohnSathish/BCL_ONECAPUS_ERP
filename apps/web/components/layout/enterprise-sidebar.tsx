'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ChevronDown,
  Clock,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Star,
  X,
  Zap,
} from 'lucide-react';
import { useMemo, useState, useLayoutEffect, useRef, useEffect, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { broadcastSessionMessage } from '@/lib/auth/session-broadcast';
import { tokenRefreshManager } from '@/lib/auth/token-refresh-manager';
import { logout } from '@/services/auth';
import { useAuthStore } from '@/store/auth-store';
import {
  ADMIN_NAV,
  ROLE_NAV,
  STAFF_NAV,
  isNavChildActive,
  isNavItemActive,
  type NavGroup,
  type NavItem,
} from '@/config/navigation';
import {
  DEFAULT_FAVORITE_HREFS,
  NAV_SEARCH_ACTIONS,
  SIDEBAR_QUICK_ACTIONS,
  moduleColor,
} from '@/config/nav-meta';
import { useStaffMe } from '@/components/staff-portal/hooks/use-staff-me';
import { buildStaffNavContext, filterStaffNav } from '@/lib/staff-portal/nav-visibility';
import { buildAdminNavContext, filterAdminNav } from '@/lib/admin-nav-visibility';
import { useInstitutionBranding } from '@/hooks/use-institution-branding';
import { Input } from '@/components/ui/input';
import { useDashboardUiStore } from '@/store/dashboard-ui-store';
import {
  activeParentLabels,
  useSidebarNavStore,
  type SidebarScrollSection,
} from '@/store/sidebar-nav-store';
import { useNavPreferencesStore } from '@/store/nav-preferences-store';
import { buildNavIndex, findEntryById, navEntryId, resolveNavEntry } from '@/lib/nav-index';
import { fetchOperationsCenter } from '@/services/dashboard-analytics';
import { SIDEBAR_WIDTH } from '@/lib/sidebar-layout';
import { SidebarInstitutionCard } from '@/components/layout/sidebar-institution-card';
import { cn } from '@/utils/cn';

const NAV_ITEM_CLASS =
  'relative flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-all duration-150';
const NAV_ITEM_ACTIVE =
  'sidebar-glow-active font-semibold text-sidebar-foreground shadow-[0_0_16px_hsl(var(--primary)/0.12)]';
const NAV_ITEM_IDLE = 'text-sidebar-muted hover:bg-sidebar-active/50 hover:text-sidebar-foreground';
const NAV_PARENT_CLASS = 'font-semibold text-sidebar-foreground';

const SCROLL_NAV_CLASS =
  'sidebar-scroll-auto min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain px-2 py-2';

const EMPTY_OPEN_GROUPS: Record<string, boolean> = {};

function SidebarNav({
  roleKey,
  section,
  className,
  ariaLabel,
  children,
}: {
  roleKey: string;
  section: SidebarScrollSection;
  className?: string;
  ariaLabel?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const hydrated = useRef(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || hydrated.current) return;
    el.scrollTop = useSidebarNavStore.getState().getScrollTop(roleKey, section);
    hydrated.current = true;
  }, [roleKey, section]);

  return (
    <nav
      ref={ref}
      className={className}
      aria-label={ariaLabel}
      onScroll={(e) => {
        useSidebarNavStore.getState().setScrollTop(roleKey, section, e.currentTarget.scrollTop);
      }}
    >
      {children}
    </nav>
  );
}

function formatRelativeTime(ts: number) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function hasAnyPermission(userPerms: string[], required?: string[]) {
  if (!required?.length) return true;
  return required.some((p) => userPerms.includes(p));
}

export function EnterpriseSidebar({ role }: { role: keyof typeof ROLE_NAV | 'admin' | 'staff' }) {
  const pathname = usePathname();
  const router = useRouter();
  const roleKey = String(role);
  const { branding, active } = useInstitutionBranding();
  const collapsed = useDashboardUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useDashboardUiStore((s) => s.toggleSidebar);
  const mobileNavOpen = useDashboardUiStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useDashboardUiStore((s) => s.setMobileNavOpen);
  const mergeOpenGroups = useSidebarNavStore((s) => s.mergeOpenGroups);
  const setGroupOpen = useSidebarNavStore((s) => s.setGroupOpen);
  const setExclusiveGroupOpen = useSidebarNavStore((s) => s.setExclusiveGroupOpen);
  const openGroups = useSidebarNavStore((s) => s.openGroupsByRole[roleKey] ?? EMPTY_OPEN_GROUPS);
  const staffMe = useStaffMe({ enabled: role === 'staff' });
  const [query, setQuery] = useState('');
  const prevPathname = useRef(pathname);
  const favoritesInit = useRef(false);

  const toggleFavorite = useNavPreferencesStore((s) => s.toggleFavorite);
  const recordVisit = useNavPreferencesStore((s) => s.recordVisit);
  const recents = useNavPreferencesStore((s) => s.recentsByRole[roleKey] ?? []);
  const favoriteIds = useNavPreferencesStore((s) => s.favoritesByRole[roleKey] ?? []);
  const setFavorites = useNavPreferencesStore((s) => s.setFavorites);

  const statsQ = useQuery({
    queryKey: ['sidebar', 'nav-badges'],
    queryFn: () => fetchOperationsCenter({}),
    enabled: role === 'admin',
    staleTime: 120_000,
    retry: 1,
  });

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname, setMobileNavOpen]);

  const session = useAuthStore((s) => s.session);
  const userPerms = session?.user?.permissions ?? [];
  const isAdminLayout = role === 'admin';

  const groups: NavGroup[] = useMemo(() => {
    if (role === 'admin') {
      return filterAdminNav(ADMIN_NAV, buildAdminNavContext(session ?? undefined));
    }
    if (role === 'staff') {
      const ctx = staffMe.data
        ? buildStaffNavContext({
            ...staffMe.data,
            permissions: session?.user?.permissions,
          })
        : buildStaffNavContext({
            staffType: 'TEACHING',
            permissions: session?.user?.permissions,
          });
      return filterStaffNav(STAFF_NAV, ctx);
    }
    const items = ROLE_NAV[role];
    if (!items) {
      return [{ label: 'Menu', items: [] }];
    }
    return [
      {
        label: 'Menu',
        items: items.map((item) => ({
          label: item.label,
          href: item.href,
          icon: item.icon,
        })),
      },
    ];
  }, [role, staffMe.data, session]);

  const navIndex = useMemo(() => buildNavIndex(groups), [groups]);

  useEffect(() => {
    if (!pathname || role !== 'admin') return;
    const entry = resolveNavEntry(navIndex, pathname);
    if (entry) {
      recordVisit(roleKey, { id: entry.id, href: entry.href, label: entry.label });
    }
  }, [pathname, navIndex, recordVisit, role, roleKey]);

  useEffect(() => {
    if (favoritesInit.current || role !== 'admin' || favoriteIds.length > 0) return;
    favoritesInit.current = true;
    const defaults = DEFAULT_FAVORITE_HREFS.map((href) => resolveNavEntry(navIndex, href))
      .filter(Boolean)
      .map((e) => e!.id);
    if (defaults.length) setFavorites(roleKey, defaults);
  }, [favoriteIds.length, navIndex, role, roleKey, setFavorites]);

  useLayoutEffect(() => {
    const parents = activeParentLabels(groups, pathname, isNavChildActive);
    const pathnameChanged = prevPathname.current !== pathname;
    prevPathname.current = pathname;

    if (!parents.length) return;

    if (pathnameChanged) {
      if (parents.length === 1) {
        setExclusiveGroupOpen(roleKey, parents[0]!);
      } else {
        mergeOpenGroups(roleKey, Object.fromEntries(parents.map((label) => [label, true])));
      }
      return;
    }

    const current = useSidebarNavStore.getState().openGroupsByRole[roleKey] ?? {};
    const toOpen = parents.filter((label) => current[label] !== false);
    if (!toOpen.length) return;
    if (toOpen.every((label) => current[label] === true)) return;
    mergeOpenGroups(roleKey, Object.fromEntries(toOpen.map((label) => [label, true])));
  }, [groups, mergeOpenGroups, pathname, roleKey, setExclusiveGroupOpen]);

  const badgeMap = useMemo(() => {
    const s = statsQ.data;
    if (!s) return {} as Record<string, string>;
    return {
      Students: s.institution.studentCount.toLocaleString(),
      Staff: s.institution.staffCount.toLocaleString(),
      Finance: s.finance.defaulters > 0 ? String(s.finance.defaulters) : '',
      'Human Resources': s.actions.find((a) => a.id === 'leave')?.count
        ? String(s.actions.find((a) => a.id === 'leave')!.count)
        : '',
      Library: '',
      Admissions: s.actions.find((a) => a.id === 'admissions')?.count
        ? String(s.actions.find((a) => a.id === 'admissions')!.count)
        : '',
    };
  }, [statsQ.data]);

  const filtered = useMemo(() => {
    if (!query.trim()) return groups;
    const q = query.toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (item) =>
            item.label.toLowerCase().includes(q) ||
            item.module?.toLowerCase().includes(q) ||
            item.children?.some((c) => c.label.toLowerCase().includes(q)),
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, query]);

  const searchAction = useMemo(() => {
    if (!query.trim()) return null;
    const q = query.trim().toLowerCase();
    return NAV_SEARCH_ACTIONS.find(
      (a) =>
        hasAnyPermission(userPerms, a.permissions) &&
        (a.label.toLowerCase().includes(q) ||
          a.keywords.some((k) => k.includes(q) || q.includes(k))),
    );
  }, [query, userPerms]);

  const quickActions = useMemo(
    () => SIDEBAR_QUICK_ACTIONS.filter((a) => hasAnyPermission(userPerms, a.permissions)),
    [userPerms],
  );

  const favoriteEntries = useMemo(
    () =>
      favoriteIds
        .map((id) => findEntryById(navIndex, id))
        .filter((e): e is NonNullable<typeof e> => Boolean(e)),
    [favoriteIds, navIndex],
  );

  const recentEntries = useMemo(
    () => recents.map((r) => resolveNavEntry(navIndex, r.href) ?? r).slice(0, 5),
    [navIndex, recents],
  );

  const handleLogout = async () => {
    setMobileNavOpen(false);
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

  const resolveOpen = (item: NavItem) => {
    const stored = openGroups[item.label];
    if (stored === false) return false;
    if (stored === true) return true;
    const hasActiveChild = item.children?.some((c) =>
      isNavChildActive(pathname, c, item.children ?? []),
    );
    if (hasActiveChild) return true;
    if (query.trim() && item.children?.length) return true;
    return false;
  };

  const handleToggle = (item: NavItem) => {
    const willOpen = !resolveOpen(item);
    if (willOpen) {
      setExclusiveGroupOpen(roleKey, item.label);
    } else {
      setGroupOpen(roleKey, item.label, false);
    }
  };

  const navCollapsed = mobileNavOpen ? false : collapsed;

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchAction) {
      setQuery('');
      setMobileNavOpen(false);
      router.push(searchAction.href);
    }
  };

  const renderGroups = (sectionGroups: NavGroup[]) =>
    sectionGroups.map((group) => (
      <NavSection
        key={group.label}
        group={group}
        pathname={pathname}
        collapsed={navCollapsed}
        resolveOpen={resolveOpen}
        onToggle={handleToggle}
        onExpandSidebar={toggleSidebar}
        badgeMap={badgeMap}
        favoriteIds={favoriteIds}
        onToggleFavorite={(id) => toggleFavorite(roleKey, id)}
      />
    ));

  return (
    <>
      {mobileNavOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px] md:hidden"
          aria-label="Close menu"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}
      <aside
        style={{
          width: mobileNavOpen ? '100%' : collapsed ? SIDEBAR_WIDTH.collapsed : undefined,
        }}
        className={cn(
          'erp-theme-sidebar pointer-events-auto fixed inset-y-0 left-0 z-50 flex h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-2xl transition-[transform,width] duration-200 ease-out',
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          !mobileNavOpen && !collapsed && 'w-[260px] lg:w-[280px]',
        )}
      >
        <div className="shrink-0 border-b border-sidebar-border/50 px-3 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={collapsed && !mobileNavOpen ? toggleSidebar : undefined}
              className={cn(
                'min-w-0 flex-1 text-left',
                collapsed &&
                  !mobileNavOpen &&
                  'cursor-pointer rounded-lg hover:bg-sidebar-active/50',
              )}
              aria-label={collapsed && !mobileNavOpen ? 'Expand sidebar' : undefined}
            >
              <SidebarInstitutionCard
                branding={branding}
                active={active}
                collapsed={collapsed && !mobileNavOpen}
              />
            </button>
            {mobileNavOpen ? (
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="inline-flex shrink-0 rounded-lg p-2 text-sidebar-muted hover:bg-sidebar-active/50 hover:text-sidebar-foreground md:hidden"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            ) : null}
          </div>
        </div>

        {mobileNavOpen || !collapsed ? (
          <div className="shrink-0 space-y-2 px-3 pb-2 pt-1">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sidebar-muted" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search modules, actions…"
                className="h-9 border-0 bg-sidebar-active/40 pl-8 pr-12 text-xs text-sidebar-foreground shadow-none placeholder:text-sidebar-muted/70 focus-visible:ring-1 focus-visible:ring-primary/40"
                aria-label="Search navigation"
              />
              <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-sidebar-border/60 bg-sidebar-active/50 px-1.5 py-0.5 text-[9px] text-sidebar-muted lg:inline">
                Ctrl K
              </kbd>
            </div>
            {searchAction ? (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setMobileNavOpen(false);
                  router.push(searchAction.href);
                }}
                className="flex w-full items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-left text-xs text-primary"
              >
                <Zap className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Go to <strong>{searchAction.label}</strong>
                </span>
              </button>
            ) : null}
          </div>
        ) : null}

        <SidebarNav
          roleKey={roleKey}
          section={isAdminLayout ? 'modules' : 'main'}
          className={cn(
            SCROLL_NAV_CLASS,
            mobileNavOpen && isAdminLayout && 'pb-[calc(4.5rem+env(safe-area-inset-bottom))]',
          )}
          ariaLabel={isAdminLayout ? 'Admin navigation' : 'Navigation'}
        >
          {isAdminLayout && !query.trim() && favoriteEntries.length > 0 && !navCollapsed ? (
            <SidebarPinSection
              title="Favorites"
              icon={Star}
              iconClass="text-amber-400"
              collapsed={navCollapsed}
            >
              <ul className="space-y-0.5">
                {favoriteEntries.map((entry) => (
                  <CompactNavLink
                    key={entry.id}
                    href={entry.href}
                    label={entry.label}
                    color={moduleColor(entry.module)}
                    active={pathname === entry.href || pathname.startsWith(`${entry.href}/`)}
                    onNavigate={() => setMobileNavOpen(false)}
                  />
                ))}
              </ul>
            </SidebarPinSection>
          ) : null}

          {isAdminLayout && !query.trim() && quickActions.length > 0 && !navCollapsed ? (
            <SidebarPinSection
              title="Quick Actions"
              icon={Zap}
              iconClass="text-yellow-400"
              collapsed={navCollapsed}
            >
              <ul className="space-y-0.5">
                {quickActions.slice(0, 4).map((action) => {
                  const Icon = action.icon;
                  return (
                    <li key={action.id}>
                      <Link
                        href={action.href}
                        prefetch={false}
                        onClick={() => setMobileNavOpen(false)}
                        className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-sidebar-muted transition hover:bg-sidebar-active/45 hover:text-sidebar-foreground"
                      >
                        <span
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                          style={{ backgroundColor: `${action.color}22`, color: action.color }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </span>
                        <span>{action.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </SidebarPinSection>
          ) : null}

          {isAdminLayout && !query.trim() && recentEntries.length > 0 && !navCollapsed ? (
            <SidebarPinSection
              title="Recently Used"
              icon={Clock}
              iconClass="text-sky-400"
              collapsed={navCollapsed}
            >
              <ul className="space-y-0.5">
                {recentEntries.map((entry) => {
                  const href = 'href' in entry ? entry.href : '';
                  const label = 'label' in entry ? entry.label : '';
                  const visitedAt =
                    'visitedAt' in entry ? (entry.visitedAt as number | undefined) : undefined;
                  return (
                    <li key={href + label}>
                      <Link
                        href={href}
                        prefetch={false}
                        onClick={() => setMobileNavOpen(false)}
                        className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs text-sidebar-muted transition hover:bg-sidebar-active/45 hover:text-sidebar-foreground"
                      >
                        <span className="truncate">{label}</span>
                        {visitedAt ? (
                          <span className="shrink-0 text-[9px] text-sidebar-muted/70">
                            {formatRelativeTime(visitedAt)}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </SidebarPinSection>
          ) : null}

          {!navCollapsed && !query.trim() ? (
            <p className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-muted/80">
              Main Navigation
            </p>
          ) : null}

          {renderGroups(filtered)}
        </SidebarNav>

        {isAdminLayout && mobileNavOpen ? (
          <div className="shrink-0 px-2 py-2 md:hidden">
            <button
              type="button"
              onClick={() => void handleLogout()}
              className={cn(
                NAV_ITEM_CLASS,
                'text-sidebar-muted hover:bg-sidebar-active/50 hover:text-danger',
              )}
            >
              <LogOut className="h-[18px] w-[18px] shrink-0" />
              <span>Sign out</span>
            </button>
          </div>
        ) : null}

        <div className="hidden shrink-0 p-2 md:block">
          <button
            type="button"
            onClick={toggleSidebar}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-lg px-2.5 py-2 text-sm transition',
              navCollapsed
                ? 'bg-sidebar-active/60 text-sidebar-foreground hover:bg-sidebar-active'
                : 'text-sidebar-muted hover:bg-sidebar-active/50 hover:text-sidebar-foreground',
            )}
            aria-label={navCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {navCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
            {!navCollapsed ? <span>Collapse</span> : <span className="sr-only">Expand</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

function SidebarPinSection({
  title,
  icon: Icon,
  iconClass,
  collapsed,
  children,
}: {
  title: string;
  icon: typeof Star;
  iconClass?: string;
  collapsed: boolean;
  children: ReactNode;
}) {
  if (collapsed) return null;
  return (
    <div className="rounded-xl border border-sidebar-border/40 bg-sidebar-active/20 p-2">
      <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-muted">
        <Icon className={cn('h-3 w-3', iconClass)} />
        {title}
      </p>
      {children}
    </div>
  );
}

function CompactNavLink({
  href,
  label,
  color,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  color: string;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <li>
      <Link
        href={href}
        prefetch={false}
        onClick={onNavigate}
        className={cn(
          'flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition',
          active
            ? 'bg-primary/15 font-medium text-sidebar-foreground'
            : 'text-sidebar-muted hover:bg-sidebar-active/45 hover:text-sidebar-foreground',
        )}
      >
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: color, boxShadow: active ? `0 0 8px ${color}` : undefined }}
        />
        {label}
      </Link>
    </li>
  );
}

function NavSection({
  group,
  pathname,
  collapsed,
  resolveOpen,
  onToggle,
  onExpandSidebar,
  badgeMap,
  favoriteIds,
  onToggleFavorite,
}: {
  group: NavGroup;
  pathname: string;
  collapsed: boolean;
  resolveOpen: (item: NavItem) => boolean;
  onToggle: (item: NavItem) => void;
  onExpandSidebar: () => void;
  badgeMap: Record<string, string>;
  favoriteIds: string[];
  onToggleFavorite: (id: string) => void;
}) {
  return (
    <div>
      {!collapsed ? (
        <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-muted/80">
          {group.label}
        </p>
      ) : null}
      <ul className="space-y-0.5">
        {group.items.map((item) => (
          <SidebarItem
            key={item.label}
            item={item}
            pathname={pathname}
            collapsed={collapsed}
            open={resolveOpen(item)}
            onToggle={() => onToggle(item)}
            onExpandSidebar={onExpandSidebar}
            badge={badgeMap[item.label] || item.badge}
            isFavorited={
              item.href ? favoriteIds.includes(navEntryId(item.label, item.href)) : false
            }
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </ul>
    </div>
  );
}

function SidebarItem({
  item,
  pathname,
  collapsed,
  open,
  onToggle,
  onExpandSidebar,
  badge,
  isFavorited,
  onToggleFavorite,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  open: boolean;
  onToggle: () => void;
  onExpandSidebar: () => void;
  badge?: string;
  isFavorited?: boolean;
  onToggleFavorite?: (id: string) => void;
}) {
  const Icon = item.icon;
  const active = isNavItemActive(pathname, item);
  const accent = moduleColor(item.module);

  const iconNode = (
    <span
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition',
        active || open ? 'shadow-[0_0_12px_var(--nav-accent-glow)]' : '',
      )}
      style={
        {
          '--nav-accent': accent,
          '--nav-accent-glow': `${accent}55`,
          backgroundColor: active || open ? `${accent}22` : `${accent}12`,
          color: accent,
        } as React.CSSProperties
      }
    >
      <Icon className="h-[16px] w-[16px]" />
    </span>
  );

  const badgeNode =
    badge && !collapsed ? (
      <span className="ml-auto shrink-0 rounded-full bg-sidebar-active/80 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-sidebar-muted">
        {badge}
      </span>
    ) : null;

  if (item.children?.length) {
    if (collapsed) {
      if (item.href) {
        return (
          <li>
            <Link
              href={item.href}
              prefetch={false}
              className={cn(
                NAV_ITEM_CLASS,
                active ? NAV_ITEM_ACTIVE : NAV_ITEM_IDLE,
                'justify-center px-2',
              )}
              title={item.label}
              aria-current={active ? 'page' : undefined}
            >
              {iconNode}
            </Link>
          </li>
        );
      }

      return (
        <li>
          <button
            type="button"
            onClick={() => {
              onExpandSidebar();
              onToggle();
            }}
            className={cn(
              NAV_ITEM_CLASS,
              active ? NAV_ITEM_ACTIVE : NAV_ITEM_IDLE,
              'justify-center px-2',
            )}
            title={item.label}
          >
            {iconNode}
          </button>
        </li>
      );
    }

    return (
      <li>
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            NAV_ITEM_CLASS,
            active || open ? NAV_PARENT_CLASS : '',
            active ? NAV_ITEM_ACTIVE : NAV_ITEM_IDLE,
          )}
          aria-expanded={open}
        >
          {iconNode}
          <span className="flex-1 text-left">{item.label}</span>
          {badgeNode}
          <ChevronDown
            className={cn('h-4 w-4 shrink-0 opacity-60 transition', open && 'rotate-180')}
          />
        </button>
        {open ? (
          <ul className="ml-3 mt-0.5 space-y-0.5 border-l border-sidebar-border/50 pl-3">
            {item.children.map((child) => {
              const childActive = isNavChildActive(pathname, child, item.children ?? []);
              return (
                <li key={child.href + child.label}>
                  <Link
                    href={child.href}
                    prefetch={false}
                    aria-current={childActive ? 'page' : undefined}
                    scroll={false}
                    className={cn(
                      'relative block rounded-lg px-2.5 py-1.5 text-xs transition-colors',
                      childActive
                        ? 'sidebar-child-active font-semibold text-sidebar-foreground'
                        : 'text-sidebar-muted/90 hover:bg-sidebar-active/35 hover:text-sidebar-foreground',
                    )}
                  >
                    {child.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
      </li>
    );
  }

  if (item.soon || !item.href) {
    return (
      <li>
        <span
          className={cn(
            NAV_ITEM_CLASS,
            'cursor-default text-sidebar-muted/55',
            collapsed && 'justify-center px-2',
          )}
        >
          {iconNode}
          {!collapsed ? (
            <>
              <span className="flex-1">{item.label}</span>
              <span className="rounded-full bg-sidebar-active px-2 py-0.5 text-[10px] font-medium uppercase">
                Soon
              </span>
            </>
          ) : null}
        </span>
      </li>
    );
  }

  return (
    <li className="group/item relative">
      <Link
        href={item.href}
        prefetch={false}
        aria-current={active ? 'page' : undefined}
        scroll={false}
        className={cn(
          NAV_ITEM_CLASS,
          active ? NAV_ITEM_ACTIVE : NAV_ITEM_IDLE,
          collapsed && 'justify-center px-2',
        )}
        title={collapsed ? item.label : undefined}
      >
        {iconNode}
        {!collapsed ? (
          <>
            <span className="flex-1">{item.label}</span>
            {badgeNode}
          </>
        ) : null}
      </Link>
      {!collapsed && onToggleFavorite && item.href ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const id = navEntryId(item.label, item.href!);
            onToggleFavorite(id);
          }}
          className={cn(
            'absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 opacity-0 transition group-hover/item:opacity-100',
            isFavorited ? 'text-amber-400 opacity-100' : 'text-sidebar-muted hover:text-amber-400',
          )}
          aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Star className={cn('h-3 w-3', isFavorited && 'fill-current')} />
        </button>
      ) : null}
    </li>
  );
}
