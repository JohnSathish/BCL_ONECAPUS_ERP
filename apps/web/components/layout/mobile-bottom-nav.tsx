'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Menu, UserCheck } from 'lucide-react';
import { cn } from '@/utils/cn';

const ITEMS = [
  { label: 'Home', href: '/admin', icon: LayoutDashboard },
  { label: 'Admit', href: '/admin/admissions', icon: UserCheck },
  { label: 'More', href: '/admin/organization', icon: Menu },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border bg-card/95 px-2 py-2 backdrop-blur-xl md:hidden"
      aria-label="Mobile navigation"
    >
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-col items-center gap-0.5 rounded-xl px-4 py-2 text-[10px] font-medium transition',
              active ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <Icon
              className={cn('h-5 w-5', active && 'drop-shadow-[0_0_8px_hsl(var(--primary))]')}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
