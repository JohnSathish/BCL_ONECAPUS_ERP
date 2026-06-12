'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CreditCard, FileText, LifeBuoy, LogOut, Settings, User } from 'lucide-react';

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

type Props = {
  displayName: string;
  email?: string | null;
};

export function StudentUserMenu({ displayName, email }: Props) {
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
          className="flex shrink-0 items-center gap-2 rounded-xl border border-border/80 bg-card/80 px-2 py-1.5 backdrop-blur transition hover:bg-muted/50"
          aria-label="Student menu"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-xs font-bold text-primary-foreground">
            {displayName.slice(0, 2).toUpperCase()}
          </span>
          <span className="hidden max-w-[100px] truncate text-sm font-medium md:inline">
            {displayName}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <p className="font-medium">{displayName}</p>
          {email ? <p className="text-xs font-normal text-muted-foreground">{email}</p> : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/student/profile">
            <User className="mr-2 h-4 w-4" /> My Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/student/id-card">
            <CreditCard className="mr-2 h-4 w-4" /> Digital ID Card
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/student/documents">
            <FileText className="mr-2 h-4 w-4" /> My Documents
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/student/support">
            <LifeBuoy className="mr-2 h-4 w-4" /> Support Ticket
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/student/settings">
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
