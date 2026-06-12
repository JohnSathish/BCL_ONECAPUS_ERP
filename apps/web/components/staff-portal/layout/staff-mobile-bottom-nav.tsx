'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, ClipboardList, GraduationCap, LayoutDashboard, User } from 'lucide-react';

import { cn } from '@/utils/cn';

const ITEMS = [
  { label: 'Home', href: '/staff/dashboard', icon: LayoutDashboard },
  { label: 'Attendance', href: '/staff/attendance', icon: ClipboardList },
  { label: 'Classes', href: '/staff/academic/timetable', icon: BookOpen },
  { label: 'LMS', href: '/staff/academic/lms', icon: GraduationCap },
  { label: 'Profile', href: '/staff/profile', icon: User },
];

export function StaffMobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border/60 bg-card/95 px-1 py-1.5 shadow-[0_-4px_24px_hsl(var(--background)/0.8)] backdrop-blur-xl md:hidden"
      aria-label="Staff mobile navigation"
    >
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const active =
          pathname === item.href ||
          (item.href !== '/staff/dashboard' && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex min-h-[44px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-medium transition',
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
