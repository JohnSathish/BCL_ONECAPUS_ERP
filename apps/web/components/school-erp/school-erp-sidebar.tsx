'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  SCHOOL_ERP_NAV,
  SCHOOL_ERP_SESSION_LABEL,
  isSchoolErpNavActive,
  type SchoolErpNavLink,
  type SchoolErpNavModule,
} from '@/lib/school-erp/nav';
import { filterSchoolErpNavForRole } from '@/lib/school-erp/permissions';
import { SCHOOL_PORTAL_LOGO_SRC } from '@/lib/school-admissions-branding';
import { SchoolErpComingSoonBadge } from './school-erp-ui';
import { cn } from '@/utils/cn';

function NestedChildren({
  items,
  pathname,
  onNavigate,
}: {
  items: SchoolErpNavLink[];
  pathname: string | null;
  onNavigate?: () => void;
}) {
  return (
    <div className="mt-0.5 space-y-0.5 border-l border-white/10 pl-2">
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
            <SchoolErpComingSoonBadge compact />
          </div>
        );
      })}
    </div>
  );
}

function NavChildItem({
  child,
  pathname,
  onNavigate,
}: {
  child: SchoolErpNavLink;
  pathname: string | null;
  onNavigate?: () => void;
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
          <ChevronDown className={cn('h-3 w-3 opacity-70 transition', open && 'rotate-180')} />
        </button>
        {open ? (
          <NestedChildren items={child.children} pathname={pathname} onNavigate={onNavigate} />
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
      <SchoolErpComingSoonBadge compact />
    </div>
  );
}

function ModuleBlock({
  module,
  pathname,
  onNavigate,
}: {
  module: SchoolErpNavModule;
  pathname: string | null;
  onNavigate?: () => void;
}) {
  const Icon = module.icon;
  const childActive = module.children?.some(
    (c) =>
      isSchoolErpNavActive(pathname, c.href) ||
      c.children?.some((n) => isSchoolErpNavActive(pathname, n.href)),
  );
  const selfActive = isSchoolErpNavActive(pathname, module.href) || Boolean(childActive);
  const [open, setOpen] = useState(selfActive || Boolean(module.primary));

  useEffect(() => {
    if (selfActive) setOpen(true);
  }, [selfActive]);

  const isComingSoonRoot =
    module.status === 'coming_soon' && !module.children?.some((c) => c.status === 'active');

  return (
    <div className="mb-1">
      {module.children?.length ? (
        <button
          type="button"
          className={cn(
            'school-erp-nav-link w-full',
            selfActive && 'is-active',
            isComingSoonRoot && 'is-disabled',
            module.primary && 'ring-1 ring-[#c5a572]/35',
          )}
          onClick={() => setOpen((v) => !v)}
        >
          <Icon className="h-4 w-4 shrink-0 opacity-90" />
          <span className="min-w-0 flex-1 text-left">{module.label}</span>
          {module.status === 'coming_soon' ? <SchoolErpComingSoonBadge compact /> : null}
          <ChevronDown
            className={cn('h-3.5 w-3.5 shrink-0 opacity-70 transition', open && 'rotate-180')}
          />
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
          <SchoolErpComingSoonBadge compact />
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
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function SchoolErpSidebar({ open, onClose }: { open?: boolean; onClose?: () => void }) {
  const pathname = usePathname();

  return (
    <aside className={cn('school-erp-sidebar', open && 'is-open')}>
      <div className="school-erp-sidebar-brand border-b border-white/10 px-4 py-4">
        <div className="flex items-center gap-3">
          <img
            src={SCHOOL_PORTAL_LOGO_SRC}
            alt="Tura Public School"
            width={44}
            height={54}
            className="h-12 w-auto shrink-0"
          />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#e8d9bf]">
              TPS Tura
            </p>
            <p className="truncate text-sm font-semibold leading-snug text-white">
              Tura Public School
            </p>
            <p className="truncate text-[11px] text-emerald-100/75">{SCHOOL_ERP_SESSION_LABEL}</p>
          </div>
        </div>
      </div>

      <nav className="school-erp-sidebar-nav px-3 py-3">
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100/55">
          Navigation
        </p>
        {filterSchoolErpNavForRole(null, SCHOOL_ERP_NAV).map((module) => (
          <ModuleBlock key={module.id} module={module} pathname={pathname} onNavigate={onClose} />
        ))}
      </nav>

      <div className="school-erp-sidebar-foot border-t border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <img
            src={SCHOOL_PORTAL_LOGO_SRC}
            alt=""
            width={28}
            height={34}
            className="h-8 w-auto opacity-90"
          />
          <div className="min-w-0 text-[11px] text-emerald-100/70">
            <p className="font-medium text-emerald-50/90">Tura Public School, Tura</p>
            <p className="mt-0.5">School ERP v1.0</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
