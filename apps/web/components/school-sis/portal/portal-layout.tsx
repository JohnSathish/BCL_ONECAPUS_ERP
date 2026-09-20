'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, LogOut, Menu, Search, Smartphone, X } from 'lucide-react';
import { BrandingLogoImage } from '@/components/branding/branding-logo-image';
import { useAuth } from '@/hooks/use-auth';
import { logout } from '@/services/auth';
import { tokenRefreshManager } from '@/lib/auth/token-refresh-manager';
import { useAuthStore } from '@/store/auth-store';
import { fetchPublishedAppearance } from '@/services/school-appearance';
import { fetchSchoolPortalBootstrap } from '@/services/school-sis-portal';
import { SCHOOL_SIS_LOGO_SRC } from '@/lib/school-erp/product';
import {
  SchoolThemeProvider,
  useResolvedSchoolTheme,
} from '@/components/school-erp/school-theme-provider';
import { useSchoolThemeStore } from '@/store/school-theme-store';
import { cn } from '@/utils/cn';
import type { SchoolSisPortalKind } from '@/lib/school-sis/portal-access';
import { isPortalNavActive, portalNavFor, type PortalNavItem } from '@/lib/school-sis/portal-nav';
import { asList, asRecord, asText } from './portal-utils';
import { PortalAvatar } from './portal-widgets';
import {
  PortalDataProvider,
  portalDisplayName,
  portalMe,
  portalStudent,
  usePortalData,
} from './portal-data';
import '../school-sis-surface.css';
import '../../school-erp/school-erp.css';
import './portal.css';

function Header({ onMenu, title }: { onMenu: () => void; title: string }) {
  const { home, childId, setChildId } = usePortalData();
  const me = portalMe(home);
  const student = portalStudent(home);
  const children = asList(me.children).map(asRecord);
  const look = useQuery({
    queryKey: ['school-appearance-published'],
    queryFn: fetchPublishedAppearance,
    staleTime: 60_000,
  });
  const boot = useQuery({
    queryKey: ['school-portal-bootstrap'],
    queryFn: fetchSchoolPortalBootstrap,
    staleTime: 60_000,
  });
  const unread = Number(home?.unreadCount ?? 0);
  const storeUrl =
    asText(boot.data?.androidStoreUrl, '') || asText(boot.data?.iosStoreUrl, '') || '';
  const logo = look.data?.logoUrl || SCHOOL_SIS_LOGO_SRC;
  const schoolName = asText(asRecord(home?.site).displayName, "St. Luke's Secondary School");

  return (
    <header className="portal-header">
      <button
        type="button"
        className="rounded-lg p-2 text-[var(--heading,#0f172a)] lg:hidden"
        aria-label="Open menu"
        onClick={onMenu}
      >
        <Menu className="h-5 w-5" />
      </button>
      <BrandingLogoImage src={logo} alt={schoolName} className="h-9 w-9 object-contain" />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[var(--heading,#0f172a)]">{schoolName}</p>
        <p className="truncate text-[0.7rem] uppercase tracking-[0.14em] text-[var(--muted-foreground,#64748b)]">
          {title} portal
        </p>
      </div>
      {title === 'Staff' ? (
        <label className="sls-dash-search">
          <Search className="h-4 w-4" />
          <input type="search" placeholder="Search students, classes, notices..." />
        </label>
      ) : (
        <div className="min-w-0 flex-1" />
      )}
      {children.length > 1 ? (
        <select
          className="hidden h-9 max-w-[10rem] rounded-lg border border-[var(--border-color,#e2e8f0)] bg-[var(--control-background,#fff)] px-2 text-xs sm:block"
          value={childId || asText(me.activeStudentId, '')}
          onChange={(e) => setChildId(e.target.value || null)}
        >
          {children.map((child) => (
            <option key={asText(child.studentId)} value={asText(child.studentId)}>
              {asText(child.fullName)}
            </option>
          ))}
        </select>
      ) : null}
      {storeUrl ? (
        <a
          href={storeUrl}
          className="hidden items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[var(--school-erp-primary,#1a365d)] sm:inline-flex"
        >
          <Smartphone className="h-3.5 w-3.5" />
          Open mobile app
        </a>
      ) : null}
      <Link
        href={
          title === 'Student'
            ? '/school-sis-portal/student/notifications'
            : title === 'Staff'
              ? '/school-sis-portal/staff/messages'
              : '/school-sis-portal/principal/communication'
        }
        className="relative rounded-lg p-2"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 ? (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[var(--danger,#e11d48)]" />
        ) : null}
      </Link>
      {title === 'Staff' ? (
        <div className="hidden text-right sm:block">
          <p className="truncate text-sm font-semibold text-[var(--heading,#0f172a)]">
            {portalDisplayName(home)}
          </p>
          <p className="truncate text-[0.7rem] text-[var(--muted-foreground,#64748b)]">
            {asText(asRecord(me.staff).designation, 'Teacher')}
          </p>
        </div>
      ) : null}
      <PortalAvatar
        src={asText(student.photoUrl || asRecord(me.staff).photoUrl, '') || null}
        name={portalDisplayName(home)}
        size={36}
      />
    </header>
  );
}

function NavLinks({ items, onClick }: { items: PortalNavItem[]; onClick?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="space-y-0.5 px-2">
      {items.map((item) => {
        const Icon = item.icon;
        const active = isPortalNavActive(pathname, item.href, item.exact);
        return (
          <Link
            key={item.id}
            href={item.href}
            onClick={onClick}
            className={cn('portal-nav-link', active && 'is-active')}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

function Sidebar({
  groups,
  open,
  onClose,
}: {
  groups: ReturnType<typeof portalNavFor>['groups'];
  open?: boolean;
  onClose?: () => void;
}) {
  const clear = useAuthStore((s) => s.clear);
  const inner = (
    <>
      <div className="flex items-center justify-between px-4 py-3 lg:hidden">
        <p className="text-sm font-semibold">Menu</p>
        <button type="button" onClick={onClose} aria-label="Close menu">
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex-1 space-y-4 py-3">
        {groups.map((group) => (
          <div key={group.id}>
            <p className="px-4 pb-1 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[var(--muted-foreground,#64748b)]">
              {group.label}
            </p>
            <NavLinks items={group.items} onClick={onClose} />
          </div>
        ))}
      </nav>
      <button
        type="button"
        className="m-3 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-[var(--danger,#be123c)]"
        onClick={async () => {
          tokenRefreshManager.clearSchedule();
          clear();
          await logout().catch(() => undefined);
          window.location.assign('/login');
        }}
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </>
  );
  if (open) {
    return (
      <aside className="fixed inset-y-0 left-0 z-50 flex w-[min(20rem,88vw)] flex-col border-r border-[var(--border-color,#e2e8f0)] bg-[var(--sidebar-background,#fff)] lg:hidden">
        {inner}
      </aside>
    );
  }
  return <aside className="portal-sidebar">{inner}</aside>;
}

function BottomNav({ items }: { items: PortalNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="portal-bottom" aria-label="Mobile navigation">
      {items.map((item) => {
        const Icon = item.icon;
        const active = isPortalNavActive(pathname, item.href, item.exact);
        return (
          <Link
            key={item.id}
            href={item.href}
            className={cn(
              'flex min-h-11 flex-col items-center justify-center gap-0.5 text-[0.65rem] font-semibold',
              active
                ? 'text-[var(--school-erp-primary,#1a365d)]'
                : 'text-[var(--muted-foreground,#64748b)]',
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function PortalChrome({
  kind,
  children,
}: {
  kind: Exclude<SchoolSisPortalKind, 'admin' | 'none'>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { groups, bottom, title } = portalNavFor(kind);
  const authed = Boolean(useAuth().session?.accessToken);
  const look = useQuery({
    queryKey: ['school-appearance-published'],
    queryFn: fetchPublishedAppearance,
    enabled: authed,
    staleTime: 0,
  });
  const setPublishedTheme = useSchoolThemeStore((s) => s.setPublished);
  const { vars, mode } = useResolvedSchoolTheme(look.data?.config, look.data?.theme);
  const customCss =
    look.data?.customCss && !/<\/style/i.test(look.data.customCss) ? look.data.customCss : '';

  useEffect(() => {
    if (!look.data?.config) return;
    setPublishedTheme(
      look.data.config,
      look.data.theme,
      (look.data.mode as 'light' | 'dark' | 'system') || 'system',
    );
  }, [look.data, setPublishedTheme]);

  return (
    <SchoolThemeProvider enabled config={look.data?.config} themeId={look.data?.theme}>
      <div
        className={cn('school-erp-shell is-sls school-sis-portal', mode === 'dark' && 'is-dark')}
        style={vars}
      >
        {customCss ? <style>{customCss}</style> : null}
        <div className="portal-shell">
          <Header onMenu={() => setOpen(true)} title={title} />
          <div className="portal-body">
            <Sidebar groups={groups} />
            {open ? (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-40 bg-black/30 lg:hidden"
                  aria-label="Close navigation"
                  onClick={() => setOpen(false)}
                />
                <Sidebar groups={groups} open onClose={() => setOpen(false)} />
              </>
            ) : null}
            <main className="portal-main" key={pathname}>
              {children}
            </main>
          </div>
          <BottomNav items={bottom} />
        </div>
      </div>
    </SchoolThemeProvider>
  );
}

export function PortalLayout({
  kind,
  children,
}: {
  kind: Exclude<SchoolSisPortalKind, 'admin' | 'none'>;
  children: React.ReactNode;
}) {
  return (
    <PortalDataProvider>
      <PortalChrome kind={kind}>{children}</PortalChrome>
    </PortalDataProvider>
  );
}

export { Header as PortalHeader, Sidebar as PortalSidebar, BottomNav as PortalBottomNavigation };
