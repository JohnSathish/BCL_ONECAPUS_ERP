'use client';

import { useState } from 'react';
import { PoweredByBaseCodeLabs } from '@/components/branding/powered-by-basecode-labs';
import { SchoolErpSidebar } from './school-erp-sidebar';
import { SchoolErpTopbar } from './school-erp-topbar';
import './school-erp.css';

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

  return (
    <div className="school-erp-shell">
      <SchoolErpTopbar onMenu={() => setMobileOpen(true)} />

      <div className="school-erp-body">
        <div className="school-erp-sidebar-slot hidden lg:flex">
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
            <div className="school-erp-main-inner">{children}</div>
            <footer className="school-erp-page-footer">
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
                <span>© {new Date().getFullYear()} Tura Public School, Tura · School ERP v1.0</span>
                <span className="hidden text-slate-300 sm:inline">|</span>
                <PoweredByBaseCodeLabs className="text-[var(--school-erp-primary)] underline" />
              </div>
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}
