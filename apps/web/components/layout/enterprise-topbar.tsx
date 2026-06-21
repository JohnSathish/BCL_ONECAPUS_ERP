'use client';

import { useRouter } from 'next/navigation';
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, Search, Settings, User } from 'lucide-react';
import { CampusSwitcher } from '@/components/dashboard/campus-switcher';
import { CommandPalette } from '@/components/dashboard/command-palette';
import { NotificationPanel } from '@/components/dashboard/notification-panel';
import { AcademicContextStrip } from '@/components/layout/academic-context-strip';
import { QuickCreateMenu } from '@/components/layout/quick-create-menu';
import { LicenseStatusBadge } from '@/components/licensing/license-status-badge';
import { ThemeToggle } from '@/components/theme-toggle';
import { StudentUserMenu } from '@/components/student-portal/layout/student-user-menu';
import { StaffUserMenu } from '@/components/staff-portal/layout/staff-user-menu';
import { StaffPortalAvatar } from '@/components/staff-portal/layout/staff-portal-avatar';
import { useStaffMe } from '@/components/staff-portal/hooks/use-staff-dashboard';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { broadcastSessionMessage } from '@/lib/auth/session-broadcast';
import { tokenRefreshManager } from '@/lib/auth/token-refresh-manager';
import { logout } from '@/services/auth';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { useDashboardUiStore } from '@/store/dashboard-ui-store';
import { useNavPreferencesStore } from '@/store/nav-preferences-store';
import { cn } from '@/utils/cn';

export function EnterpriseTopbar({
  title,
  portalRole,
}: {
  title?: string;
  portalRole?: 'student' | 'staff' | 'admin' | 'shift';
}) {
  const router = useRouter();
  const authReady = useAuthQueryEnabled();
  const session = useAuthStore((s) => s.session);
  const sidebarCollapsed = useDashboardUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useDashboardUiStore((s) => s.toggleSidebar);
  const toggleMobileNavOpen = useDashboardUiStore((s) => s.toggleMobileNavOpen);
  const showQuickCreate = useNavPreferencesStore((s) => s.sidebarLayout.showQuickCreate);

  const handleLogout = async () => {
    broadcastSessionMessage({ type: 'LOGOUT' });
    tokenRefreshManager.clearSchedule();
    useAuthStore.getState().clear();
    try {
      await logout();
    } catch {
      /* ignore */
    }
    router.replace('/login');
  };

  const displayName = session?.user.email?.split('@')[0] ?? 'Admin';
  const staffMeQ = useStaffMe({ enabled: portalRole === 'staff' });
  const staffProfile = staffMeQ.data;

  const staffDisplayName = staffProfile?.fullName ?? displayName;
  const staffInstitution =
    staffProfile?.institutionName ?? staffProfile?.campusName ?? 'Staff Portal';

  return (
    <header
      className={cn(
        'z-30 flex h-16 min-h-16 w-full max-w-full shrink-0 items-center overflow-hidden border-b border-border/60 px-4 shadow-sm backdrop-blur-xl sm:px-5 lg:px-6',
        portalRole === 'staff'
          ? 'bg-gradient-to-r from-primary/10 via-topbar/90 to-accent/10 md:bg-topbar/85'
          : 'bg-topbar/85',
      )}
    >
      <div className="flex w-full min-w-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={toggleMobileNavOpen}
          className="inline-flex shrink-0 items-center justify-center rounded-xl border border-border/80 bg-card/80 p-2.5 text-muted-foreground backdrop-blur transition hover:bg-muted/50 hover:text-foreground md:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={toggleSidebar}
          className={cn(
            'hidden shrink-0 items-center gap-2 rounded-xl border border-border/80 bg-card/80 px-2.5 py-2 text-sm text-muted-foreground backdrop-blur transition hover:bg-muted/50 hover:text-foreground md:inline-flex',
            sidebarCollapsed && 'border-primary/40 bg-primary/5 text-primary',
          )}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
          <span className="hidden lg:inline">{sidebarCollapsed ? 'Expand menu' : 'Collapse'}</span>
        </button>

        <div className="min-w-0 shrink">
          {portalRole === 'staff' && staffProfile ? (
            <div className="flex min-w-0 items-center gap-2.5 md:hidden">
              <StaffPortalAvatar
                photoUrl={staffProfile.photoUrl}
                name={staffDisplayName}
                size="md"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-tight">{staffInstitution}</p>
                <p className="truncate text-xs font-medium text-foreground">{staffDisplayName}</p>
                {staffProfile.designation ? (
                  <p className="truncate text-[11px] text-muted-foreground">
                    {staffProfile.designation}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
          {title && portalRole !== 'staff' ? (
            <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg md:text-xl">
              {title}
            </h1>
          ) : title ? (
            <h1 className="hidden truncate text-base font-semibold tracking-tight sm:text-lg md:block md:text-xl">
              {title}
            </h1>
          ) : null}
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <AcademicContextStrip />
            <LicenseStatusBadge className="hidden sm:inline-flex" />
          </div>
        </div>

        <div className="relative hidden min-w-0 max-w-[280px] flex-1 lg:block xl:max-w-[320px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            readOnly
            onFocus={() =>
              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
            }
            placeholder="Ask OneCampus AI…"
            className="h-9 w-full min-w-0 cursor-pointer rounded-xl border-border/80 bg-card/60 pl-9 text-sm backdrop-blur"
            aria-label="Open AI search"
          />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          {portalRole === 'admin' && showQuickCreate ? <QuickCreateMenu /> : null}
          <CommandPalette />
          <CampusSwitcher />
          {authReady ? <NotificationPanel /> : null}
          <ThemeToggle />

          {portalRole === 'student' ? (
            <StudentUserMenu displayName={displayName} email={session?.user.email} />
          ) : portalRole === 'staff' ? (
            <StaffUserMenu
              fullName={staffDisplayName}
              designation={staffProfile?.designation}
              photoUrl={staffProfile?.photoUrl}
              email={staffProfile?.email ?? session?.user.email}
              compact
            />
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex shrink-0 items-center gap-2 rounded-xl border border-border/80 bg-card/80 px-2 py-1.5 backdrop-blur transition hover:bg-muted/50"
                  aria-label="User menu"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-xs font-bold text-primary-foreground">
                    {displayName.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="hidden max-w-[100px] truncate text-sm font-medium md:inline">
                    {displayName}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>
                  <p className="font-medium">{displayName}</p>
                  <p className="text-xs font-normal text-muted-foreground">{session?.user.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" /> Profile
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" /> Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-danger focus:text-danger">
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
