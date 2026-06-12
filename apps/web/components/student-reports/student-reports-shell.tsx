'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/utils/cn';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/admin/reports/students' },
  { label: 'Admission', href: '/admin/reports/students/admission' },
  { label: 'Academic', href: '/admin/reports/students/academic' },
  { label: 'Demographic', href: '/admin/reports/students/demographic' },
  { label: 'Department', href: '/admin/reports/students/department' },
  { label: 'NEP Buckets', href: '/admin/reports/students/nep' },
  { label: 'Contact', href: '/admin/reports/students/contact' },
  { label: 'Government', href: '/admin/reports/students/government' },
  { label: 'Statistical', href: '/admin/reports/students/statistical' },
  { label: 'Report Builder', href: '/admin/reports/students/builder', soon: true },
  { label: 'Saved Reports', href: '/admin/reports/students/saved', soon: true },
  { label: 'Scheduled', href: '/admin/reports/students/scheduled', soon: true },
  { label: 'Export Center', href: '/admin/reports/students/export' },
];

type Props = {
  children: React.ReactNode;
  title: string;
  description?: string;
  actions?: React.ReactNode;
};

export function StudentReportsShell({ children, title, description, actions }: Props) {
  const pathname = usePathname();

  return (
    <div className="space-y-4 print:space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {description ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>

      <nav
        className="flex gap-1 overflow-x-auto rounded-xl border border-border/60 bg-muted/30 p-1 print:hidden"
        aria-label="Student reports sections"
      >
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === '/admin/reports/students'
              ? pathname === item.href
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                active
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {item.label}
              {item.soon ? <span className="ml-1 text-[10px] text-amber-600">Soon</span> : null}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
