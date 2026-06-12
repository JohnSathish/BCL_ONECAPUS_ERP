'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardList, GraduationCap, LayoutDashboard, User, Wallet } from 'lucide-react';

import { cn } from '@/utils/cn';

const ITEMS = [
  { label: 'Home', href: '/student', icon: LayoutDashboard, exact: true },
  { label: 'Attendance', href: '/student/attendance', icon: ClipboardList },
  { label: 'LMS', href: '/student/lms', icon: GraduationCap },
  { label: 'Fees', href: '/student/fees', icon: Wallet },
  { label: 'Profile', href: '/student/profile', icon: User },
];

export function StudentMobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border bg-card/95 px-1 py-2 backdrop-blur-xl md:hidden"
      aria-label="Student mobile navigation"
    >
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[10px] font-medium transition',
              active ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <Icon
              className={cn('h-5 w-5', active && 'drop-shadow-[0_0_8px_hsl(var(--primary))]')}
            />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
