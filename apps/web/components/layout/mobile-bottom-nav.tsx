'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GraduationCap, IndianRupee, LayoutDashboard, Menu, Users } from 'lucide-react';
import { useDashboardUiStore } from '@/store/dashboard-ui-store';
import { cn } from '@/utils/cn';

const ITEMS = [
  { label: 'Home', href: '/admin', icon: LayoutDashboard, exact: true },
  { label: 'Students', href: '/admin/students', icon: Users },
  { label: 'Admit', href: '/admin/admissions', icon: GraduationCap },
  { label: 'Fees', href: '/admin/fees', icon: IndianRupee },
] as const;

export function MobileBottomNav() {
  const pathname = usePathname();
  const toggleMobileNavOpen = useDashboardUiStore((s) => s.toggleMobileNavOpen);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border/60 bg-card/95 px-1 py-1.5 shadow-[0_-4px_24px_hsl(var(--background)/0.8)] backdrop-blur-xl md:hidden"
      aria-label="Mobile navigation"
    >
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const active =
          'exact' in item && item.exact
            ? pathname === item.href
            : pathname === item.href || pathname?.startsWith(`${item.href}/`);
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
      <button
        type="button"
        onClick={toggleMobileNavOpen}
        className="flex min-h-[44px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-medium text-muted-foreground transition hover:text-primary"
        aria-label="Open full menu"
      >
        <Menu className="h-5 w-5" />
        <span className="truncate">Menu</span>
      </button>
    </nav>
  );
}
