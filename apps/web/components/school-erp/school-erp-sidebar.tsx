'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, LogOut, Minus, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  SCHOOL_ERP_NAV,
  SCHOOL_ERP_SESSION_LABEL,
  isSchoolErpNavActive,
  type SchoolErpNavLink,
  type SchoolErpNavModule,
} from '@/lib/school-erp/nav';
import { isSecondarySchoolSisSession, SCHOOL_SIS_LOGO_SRC } from '@/lib/school-erp/product';
import { SCHOOL_SIS_NAV_GROUPS } from '@/lib/school-sis/nav';
import { filterSchoolSisNavGroups } from '@/lib/school-sis/permissions';
import { filterSchoolErpNavForRole } from '@/lib/school-erp/permissions';
import { SCHOOL_PORTAL_LOGO_SRC } from '@/lib/school-admissions-branding';
import { useAuthStore } from '@/store/auth-store';
import { useBranding } from '@/hooks/use-branding';
import { logoutClientSide } from '@/lib/auth/client-logout';
import { useRouter } from 'next/navigation';
import { fetchSchoolSisOverview } from '@/services/school-sis';
import { useQuery } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { SchoolErpComingSoonBadge } from './school-erp-ui';
import { cn } from '@/utils/cn';

function NestedChildren({
  items,
  pathname,
  onNavigate,
  light,
}: {
  items: SchoolErpNavLink[];
  pathname: string | null;
  onNavigate?: () => void;
  light?: boolean;
}) {
  return (
    <div
      className={cn(
        'mt-0.5 space-y-0.5 pl-2',
        light ? 'border-l border-slate-200' : 'border-l border-white/10',
      )}
    >
      {items.map((child) => {
        const active = isSchoolErpNavActive(pathname, child.href);
        if (child.status === 'active' && child.href) {
          return (
            <Link
              key={child.id}
              href={child.href}
              className={cn('school-erp-nav-child text-[12px]', active && 'is-active')}
              onClick={onNavigate}
            >
              <span>{child.label}</span>
            </Link>
          );
        }
        return (
          <div key={child.id} className="school-erp-nav-child is-disabled opacity-70 text-[12px]">
            <span>{child.label}</span>
            <SchoolErpComingSoonBadge compact tone={light ? 'light' : 'dark'} />
          </div>
        );
      })}
    </div>
  );
}

function ExpandGlyph({ open, light }: { open: boolean; light?: boolean }) {
  if (light) {
    return open ? (
      <Minus className="h-3.5 w-3.5 shrink-0 text-slate-400" />
    ) : (
      <Plus className="h-3.5 w-3.5 shrink-0 text-slate-400" />
    );
  }
  return (
    <ChevronDown
      className={cn('h-3.5 w-3.5 shrink-0 opacity-70 transition', open && 'rotate-180')}
    />
  );
}

function NavChildItem({
  child,
  pathname,
  onNavigate,
  light,
}: {
  child: SchoolErpNavLink;
  pathname: string | null;
  onNavigate?: () => void;
  light?: boolean;
}) {
  const nestedActive = child.children?.some((c) => isSchoolErpNavActive(pathname, c.href));
  const active = isSchoolErpNavActive(pathname, child.href) || Boolean(nestedActive);
  const [open, setOpen] = useState(active);

  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  if (child.children?.length) {
    return (
      <div>
        <button
          type="button"
          className={cn('school-erp-nav-child w-full justify-between', active && 'is-active')}
          onClick={() => setOpen((v) => !v)}
        >
          <span>{child.label}</span>
          <ExpandGlyph open={open} light={light} />
        </button>
        {open ? (
          <NestedChildren
            items={child.children}
            pathname={pathname}
            onNavigate={onNavigate}
            light={light}
          />
        ) : null}
      </div>
    );
  }

  if (child.status === 'active' && child.href) {
    return (
      <Link
        href={child.href}
        className={cn('school-erp-nav-child', active && 'is-active')}
        onClick={onNavigate}
      >
        <span>{child.label}</span>
      </Link>
    );
  }

  return (
    <div className="school-erp-nav-child is-disabled opacity-70">
      <span>{child.label}</span>
      <SchoolErpComingSoonBadge compact tone={light ? 'light' : 'dark'} />
    </div>
  );
}

function ModuleBlock({
  module,
  pathname,
  onNavigate,
  light,
}: {
  module: SchoolErpNavModule;
  pathname: string | null;
  onNavigate?: () => void;
  light?: boolean;
}) {
  const Icon = module.icon;
  const childActive = module.children?.some(
    (c) =>
      isSchoolErpNavActive(pathname, c.href) ||
      c.children?.some((n) => isSchoolErpNavActive(pathname, n.href)),
  );
  const selfActive = isSchoolErpNavActive(pathname, module.href) || Boolean(childActive);
  const [open, setOpen] = useState(selfActive || (!light && Boolean(module.primary)));

  useEffect(() => {
    if (selfActive) setOpen(true);
  }, [selfActive]);

  const isComingSoonRoot =
    module.status === 'coming_soon' && !module.children?.some((c) => c.status === 'active');

  return (
    <div className="mb-0.5">
      {module.children?.length ? (
        <button
          type="button"
          className={cn(
            'school-erp-nav-link w-full',
            selfActive && 'is-active',
            isComingSoonRoot && 'is-disabled',
            !light && module.primary && 'ring-1 ring-[#c5a572]/35',
          )}
          onClick={() => setOpen((v) => !v)}
        >
          <Icon className="h-4 w-4 shrink-0 opacity-90" />
          <span className="min-w-0 flex-1 text-left">{module.label}</span>
          {module.status === 'coming_soon' ? (
            <SchoolErpComingSoonBadge compact tone={light ? 'light' : 'dark'} />
          ) : null}
          <ExpandGlyph open={open} light={light} />
        </button>
      ) : module.href && module.status === 'active' ? (
        <Link
          href={module.href}
          className={cn('school-erp-nav-link', selfActive && 'is-active')}
          onClick={onNavigate}
        >
          <Icon className="h-4 w-4 shrink-0 opacity-90" />
          <span className="min-w-0 flex-1">{module.label}</span>
        </Link>
      ) : (
        <div className="school-erp-nav-link is-disabled">
          <Icon className="h-4 w-4 shrink-0 opacity-90" />
          <span className="min-w-0 flex-1">{module.label}</span>
          <SchoolErpComingSoonBadge compact tone={light ? 'light' : 'dark'} />
        </div>
      )}

      {module.children?.length && open ? (
        <div className="mt-0.5 space-y-0.5 pb-1">
          {module.children.map((child) => (
            <NavChildItem
              key={child.id}
              child={child}
              pathname={pathname}
              onNavigate={onNavigate}
              light={light}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function roleCaption(roles?: string[]) {
  if (!roles?.length) return 'Staff';
  const joined = roles.join(' ');
  if (/principal/i.test(joined)) return 'Principal';
  if (/admin/i.test(joined)) return 'Administrator';
  return roles[0].replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function SchoolErpSidebar({ open, onClose }: { open?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const tenantSlug = useAuthStore((s) => s.session?.user.tenantSlug);
  const user = useAuthStore((s) => s.session?.user);
  const { branding, displayName, portalSubtitle } = useBranding();
  const sis = isSecondarySchoolSisSession({
    tenantSlug,
    hostname: typeof window !== 'undefined' ? window.location.hostname : undefined,
    extras: branding?.portalExtras,
  });
  const enabled = useAuthQueryEnabled();
  const overview = useQuery({
    queryKey: ['school-sis-overview'],
    queryFn: fetchSchoolSisOverview,
    enabled: enabled && sis,
    staleTime: 60_000,
  });
  const groups = sis
    ? filterSchoolSisNavGroups(SCHOOL_SIS_NAV_GROUPS, {
        permissions: user?.permissions,
        roles: user?.roles,
        modules: overview.data?.modules,
      })
    : null;
  const nav = SCHOOL_ERP_NAV;
  const shortName = branding?.shortName || (sis ? 'SLS Tura' : 'TPS Tura');
  const schoolName =
    branding?.displayName ||
    displayName ||
    (sis ? "St. Luke's Secondary School" : 'Tura Public School');
  const sessionLabel = sis ? portalSubtitle || 'School Management' : SCHOOL_ERP_SESSION_LABEL;
  const logoSrc = branding?.logoUrl || (sis ? SCHOOL_SIS_LOGO_SRC : SCHOOL_PORTAL_LOGO_SRC);
  const [profileOpen, setProfileOpen] = useState(false);
  const display = user?.displayName?.trim() || user?.email?.split('@')[0] || 'User';

  return (
    <aside
      className={cn('school-erp-sidebar', sis && 'school-erp-sidebar--sis', open && 'is-open')}
    >
      <div className="school-erp-sidebar-brand border-b px-4 py-4">
        <div className="flex items-center gap-3">
          <img
            src={logoSrc}
            alt={schoolName}
            width={44}
            height={54}
            className="h-12 w-auto shrink-0"
          />
          <div className="min-w-0">
            {sis ? (
              <>
                <p className="truncate text-sm font-semibold leading-snug text-slate-900">
                  {schoolName}
                </p>
                <p className="truncate text-[11px] text-slate-500">School Management</p>
              </>
            ) : (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#e8d9bf]">
                  {shortName}
                </p>
                <p className="truncate text-sm font-semibold leading-snug text-white">
                  {schoolName}
                </p>
                <p className="truncate text-[11px] text-emerald-100/75">{sessionLabel}</p>
              </>
            )}
          </div>
        </div>
        {sis ? (
          <button
            type="button"
            className="school-erp-tenant-switch mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left"
            disabled
            title="This tenant is St. Luke's Secondary School"
          >
            <p className="truncate text-xs font-semibold text-slate-800">{schoolName}</p>
            <p className="truncate text-[10px] text-slate-500">School Management</p>
          </button>
        ) : null}
      </div>

      <nav className="school-erp-sidebar-nav px-3 py-3">
        {groups ? (
          groups.map((group) => (
            <div key={group.id} className="mb-3">
              <p className="school-erp-nav-group-label mb-1.5 px-2">{group.label}</p>
              {group.items.map((module) => (
                <ModuleBlock
                  key={module.id}
                  module={module}
                  pathname={pathname}
                  onNavigate={onClose}
                  light
                />
              ))}
            </div>
          ))
        ) : (
          <>
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100/55">
              Navigation
            </p>
            {filterSchoolErpNavForRole(null, nav).map((module) => (
              <ModuleBlock
                key={module.id}
                module={module}
                pathname={pathname}
                onNavigate={onClose}
              />
            ))}
          </>
        )}
      </nav>

      {sis ? (
        <div className="school-erp-sidebar-foot relative border-t border-slate-200 px-3 py-3">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-xl px-1 py-1 text-left hover:bg-slate-50"
            onClick={() => setProfileOpen((v) => !v)}
            aria-expanded={profileOpen}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-[#1a365d]">
              {display.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-slate-800">{display}</span>
              <span className="block truncate text-[10px] text-slate-500">
                {roleCaption(user?.roles)}
              </span>
            </span>
            <ChevronDown
              className={cn('h-3.5 w-3.5 text-slate-400 transition', profileOpen && 'rotate-180')}
            />
          </button>
          {profileOpen ? (
            <div className="absolute bottom-[calc(100%+0.35rem)] left-3 right-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
              <button type="button" className="school-erp-menu-item" disabled>
                My Profile
                <span className="ml-auto text-[10px] text-slate-400">Soon</span>
              </button>
              <button type="button" className="school-erp-menu-item" disabled>
                Account Settings
                <span className="ml-auto text-[10px] text-slate-400">Soon</span>
              </button>
              <button type="button" className="school-erp-menu-item" disabled>
                Change Password
                <span className="ml-auto text-[10px] text-slate-400">Use header</span>
              </button>
              <button type="button" className="school-erp-menu-item" disabled>
                Login Activity
                <span className="ml-auto text-[10px] text-slate-400">Soon</span>
              </button>
              <button
                type="button"
                className="school-erp-menu-item school-erp-menu-item-danger"
                onClick={() => logoutClientSide(router, { redirectTo: '/login' })}
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          ) : null}
          <p className="mt-2 px-1 text-[10px] leading-snug text-slate-400">
            © {new Date().getFullYear()} St. Luke&apos;s Secondary School, Tura. Knowledge · Service
            · Light.
          </p>
        </div>
      ) : (
        <div className="school-erp-sidebar-foot border-t border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <img src={logoSrc} alt="" width={28} height={34} className="h-8 w-auto opacity-90" />
            <div className="min-w-0 text-[11px] text-emerald-100/70">
              <p className="font-medium text-emerald-50/90">{schoolName}</p>
              <p className="mt-0.5">School ERP v1.0</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
