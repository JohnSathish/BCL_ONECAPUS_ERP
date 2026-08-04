'use client';

import { PrincipalFab } from '@/components/principal-desk/layout/principal-fab';
import { PrincipalSidebar } from '@/components/principal-desk/layout/principal-sidebar';
import { PrincipalTopbar } from '@/components/principal-desk/layout/principal-topbar';
import { SIDEBAR_WIDTH } from '@/lib/sidebar-layout';
import { useDashboardUiStore } from '@/store/dashboard-ui-store';
import { cn } from '@/utils/cn';

export function PrincipalPortalShell({ children }: { children: React.ReactNode }) {
  const collapsed = useDashboardUiStore((s) => s.sidebarCollapsed);

  return (
    <div className="flex h-screen w-full max-w-full overflow-hidden bg-[#F8FAFC] dark:bg-background">
      <PrincipalSidebar />
      <div
        className={cn(
          'relative z-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden transition-[padding] duration-200',
          collapsed ? 'md:pl-[72px]' : 'md:pl-[260px] lg:pl-[280px]',
        )}
        style={
          {
            // keep in sync with SIDEBAR_WIDTH constants
            ['--principal-sidebar' as string]: collapsed
              ? `${SIDEBAR_WIDTH.collapsed}px`
              : `${SIDEBAR_WIDTH.desktop}px`,
          } as React.CSSProperties
        }
      >
        <PrincipalTopbar />
        <main className="relative z-0 min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain">
          {children}
        </main>
        <PrincipalFab />
      </div>
    </div>
  );
}
