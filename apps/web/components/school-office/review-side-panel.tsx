'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';

export function SchoolOfficeReviewSidePanel({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  className,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end print:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        aria-label="Close review panel"
        onClick={onClose}
      />
      <aside
        className={cn(
          'relative flex h-full w-full max-w-lg flex-col border-l bg-white shadow-xl',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-[var(--school-erp-primary)]">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-0.5 text-sm text-[var(--school-erp-muted)]">{subtitle}</p>
            ) : null}
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer ? <div className="border-t bg-slate-50 px-4 py-3">{footer}</div> : null}
      </aside>
    </div>
  );
}
