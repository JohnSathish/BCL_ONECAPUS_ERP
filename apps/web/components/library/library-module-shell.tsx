'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent, type ReactNode } from 'react';
import {
  BookMarked,
  BookOpen,
  ChevronDown,
  CircleHelp,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  Monitor,
  BarChart3,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { NotificationPanel } from '@/components/dashboard/notification-panel';
import { LicenseAlertBanner } from '@/components/licensing/license-alert-banner';
import { LicenseWriteBlockedBanner } from '@/components/licensing/license-write-blocked-banner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useInstitutionBranding } from '@/hooks/use-institution-branding';
import { usePermissions } from '@/hooks/use-permissions';
import { logoutClientSide } from '@/lib/auth/client-logout';
import { useAuthStore } from '@/store/auth-store';
import { cn } from '@/utils/cn';

type NavChild = { label: string; href: string; icon: LucideIcon; permissions: string[] };
type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  permissions: string[];
  exact?: boolean;
  children?: NavChild[];
};

const NAV: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/admin/library',
    icon: LayoutDashboard,
    permissions: [],
    exact: true,
  },
  {
    label: 'Books',
    href: '/admin/library/catalogue',
    icon: BookOpen,
    permissions: ['library:read', 'library:manage'],
  },
  {
    label: 'Members',
    href: '/admin/library/members',
    icon: Users,
    permissions: ['library:read', 'library:manage'],
  },
  {
    label: 'Circulation',
    href: '/admin/library/circulation',
    icon: RefreshCw,
    permissions: ['library:circulate', 'library:manage'],
    children: [
      {
        label: 'Issue Book',
        href: '/admin/library/circulation?tab=issue',
        icon: BookOpen,
        permissions: ['library:circulate', 'library:manage'],
      },
      {
        label: 'Return Book',
        href: '/admin/library/circulation?tab=return',
        icon: RotateCcw,
        permissions: ['library:circulate', 'library:manage'],
      },
      {
        label: 'Renew Book',
        href: '/admin/library/circulation?tab=renew',
        icon: RefreshCw,
        permissions: ['library:circulate', 'library:manage'],
      },
      {
        label: 'Reservations',
        href: '/admin/library/reservations',
        icon: BookMarked,
        permissions: ['library:circulate', 'library:manage'],
      },
    ],
  },
  {
    label: 'Reports',
    href: '/admin/library/reports',
    icon: BarChart3,
    permissions: ['library:reports', 'library:manage'],
  },
  {
    label: 'Digital Library',
    href: '/admin/library/digital',
    icon: Monitor,
    permissions: ['library:digital:read', 'library:digital:manage'],
  },
  {
    label: 'Catalog / OPAC',
    href: '/admin/library/opac',
    icon: BookMarked,
    permissions: ['library:manage'],
  },
  {
    label: 'Settings',
    href: '/admin/library/settings',
    icon: Settings,
    permissions: ['library:settings', 'library:manage'],
  },
];

function roleLabel(roles: string[]) {
  const role = roles[0];
  if (!role) return 'Librarian';
  return role
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function pathOf(href: string) {
  return href.split('?')[0] ?? href;
}

export function LibraryModuleShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const searchParams = useSearchParams();
  const router = useRouter();
  const { canAny } = usePermissions();
  const session = useAuthStore((s) => s.session);
  const { branding } = useInstitutionBranding();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [circulationOpen, setCirculationOpen] = useState(
    pathname.startsWith('/admin/library/circulation') ||
      pathname.startsWith('/admin/library/reservations'),
  );
  const [query, setQuery] = useState('');

  const collegeName = branding?.displayName?.trim() || 'Don Bosco College, Tura';
  const displayName =
    session?.user.displayName?.trim() || session?.user.email?.split('@')[0] || 'Librarian';
  const initials = displayName.slice(0, 2).toUpperCase();
  const visible = NAV.filter((item) => !item.permissions.length || canAny(...item.permissions));

  function active(href: string, exact = false) {
    const path = pathOf(href);
    if (exact) return pathname === path;
    return pathname === path || pathname.startsWith(`${path}/`);
  }

  function search(event: FormEvent) {
    event.preventDefault();
    const term = query.trim();
    router.push(
      term
        ? `/admin/library/catalogue?search=${encodeURIComponent(term)}`
        : '/admin/library/catalogue',
    );
    setMobileOpen(false);
  }

  const sidebar = (mode: 'dock' | 'drawer') => (
    <aside
      className={cn(
        'flex h-full flex-col bg-[#071B45] text-white',
        mode === 'dock' ? (collapsed ? 'w-[76px]' : 'w-[248px]') : 'w-[280px]',
      )}
    >
      <div
        className={cn('flex items-center gap-3 px-4 py-4', collapsed && mode === 'dock' && 'px-3')}
      >
        {branding?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={branding.logoUrl}
            alt=""
            className="h-10 w-10 shrink-0 rounded-xl bg-white object-contain p-1"
          />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#155EEF]">
            <Library className="h-5 w-5" />
          </span>
        )}
        {collapsed && mode === 'dock' ? null : (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">{collegeName}</p>
            <p className="truncate text-[11px] text-blue-100/80">Library Management</p>
          </div>
        )}
      </div>
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-3">
        {visible.map((item) => {
          const Icon = item.icon;
          const on = active(item.href, item.exact);
          const children = (item.children ?? []).filter(
            (child) => !child.permissions.length || canAny(...child.permissions),
          );
          return (
            <div key={item.label}>
              <div className="flex items-center gap-1">
                <Link
                  href={item.href}
                  title={item.label}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-blue-50/90 transition hover:bg-white/10',
                    on &&
                      'bg-gradient-to-r from-[#155EEF] to-[#3B82F6] text-white shadow-lg shadow-blue-900/30',
                    collapsed && mode === 'dock' && 'justify-center px-0',
                  )}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  {collapsed && mode === 'dock' ? null : (
                    <span className="truncate">{item.label}</span>
                  )}
                </Link>
                {children.length && !(collapsed && mode === 'dock') ? (
                  <button
                    type="button"
                    className="rounded-lg p-2 text-blue-100/80 hover:bg-white/10"
                    aria-label={`${circulationOpen ? 'Hide' : 'Show'} ${item.label}`}
                    onClick={() => setCirculationOpen((open) => !open)}
                  >
                    <ChevronDown
                      className={cn('h-4 w-4 transition', circulationOpen && 'rotate-180')}
                    />
                  </button>
                ) : null}
              </div>
              {children.length && circulationOpen && !(collapsed && mode === 'dock') ? (
                <div className="ml-4 mt-1 space-y-1 border-l border-white/10 pl-3">
                  {children.map((child) => {
                    const ChildIcon = child.icon;
                    const [childPath, childQuery] = child.href.split('?');
                    const childOn = childQuery
                      ? pathname === childPath &&
                        childQuery.split('&').every((part) => {
                          const [key, value] = part.split('=');
                          return searchParams.get(key ?? '') === value;
                        })
                      : active(child.href);
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          'flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-blue-100/80 hover:bg-white/10 hover:text-white',
                          childOn && 'bg-white/10 text-white',
                        )}
                      >
                        <ChildIcon className="h-3.5 w-3.5" />
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
      {collapsed && mode === 'dock' ? null : (
        <div className="px-4 pb-4" aria-hidden>
          <ShelfArt />
        </div>
      )}
    </aside>
  );

  return (
    <div className="flex h-full min-h-0 bg-[#F4F7FC] text-slate-900">
      <div className="hidden h-full shrink-0 md:block">{sidebar('dock')}</div>
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/50"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative h-full w-[280px] shadow-2xl">{sidebar('drawer')}</div>
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-slate-200/80 bg-white/95 px-3 backdrop-blur sm:px-4">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 md:hidden"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="hidden h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 md:inline-flex"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
          <form onSubmit={search} className="min-w-0 flex-1">
            <label className="relative block">
              <span className="sr-only">Search the library</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by Book Title, Author, Accession No. or ISBN..."
                className="h-9 w-full rounded-xl border border-slate-200 bg-[#F4F7FC] pl-9 pr-3 text-sm outline-none ring-[#155EEF] placeholder:text-slate-400 focus:ring-2"
              />
            </label>
          </form>
          <NotificationPanel />
          <Link
            href="/admin/library/search"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
            aria-label="Help and catalogue search"
            title="Catalogue search"
          >
            <CircleHelp className="h-4 w-4" />
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white py-1 pl-1 pr-2 hover:bg-slate-50"
                aria-label="Account menu"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#155EEF] text-xs font-semibold text-white">
                  {initials}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block max-w-[120px] truncate text-xs font-semibold leading-tight">
                    {displayName}
                  </span>
                  <span className="block text-[10px] text-slate-500">
                    {roleLabel(session?.user.roles ?? [])}
                  </span>
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <p className="font-medium">{displayName}</p>
                <p className="text-xs font-normal text-slate-500">{session?.user.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {canAny('library:settings', 'library:manage') ? (
                <DropdownMenuItem asChild>
                  <Link href="/admin/library/settings">
                    <Settings className="mr-2 h-4 w-4" /> Library settings
                  </Link>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem asChild>
                <Link href="/admin">
                  <LayoutDashboard className="mr-2 h-4 w-4" /> College ERP
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => logoutClientSide(router)}>
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <LicenseAlertBanner />
        <LicenseWriteBlockedBanner />
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function ShelfArt() {
  return (
    <svg viewBox="0 0 220 92" className="w-full text-blue-200/80">
      <rect x="18" y="70" width="184" height="6" rx="2" fill="currentColor" opacity="0.35" />
      <rect x="28" y="28" width="22" height="42" rx="2" fill="#60A5FA" />
      <rect x="54" y="18" width="18" height="52" rx="2" fill="#34D399" />
      <rect x="76" y="34" width="26" height="36" rx="2" fill="#FBBF24" />
      <rect x="106" y="22" width="16" height="48" rx="2" fill="#F472B6" />
      <rect x="126" y="30" width="24" height="40" rx="2" fill="#A78BFA" />
      <rect x="154" y="16" width="20" height="54" rx="2" fill="#FB7185" />
    </svg>
  );
}
