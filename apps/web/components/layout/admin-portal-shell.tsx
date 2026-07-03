'use client';

import { EnterpriseSidebar } from '@/components/layout/enterprise-sidebar';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { WorkspaceThemeEffect } from '@/components/layout/workspace-theme-effect';
import { useDashboardUiStore } from '@/store/dashboard-ui-store';
import { cn } from '@/utils/cn';

/** Persistent admin chrome — sidebar mounts once per admin session. */
export function AdminPortalShell({ children }: { children: React.ReactNode }) {
  const collapsed = useDashboardUiStore((s) => s.sidebarCollapsed);

  return (
    <div className="flex h-dvh max-h-dvh w-full max-w-full overflow-hidden bg-background">
      <WorkspaceThemeEffect />
      <EnterpriseSidebar role="admin" />
      <div
        className={cn(
          'relative z-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
          collapsed ? 'md:pl-[72px]' : 'md:pl-[260px] lg:pl-[280px]',
        )}
      >
        {/* Bounded flex child so page shells (DashboardShell) can scroll internally. */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
        <MobileBottomNav />
      </div>
    </div>
  );
}
