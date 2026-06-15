'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CreditCard,
  Download,
  GraduationCap,
  Mail,
  MessageSquare,
  Printer,
  TrendingUp,
  X,
} from 'lucide-react';

import { buildBulkHref } from '@/components/students-module/directory/directory-utils';
import type { DirectoryFilters } from '@/components/students-module/directory/directory-filter-bar';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/utils/cn';

type Props = {
  selectedIds: Set<string>;
  filters: DirectoryFilters;
  canManage: boolean;
  canExport: boolean;
  onExportSelected?: () => void;
  exportPending?: boolean;
  onClearSelection: () => void;
};

export function DirectoryFloatingBulkBar({
  selectedIds,
  filters,
  canManage,
  canExport,
  onExportSelected,
  exportPending,
  onClearSelection,
}: Props) {
  const count = selectedIds.size;
  const promoteHref = buildBulkHref('/admin/students/promotion', selectedIds, filters);
  const subjectsHref = buildBulkHref('/admin/students/subject-registration', selectedIds, filters);

  return (
    <AnimatePresence>
      {count > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-4 left-1/2 z-40 w-[min(900px,calc(100vw-1.5rem))] -translate-x-1/2"
        >
          <div className="glass-card flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/20 px-3 py-2.5 shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-primary">
                {count} Student{count === 1 ? '' : 's'} Selected
              </span>
              <button
                type="button"
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={onClearSelection}
                aria-label="Clear selection"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {canManage ? (
                <>
                  <Link
                    href={subjectsHref}
                    className={cn(buttonVariants({ size: 'sm' }), 'h-7 rounded-lg text-[11px]')}
                  >
                    <GraduationCap className="mr-1 h-3 w-3" />
                    Assign Subjects
                  </Link>
                  <Link
                    href={promoteHref}
                    className={cn(
                      buttonVariants({ variant: 'outline', size: 'sm' }),
                      'h-7 rounded-lg text-[11px]',
                    )}
                  >
                    <TrendingUp className="mr-1 h-3 w-3" />
                    Promote Semester
                  </Link>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    disabled
                  >
                    <CreditCard className="mr-1 h-3 w-3" />
                    Generate ID Cards
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    disabled
                  >
                    <MessageSquare className="mr-1 h-3 w-3" />
                    Send SMS
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    disabled
                  >
                    <MessageSquare className="mr-1 h-3 w-3" />
                    Send WhatsApp
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    disabled
                  >
                    <Mail className="mr-1 h-3 w-3" />
                    Send Email
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    disabled
                  >
                    <Printer className="mr-1 h-3 w-3" />
                    Print Reports
                  </Button>
                </>
              ) : null}
              {canExport && onExportSelected ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px]"
                  disabled={exportPending}
                  onClick={onExportSelected}
                >
                  <Download className="mr-1 h-3 w-3" />
                  Export Excel
                </Button>
              ) : null}
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
