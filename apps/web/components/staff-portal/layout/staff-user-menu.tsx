'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  LogOut,
  Settings,
  User,
} from 'lucide-react';

import { StaffPortalAvatar } from '@/components/staff-portal/layout/staff-portal-avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { broadcastSessionMessage } from '@/lib/auth/session-broadcast';
import { tokenRefreshManager } from '@/lib/auth/token-refresh-manager';
import { logout } from '@/services/auth';
import { useAuthStore } from '@/store/auth-store';
import { cn } from '@/utils/cn';

type Props = {
  fullName: string;
  designation?: string | null;
  photoUrl?: string | null;
  email?: string | null;
  compact?: boolean;
};

export function StaffUserMenu({ fullName, designation, photoUrl, email, compact = false }: Props) {
  const router = useRouter();

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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex shrink-0 items-center gap-2 rounded-xl border border-border/80 bg-card/80 backdrop-blur transition hover:bg-muted/50',
            compact ? 'p-0.5' : 'px-2 py-1.5',
          )}
          aria-label="Staff menu"
        >
          <StaffPortalAvatar photoUrl={photoUrl} name={fullName} size={compact ? 'md' : 'sm'} />
          {!compact ? (
            <span className="hidden max-w-[100px] truncate text-sm font-medium md:inline">
              {fullName.split(' ')[0]}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <p className="font-medium">{fullName}</p>
          {designation ? (
            <p className="text-xs font-normal text-muted-foreground">{designation}</p>
          ) : null}
          {email ? <p className="text-xs font-normal text-muted-foreground">{email}</p> : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/staff/profile">
            <User className="mr-2 h-4 w-4" /> My Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/staff/academic/timetable">
            <CalendarDays className="mr-2 h-4 w-4" /> My Timetable
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/staff/academic/subjects">
            <GraduationCap className="mr-2 h-4 w-4" /> My Subjects
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/staff/attendance">
            <ClipboardList className="mr-2 h-4 w-4" /> Attendance History
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/staff/settings">
            <Settings className="mr-2 h-4 w-4" /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-danger focus:text-danger">
          <LogOut className="mr-2 h-4 w-4" /> Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
