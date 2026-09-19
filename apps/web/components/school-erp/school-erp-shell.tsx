'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PoweredByBaseCodeLabs } from '@/components/branding/powered-by-basecode-labs';
import { useBranding } from '@/hooks/use-branding';
import { ImpersonationBanner } from '@/components/administration-module/impersonation-banner';
import { useAuthStore } from '@/store/auth-store';
import { isSecondarySchoolSisSession } from '@/lib/school-erp/product';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchPublishedAppearance } from '@/services/school-appearance';
import { appearanceCssVars } from '@/lib/school-sis/appearance-tokens';
import { cn } from '@/utils/cn';
import { SchoolErpSidebar } from './school-erp-sidebar';
import { SchoolErpTopbar } from './school-erp-topbar';
import './school-erp.css';

function SchoolErpFooterLine() {
  const { branding, displayName } = useBranding();
  const name = branding?.displayName || displayName;
  const tenantSlug = useAuthStore((s) => s.session?.user.tenantSlug);
  const sis = isSecondarySchoolSisSession({
    tenantSlug,
    hostname: typeof window !== 'undefined' ? window.location.hostname : undefined,
    extras: branding?.portalExtras,
  });
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
      <span>
        © {new Date().getFullYear()} {name}
        {sis ? ' · Knowledge · Service · Light' : ' · School ERP v1.0'}
      </span>
      <span className="hidden text-slate-300 sm:inline">|</span>
      <PoweredByBaseCodeLabs className="text-[var(--school-erp-primary)] underline" />
    </div>
  );
}

/**
 * School ERP application shell:
 * Header (fixed in column)
 * └── Body
 *     ├── Sidebar (own height; nav scrolls if needed)
 *     └── Main column (independent scroll)
 *         ├── Page content (flex: 1 — fills short viewports)
 *         └── Footer (after content; bottom of viewport when short)
 */
export function SchoolErpShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopNavCollapsed, setDesktopNavCollapsed] = useState(false);
  const { branding } = useBranding();
  const tenantSlug = useAuthStore((s) => s.session?.user.tenantSlug);
  const impersonating = useAuthStore((s) => Boolean(s.session?.user.isImpersonating));
  const sis = isSecondarySchoolSisSession({
    tenantSlug,
    hostname: typeof window !== 'undefined' ? window.location.hostname : undefined,
    extras: branding?.portalExtras,
  });
  const authed = useAuthQueryEnabled();
  const look = useQuery({
    queryKey: ['school-appearance-published'],
    queryFn: fetchPublishedAppearance,
    enabled: authed && sis,
    staleTime: 60_000,
    retry: false,
  });
  const customCss =
    look.data?.customCss && !/<\/style/i.test(look.data.customCss) ? look.data.customCss : '';

  useEffect(() => {
    const title = look.data?.config?.identity?.browserTitle;
    if (title) document.title = title;
    const fav = look.data?.faviconUrl;
    if (!fav) return;
    let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = fav;
  }, [look.data]);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const onChange = () => {
      if (desktop.matches) setMobileOpen(false);
    };
    desktop.addEventListener('change', onChange);
    return () => desktop.removeEventListener('change', onChange);
  }, []);

  const onMenu = () => {
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches && sis) {
      setDesktopNavCollapsed((open) => !open);
      return;
    }
    setMobileOpen(true);
  };

  return (
    <div
      className={cn(
        'school-erp-shell',
        sis && 'is-sls',
        sis && look.data?.sidebarPosition === 'right' && 'is-sidebar-right',
        sis && look.data?.sidebarStyle === 'glass' && 'is-sidebar-glass',
        sis && look.data?.sidebarStyle === 'compact' && 'is-sidebar-compact',
        look.data?.config?.a11y?.reducedMotion && 'motion-reduce',
      )}
      style={
        sis
          ? appearanceCssVars(look.data?.config, { sidebarWidth: look.data?.sidebarWidth })
          : undefined
      }
    >
      {sis && customCss ? <style>{customCss}</style> : null}
      <SchoolErpTopbar onMenu={onMenu} />

      <div className="school-erp-body">
        <div
          className={cn(
            'school-erp-sidebar-slot hidden lg:flex',
            sis && desktopNavCollapsed && 'is-collapsed',
          )}
        >
          <SchoolErpSidebar />
        </div>

        {mobileOpen ? (
          <>
            <button
              type="button"
              className="school-erp-backdrop lg:hidden"
              aria-label="Close navigation"
              onClick={() => setMobileOpen(false)}
            />
            <div className="lg:hidden">
              <SchoolErpSidebar open onClose={() => setMobileOpen(false)} />
            </div>
          </>
        ) : null}

        <div className="school-erp-main-column">
          <main className="school-erp-main-scroll">
            <div className="school-erp-main-inner">
              {impersonating ? (
                <div className="mb-3 px-4 pt-3">
                  <ImpersonationBanner />
                </div>
              ) : null}
              {children}
            </div>
            <footer className="school-erp-page-footer">
              <SchoolErpFooterLine />
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}
