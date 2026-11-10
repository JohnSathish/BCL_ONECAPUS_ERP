'use client';

import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { EnterpriseSidebar } from '@/components/layout/enterprise-sidebar';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { WorkspaceThemeEffect } from '@/components/layout/workspace-theme-effect';
import { LibraryModuleShell } from '@/components/library/library-module-shell';
import { useDashboardUiStore } from '@/store/dashboard-ui-store';
import { LibraryQpReadonlyNotice } from '@/components/permissions/library-qp-readonly-notice';
import { cn } from '@/utils/cn';

/** Persistent admin chrome — sidebar mounts once per admin session. */
export function AdminPortalShell({ children }: { children: React.ReactNode }) {
  const collapsed = useDashboardUiStore((s) => s.sidebarCollapsed);
  const pathname = usePathname();
  const isTimetablePrint = pathname?.startsWith('/admin/academics/timetable/print');
  const libraryModule = pathname?.startsWith('/admin/library');

  if (libraryModule) {
    return (
      <div className="h-dvh max-h-dvh w-full overflow-hidden bg-[#F4F7FC]">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
        >
          Skip to main content
        </a>
        <WorkspaceThemeEffect />
        <Suspense fallback={<div className="h-dvh bg-[#F4F7FC]" />}>
          <LibraryModuleShell>
            <LibraryQpReadonlyNotice />
            <div id="main-content" tabIndex={-1} className="outline-none">
              {children}
            </div>
          </LibraryModuleShell>
        </Suspense>
      </div>
    );
  }

  // Dedicated print tab: no sidebar / bottom nav / viewport clip so all periods print.
  if (isTimetablePrint) {
    return (
      <div className="min-h-dvh w-full bg-background">
        <WorkspaceThemeEffect />
        {children}
      </div>
    );
  }

  return (
    <div className="flex h-dvh max-h-dvh w-full max-w-full overflow-hidden bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>
      <WorkspaceThemeEffect />
      <EnterpriseSidebar role="admin" />
      <div
        className={cn(
          'relative z-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
          collapsed ? 'md:pl-[72px]' : 'md:pl-[260px] lg:pl-[280px]',
        )}
      >
        <div
          id="main-content"
          tabIndex={-1}
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden outline-none"
        >
          <LibraryQpReadonlyNotice />
          {children}
        </div>
        <MobileBottomNav />
      </div>
    </div>
  );
}
