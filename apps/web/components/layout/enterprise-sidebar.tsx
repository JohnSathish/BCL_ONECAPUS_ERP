'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, PanelLeftClose, PanelLeftOpen, Search, X } from 'lucide-react';
import { useMemo, useState, useLayoutEffect, useRef, useEffect, type ReactNode } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { InstitutionBrandMark } from '@/components/branding/institution-brand-mark';
import {
  ADMIN_NAV,
  ROLE_NAV,
  STAFF_NAV,
  isNavChildActive,
  isNavItemActive,
  type NavGroup,
  type NavItem,
} from '@/config/navigation';
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
import { cn } from '@/utils/cn';

const NAV_ITEM_CLASS =
  'relative flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors';
const NAV_ITEM_ACTIVE = 'sidebar-glow-active text-sidebar-foreground';
const NAV_ITEM_IDLE = 'text-sidebar-muted hover:bg-sidebar-active/50 hover:text-sidebar-foreground';

const SCROLL_NAV_CLASS =
  'scrollbar-thin min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-y-contain px-1.5 py-1';

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

export function EnterpriseSidebar({ role }: { role: keyof typeof ROLE_NAV | 'admin' | 'staff' }) {
  const pathname = usePathname();
  const roleKey = String(role);
  const { branding, active } = useInstitutionBranding();
  const collapsed = useDashboardUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useDashboardUiStore((s) => s.toggleSidebar);
  const mobileNavOpen = useDashboardUiStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useDashboardUiStore((s) => s.setMobileNavOpen);
  const mergeOpenGroups = useSidebarNavStore((s) => s.mergeOpenGroups);
  const setGroupOpen = useSidebarNavStore((s) => s.setGroupOpen);
  const openGroups = useSidebarNavStore((s) => s.openGroupsByRole[roleKey] ?? EMPTY_OPEN_GROUPS);
  const staffMe = useStaffMe({ enabled: role === 'staff' });
  const [query, setQuery] = useState('');
  const prevPathname = useRef(pathname);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname, setMobileNavOpen]);

  const session = useAuthStore((s) => s.session);
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

  useLayoutEffect(() => {
    const parents = activeParentLabels(groups, pathname, isNavChildActive);
    const pathnameChanged = prevPathname.current !== pathname;
    prevPathname.current = pathname;

    if (!parents.length) return;

    if (pathnameChanged) {
      mergeOpenGroups(roleKey, Object.fromEntries(parents.map((label) => [label, true])));
      return;
    }

    const current = useSidebarNavStore.getState().openGroupsByRole[roleKey] ?? {};
    const toOpen = parents.filter((label) => current[label] !== false);
    if (!toOpen.length) return;
    if (toOpen.every((label) => current[label] === true)) return;
    mergeOpenGroups(roleKey, Object.fromEntries(toOpen.map((label) => [label, true])));
  }, [groups, mergeOpenGroups, pathname, roleKey]);

  const filtered = useMemo(() => {
    if (!query.trim()) return groups;
    const q = query.toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (item) =>
            item.label.toLowerCase().includes(q) ||
            item.children?.some((c) => c.label.toLowerCase().includes(q)),
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, query]);

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

  const navCollapsed = mobileNavOpen ? false : collapsed;

  const renderGroups = (sectionGroups: NavGroup[], options?: { hideFirstDivider?: boolean }) =>
    sectionGroups.map((group, index) => (
      <NavSection
        key={group.label}
        group={group}
        pathname={pathname}
        collapsed={navCollapsed}
        resolveOpen={resolveOpen}
        onToggle={(item) => setGroupOpen(roleKey, item.label, !resolveOpen(item))}
        onExpandSidebar={toggleSidebar}
        showDivider={collapsed && !(options?.hideFirstDivider && index === 0)}
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
        style={{ width: mobileNavOpen ? 280 : collapsed ? 72 : 240 }}
        className={cn(
          'erp-theme-sidebar pointer-events-auto fixed inset-y-0 left-0 z-50 flex h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-2xl transition-[transform,width] duration-200 ease-out',
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        <div className="shrink-0 border-b border-sidebar-border px-3 py-3">
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
              title={collapsed && !mobileNavOpen ? 'Expand sidebar' : undefined}
            >
              <InstitutionBrandMark
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
          <div className="shrink-0 px-3 py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sidebar-muted" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search modules…"
                className="h-8 border-sidebar-border bg-sidebar/50 pl-8 text-xs text-sidebar-foreground placeholder:text-muted-foreground"
                aria-label="Search navigation"
              />
            </div>
          </div>
        ) : null}

        <SidebarNav
          roleKey={roleKey}
          section={isAdminLayout ? 'modules' : 'main'}
          className={SCROLL_NAV_CLASS}
          ariaLabel={isAdminLayout ? 'Admin navigation' : 'Navigation'}
        >
          {renderGroups(filtered, { hideFirstDivider: true })}
        </SidebarNav>

        <div className="hidden shrink-0 border-t border-sidebar-border p-2 md:block">
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
            title={navCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {navCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
            {!navCollapsed ? (
              <span>Collapse</span>
            ) : (
              <span className="sr-only">Expand sidebar</span>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}

function NavSection({
  group,
  pathname,
  collapsed,
  resolveOpen,
  onToggle,
  onExpandSidebar,
  hideLabel,
  showDivider,
}: {
  group: NavGroup;
  pathname: string;
  collapsed: boolean;
  resolveOpen: (item: NavItem) => boolean;
  onToggle: (item: NavItem) => void;
  onExpandSidebar: () => void;
  hideLabel?: boolean;
  showDivider?: boolean;
}) {
  return (
    <div>
      {showDivider ? (
        <div className="mx-2 my-1.5 border-t border-sidebar-border/80" aria-hidden />
      ) : null}
      {!collapsed && !hideLabel ? (
        <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-muted/90 first:pt-0">
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
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  open: boolean;
  onToggle: () => void;
  onExpandSidebar: () => void;
}) {
  const Icon = item.icon;
  const active = isNavItemActive(pathname, item);

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
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className={cn('h-[18px] w-[18px] shrink-0', active && 'text-primary')} />
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
            aria-label={item.label}
          >
            <Icon className={cn('h-[18px] w-[18px] shrink-0', active && 'text-primary')} />
          </button>
        </li>
      );
    }

    return (
      <li>
        <button
          type="button"
          onClick={onToggle}
          className={cn(NAV_ITEM_CLASS, active ? NAV_ITEM_ACTIVE : NAV_ITEM_IDLE)}
          aria-expanded={open}
        >
          <Icon className={cn('h-[18px] w-[18px] shrink-0', active && 'text-primary')} />
          <span className="flex-1 text-left">{item.label}</span>
          <ChevronDown
            className={cn('h-4 w-4 shrink-0 opacity-70 transition', open && 'rotate-180')}
          />
        </button>
        {open ? (
          <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-sidebar-border/80 pl-3">
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
                      'relative z-10 block rounded-md px-2.5 py-1.5 text-[13px] transition-colors',
                      childActive
                        ? 'bg-sidebar-active font-medium text-sidebar-foreground'
                        : 'text-sidebar-muted hover:bg-sidebar-active/40 hover:text-sidebar-foreground',
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
          title={collapsed ? `${item.label} (Coming soon)` : 'Coming soon'}
        >
          <Icon className="h-[18px] w-[18px] shrink-0 opacity-60" />
          {!collapsed ? (
            <>
              <span className="flex-1">{item.label}</span>
              <span className="rounded-full bg-sidebar-active px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                Soon
              </span>
            </>
          ) : null}
        </span>
      </li>
    );
  }

  return (
    <li>
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
        aria-label={collapsed ? item.label : undefined}
      >
        <Icon className={cn('h-[18px] w-[18px] shrink-0', active && 'text-primary')} />
        {!collapsed ? <span>{item.label}</span> : null}
      </Link>
    </li>
  );
}
