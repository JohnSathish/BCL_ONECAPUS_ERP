'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Award,
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Megaphone,
  ScanLine,
  Users,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { useInstitutionBranding } from '@/hooks/use-institution-branding';
import { broadcastSessionMessage } from '@/lib/auth/session-broadcast';
import { tokenRefreshManager } from '@/lib/auth/token-refresh-manager';
import { logout } from '@/services/auth';
import { useAuthStore } from '@/store/auth-store';
import { cn } from '@/utils/cn';

const NAV = [
  { href: '/principal-desk', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/principal-desk/student-lookup', label: 'Student Lookup', icon: ScanLine },
  { href: '/principal-desk/staff', label: 'Staff Center', icon: Users },
  { href: '/principal-desk/attendance', label: 'Attendance', icon: ClipboardCheck },
  { href: '/principal-desk/fees', label: 'Fee Monitor', icon: Wallet },
  { href: '/principal-desk/academic', label: 'Academic', icon: BookOpen },
  { href: '/principal-desk/examinations', label: 'Examinations', icon: ClipboardList },
  { href: '/principal-desk/leave', label: 'Leave Approvals', icon: CalendarDays },
  { href: '/principal-desk/committees', label: 'Committees', icon: Building2 },
  { href: '/principal-desk/events', label: 'Events', icon: Megaphone },
  { href: '/principal-desk/notices', label: 'Notices', icon: FileText },
  { href: '/principal-desk/health', label: 'Institutional Health', icon: BarChart3 },
  { href: '/principal-desk/naac', label: 'NAAC Readiness', icon: Award },
  { href: '/principal-desk/reports', label: 'Reports', icon: GraduationCap },
];

export function PrincipalDeskNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { session } = useAuth();
  const branding = useInstitutionBranding();

  const handleLogout = async () => {
    broadcastSessionMessage({ type: 'LOGOUT' });
    tokenRefreshManager.clearSchedule();
    useAuthStore.getState().clear();
    try {
      await logout();
    } catch {
      /* ignore */
    }
    router.replace('/principal-desk/login');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md dark:border-border/60 dark:bg-card/95">
      <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-4 py-3">
        <div className="min-w-0 shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-600">
            Principal Command Center
          </p>
          <p className="truncate text-sm font-bold text-slate-900 dark:text-foreground">
            {branding.branding?.displayName ?? 'OneCampus'}
          </p>
        </div>
        <nav className="hidden flex-1 items-center gap-1 overflow-x-auto lg:flex">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname?.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                  active
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-muted-foreground dark:hover:bg-muted',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <span className="hidden text-xs text-slate-500 sm:inline">{session?.user?.email}</span>
          <Button variant="outline" size="sm" onClick={() => void handleLogout()}>
            <LogOut className="mr-1 h-3.5 w-3.5" />
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
